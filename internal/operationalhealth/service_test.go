package operationalhealth

import (
	"context"
	"testing"
	"time"

	"github.com/benchristian88/agh-ha-controller/internal/domain"
	"github.com/benchristian88/agh-ha-controller/internal/inventory"
	"github.com/benchristian88/agh-ha-controller/internal/querylog"
	"github.com/benchristian88/agh-ha-controller/internal/telemetry"
)

type repositoryFake struct {
	nodes       []domain.Node
	snapshots   []inventory.Snapshot
	attempts    []telemetry.NodeAttempt
	checkpoints []querylog.Checkpoint
	database    Database
}

func (repositoryFake) ClusterByID(context.Context, string) (domain.Cluster, error) {
	return domain.Cluster{}, nil
}
func (r repositoryFake) ListNodes(context.Context, string) ([]domain.Node, error) {
	return r.nodes, nil
}
func (r repositoryFake) LatestSnapshots(context.Context, string) ([]inventory.Snapshot, error) {
	return r.snapshots, nil
}
func (r repositoryFake) LatestSuccessfulSnapshots(context.Context, string) ([]inventory.Snapshot, error) {
	return r.snapshots, nil
}
func (repositoryFake) CapabilityProfiles(context.Context, string) ([]inventory.CapabilityProfile, error) {
	return nil, nil
}
func (r repositoryFake) LatestStatisticsAttempts(context.Context, string, string) ([]telemetry.NodeAttempt, error) {
	return r.attempts, nil
}
func (r repositoryFake) QueryLogCheckpoints(context.Context, string, string) ([]querylog.Checkpoint, error) {
	return r.checkpoints, nil
}
func (r repositoryFake) OperationalDatabase(context.Context, time.Duration, time.Duration) (Database, error) {
	return r.database, nil
}

func TestStatusAggregatesStaleGapAndUnreachableWithoutFailingController(t *testing.T) {
	now := time.Date(2026, 8, 9, 1, 0, 0, 0, time.UTC)
	old := now.Add(-4 * time.Hour)
	nodeID := "22222222-2222-4222-8222-222222222222"
	repository := repositoryFake{
		nodes:       []domain.Node{{ID: nodeID, Name: "dns-secondary", Enabled: true, HealthStatus: domain.NodeUnreachable, LastPolledAt: &now, LastSeenAt: &old, LastErrorCode: "NODE_UNREACHABLE"}},
		snapshots:   []inventory.Snapshot{{NodeID: nodeID, ObservedAt: old, CollectionStatus: "succeeded"}},
		attempts:    []telemetry.NodeAttempt{{NodeID: nodeID, Status: "succeeded", CompletedAt: old, CollectedRanges: 3}},
		checkpoints: []querylog.Checkpoint{{NodeID: nodeID, LastAttemptAt: old, LastSuccessAt: &old, LastStatus: "succeeded", SourceNewestAt: &old, GapDetected: true, GapReason: "QUERY_LOG_NODE_RETENTION_GAP"}},
		database:    Database{State: Healthy},
	}
	service := NewService(repository, NewTracker(), Options{NodeInterval: 30 * time.Second, RequestTimeout: 10 * time.Second, StatisticsInterval: time.Hour, QueryLogInterval: 30 * time.Second, QueryLogEnabled: true})
	service.now = func() time.Time { return now }
	status, err := service.Status(context.Background(), "11111111-1111-4111-8111-111111111111")
	if err != nil {
		t.Fatal(err)
	}
	if status.Summary.State != Degraded || status.Nodes[0].State != Failed || status.Observation.Nodes[0].State != Stale || status.Statistics.Nodes[0].State != Stale || status.QueryLog.Nodes[0].State != Stale {
		t.Fatalf("unexpected status aggregation: %#v", status)
	}
	if !status.QueryLog.Nodes[0].GapDetected || status.QueryLog.Nodes[0].GapReason == "" {
		t.Fatal("known gap was not retained")
	}
}

func TestDatabaseFailureFailsOverallHealth(t *testing.T) {
	repository := repositoryFake{database: Database{State: Failed, ErrorCode: "DATABASE_UNAVAILABLE"}}
	service := NewService(repository, NewTracker(), Options{})
	status, err := service.Status(context.Background(), "11111111-1111-4111-8111-111111111111")
	if err != nil {
		t.Fatal(err)
	}
	if status.Summary.State != Failed || !status.Summary.ActionRequired {
		t.Fatalf("summary = %#v", status.Summary)
	}
}
