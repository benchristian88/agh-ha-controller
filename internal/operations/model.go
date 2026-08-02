package operations

import (
	"context"
	"time"

	"github.com/benchristian88/agh-ha-controller/internal/domain"
)

type Command string

const (
	TestUpstreamDNS Command = "test_upstream_dns"
	ClearDNSCache   Command = "clear_dns_cache"

	ClearDNSCacheConfirmation = "CLEAR_DNS_CACHE"
)

type Target struct {
	Scope  string `json:"scope"`
	NodeID string `json:"nodeId,omitempty"`
}

type UpstreamInput struct {
	DraftVersion               int      `json:"draftVersion"`
	UpstreamDNS                []string `json:"upstreamDns"`
	BootstrapDNS               []string `json:"bootstrapDns"`
	FallbackDNS                []string `json:"fallbackDns"`
	PrivateReverseDNS          []string `json:"privateReverseDns"`
	UpstreamMode               string   `json:"upstreamMode"`
	UsePrivateReverseResolvers bool     `json:"usePrivateReverseResolvers"`
}

type ResolverResult struct {
	ResolverID string `json:"resolverId"`
	Status     string `json:"status"`
	ErrorCode  string `json:"errorCode,omitempty"`
}

type ExcludedNode struct {
	NodeID    string `json:"nodeId"`
	NodeName  string `json:"nodeName"`
	ErrorCode string `json:"errorCode"`
}

type NodeResult struct {
	ID                    string           `json:"id"`
	NodeID                string           `json:"nodeId"`
	NodeName              string           `json:"nodeName"`
	Position              int              `json:"position"`
	Status                string           `json:"status"`
	ErrorCode             string           `json:"errorCode,omitempty"`
	ResolverResults       []ResolverResult `json:"upstreamResults,omitempty"`
	ObservationStatus     string           `json:"observationStatus,omitempty"`
	ObservationSnapshotID string           `json:"observationSnapshotId,omitempty"`
	ObservationErrorCode  string           `json:"observationErrorCode,omitempty"`
	StartedAt             *time.Time       `json:"startedAt,omitempty"`
	CompletedAt           *time.Time       `json:"completedAt,omitempty"`
}

type Operation struct {
	ID               string                  `json:"id"`
	ClusterID        string                  `json:"clusterId"`
	ClusterName      string                  `json:"clusterName"`
	Command          Command                 `json:"command"`
	Target           Target                  `json:"target"`
	Status           string                  `json:"status"`
	RequestID        string                  `json:"requestId"`
	IdempotencyKey   string                  `json:"-"`
	RequestedBy      string                  `json:"-"`
	InputFingerprint string                  `json:"-"`
	Payload          domain.EncryptedPayload `json:"-"`
	AuditReference   string                  `json:"auditReference,omitempty"`
	RequestedAt      time.Time               `json:"requestedAt"`
	StartedAt        *time.Time              `json:"startedAt,omitempty"`
	CompletedAt      *time.Time              `json:"completedAt,omitempty"`
	NodeResults      []NodeResult            `json:"nodeResults"`
	ExcludedNodes    []ExcludedNode          `json:"excludedNodes"`
	Duplicate        bool                    `json:"duplicate,omitempty"`
}

type Executor interface {
	TestUpstreamDNS(context.Context, domain.NodeProbeRequest, UpstreamInput) ([]ResolverResult, error)
	ClearDNSCache(context.Context, domain.NodeProbeRequest) error
}

type PayloadProtector interface {
	EncryptPayload(string, []byte) (domain.EncryptedPayload, error)
	DecryptPayload(string, domain.EncryptedPayload) ([]byte, error)
}

type CredentialProtector interface {
	Decrypt(string, domain.EncryptedCredentials) (domain.NodeCredentials, error)
}
