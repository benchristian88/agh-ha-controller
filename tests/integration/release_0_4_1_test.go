package integration_test

import (
	"context"
	"testing"
	"time"

	"github.com/benchristian88/agh-ha-controller/internal/domain"
	"github.com/benchristian88/agh-ha-controller/internal/inventory"
)

func TestDHCPOperationResultPersistsAndDeduplicates(t *testing.T) {
	store := integrationStore(t)
	ctx := context.Background()
	const (
		userID      = "10000000-0000-4000-8000-000000000001"
		clusterID   = "10000000-0000-4000-8000-000000000002"
		nodeID      = "10000000-0000-4000-8000-000000000003"
		operationID = "10000000-0000-4000-8000-000000000004"
		resultID    = "10000000-0000-4000-8000-000000000005"
		requestID   = "10000000-0000-4000-8000-000000000006"
		key         = "10000000-0000-4000-8000-000000000007"
		requestedID = "10000000-0000-4000-8000-000000000008"
		terminalID  = "10000000-0000-4000-8000-000000000009"
	)
	now := time.Date(2026, time.August, 2, 2, 3, 4, 0, time.UTC)
	if _, err := store.Pool().Exec(ctx, `
		INSERT INTO users (id,email,display_name,password_hash,role,enabled,created_at,updated_at)
		VALUES ($1,'operator@example.test','Operator','hash','administrator',true,$4,$4);
		INSERT INTO clusters (id,name,description,created_at,updated_at)
		VALUES ($2,'Home','',$4,$4);
		INSERT INTO nodes
			(id,cluster_id,name,base_url,encrypted_credentials,credential_nonce,
			 credential_key_version,credential_algorithm,certificate_policy,enabled,
			 created_at,updated_at)
		VALUES ($3,$2,'Primary','http://node.test',$5,$6,1,'AES-256-GCM','insecure_http',true,$4,$4)`,
		userID, clusterID, nodeID, now, []byte("ciphertext"), []byte("nonce")); err != nil {
		t.Fatal(err)
	}
	operation := inventory.DHCPOperation{
		ID: operationID, ClusterID: clusterID, ClusterName: "Home",
		Command: inventory.DHCPOperationResetLeases, Status: "running",
		RequestID: requestID, IdempotencyKey: key, RequestedBy: userID,
		ObservationStatus: "not_run", RequestedAt: now,
		NodeResults: []inventory.DHCPOperationNodeResult{{
			ID: resultID, NodeID: nodeID, NodeName: "Primary", Status: "running", StartedAt: now,
		}},
	}
	resourceID := operationID
	requested := domain.AuditEvent{
		ID: requestedID, ActorType: "user", ActorUserID: stringPointer(userID),
		Action: "dhcp.reset_leases_requested", ResourceType: "operational_command",
		ResourceID: &resourceID, RequestID: requestID,
		Metadata: map[string]any{"clusterId": clusterID, "nodeId": nodeID, "command": operation.Command}, CreatedAt: now,
	}
	stored, created, err := store.BeginDHCPOperation(ctx, operation, requested)
	if err != nil || !created || stored.ID != operationID {
		t.Fatalf("begin stored=%#v created=%t err=%v", stored, created, err)
	}
	duplicate := operation
	duplicate.ID = "10000000-0000-4000-8000-000000000010"
	stored, created, err = store.BeginDHCPOperation(ctx, duplicate, requested)
	if err != nil || created || stored.ID != operationID {
		t.Fatalf("duplicate stored=%#v created=%t err=%v", stored, created, err)
	}
	completed := now.Add(time.Second)
	operation.Status = "succeeded"
	operation.CompletedAt = &completed
	operation.AuditReference = terminalID
	operation.NodeResults[0].Status = "succeeded"
	operation.NodeResults[0].CompletedAt = &completed
	terminal := domain.AuditEvent{
		ID: terminalID, ActorType: "user", ActorUserID: stringPointer(userID),
		Action: "dhcp.reset_leases_succeeded", ResourceType: "operational_command",
		ResourceID: &resourceID, RequestID: requestID,
		Metadata: map[string]any{"clusterId": clusterID, "nodeId": nodeID, "status": "succeeded"}, CreatedAt: completed,
	}
	if err := store.FinishDHCPOperation(ctx, operation, terminal); err != nil {
		t.Fatal(err)
	}
	items, err := store.ListDHCPOperations(ctx, nodeID, 10)
	if err != nil {
		t.Fatal(err)
	}
	if len(items) != 1 || items[0].Status != "succeeded" || items[0].AuditReference != terminalID || len(items[0].NodeResults) != 1 || items[0].NodeResults[0].Status != "succeeded" {
		t.Fatalf("persistent items=%#v", items)
	}
	var auditCount int
	if err := store.Pool().QueryRow(ctx, `SELECT count(*) FROM audit_events WHERE resource_type='operational_command' AND resource_id=$1`, operationID).Scan(&auditCount); err != nil {
		t.Fatal(err)
	}
	if auditCount != 2 {
		t.Fatalf("audit count=%d, want 2", auditCount)
	}
}

func stringPointer(value string) *string { return &value }
