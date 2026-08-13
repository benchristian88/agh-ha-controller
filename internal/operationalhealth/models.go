package operationalhealth

import "time"

import "github.com/benchristian88/atlas-dns/internal/haoperations"

type State string

const (
	Healthy     State = "healthy"
	Degraded    State = "degraded"
	Stale       State = "stale"
	Failed      State = "failed"
	Paused      State = "paused"
	Unsupported State = "unsupported"
	Maintenance State = "maintenance"
	Unknown     State = "unknown"
)

type Worker struct {
	Name                string     `json:"name"`
	State               State      `json:"state"`
	Running             bool       `json:"running"`
	LastAttemptAt       *time.Time `json:"lastAttemptAt,omitempty"`
	LastSuccessAt       *time.Time `json:"lastSuccessAt,omitempty"`
	LastFailureAt       *time.Time `json:"lastFailureAt,omitempty"`
	ConsecutiveFailures int        `json:"consecutiveFailures"`
	NextScheduledAt     *time.Time `json:"nextScheduledAt,omitempty"`
	CurrentDurationMS   int64      `json:"currentDurationMs,omitempty"`
	ErrorCode           string     `json:"errorCode,omitempty"`
	RunsTotal           uint64     `json:"runsTotal"`
	FailuresTotal       uint64     `json:"failuresTotal"`
}

type NodeSubsystem struct {
	NodeID                string     `json:"nodeId"`
	NodeName              string     `json:"nodeName"`
	State                 State      `json:"state"`
	LastAttemptAt         *time.Time `json:"lastAttemptAt,omitempty"`
	LastSuccessAt         *time.Time `json:"lastSuccessAt,omitempty"`
	NextScheduledAt       *time.Time `json:"nextScheduledAt,omitempty"`
	LagSeconds            *int64     `json:"lagSeconds,omitempty"`
	ConsecutiveFailures   int        `json:"consecutiveFailures"`
	ErrorCode             string     `json:"errorCode,omitempty"`
	GapDetected           bool       `json:"gapDetected,omitempty"`
	GapReason             string     `json:"gapReason,omitempty"`
	RecordsReceived       int        `json:"recordsReceived,omitempty"`
	CapabilityState       State      `json:"capabilityState,omitempty"`
	CapabilityRefreshedAt *time.Time `json:"capabilityRefreshedAt,omitempty"`
	counted               bool
}

type CollectionSummary struct {
	State            State           `json:"state"`
	ExpectedNodes    int             `json:"expectedNodes"`
	CurrentNodes     int             `json:"currentNodes"`
	StaleNodes       int             `json:"staleNodes"`
	UnsupportedNodes int             `json:"unsupportedNodes"`
	CoveragePercent  float64         `json:"coveragePercent"`
	Nodes            []NodeSubsystem `json:"nodes"`
}

type StorageDataset struct {
	Name             string     `json:"name"`
	EstimatedRows    int64      `json:"estimatedRows"`
	ApproximateBytes int64      `json:"approximateBytes"`
	RetentionSeconds int64      `json:"retentionSeconds"`
	OldestRetainedAt *time.Time `json:"oldestRetainedAt,omitempty"`
	NewestRetainedAt *time.Time `json:"newestRetainedAt,omitempty"`
}

type Database struct {
	State         State            `json:"state"`
	PingLatencyMS int64            `json:"pingLatencyMs"`
	SchemaVersion int64            `json:"schemaVersion"`
	DatabaseBytes int64            `json:"databaseBytes"`
	PoolTotal     int32            `json:"poolTotal"`
	PoolAcquired  int32            `json:"poolAcquired"`
	PoolMax       int32            `json:"poolMax"`
	Datasets      []StorageDataset `json:"datasets"`
	ErrorCode     string           `json:"errorCode,omitempty"`
}

type Summary struct {
	State          State  `json:"state"`
	ActionRequired bool   `json:"actionRequired"`
	Message        string `json:"message"`
	HealthyNodes   int    `json:"healthyNodes"`
	ExpectedNodes  int    `json:"expectedNodes"`
}

type Status struct {
	GeneratedAt time.Time              `json:"generatedAt"`
	ClusterID   string                 `json:"clusterId"`
	Summary     Summary                `json:"summary"`
	API         State                  `json:"api"`
	Database    Database               `json:"database"`
	Nodes       []NodeSubsystem        `json:"nodes"`
	DNSService  CollectionSummary      `json:"dnsService"`
	HA          haoperations.HASummary `json:"ha"`
	Observation CollectionSummary      `json:"observation"`
	Statistics  CollectionSummary      `json:"statistics"`
	QueryLog    CollectionSummary      `json:"queryLog"`
	Workers     []Worker               `json:"workers"`
}
