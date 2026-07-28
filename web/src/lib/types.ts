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

export interface ConfigurationDocument {
  schemaVersion: number;
  shared: {
    dns: {
      upstreamDns: string[];
      bootstrapDns: string[];
      fallbackDns: string[];
      privateReverseDns: string[];
    };
    filtering: {
      enabled: boolean;
      updateIntervalHours: number;
      filterUrls: string[];
      userRules: string[];
    };
  };
  nodeSpecific: { bindHosts: string[]; dnsPort: number };
  observedOnly: { productVersion: string };
  unsupported: { section: string; reason: string }[];
}

export interface ConfigurationSnapshot {
  id: string;
  nodeId: string;
  observedAt: string;
  schemaVersion: number;
  document?: ConfigurationDocument;
  canonicalHash?: string;
  nodeVersion?: string;
  collectionStatus: "succeeded" | "failed";
  errorCode?: string;
}

export interface CapabilityProfile {
  nodeId: string;
  productVersion: string;
  compatibility: string;
  schemaVersion: number;
  features: Record<string, boolean>;
  warnings: string[];
  refreshedAt: string;
}

export interface ConfigurationDraft {
  id: string;
  clusterId: string;
  sourceSnapshotId: string;
  schemaVersion: number;
  document: ConfigurationDocument;
  canonicalHash: string;
  version: number;
  updatedAt: string;
}

export interface ConfigurationDifference {
  section: string;
  field: string;
  scope:
    | "shared_managed"
    | "node_specific_managed"
    | "observed_only"
    | "unsupported";
  left: unknown;
  right: unknown;
  summary: string;
}

export interface ApiErrorBody {
  code: string;
  message: string;
  field?: string;
  requestId: string;
}
