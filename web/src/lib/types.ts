export interface User {
  id: string;
  email: string;
  displayName: string;
  role: "administrator";
}

export interface AuthResponse {
  user: User;
  expiresAt: string;
}

export interface Cluster {
  id: string;
  name: string;
  description: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export type HealthStatus =
  | "unknown"
  | "healthy"
  | "unreachable"
  | "incompatible"
  | "disabled";
export type CertificatePolicy = "system" | "custom_ca" | "insecure_http";

export interface Node {
  id: string;
  clusterId: string;
  name: string;
  baseUrl: string;
  certificatePolicy: CertificatePolicy;
  enabled: boolean;
  healthStatus: HealthStatus;
  compatibilityStatus: "unknown" | "supported" | "unsupported";
  version?: string;
  lastSeenAt?: string;
  lastPolledAt?: string;
  latencyMs?: number;
  lastErrorCode?: string;
  recordVersion: number;
  createdAt: string;
  updatedAt: string;
}

export interface AuditEvent {
  id: string;
  actorType: "user" | "system" | "anonymous";
  actorUserId?: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  requestId: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface ApiErrorBody {
  code: string;
  message: string;
  field?: string;
  requestId: string;
}
