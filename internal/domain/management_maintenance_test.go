package domain

import (
	"context"
	"errors"
	"testing"
	"time"
)

const (
	maintenanceTestClusterID = "11111111-1111-4111-8111-111111111111"
	maintenanceTestNodeID    = "22222222-2222-4222-8222-222222222222"
	maintenanceTestUserID    = "33333333-3333-4333-8333-333333333333"
)

type maintenanceManagementRepositoryFake struct {
	ManagementRepository
	node   Node
	events []AuditEvent
	err    error
}

func (r *maintenanceManagementRepositoryFake) NodeByID(context.Context, string) (Node, error) {
	return r.node, nil
}

func (r *maintenanceManagementRepositoryFake) SetNodeMaintenance(_ context.Context, _ string, enabled bool, expectedVersion int, at time.Time, event AuditEvent) error {
	if r.err != nil {
		return r.err
	}
	if expectedVersion != r.node.RecordVersion {
		return NewError(ErrorConflict, "node was changed by another request")
	}
	r.node.MaintenanceMode = enabled
	r.node.RecordVersion++
	r.node.UpdatedAt = at
	if enabled {
		r.node.ConvergenceStatus = "maintenance"
	} else {
		r.node.ConvergenceStatus = "pending"
	}
	r.events = append(r.events, event)
	return nil
}

func TestSetNodeMaintenancePersistsBothTransitionsAndAudits(t *testing.T) {
	now := time.Date(2026, 8, 16, 1, 2, 3, 0, time.UTC)
	repository := &maintenanceManagementRepositoryFake{node: Node{ID: maintenanceTestNodeID, ClusterID: maintenanceTestClusterID, RecordVersion: 7, ConvergenceStatus: "converged"}}
	service := NewManagementService(repository, nil, nil)
	service.now = func() time.Time { return now }
	actor := Actor{UserID: maintenanceTestUserID, RequestID: "request-maintenance"}

	entered, err := service.SetNodeMaintenance(context.Background(), actor, maintenanceTestNodeID, true, 7)
	if err != nil || !entered.MaintenanceMode || !repository.node.MaintenanceMode || repository.node.RecordVersion != 8 {
		t.Fatalf("enter node=%#v persisted=%#v err=%v", entered, repository.node, err)
	}
	returned, err := service.SetNodeMaintenance(context.Background(), actor, maintenanceTestNodeID, false, 8)
	if err != nil || returned.MaintenanceMode || repository.node.MaintenanceMode || repository.node.RecordVersion != 9 {
		t.Fatalf("return node=%#v persisted=%#v err=%v", returned, repository.node, err)
	}
	if len(repository.events) != 2 {
		t.Fatalf("audit events=%#v", repository.events)
	}
	for index, enabled := range []bool{true, false} {
		event := repository.events[index]
		if event.Action != "node.maintenance_changed" || event.RequestID != actor.RequestID || event.Metadata["enabled"] != enabled || event.Metadata["clusterId"] != maintenanceTestClusterID {
			t.Fatalf("audit[%d]=%#v", index, event)
		}
	}
}

func TestSetNodeMaintenanceFailureDoesNotChangeCanonicalState(t *testing.T) {
	repository := &maintenanceManagementRepositoryFake{
		node: Node{ID: maintenanceTestNodeID, ClusterID: maintenanceTestClusterID, MaintenanceMode: true, RecordVersion: 3, ConvergenceStatus: "maintenance"},
		err:  errors.New("persistence unavailable"),
	}
	service := NewManagementService(repository, nil, nil)
	if _, err := service.SetNodeMaintenance(context.Background(), Actor{UserID: maintenanceTestUserID}, maintenanceTestNodeID, false, 3); err == nil {
		t.Fatal("exit maintenance succeeded despite persistence failure")
	}
	if !repository.node.MaintenanceMode || repository.node.RecordVersion != 3 || len(repository.events) != 0 {
		t.Fatalf("canonical state changed after failure: node=%#v events=%#v", repository.node, repository.events)
	}
}
