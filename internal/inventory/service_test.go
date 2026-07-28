package inventory

import (
	"context"
	"testing"
	"time"

	"github.com/benchristian88/agh-ha-controller/internal/configuration"
	"github.com/benchristian88/agh-ha-controller/internal/domain"
)

type fakeRepository struct {
	snapshot Snapshot
	node     domain.Node
	draft    *Draft
	imported bool
}

func (f *fakeRepository) SnapshotByID(context.Context, string) (Snapshot, error) {
	return f.snapshot, nil
}
func (f *fakeRepository) NodeByID(context.Context, string) (domain.Node, error) { return f.node, nil }
func (f *fakeRepository) DraftByCluster(context.Context, string) (Draft, error) {
	if f.draft == nil {
		return Draft{}, domain.NewError(domain.ErrorNotFound, "configuration draft was not found")
	}
	return *f.draft, nil
}
func (f *fakeRepository) ImportDraft(_ context.Context, d Draft, _ int, _ domain.AuditEvent) error {
	f.imported = true
	f.draft = &d
	return nil
}
func (*fakeRepository) CreateCluster(context.Context, domain.Cluster, domain.AuditEvent) error {
	return nil
}
func (*fakeRepository) ListClusters(context.Context) ([]domain.Cluster, error) { return nil, nil }
func (*fakeRepository) ClusterByID(context.Context, string) (domain.Cluster, error) {
	return domain.Cluster{}, nil
}
func (*fakeRepository) UpdateCluster(context.Context, domain.Cluster, int, domain.AuditEvent) error {
	return nil
}
func (*fakeRepository) CreateNode(context.Context, domain.NodeRecord, domain.AuditEvent) error {
	return nil
}
func (*fakeRepository) ListNodes(context.Context, string) ([]domain.Node, error) { return nil, nil }
func (*fakeRepository) NodeRecordByID(context.Context, string) (domain.NodeRecord, error) {
	return domain.NodeRecord{}, nil
}
func (*fakeRepository) UpdateNode(context.Context, domain.NodeRecord, int, domain.AuditEvent) error {
	return nil
}
func (*fakeRepository) SoftDeleteNode(context.Context, string, int, time.Time, domain.AuditEvent) error {
	return nil
}
func (*fakeRepository) UpdateNodeHealth(context.Context, string, domain.NodeHealth, domain.Compatibility, string, *int, string, time.Time, bool) error {
	return nil
}
func (*fakeRepository) RecordNodeTestResult(context.Context, string, domain.NodeHealth, domain.Compatibility, string, *int, string, time.Time, bool, domain.AuditEvent) error {
	return nil
}
func (*fakeRepository) SaveObservation(context.Context, Snapshot, CapabilityProfile) error {
	return nil
}
func (*fakeRepository) LatestSnapshots(context.Context, string) ([]Snapshot, error) { return nil, nil }
func (*fakeRepository) CapabilityProfiles(context.Context, string) ([]CapabilityProfile, error) {
	return nil, nil
}

type unusedCredentials struct{}

func (unusedCredentials) Decrypt(string, domain.EncryptedCredentials) (domain.NodeCredentials, error) {
	return domain.NodeCredentials{}, nil
}

type unusedReader struct{}

func (unusedReader) ReadConfiguration(context.Context, domain.NodeProbeRequest, string) (configuration.Document, CapabilityProfile, error) {
	return configuration.Document{}, CapabilityProfile{}, nil
}

func TestImportRequiresConfirmationAndCreatesOnlyDraft(t *testing.T) {
	clusterID := "11111111-1111-4111-8111-111111111111"
	nodeID := "22222222-2222-4222-8222-222222222222"
	snapshotID := "33333333-3333-4333-8333-333333333333"
	document := configuration.Document{SchemaVersion: 1}
	repo := &fakeRepository{snapshot: Snapshot{ID: snapshotID, NodeID: nodeID, Document: &document, CanonicalHash: "hash", CollectionStatus: "succeeded"}, node: domain.Node{ID: nodeID, ClusterID: clusterID}}
	service := NewService(repo, unusedCredentials{}, unusedReader{})
	actor := domain.Actor{UserID: "44444444-4444-4444-8444-444444444444", RequestID: "55555555-5555-4555-8555-555555555555"}
	if _, err := service.Import(context.Background(), actor, clusterID, snapshotID, 0, false); err == nil {
		t.Fatal("unconfirmed import succeeded")
	}
	draft, err := service.Import(context.Background(), actor, clusterID, snapshotID, 0, true)
	if err != nil {
		t.Fatal(err)
	}
	if !repo.imported || draft.Version != 1 || draft.SourceSnapshotID != snapshotID {
		t.Fatalf("unexpected draft: %#v", draft)
	}
}
