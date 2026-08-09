import type {
  AllowlistPresentation,
  ApiErrorBody,
  AuditEvent,
  AuthResponse,
  BlockedServicesCatalogue,
  BlocklistPresentation,
  CapabilityProfile,
  CertificateHealth,
  CertificatePolicy,
  Cluster,
  ConfigurationDifference,
  ConfigurationDraft,
  ConfigurationRevision,
  ConfigurationSnapshot,
  Deployment,
  DeploymentPreview,
  DesiredConfigurationDocument,
  DhcpActiveCheckResult,
  DhcpInterfaces,
  DhcpOperation,
  DNSOperationalCommand,
  DriftEvent,
  HAEvent,
  HASummary,
  LifecycleSettings,
  MaintenancePreflight,
  Node,
  NodeLifecycle,
  NotificationChannel,
  OperationalStatus,
  OperationalTarget,
  QueryEvent,
  QueryEventPage,
  StatisticsReport,
  UpgradeOperation,
  ValidationIssue,
  VersionHealth,
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
  operationalStatus: (clusterId: string) =>
    request<OperationalStatus>(
      `/api/v1/clusters/${clusterId}/operational-status`,
    ),
  haStatus: (clusterId: string) =>
    request<HASummary>(`/api/v1/clusters/${clusterId}/ha-status`),
  haHistory: (clusterId: string, nodeId = "") => {
    const query = new URLSearchParams({ limit: "100" });
    if (nodeId) query.set("nodeId", nodeId);
    return request<{ items: HAEvent[] }>(
      `/api/v1/clusters/${clusterId}/ha-history?${query.toString()}`,
    );
  },
  certificates: (clusterId: string) =>
    request<{ items: CertificateHealth[] }>(
      `/api/v1/clusters/${clusterId}/certificates`,
    ),
  versions: (clusterId: string) =>
    request<{ items: VersionHealth[] }>(
      `/api/v1/clusters/${clusterId}/versions`,
    ),
  nodeLifecycle: (nodeId: string) =>
    request<NodeLifecycle>(`/api/v1/nodes/${nodeId}/lifecycle`),
  maintenancePreflight: (nodeId: string) =>
    request<MaintenancePreflight>(
      `/api/v1/nodes/${nodeId}/maintenance-preflight`,
    ),
  probeDNS: (nodeId: string) =>
    request<import("./types").DNSProbeResult>(
      `/api/v1/nodes/${nodeId}/dns-probe`,
      { method: "POST", body: "{}" },
    ),
  saveLifecycleSettings: (nodeId: string, settings: LifecycleSettings) =>
    request<LifecycleSettings>(`/api/v1/nodes/${nodeId}/lifecycle-settings`, {
      method: "PUT",
      body: JSON.stringify(settings),
    }),
  enterMaintenance: (node: Node, breakGlass = false, confirmation = "") =>
    request<Node>(`/api/v1/nodes/${node.id}/maintenance`, {
      method: "POST",
      body: JSON.stringify({
        enabled: true,
        recordVersion: node.recordVersion,
        breakGlass,
        confirmation,
      }),
    }),
  returnToService: (node: Node) =>
    request<{
      nodeId: string;
      succeeded: boolean;
      checks: import("./types").LifecycleCheck[];
    }>(`/api/v1/nodes/${node.id}/return-to-service`, {
      method: "POST",
      body: JSON.stringify({ recordVersion: node.recordVersion }),
    }),
  upgrades: (clusterId: string) =>
    request<{ items: UpgradeOperation[] }>(
      `/api/v1/clusters/${clusterId}/upgrades`,
    ),
  startUpgrade: (nodeId: string, targetVersion: string) =>
    request<UpgradeOperation>(`/api/v1/nodes/${nodeId}/upgrades`, {
      method: "POST",
      body: JSON.stringify({ targetVersion }),
    }),
  validateUpgrade: (upgradeId: string, recordVersion: number) =>
    request<UpgradeOperation>(`/api/v1/upgrades/${upgradeId}/validate`, {
      method: "POST",
      body: JSON.stringify({ recordVersion }),
    }),
  notificationChannels: (clusterId: string) =>
    request<{ items: NotificationChannel[] }>(
      `/api/v1/clusters/${clusterId}/notification-channels`,
    ),
  saveNotificationChannel: (
    clusterId: string,
    input: {
      id?: string;
      name: string;
      destination: string;
      enabled: boolean;
      recordVersion?: number;
    },
  ) =>
    request<NotificationChannel>(
      `/api/v1/clusters/${clusterId}/notification-channels`,
      {
        method: "POST",
        body: JSON.stringify({ id: "", recordVersion: 0, ...input }),
      },
    ),
  statistics: (clusterId: string, range: string, nodeId = "") => {
    const query = new URLSearchParams({ range, limit: "10" });
    if (nodeId !== "") query.set("nodeId", nodeId);
    return request<StatisticsReport>(
      `/api/v1/clusters/${clusterId}/statistics?${query.toString()}`,
    );
  },
  queryEvents: (
    clusterId: string,
    input: {
      nodeId?: string;
      cursor?: string;
      limit?: number;
      search?: string;
      status?: string;
      queryType?: string;
      client?: string;
    } = {},
  ) => {
    const query = new URLSearchParams({ limit: String(input.limit ?? 50) });
    if (input.nodeId) query.set("nodeId", input.nodeId);
    if (input.cursor) query.set("cursor", input.cursor);
    if (input.search) query.set("search", input.search);
    if (input.status) query.set("status", input.status);
    if (input.queryType) query.set("queryType", input.queryType);
    if (input.client) query.set("client", input.client);
    return request<QueryEventPage>(
      `/api/v1/clusters/${clusterId}/query-events?${query.toString()}`,
    );
  },
  queryEvent: (clusterId: string, eventId: string) =>
    request<QueryEvent>(
      `/api/v1/clusters/${clusterId}/query-events/${eventId}`,
    ),
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
  testUpstreamDNS: (
    clusterId: string,
    target: OperationalTarget,
    input: {
      draftVersion: number;
      upstreamDns: string[];
      bootstrapDns: string[];
      fallbackDns: string[];
      privateReverseDns: string[];
      upstreamMode: string;
      usePrivateReverseResolvers: boolean;
    },
    idempotencyKey: string,
  ) =>
    request<DNSOperationalCommand>(
      `/api/v1/clusters/${clusterId}/operational-commands/test-upstream-dns`,
      {
        method: "POST",
        headers: { "Idempotency-Key": idempotencyKey },
        body: JSON.stringify({ target, input }),
      },
    ),
  clearDNSCache: (
    clusterId: string,
    target: OperationalTarget,
    idempotencyKey: string,
  ) =>
    request<DNSOperationalCommand>(
      `/api/v1/clusters/${clusterId}/operational-commands/clear-dns-cache`,
      {
        method: "POST",
        headers: { "Idempotency-Key": idempotencyKey },
        body: JSON.stringify({ target, confirmation: "CLEAR_DNS_CACHE" }),
      },
    ),
  testHostFiltering: (
    clusterId: string,
    target: OperationalTarget,
    input: { hostname: string; client?: string; queryType?: string },
    idempotencyKey: string,
  ) =>
    request<DNSOperationalCommand>(
      `/api/v1/clusters/${clusterId}/operational-commands/test-host-filtering`,
      {
        method: "POST",
        headers: { "Idempotency-Key": idempotencyKey },
        body: JSON.stringify({ target, input }),
      },
    ),
  clearQueryLog: (
    clusterId: string,
    target: OperationalTarget,
    idempotencyKey: string,
  ) =>
    request<DNSOperationalCommand>(
      `/api/v1/clusters/${clusterId}/operational-commands/clear-query-log`,
      {
        method: "POST",
        headers: { "Idempotency-Key": idempotencyKey },
        body: JSON.stringify({ target, confirmation: "CLEAR_QUERY_LOG" }),
      },
    ),
  resetStatistics: (
    clusterId: string,
    target: OperationalTarget,
    idempotencyKey: string,
  ) =>
    request<DNSOperationalCommand>(
      `/api/v1/clusters/${clusterId}/operational-commands/reset-statistics`,
      {
        method: "POST",
        headers: { "Idempotency-Key": idempotencyKey },
        body: JSON.stringify({ target, confirmation: "RESET_STATISTICS" }),
      },
    ),
  dnsOperation: (operationId: string) =>
    request<DNSOperationalCommand>(
      `/api/v1/operational-commands/${operationId}`,
    ),
  dnsOperations: (
    clusterId: string,
    command?: DNSOperationalCommand["command"],
  ) =>
    request<{ items: DNSOperationalCommand[] }>(
      `/api/v1/clusters/${clusterId}/operational-commands?limit=10${command ? `&command=${command}` : ""}`,
    ),
  dhcpInterfaces: (nodeId: string) =>
    request<DhcpInterfaces>(`/api/v1/nodes/${nodeId}/dhcp/interfaces`),
  checkActiveDhcp: (nodeId: string, interfaceName: string) =>
    request<DhcpActiveCheckResult>(
      `/api/v1/nodes/${nodeId}/dhcp/active-check`,
      {
        method: "POST",
        body: JSON.stringify({ interfaceName }),
      },
    ),
  resetDhcpLeases: (
    nodeId: string,
    confirmation: string,
    idempotencyKey: string,
  ) =>
    request<DhcpOperation>(`/api/v1/nodes/${nodeId}/dhcp/reset-leases`, {
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey },
      body: JSON.stringify({ confirmation }),
    }),
  resetDhcpConfiguration: (
    nodeId: string,
    confirmation: string,
    idempotencyKey: string,
  ) =>
    request<DhcpOperation>(`/api/v1/nodes/${nodeId}/dhcp/reset-configuration`, {
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey },
      body: JSON.stringify({ confirmation }),
    }),
  dhcpOperations: (nodeId: string) =>
    request<{ items: DhcpOperation[] }>(
      `/api/v1/nodes/${nodeId}/dhcp/operations?limit=10`,
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
  blockedServicesCatalogue: (clusterId: string) =>
    request<BlockedServicesCatalogue>(
      `/api/v1/clusters/${clusterId}/blocked-services/catalogue`,
    ),
  blocklistPresentation: (clusterId: string) =>
    request<BlocklistPresentation>(
      `/api/v1/clusters/${clusterId}/blocklists/presentation`,
    ),
  allowlistPresentation: (clusterId: string) =>
    request<AllowlistPresentation>(
      `/api/v1/clusters/${clusterId}/allowlists/presentation`,
    ),
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
