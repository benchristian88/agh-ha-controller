package inventory

import (
	"context"
	"errors"
	"time"

	"github.com/benchristian88/agh-ha-controller/internal/configuration"
	"github.com/benchristian88/agh-ha-controller/internal/domain"
)

type CapabilityProfile struct {
	NodeID         string          `json:"nodeId"`
	ProductVersion string          `json:"productVersion"`
	Compatibility  string          `json:"compatibility"`
	SchemaVersion  int             `json:"schemaVersion"`
	Features       map[string]bool `json:"features"`
	Warnings       []string        `json:"warnings"`
	RefreshedAt    time.Time       `json:"refreshedAt"`
}

type Snapshot struct {
	ID               string                  `json:"id"`
	NodeID           string                  `json:"nodeId"`
	ObservedAt       time.Time               `json:"observedAt"`
	SchemaVersion    int                     `json:"schemaVersion"`
	Document         *configuration.Document `json:"document,omitempty"`
	CanonicalHash    string                  `json:"canonicalHash,omitempty"`
	NodeVersion      string                  `json:"nodeVersion,omitempty"`
	CollectionStatus string                  `json:"collectionStatus"`
	ErrorCode        string                  `json:"errorCode,omitempty"`
}

type Draft struct {
	ID               string                 `json:"id"`
	ClusterID        string                 `json:"clusterId"`
	SourceSnapshotID string                 `json:"sourceSnapshotId"`
	SchemaVersion    int                    `json:"schemaVersion"`
	Document         configuration.Document `json:"document"`
	CanonicalHash    string                 `json:"canonicalHash"`
	Version          int                    `json:"version"`
	UpdatedBy        string                 `json:"updatedBy"`
	UpdatedAt        time.Time              `json:"updatedAt"`
}

type Reader interface {
	ReadConfiguration(context.Context, domain.NodeProbeRequest, string) (configuration.Document, CapabilityProfile, error)
}

type Repository interface {
	domain.ManagementRepository
	SaveObservation(context.Context, Snapshot, CapabilityProfile) error
	LatestSnapshots(context.Context, string) ([]Snapshot, error)
	SnapshotByID(context.Context, string) (Snapshot, error)
	CapabilityProfiles(context.Context, string) ([]CapabilityProfile, error)
	DraftByCluster(context.Context, string) (Draft, error)
	ImportDraft(context.Context, Draft, int, domain.AuditEvent) error
}

type CredentialProtector interface {
	Decrypt(string, domain.EncryptedCredentials) (domain.NodeCredentials, error)
}

type Service struct {
	repository  Repository
	credentials CredentialProtector
	reader      Reader
	now         func() time.Time
}

func NewService(repository Repository, credentials CredentialProtector, reader Reader) *Service {
	return &Service{repository: repository, credentials: credentials, reader: reader, now: time.Now}
}

func (s *Service) Observe(ctx context.Context, nodeID string) (Snapshot, error) {
	if !domain.ValidID(nodeID) {
		return Snapshot{}, domain.Validation("nodeId", "must be a valid UUID")
	}
	record, err := s.repository.NodeRecordByID(ctx, nodeID)
	if err != nil {
		return Snapshot{}, err
	}
	if !record.Node.Enabled {
		return Snapshot{}, domain.Validation("nodeId", "disabled nodes cannot be observed")
	}
	credentials, err := s.credentials.Decrypt(nodeID, record.Secrets.Credentials)
	if err != nil {
		return Snapshot{}, errors.New("stored node credentials could not be decrypted")
	}
	id, err := domain.NewID()
	if err != nil {
		return Snapshot{}, err
	}
	now := s.now().UTC()
	request := domain.NodeProbeRequest{BaseURL: record.Node.BaseURL, CertificatePolicy: record.Node.CertificatePolicy, CustomCAPEM: record.Secrets.CustomCAPEM, Credentials: credentials}
	document, capability, readErr := s.reader.ReadConfiguration(ctx, request, record.Node.Version)
	snapshot := Snapshot{ID: id, NodeID: nodeID, ObservedAt: now, SchemaVersion: configuration.SchemaVersion, NodeVersion: record.Node.Version}
	capability.NodeID, capability.RefreshedAt = nodeID, now
	if readErr != nil {
		snapshot.CollectionStatus, snapshot.ErrorCode = "failed", errorCode(readErr)
		if err := s.repository.SaveObservation(ctx, snapshot, capability); err != nil {
			return Snapshot{}, err
		}
		return snapshot, readErr
	}
	_, hash, err := configuration.Marshal(document)
	if err != nil {
		return Snapshot{}, err
	}
	snapshot.Document, snapshot.CanonicalHash, snapshot.CollectionStatus = &document, hash, "succeeded"
	if err := s.repository.SaveObservation(ctx, snapshot, capability); err != nil {
		return Snapshot{}, err
	}
	return snapshot, nil
}

func (s *Service) Inventory(ctx context.Context, clusterID string) ([]Snapshot, []CapabilityProfile, *Draft, error) {
	if !domain.ValidID(clusterID) {
		return nil, nil, nil, domain.Validation("clusterId", "must be a valid UUID")
	}
	if _, err := s.repository.ClusterByID(ctx, clusterID); err != nil {
		return nil, nil, nil, err
	}
	snapshots, err := s.repository.LatestSnapshots(ctx, clusterID)
	if err != nil {
		return nil, nil, nil, err
	}
	profiles, err := s.repository.CapabilityProfiles(ctx, clusterID)
	if err != nil {
		return nil, nil, nil, err
	}
	draft, err := s.repository.DraftByCluster(ctx, clusterID)
	if err != nil {
		var de *domain.Error
		if !errors.As(err, &de) || de.Kind != domain.ErrorNotFound {
			return nil, nil, nil, err
		}
		return snapshots, profiles, nil, nil
	}
	return snapshots, profiles, &draft, nil
}

func (s *Service) Compare(ctx context.Context, leftID, rightID string) ([]configuration.Difference, error) {
	left, err := s.repository.SnapshotByID(ctx, leftID)
	if err != nil {
		return nil, err
	}
	right, err := s.repository.SnapshotByID(ctx, rightID)
	if err != nil {
		return nil, err
	}
	if left.Document == nil || right.Document == nil {
		return nil, domain.Validation("snapshot", "only successful snapshots can be compared")
	}
	return configuration.Diff(*left.Document, *right.Document), nil
}

func (s *Service) Import(ctx context.Context, actor domain.Actor, clusterID, snapshotID string, expectedVersion int, confirmed bool) (Draft, error) {
	if !confirmed {
		return Draft{}, domain.Validation("confirmed", "must be true after reviewing the snapshot")
	}
	snapshot, err := s.repository.SnapshotByID(ctx, snapshotID)
	if err != nil {
		return Draft{}, err
	}
	node, err := s.repository.NodeByID(ctx, snapshot.NodeID)
	if err != nil {
		return Draft{}, err
	}
	if node.ClusterID != clusterID {
		return Draft{}, domain.Validation("snapshotId", "snapshot does not belong to the cluster")
	}
	if snapshot.Document == nil {
		return Draft{}, domain.Validation("snapshotId", "failed snapshots cannot be imported")
	}
	id, err := domain.NewID()
	if err != nil {
		return Draft{}, err
	}
	if current, currentErr := s.repository.DraftByCluster(ctx, clusterID); currentErr == nil {
		id = current.ID
		if expectedVersion != current.Version {
			return Draft{}, domain.NewError(domain.ErrorConflict, "the configuration draft was changed by another request")
		}
	} else if expectedVersion != 0 {
		return Draft{}, domain.NewError(domain.ErrorConflict, "the configuration draft does not exist")
	}
	now := s.now().UTC()
	draft := Draft{ID: id, ClusterID: clusterID, SourceSnapshotID: snapshotID, SchemaVersion: configuration.SchemaVersion, Document: *snapshot.Document, CanonicalHash: snapshot.CanonicalHash, Version: expectedVersion + 1, UpdatedBy: actor.UserID, UpdatedAt: now}
	eventID, err := domain.NewID()
	if err != nil {
		return Draft{}, err
	}
	resourceID := id
	userID := actor.UserID
	event := domain.AuditEvent{ID: eventID, ActorType: "user", ActorUserID: &userID, Action: "configuration.draft_imported", ResourceType: "configuration_draft", ResourceID: &resourceID, RequestID: actor.RequestID, Metadata: map[string]any{"clusterId": clusterID, "sourceSnapshotId": snapshotID}, CreatedAt: now}
	if err := s.repository.ImportDraft(ctx, draft, expectedVersion, event); err != nil {
		return Draft{}, err
	}
	return draft, nil
}

func errorCode(err error) string {
	var de *domain.Error
	if errors.As(err, &de) {
		return string(de.Kind)
	}
	return string(domain.ErrorInternal)
}
