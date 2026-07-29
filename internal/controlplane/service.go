package controlplane

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/benchristian88/agh-ha-controller/internal/configuration"
	"github.com/benchristian88/agh-ha-controller/internal/domain"
	"github.com/benchristian88/agh-ha-controller/internal/inventory"
)

type Repository interface {
	domain.ManagementRepository
	DraftByCluster(context.Context, string) (inventory.Draft, error)
	LatestSnapshots(context.Context, string) ([]inventory.Snapshot, error)
	SnapshotByID(context.Context, string) (inventory.Snapshot, error)
	CapabilityProfiles(context.Context, string) ([]inventory.CapabilityProfile, error)
	UpdateConfigurationDraft(context.Context, inventory.Draft, int, domain.AuditEvent) error
	PublishRevision(context.Context, inventory.Draft, *Revision, int, domain.AuditEvent) error
	ListRevisions(context.Context, string) ([]Revision, error)
	RevisionByID(context.Context, string) (Revision, error)
	CreateDeployment(context.Context, Deployment, domain.AuditEvent) error
	ListDeployments(context.Context, string) ([]Deployment, error)
	DeploymentByID(context.Context, string) (Deployment, error)
	RequestDeploymentCancel(context.Context, string, domain.AuditEvent) error
	ListDriftEvents(context.Context, string) ([]DriftEvent, error)
	DriftEventByID(context.Context, string) (DriftEvent, error)
	UpdateDriftReconciliation(context.Context, string, string, *string) error
	UpsertDriftEvent(context.Context, DriftEvent, domain.AuditEvent) (DriftEvent, bool, error)
	ResolveNodeDrift(context.Context, string, string, time.Time, domain.AuditEvent) (bool, error)
	UpdateNodeConvergence(context.Context, string, string, time.Time) error
	ClusterHasActiveDeployment(context.Context, string) (bool, error)
}

type Service struct {
	repository Repository
	now        func() time.Time
}

func NewService(repository Repository) *Service {
	return &Service{repository: repository, now: time.Now}
}

func (s *Service) UpdateDraft(ctx context.Context, actor domain.Actor, clusterID string, expectedVersion int, document configuration.DesiredDocument) (inventory.Draft, []configuration.ValidationIssue, error) {
	if !domain.ValidID(clusterID) {
		return inventory.Draft{}, nil, domain.Validation("clusterId", "must be a valid UUID")
	}
	draft, err := s.repository.DraftByCluster(ctx, clusterID)
	if err != nil {
		return inventory.Draft{}, nil, err
	}
	if expectedVersion != draft.Version {
		return inventory.Draft{}, nil, domain.NewError(domain.ErrorConflict, "the configuration draft was changed by another request")
	}
	nodes, err := s.repository.ListNodes(ctx, clusterID)
	if err != nil {
		return inventory.Draft{}, nil, err
	}
	issues := configuration.ValidateDesired(document, enabledNodeIDs(nodes))
	if document.SchemaVersion != configuration.SchemaVersion {
		return inventory.Draft{}, issues, domain.Validation("document.schemaVersion", "must be 1")
	}
	document = configuration.CanonicaliseDesired(document)
	body, hash, err := configuration.MarshalDesired(document)
	if err != nil || len(body) == 0 {
		return inventory.Draft{}, nil, fmt.Errorf("canonicalise desired configuration: %w", err)
	}
	now := s.now().UTC()
	draft.Document, draft.CanonicalHash, draft.Version, draft.UpdatedBy, draft.UpdatedAt = document, hash, expectedVersion+1, actor.UserID, now
	event, err := userAudit(actor, "configuration.draft_updated", "configuration_draft", draft.ID, map[string]any{"clusterId": clusterID, "valid": len(issues) == 0}, now)
	if err != nil {
		return inventory.Draft{}, nil, err
	}
	if err := s.repository.UpdateConfigurationDraft(ctx, draft, expectedVersion, event); err != nil {
		return inventory.Draft{}, nil, err
	}
	return draft, issues, nil
}

func (s *Service) ValidateDraft(ctx context.Context, clusterID string) (Preview, error) {
	if !domain.ValidID(clusterID) {
		return Preview{}, domain.Validation("clusterId", "must be a valid UUID")
	}
	draft, err := s.repository.DraftByCluster(ctx, clusterID)
	if err != nil {
		return Preview{}, err
	}
	return s.previewDocument(ctx, clusterID, "", draft.Document, nil)
}

func (s *Service) Publish(ctx context.Context, actor domain.Actor, clusterID, summary string, expectedVersion int) (Revision, error) {
	if !domain.ValidID(clusterID) {
		return Revision{}, domain.Validation("clusterId", "must be a valid UUID")
	}
	summary = strings.TrimSpace(summary)
	if len(summary) < 1 || len(summary) > 500 {
		return Revision{}, domain.Validation("summary", "must contain between 1 and 500 characters")
	}
	draft, err := s.repository.DraftByCluster(ctx, clusterID)
	if err != nil {
		return Revision{}, err
	}
	if expectedVersion != draft.Version {
		return Revision{}, domain.NewError(domain.ErrorConflict, "the configuration draft was changed by another request")
	}
	preview, err := s.previewDocument(ctx, clusterID, "", draft.Document, nil)
	if err != nil {
		return Revision{}, err
	}
	if !preview.Valid {
		return Revision{}, domain.NewError(domain.ErrorCapability, "the draft has validation or capability issues")
	}
	id, err := domain.NewID()
	if err != nil {
		return Revision{}, err
	}
	_, hash, err := configuration.MarshalDesired(draft.Document)
	if err != nil {
		return Revision{}, err
	}
	now := s.now().UTC()
	revision := Revision{ID: id, ClusterID: clusterID, SchemaVersion: configuration.SchemaVersion, Document: configuration.CanonicaliseDesired(draft.Document), CanonicalHash: hash, Summary: summary, CreatedBy: actor.UserID, CreatedAt: now}
	event, err := userAudit(actor, "configuration.revision_published", "configuration_revision", id, map[string]any{"clusterId": clusterID, "summary": summary, "canonicalHash": hash}, now)
	if err != nil {
		return Revision{}, err
	}
	if err := s.repository.PublishRevision(ctx, draft, &revision, expectedVersion, event); err != nil {
		return Revision{}, err
	}
	return revision, nil
}

func (s *Service) ListRevisions(ctx context.Context, clusterID string) ([]Revision, error) {
	if !domain.ValidID(clusterID) {
		return nil, domain.Validation("clusterId", "must be a valid UUID")
	}
	return s.repository.ListRevisions(ctx, clusterID)
}

func (s *Service) Revision(ctx context.Context, id string) (Revision, error) {
	if !domain.ValidID(id) {
		return Revision{}, domain.Validation("revisionId", "must be a valid UUID")
	}
	return s.repository.RevisionByID(ctx, id)
}

func (s *Service) CompareRevisions(ctx context.Context, leftID, rightID string) ([]configuration.Difference, error) {
	left, err := s.Revision(ctx, leftID)
	if err != nil {
		return nil, err
	}
	right, err := s.Revision(ctx, rightID)
	if err != nil {
		return nil, err
	}
	if left.ClusterID != right.ClusterID || left.SchemaVersion != right.SchemaVersion {
		return nil, domain.Validation("revisionId", "revisions must belong to the same cluster and schema")
	}
	return configuration.DiffDesired(left.Document, right.Document), nil
}

func (s *Service) PreviewDeployment(ctx context.Context, clusterID, revisionID string) (Preview, error) {
	revision, err := s.Revision(ctx, revisionID)
	if err != nil {
		return Preview{}, err
	}
	if revision.ClusterID != clusterID {
		return Preview{}, domain.Validation("revisionId", "revision does not belong to the cluster")
	}
	preview, err := s.previewDocument(ctx, clusterID, revisionID, revision.Document, nil)
	if err != nil {
		return Preview{}, err
	}
	cluster, err := s.repository.ClusterByID(ctx, clusterID)
	if err != nil {
		return Preview{}, err
	}
	baseline := configuration.DesiredDocument{SchemaVersion: configuration.SchemaVersion, NodeOverrides: map[string]configuration.NodeSpecific{}}
	if cluster.ActiveRevisionID != nil {
		active, err := s.repository.RevisionByID(ctx, *cluster.ActiveRevisionID)
		if err != nil {
			return Preview{}, err
		}
		baseline = active.Document
	}
	preview.Differences = configuration.DiffDesired(baseline, revision.Document)
	return preview, nil
}

func (s *Service) StartDeployment(ctx context.Context, actor domain.Actor, clusterID, revisionID, origin string, rollbackOf *string, targetNodeIDs []string) (Deployment, error) {
	return s.startDeployment(ctx, &actor, clusterID, revisionID, origin, rollbackOf, targetNodeIDs)
}

func (s *Service) StartReconciliation(ctx context.Context, clusterID, revisionID, nodeID string) (Deployment, error) {
	return s.startDeployment(ctx, nil, clusterID, revisionID, "reconciliation", nil, []string{nodeID})
}

func (s *Service) startDeployment(ctx context.Context, actor *domain.Actor, clusterID, revisionID, origin string, rollbackOf *string, targetNodeIDs []string) (Deployment, error) {
	if origin != "manual" && origin != "rollback" && origin != "reconciliation" {
		return Deployment{}, domain.Validation("origin", "is invalid")
	}
	if origin != "reconciliation" && len(targetNodeIDs) > 0 {
		return Deployment{}, domain.Validation("targetNodeIds", "targeted deployments are reserved for drift reconciliation")
	}
	revision, err := s.Revision(ctx, revisionID)
	if err != nil {
		return Deployment{}, err
	}
	if revision.ClusterID != clusterID {
		return Deployment{}, domain.Validation("revisionId", "revision does not belong to the cluster")
	}
	preview, err := s.previewDocument(ctx, clusterID, revisionID, revision.Document, targetNodeIDs)
	if err != nil {
		return Deployment{}, err
	}
	if !preview.Valid || len(preview.Nodes) == 0 {
		return Deployment{}, domain.NewError(domain.ErrorCapability, "all deployment targets must pass validation before mutation")
	}
	id, err := domain.NewID()
	if err != nil {
		return Deployment{}, err
	}
	now := s.now().UTC()
	requestID, err := domain.NewID()
	if err != nil {
		return Deployment{}, err
	}
	var requestedBy *string
	if actor != nil {
		requestedBy = &actor.UserID
		requestID = actor.RequestID
	}
	deployment := Deployment{ID: id, ClusterID: clusterID, RevisionID: revisionID, Status: "queued", Strategy: "sequential", FailurePolicy: "stop", Origin: origin, RollbackOfRevisionID: rollbackOf, RequestedBy: requestedBy, RequestID: requestID, RequestedAt: now, Nodes: make([]DeploymentNode, 0, len(preview.Nodes))}
	for _, target := range preview.Nodes {
		taskID, err := domain.NewID()
		if err != nil {
			return Deployment{}, err
		}
		deployment.Nodes = append(deployment.Nodes, DeploymentNode{ID: taskID, DeploymentID: id, NodeID: target.NodeID, Position: target.Position, EffectiveHash: target.EffectiveHash, Status: "pending"})
	}
	action := "deployment.created"
	if origin == "rollback" {
		action = "deployment.rollback_created"
	} else if origin == "reconciliation" {
		action = "deployment.reconciliation_created"
	}
	metadata := map[string]any{"clusterId": clusterID, "revisionId": revisionID, "targetCount": len(deployment.Nodes)}
	var event domain.AuditEvent
	if actor == nil {
		event, err = systemAudit(action, "deployment", id, requestID, metadata, now)
	} else {
		event, err = userAudit(*actor, action, "deployment", id, metadata, now)
	}
	if err != nil {
		return Deployment{}, err
	}
	if err := s.repository.CreateDeployment(ctx, deployment, event); err != nil {
		return Deployment{}, err
	}
	return deployment, nil
}

func (s *Service) Rollback(ctx context.Context, actor domain.Actor, clusterID, revisionID string) (Deployment, error) {
	if !domain.ValidID(clusterID) {
		return Deployment{}, domain.Validation("clusterId", "must be a valid UUID")
	}
	cluster, err := s.repository.ClusterByID(ctx, clusterID)
	if err != nil {
		return Deployment{}, err
	}
	if cluster.ActiveRevisionID == nil {
		return Deployment{}, domain.NewError(domain.ErrorConflict, "rollback requires an active revision")
	}
	if *cluster.ActiveRevisionID == revisionID {
		return Deployment{}, domain.Validation("revisionId", "the active revision cannot be its own rollback target")
	}
	return s.StartDeployment(ctx, actor, clusterID, revisionID, "rollback", cluster.ActiveRevisionID, nil)
}

func (s *Service) ListDeployments(ctx context.Context, clusterID string) ([]Deployment, error) {
	if !domain.ValidID(clusterID) {
		return nil, domain.Validation("clusterId", "must be a valid UUID")
	}
	return s.repository.ListDeployments(ctx, clusterID)
}

func (s *Service) Deployment(ctx context.Context, id string) (Deployment, error) {
	if !domain.ValidID(id) {
		return Deployment{}, domain.Validation("deploymentId", "must be a valid UUID")
	}
	return s.repository.DeploymentByID(ctx, id)
}

func (s *Service) CancelDeployment(ctx context.Context, actor domain.Actor, id string) error {
	if !domain.ValidID(id) {
		return domain.Validation("deploymentId", "must be a valid UUID")
	}
	deployment, err := s.repository.DeploymentByID(ctx, id)
	if err != nil {
		return err
	}
	now := s.now().UTC()
	event, err := userAudit(actor, "deployment.cancellation_requested", "deployment", id, map[string]any{"clusterId": deployment.ClusterID}, now)
	if err != nil {
		return err
	}
	return s.repository.RequestDeploymentCancel(ctx, id, event)
}

func (s *Service) ListDrift(ctx context.Context, clusterID string) ([]DriftEvent, error) {
	if !domain.ValidID(clusterID) {
		return nil, domain.Validation("clusterId", "must be a valid UUID")
	}
	return s.repository.ListDriftEvents(ctx, clusterID)
}

func (s *Service) RestoreDrift(ctx context.Context, actor domain.Actor, driftID string) (Deployment, error) {
	if !domain.ValidID(driftID) {
		return Deployment{}, domain.Validation("driftId", "must be a valid UUID")
	}
	drift, err := s.repository.DriftEventByID(ctx, driftID)
	if err != nil {
		return Deployment{}, err
	}
	if drift.Status != "open" {
		return Deployment{}, domain.NewError(domain.ErrorConflict, "drift event is already resolved")
	}
	deployment, err := s.StartDeployment(ctx, actor, drift.ClusterID, drift.DesiredRevisionID, "reconciliation", nil, []string{drift.NodeID})
	if err != nil {
		return Deployment{}, err
	}
	if err := s.repository.UpdateDriftReconciliation(ctx, drift.ID, "enforcing", &deployment.ID); err != nil {
		return Deployment{}, err
	}
	return deployment, nil
}

func (s *Service) AdoptDrift(ctx context.Context, actor domain.Actor, driftID string, expectedDraftVersion int) (inventory.Draft, error) {
	if !domain.ValidID(driftID) {
		return inventory.Draft{}, domain.Validation("driftId", "must be a valid UUID")
	}
	drift, err := s.repository.DriftEventByID(ctx, driftID)
	if err != nil {
		return inventory.Draft{}, err
	}
	snapshot, err := s.repository.SnapshotByID(ctx, drift.ObservedSnapshotID)
	if err != nil || snapshot.Document == nil {
		return inventory.Draft{}, domain.NewError(domain.ErrorConflict, "the drift observation is unavailable")
	}
	draft, err := s.repository.DraftByCluster(ctx, drift.ClusterID)
	if err != nil {
		return inventory.Draft{}, err
	}
	if draft.Version != expectedDraftVersion {
		return inventory.Draft{}, domain.NewError(domain.ErrorConflict, "the configuration draft was changed by another request")
	}
	draft.Document.Shared = snapshot.Document.Shared
	if draft.Document.NodeOverrides == nil {
		draft.Document.NodeOverrides = map[string]configuration.NodeSpecific{}
	}
	draft.Document.NodeOverrides[drift.NodeID] = snapshot.Document.NodeSpecific
	_, hash, err := configuration.MarshalDesired(draft.Document)
	if err != nil {
		return inventory.Draft{}, err
	}
	now := s.now().UTC()
	draft.CanonicalHash, draft.Version, draft.UpdatedBy, draft.UpdatedAt = hash, draft.Version+1, actor.UserID, now
	event, err := userAudit(actor, "drift.adopted_to_draft", "drift_event", drift.ID, map[string]any{"clusterId": drift.ClusterID, "draftId": draft.ID}, now)
	if err != nil {
		return inventory.Draft{}, err
	}
	if err := s.repository.UpdateConfigurationDraft(ctx, draft, expectedDraftVersion, event); err != nil {
		return inventory.Draft{}, err
	}
	return draft, nil
}

func (s *Service) previewDocument(ctx context.Context, clusterID, revisionID string, document configuration.DesiredDocument, selected []string) (Preview, error) {
	nodes, err := s.repository.ListNodes(ctx, clusterID)
	if err != nil {
		return Preview{}, err
	}
	selectedSet := map[string]bool{}
	for _, id := range selected {
		selectedSet[id] = true
	}
	targets := make([]domain.Node, 0, len(nodes))
	for _, node := range nodes {
		if !node.Enabled || node.MaintenanceMode || (len(selectedSet) > 0 && !selectedSet[node.ID]) {
			continue
		}
		targets = append(targets, node)
	}
	// A revision remains complete for the whole enabled fleet even when a
	// deployment targets only a subset or temporarily skips maintenance nodes.
	preview := Preview{RevisionID: revisionID, Strategy: "sequential", FailurePolicy: "stop", Differences: []configuration.Difference{}, Issues: configuration.ValidateDesired(document, enabledNodeIDs(nodes)), Nodes: []PreviewNode{}}
	snapshots, err := s.repository.LatestSnapshots(ctx, clusterID)
	if err != nil {
		return Preview{}, err
	}
	profiles, err := s.repository.CapabilityProfiles(ctx, clusterID)
	if err != nil {
		return Preview{}, err
	}
	snapshotByNode := map[string]inventory.Snapshot{}
	for _, snapshot := range snapshots {
		snapshotByNode[snapshot.NodeID] = snapshot
	}
	profileByNode := map[string]inventory.CapabilityProfile{}
	for _, profile := range profiles {
		profileByNode[profile.NodeID] = profile
	}
	for index, node := range targets {
		effective, effectiveErr := configuration.Effective(document, node.ID)
		if effectiveErr != nil {
			continue
		}
		_, hash, hashErr := configuration.Marshal(effective)
		if hashErr != nil {
			return Preview{}, hashErr
		}
		item := PreviewNode{NodeID: node.ID, Position: index + 1, EffectiveHash: hash, Valid: true}
		profile, profileOK := profileByNode[node.ID]
		if !profileOK || profile.Compatibility != string(domain.CompatibilitySupported) || !profile.Features["dns"] || !profile.Features["filtering"] {
			item.Valid = false
			item.Warning = "DNS and filtering capabilities must be observed before deployment."
			preview.Issues = append(preview.Issues, configuration.ValidationIssue{Field: "nodes." + node.ID, Message: item.Warning})
		}
		snapshot, snapshotOK := snapshotByNode[node.ID]
		if !snapshotOK || snapshot.Document == nil || snapshot.CollectionStatus != "succeeded" {
			item.Valid = false
			item.Warning = "A successful current configuration observation is required."
			preview.Issues = append(preview.Issues, configuration.ValidationIssue{Field: "nodes." + node.ID, Message: item.Warning})
		} else if listenerDiff := nodeSpecificDifferences(effective, *snapshot.Document); len(listenerDiff) > 0 {
			item.Valid = false
			item.Warning = "DNS bind hosts or port differ; AdGuard Home has no supported API writer for these values."
			preview.Issues = append(preview.Issues, configuration.ValidationIssue{Field: "nodeOverrides." + node.ID, Message: item.Warning})
		}
		preview.Nodes = append(preview.Nodes, item)
	}
	preview.Valid = len(preview.Issues) == 0 && len(preview.Nodes) > 0
	return preview, nil
}

func nodeSpecificDifferences(desired, observed configuration.Document) []configuration.Difference {
	result := []configuration.Difference{}
	for _, difference := range configuration.Diff(desired, observed) {
		if difference.Scope == configuration.NodeManaged {
			result = append(result, difference)
		}
	}
	return result
}

func enabledNodeIDs(nodes []domain.Node) []string {
	result := []string{}
	for _, node := range nodes {
		if node.Enabled {
			result = append(result, node.ID)
		}
	}
	sort.Strings(result)
	return result
}

func DriftFingerprint(revisionID, desiredHash, observedHash string) string {
	digest := sha256.Sum256([]byte(revisionID + "\x00" + desiredHash + "\x00" + observedHash))
	return hex.EncodeToString(digest[:])
}

func userAudit(actor domain.Actor, action, resourceType, resourceID string, metadata map[string]any, at time.Time) (domain.AuditEvent, error) {
	if !domain.ValidID(actor.UserID) || !domain.ValidID(actor.RequestID) {
		return domain.AuditEvent{}, errors.New("audit actor is invalid")
	}
	id, err := domain.NewID()
	if err != nil {
		return domain.AuditEvent{}, err
	}
	userID := actor.UserID
	return domain.AuditEvent{ID: id, ActorType: "user", ActorUserID: &userID, Action: action, ResourceType: resourceType, ResourceID: &resourceID, RequestID: actor.RequestID, Metadata: metadata, CreatedAt: at}, nil
}
