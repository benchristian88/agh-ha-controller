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
  reconciliationPolicy: "enforce" | "alert" | "manual";
  activeRevisionId?: string;
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
  maintenanceMode: boolean;
  appliedRevisionId?: string;
  appliedHash?: string;
  convergenceStatus:
    | "pending"
    | "converged"
    | "drifted"
    | "applying"
    | "verifying"
    | "apply_failed"
    | "observation_failed"
    | "unsupported"
    | "maintenance";
  lastReconciledAt?: string;
  recordVersion: number;
  createdAt: string;
  updatedAt: string;
}

export interface DesiredConfigurationDocument {
  schemaVersion: number;
  shared: ConfigurationDocument["shared"];
  nodeOverrides: Record<string, ConfigurationDocument["nodeSpecific"]>;
  unsupported: ConfigurationDocument["unsupported"];
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
  baseRevisionId?: string;
  document: DesiredConfigurationDocument;
  canonicalHash: string;
  version: number;
  updatedAt: string;
}

export interface ValidationIssue {
  field: string;
  message: string;
}

export interface ConfigurationRevision {
  id: string;
  clusterId: string;
  revisionNumber: number;
  schemaVersion: number;
  document: DesiredConfigurationDocument;
  canonicalHash: string;
  summary: string;
  createdBy: string;
  createdAt: string;
  active: boolean;
}

export interface DeploymentNode {
  id: string;
  deploymentId: string;
  nodeId: string;
  position: number;
  effectiveHash: string;
  status: string;
  attemptCount: number;
  startedAt?: string;
  completedAt?: string;
  errorCode?: string;
  errorMessage?: string;
  verificationSnapshotId?: string;
}

export interface Deployment {
  id: string;
  clusterId: string;
  revisionId: string;
  status: string;
  strategy: "sequential";
  failurePolicy: "stop";
  origin: "manual" | "rollback" | "reconciliation";
  rollbackOfRevisionId?: string;
  requestId: string;
  cancelRequested: boolean;
  errorCode?: string;
  requestedAt: string;
  startedAt?: string;
  completedAt?: string;
  nodes: DeploymentNode[];
}

export interface DeploymentPreview {
  revisionId: string;
  strategy: string;
  failurePolicy: string;
  differences: ConfigurationDifference[];
  restartRequired: boolean;
  valid: boolean;
  issues: ValidationIssue[];
  nodes: {
    nodeId: string;
    position: number;
    effectiveHash: string;
    valid: boolean;
    warning?: string;
  }[];
}

export interface DriftEvent {
  id: string;
  clusterId: string;
  nodeId: string;
  desiredRevisionId: string;
  desiredHash: string;
  observedSnapshotId: string;
  observedHash: string;
  fingerprint: string;
  status: "open" | "resolved";
  policy: "enforce" | "alert" | "manual";
  reconciliationStatus: string;
  differences: ConfigurationDifference[];
  detectedAt: string;
  lastSeenAt: string;
  resolvedAt?: string;
  resolution?: string;
  relatedDeploymentId?: string;
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
