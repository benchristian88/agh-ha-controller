package controlplane

import (
	"time"

	"github.com/benchristian88/agh-ha-controller/internal/configuration"
)

type Revision struct {
	ID             string                        `json:"id"`
	ClusterID      string                        `json:"clusterId"`
	RevisionNumber int                           `json:"revisionNumber"`
	SchemaVersion  int                           `json:"schemaVersion"`
	Document       configuration.DesiredDocument `json:"document"`
	CanonicalHash  string                        `json:"canonicalHash"`
	Summary        string                        `json:"summary"`
	CreatedBy      string                        `json:"createdBy"`
	CreatedAt      time.Time                     `json:"createdAt"`
	Active         bool                          `json:"active"`
}

type Deployment struct {
	ID                   string           `json:"id"`
	ClusterID            string           `json:"clusterId"`
	RevisionID           string           `json:"revisionId"`
	Status               string           `json:"status"`
	Strategy             string           `json:"strategy"`
	FailurePolicy        string           `json:"failurePolicy"`
	Origin               string           `json:"origin"`
	RollbackOfRevisionID *string          `json:"rollbackOfRevisionId,omitempty"`
	RequestedBy          *string          `json:"requestedBy,omitempty"`
	RequestID            string           `json:"requestId"`
	CancelRequested      bool             `json:"cancelRequested"`
	ErrorCode            string           `json:"errorCode,omitempty"`
	RequestedAt          time.Time        `json:"requestedAt"`
	StartedAt            *time.Time       `json:"startedAt,omitempty"`
	CompletedAt          *time.Time       `json:"completedAt,omitempty"`
	Nodes                []DeploymentNode `json:"nodes"`
}

type DeploymentNode struct {
	ID                     string     `json:"id"`
	DeploymentID           string     `json:"deploymentId"`
	NodeID                 string     `json:"nodeId"`
	Position               int        `json:"position"`
	EffectiveHash          string     `json:"effectiveHash"`
	Status                 string     `json:"status"`
	AttemptCount           int        `json:"attemptCount"`
	StartedAt              *time.Time `json:"startedAt,omitempty"`
	CompletedAt            *time.Time `json:"completedAt,omitempty"`
	ErrorCode              string     `json:"errorCode,omitempty"`
	ErrorMessage           string     `json:"errorMessage,omitempty"`
	VerificationSnapshotID *string    `json:"verificationSnapshotId,omitempty"`
}

type DriftEvent struct {
	ID                   string                     `json:"id"`
	ClusterID            string                     `json:"clusterId"`
	NodeID               string                     `json:"nodeId"`
	DesiredRevisionID    string                     `json:"desiredRevisionId"`
	DesiredHash          string                     `json:"desiredHash"`
	ObservedSnapshotID   string                     `json:"observedSnapshotId"`
	ObservedHash         string                     `json:"observedHash"`
	Fingerprint          string                     `json:"fingerprint"`
	Status               string                     `json:"status"`
	Policy               string                     `json:"policy"`
	ReconciliationStatus string                     `json:"reconciliationStatus"`
	Differences          []configuration.Difference `json:"differences"`
	DetectedAt           time.Time                  `json:"detectedAt"`
	LastSeenAt           time.Time                  `json:"lastSeenAt"`
	ResolvedAt           *time.Time                 `json:"resolvedAt,omitempty"`
	Resolution           string                     `json:"resolution,omitempty"`
	RelatedDeploymentID  *string                    `json:"relatedDeploymentId,omitempty"`
}

type Preview struct {
	RevisionID      string                          `json:"revisionId"`
	Strategy        string                          `json:"strategy"`
	FailurePolicy   string                          `json:"failurePolicy"`
	Differences     []configuration.Difference      `json:"differences"`
	RestartRequired bool                            `json:"restartRequired"`
	Valid           bool                            `json:"valid"`
	Issues          []configuration.ValidationIssue `json:"issues"`
	Nodes           []PreviewNode                   `json:"nodes"`
}

type PreviewNode struct {
	NodeID        string `json:"nodeId"`
	Position      int    `json:"position"`
	EffectiveHash string `json:"effectiveHash"`
	Valid         bool   `json:"valid"`
	Warning       string `json:"warning,omitempty"`
}
