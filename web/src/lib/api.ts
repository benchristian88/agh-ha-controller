import type {
  ApiErrorBody,
  AuditEvent,
  AuthResponse,
  CapabilityProfile,
  CertificatePolicy,
  Cluster,
  ConfigurationDifference,
  ConfigurationDraft,
  ConfigurationRevision,
  ConfigurationSnapshot,
  Deployment,
  DeploymentPreview,
  DesiredConfigurationDocument,
  DriftEvent,
  Node,
  ValidationIssue,
} from "./types";

export class ApiError extends Error {
  readonly code: string;
  readonly field?: string;
  readonly requestId: string;
  readonly status: number;

  constructor(status: number, body: ApiErrorBody) {
    super(body.message);
    this.name = "ApiError";
    this.code = body.code;
    this.field = body.field;
    this.requestId = body.requestId;
    this.status = status;
  }
}

function cookie(name: string): string {
  const prefix = `${encodeURIComponent(name)}=`;
  for (const part of document.cookie.split(";")) {
    const value = part.trim();
    if (value.startsWith(prefix)) {
      return decodeURIComponent(value.slice(prefix.length));
    }
  }
  return "";
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const method = options.method ?? "GET";
  const headers = new Headers(options.headers);
  headers.set("Accept", "application/json");
  if (options.body !== undefined) {
    headers.set("Content-Type", "application/json");
  }
  if (!["GET", "HEAD", "OPTIONS"].includes(method.toUpperCase())) {
    headers.set("X-CSRF-Token", cookie("aghha_csrf"));
  }
  const response = await fetch(path, {
    ...options,
    headers,
    credentials: "same-origin",
  });
  if (!response.ok) {
    const fallback: ApiErrorBody = {
      code: "HTTP_ERROR",
      message: `Request failed with status ${response.status}.`,
      requestId: response.headers.get("X-Request-ID") ?? "unknown",
    };
    let body = fallback;
    try {
      const payload = (await response.json()) as { error?: ApiErrorBody };
      if (payload.error !== undefined) body = payload.error;
    } catch {
      // The stable fallback avoids exposing an untrusted HTML error body.
    }
    throw new ApiError(response.status, body);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export interface NodePayload {
  name: string;
  baseUrl: string;
  certificatePolicy: CertificatePolicy;
  customCaPem?: string;
  credentials?: { username: string; password: string };
  enabled: boolean;
  recordVersion?: number;
}

export const api = {
  setupStatus: () =>
    request<{
      setupRequired: boolean;
      publicBaseUrl: string;
      controllerTime: string;
      secureCookies: boolean;
      checks: Record<string, string>;
    }>("/api/v1/setup/status"),
  setup: (input: { email: string; displayName: string; password: string }) =>
    request<AuthResponse>("/api/v1/setup", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  login: (input: { email: string; password: string }) =>
    request<AuthResponse>("/api/v1/auth/login", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  me: () => request<AuthResponse>("/api/v1/auth/me"),
  logout: () =>
    request<void>("/api/v1/auth/logout", { method: "POST", body: "{}" }),
  clusters: () => request<{ items: Cluster[] }>("/api/v1/clusters"),
  createCluster: (input: { name: string; description: string }) =>
    request<Cluster>("/api/v1/clusters", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  updateCluster: (cluster: Cluster) =>
    request<Cluster>(`/api/v1/clusters/${cluster.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        name: cluster.name,
        description: cluster.description,
        reconciliationPolicy: cluster.reconciliationPolicy,
        version: cluster.version,
      }),
    }),
  nodes: (clusterId: string) =>
    request<{
      items: Node[];
      refreshedAt: string;
      staleAfterSeconds: number;
    }>(`/api/v1/clusters/${clusterId}/nodes`),
  createNode: (clusterId: string, input: NodePayload) =>
    request<Node>(`/api/v1/clusters/${clusterId}/nodes`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  updateNode: (nodeId: string, input: NodePayload) =>
    request<Node>(`/api/v1/nodes/${nodeId}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  deleteNode: (node: Node, confirmName: string) =>
    request<void>(`/api/v1/nodes/${node.id}`, {
      method: "DELETE",
      body: JSON.stringify({ recordVersion: node.recordVersion, confirmName }),
    }),
  testNode: (nodeId: string) =>
    request<{
      version: string;
      compatibility: string;
      running: boolean;
      latencyMs: number;
    }>(`/api/v1/nodes/${nodeId}/test-connection`, {
      method: "POST",
      body: "{}",
    }),
  observeNode: (nodeId: string) =>
    request<ConfigurationSnapshot>(`/api/v1/nodes/${nodeId}/observations`, {
      method: "POST",
      body: "{}",
    }),
  refreshFilters: (nodeId: string, whitelist: boolean) =>
    request<{ nodeId: string; whitelist: boolean; status: "succeeded" }>(
      `/api/v1/nodes/${nodeId}/filter-refresh`,
      { method: "POST", body: JSON.stringify({ whitelist }) },
    ),
  setNodeMaintenance: (node: Node, enabled: boolean) =>
    request<Node>(`/api/v1/nodes/${node.id}/maintenance`, {
      method: "POST",
      body: JSON.stringify({ enabled, recordVersion: node.recordVersion }),
    }),
  configurationInventory: (clusterId: string) =>
    request<{
      schemaVersion: number;
      snapshots: ConfigurationSnapshot[];
      capabilities: CapabilityProfile[];
      draft?: ConfigurationDraft;
    }>(`/api/v1/clusters/${clusterId}/configuration-inventory`),
  compareConfigurations: (leftSnapshotId: string, rightSnapshotId: string) =>
    request<{ equal: boolean; differences: ConfigurationDifference[] }>(
      `/api/v1/configuration-comparisons?leftSnapshotId=${encodeURIComponent(leftSnapshotId)}&rightSnapshotId=${encodeURIComponent(rightSnapshotId)}`,
    ),
  importConfiguration: (
    clusterId: string,
    snapshotId: string,
    expectedVersion: number,
  ) =>
    request<ConfigurationDraft>(
      `/api/v1/clusters/${clusterId}/configuration-draft/import`,
      {
        method: "POST",
        body: JSON.stringify({ snapshotId, expectedVersion, confirmed: true }),
      },
    ),
  updateConfigurationDraft: (
    clusterId: string,
    expectedVersion: number,
    document: DesiredConfigurationDocument,
  ) =>
    request<{ draft: ConfigurationDraft; issues: ValidationIssue[] }>(
      `/api/v1/clusters/${clusterId}/configuration-draft`,
      {
        method: "PUT",
        body: JSON.stringify({ expectedVersion, document }),
      },
    ),
  validateConfigurationDraft: (clusterId: string) =>
    request<DeploymentPreview>(
      `/api/v1/clusters/${clusterId}/configuration-draft/validate`,
      { method: "POST", body: "{}" },
    ),
  publishConfigurationRevision: (
    clusterId: string,
    expectedVersion: number,
    summary: string,
  ) =>
    request<ConfigurationRevision>(
      `/api/v1/clusters/${clusterId}/configuration-revisions`,
      {
        method: "POST",
        body: JSON.stringify({ expectedVersion, summary }),
      },
    ),
  configurationRevisions: (clusterId: string) =>
    request<{ items: ConfigurationRevision[] }>(
      `/api/v1/clusters/${clusterId}/configuration-revisions`,
    ),
  compareConfigurationRevisions: (
    leftRevisionId: string,
    rightRevisionId: string,
  ) =>
    request<{ equal: boolean; differences: ConfigurationDifference[] }>(
      `/api/v1/configuration-revision-comparisons?leftRevisionId=${encodeURIComponent(leftRevisionId)}&rightRevisionId=${encodeURIComponent(rightRevisionId)}`,
    ),
  deploymentPreview: (clusterId: string, revisionId: string) =>
    request<DeploymentPreview>(
      `/api/v1/clusters/${clusterId}/configuration-revisions/${revisionId}/deployment-preview`,
      { method: "POST", body: "{}" },
    ),
  startDeployment: (clusterId: string, revisionId: string) =>
    request<Deployment>(
      `/api/v1/clusters/${clusterId}/configuration-revisions/${revisionId}/deployments`,
      { method: "POST", body: JSON.stringify({ targetNodeIds: [] }) },
    ),
  rollback: (clusterId: string, revisionId: string) =>
    request<Deployment>(
      `/api/v1/clusters/${clusterId}/configuration-revisions/${revisionId}/rollback`,
      { method: "POST", body: JSON.stringify({ confirmed: true }) },
    ),
  deployments: (clusterId: string) =>
    request<{ items: Deployment[] }>(
      `/api/v1/clusters/${clusterId}/deployments`,
    ),
  deployment: (deploymentId: string) =>
    request<Deployment>(`/api/v1/deployments/${deploymentId}`),
  cancelDeployment: (deploymentId: string) =>
    request<void>(`/api/v1/deployments/${deploymentId}/cancel`, {
      method: "POST",
      body: "{}",
    }),
  driftEvents: (clusterId: string) =>
    request<{ items: DriftEvent[] }>(
      `/api/v1/clusters/${clusterId}/drift-events`,
    ),
  restoreDrift: (driftId: string) =>
    request<Deployment>(`/api/v1/drift-events/${driftId}/restore`, {
      method: "POST",
      body: "{}",
    }),
  adoptDrift: (driftId: string, expectedDraftVersion: number) =>
    request<ConfigurationDraft>(`/api/v1/drift-events/${driftId}/adopt`, {
      method: "POST",
      body: JSON.stringify({ expectedDraftVersion }),
    }),
  auditEvents: () =>
    request<{ items: AuditEvent[] }>("/api/v1/audit-events?limit=100"),
};
