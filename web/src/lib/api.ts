import type {
  ApiErrorBody,
  AuditEvent,
  AuthResponse,
  CertificatePolicy,
  Cluster,
  Node,
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
  auditEvents: () =>
    request<{ items: AuditEvent[] }>("/api/v1/audit-events?limit=100"),
};
