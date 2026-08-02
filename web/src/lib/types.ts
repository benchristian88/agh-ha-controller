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
      protectionEnabled: boolean;
      rateLimit: number;
      rateLimitSubnetLengthIpv4: number;
      rateLimitSubnetLengthIpv6: number;
      rateLimitAllowlist: string[];
      blockingMode:
        | ""
        | "default"
        | "refused"
        | "nxdomain"
        | "null_ip"
        | "custom_ip";
      blockingIpv4: string;
      blockingIpv6: string;
      blockedResponseTtl: number;
      ednsClientSubnet: boolean;
      ednsUseCustom: boolean;
      ednsCustomIp: string;
      disableIpv6: boolean;
      dnssecEnabled: boolean;
      cacheSize: number;
      cacheEnabled: boolean;
      cacheTtlMin: number;
      cacheTtlMax: number;
      cacheOptimistic: boolean;
      upstreamMode: "" | "load_balance" | "fastest_addr" | "parallel";
      usePrivateReverseResolvers: boolean;
      resolveClients: boolean;
      upstreamTimeoutSeconds: number;
    };
    filtering: {
      enabled: boolean;
      updateIntervalHours: number;
      filterUrls: string[];
      whitelistUrls: string[];
      userRules: string[];
    };
    clients: PersistentClient[];
    rewritesEnabled: boolean;
    rewrites: Rewrite[];
    services: ServicesConfiguration;
    queryLog: QueryLogPolicy;
    statistics: StatisticsPolicy;
  };
  nodeSpecific: NodeSpecificConfiguration;
  observedOnly: {
    productVersion: string;
    tls: TlsStatus;
    dhcpLeases: DhcpLease[];
  };
  unsupported: { section: string; reason: string }[];
}

export interface SafeSearchConfiguration {
  enabled: boolean;
  bing: boolean;
  duckDuckGo: boolean;
  ecosia: boolean;
  google: boolean;
  pixabay: boolean;
  yandex: boolean;
  youTube: boolean;
}

export interface PersistentClient {
  name: string;
  ids: string[];
  useGlobalSettings: boolean;
  filteringEnabled: boolean;
  parentalEnabled: boolean;
  safeBrowsingEnabled: boolean;
  safeSearch: SafeSearchConfiguration;
  useGlobalBlockedServices: boolean;
  blockedServices: string[];
  blockedServicesSchedule: Schedule;
  upstreams: string[];
  upstreamsCacheEnabled: boolean;
  upstreamsCacheSize: number;
  tags: string[];
  ignoreQueryLog: boolean;
  ignoreStatistics: boolean;
}

export interface Rewrite {
  domain: string;
  answer: string;
  enabled: boolean;
}
export interface DayRange {
  start: number;
  end: number;
}
export interface Schedule {
  timeZone: string;
  days: Record<string, DayRange>;
}
export interface ServicesConfiguration {
  blockedServiceIds: string[];
  blockedSchedule: Schedule;
  safeBrowsing: boolean;
  parentalControl: boolean;
  safeSearch: SafeSearchConfiguration;
}
export interface BlockedServiceCatalogueService {
  id: string;
  name: string;
  groupId?: string;
  supportedNodeIds: string[];
  unsupportedNodeIds: string[];
}
export interface BlockedServiceCatalogueNode {
  nodeId: string;
  nodeName: string;
  version?: string;
  status: "available" | "stale" | "error" | "unsupported";
  serviceCount: number;
  fetchedAt?: string;
  errorCode?: string;
}
export interface BlockedServicesCatalogue {
  services: BlockedServiceCatalogueService[];
  groups: { id: string }[];
  nodes: BlockedServiceCatalogueNode[];
  generatedAt: string;
  stale: boolean;
  partial: boolean;
}
export interface FilterListMetadata {
  id: number;
  url: string;
  name: string;
  enabled: boolean;
  ruleCount: number;
  lastUpdated?: string;
  portable: boolean;
}
export interface FilterListPresentationNode {
  nodeId: string;
  nodeName: string;
  version?: string;
  status: "available" | "stale" | "error" | "unsupported";
  fetchedAt?: string;
  errorCode?: string;
  lists: FilterListMetadata[];
}
export interface FilterListPresentation {
  nodes: FilterListPresentationNode[];
  generatedAt: string;
  stale: boolean;
  partial: boolean;
}
export type BlocklistPresentation = FilterListPresentation;
export type AllowlistPresentation = FilterListPresentation;
export interface QueryLogPolicy {
  enabled: boolean;
  intervalMillis: number;
  anonymizeClientIp: boolean;
  ignored: string[];
  ignoredEnabled: boolean;
}
export interface StatisticsPolicy {
  enabled: boolean;
  intervalMillis: number;
  ignored: string[];
  ignoredEnabled: boolean;
}
export interface DhcpStaticLease {
  mac: string;
  ip: string;
  hostname: string;
}
export interface DhcpConfiguration {
  enabled: boolean;
  interfaceName: string;
  ipv4: {
    gateway: string;
    subnetMask: string;
    rangeStart: string;
    rangeEnd: string;
    leaseDurationSeconds: number;
  };
  ipv6: { rangeStart: string; leaseDurationSeconds: number };
  staticLeases: DhcpStaticLease[];
}
export interface NodeSpecificConfiguration {
  bindHosts: string[];
  dnsPort: number;
  dhcp?: DhcpConfiguration;
}
export interface DhcpLease {
  mac: string;
  ip: string;
  hostname: string;
  expiresAt: string;
}
export interface DhcpInterface {
  name: string;
  hardwareAddress?: string;
  ipv4Addresses: string[];
  ipv6Addresses: string[];
  gatewayIp?: string;
  flags: string[];
  available: boolean;
}
export interface DhcpInterfaces {
  nodeId: string;
  nodeName: string;
  interfaces: DhcpInterface[];
  fetchedAt: string;
}
export type DhcpCheckValueStatus = "yes" | "no" | "error" | "unavailable";
export interface DhcpCheckValue {
  status: DhcpCheckValueStatus;
  message?: string;
}
export interface DhcpActiveCheckResult {
  nodeId: string;
  nodeName: string;
  interfaceName: string;
  status: "none" | "found" | "multiple" | "partial" | "error";
  ipv4: DhcpCheckValue;
  ipv4StaticIp: { status: DhcpCheckValueStatus; ip?: string };
  ipv6: DhcpCheckValue;
  checkedAt: string;
}
export type DhcpOperationCommand =
  | "dhcp_reset_leases"
  | "dhcp_reset_configuration";
export interface DhcpOperationNodeResult {
  id: string;
  nodeId: string;
  nodeName: string;
  status: "running" | "succeeded" | "failed";
  errorCode?: string;
  startedAt: string;
  completedAt?: string;
}
export interface DhcpOperation {
  id: string;
  clusterId: string;
  clusterName: string;
  command: DhcpOperationCommand;
  status: "running" | "succeeded" | "failed";
  requestId: string;
  observationStatus: "not_run" | "succeeded" | "failed";
  observationSnapshotId?: string;
  observationErrorCode?: string;
  auditReference?: string;
  requestedAt: string;
  completedAt?: string;
  nodeResults: DhcpOperationNodeResult[];
  duplicate?: boolean;
}
export interface TlsStatus {
  enabled: boolean;
  serverName: string;
  forceHttps: boolean;
  httpsPort: number;
  dnsOverTlsPort: number;
  dnsOverQuicPort: number;
  servePlainDns: boolean;
  validCertificate: boolean;
  validChain: boolean;
  validKey: boolean;
  validPair: boolean;
  subject?: string;
  issuer?: string;
  notBefore?: string;
  notAfter?: string;
  dnsNames?: string[];
  warning?: string;
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

export type OperationalTarget =
  | { scope: "node"; nodeId: string }
  | { scope: "all_compatible_enabled_nodes" };

export interface DNSOperationalCommand {
  id: string;
  clusterId: string;
  clusterName: string;
  command: "test_upstream_dns" | "clear_dns_cache";
  target: OperationalTarget;
  status:
    | "queued"
    | "running"
    | "succeeded"
    | "partial_success"
    | "failed"
    | "interrupted";
  requestId: string;
  auditReference?: string;
  requestedAt: string;
  startedAt?: string;
  completedAt?: string;
  duplicate?: boolean;
  excludedNodes: {
    nodeId: string;
    nodeName: string;
    errorCode: string;
  }[];
  nodeResults: {
    id: string;
    nodeId: string;
    nodeName: string;
    position: number;
    status: "pending" | "running" | "succeeded" | "failed" | "skipped";
    errorCode?: string;
    upstreamResults?: {
      resolverId: string;
      status: "succeeded" | "failed";
      errorCode?: string;
    }[];
    observationStatus?: "not_run" | "succeeded" | "failed";
    observationSnapshotId?: string;
    observationErrorCode?: string;
  }[];
}
