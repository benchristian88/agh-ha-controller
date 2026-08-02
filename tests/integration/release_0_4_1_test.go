package integration_test

import (
	"bytes"
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/benchristian88/agh-ha-controller/internal/adguard"
	"github.com/benchristian88/agh-ha-controller/internal/auth"
	"github.com/benchristian88/agh-ha-controller/internal/domain"
	"github.com/benchristian88/agh-ha-controller/internal/inventory"
	"github.com/benchristian88/agh-ha-controller/internal/operations"
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

type operationObservation struct{ nodes []string }

func (o *operationObservation) Observe(_ context.Context, nodeID string) (inventory.Snapshot, error) {
	o.nodes = append(o.nodes, nodeID)
	return inventory.Snapshot{}, nil
}

func TestDNSOperationsAreNodeAttributedIdempotentAndDoNotChangeDesiredState(t *testing.T) {
	store := integrationStore(t)
	ctx := context.Background()
	const (
		userID    = "20000000-0000-4000-8000-000000000001"
		clusterID = "20000000-0000-4000-8000-000000000002"
		nodeAID   = "20000000-0000-4000-8000-000000000003"
		nodeBID   = "20000000-0000-4000-8000-000000000004"
		keyA      = "20000000-0000-4000-8000-000000000005"
		keyB      = "20000000-0000-4000-8000-000000000006"
	)
	calls := map[string]int{}
	newNode := func(name string) *httptest.Server {
		return httptest.NewServer(http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
			calls[name+request.URL.Path]++
			switch request.URL.Path {
			case "/control/test_upstream_dns":
				response.Header().Set("Content-Type", "application/json")
				_, _ = response.Write([]byte(`{"1.1.1.1":""}`))
			case "/control/cache_clear":
				response.WriteHeader(http.StatusOK)
			default:
				http.NotFound(response, request)
			}
		}))
	}
	nodeA, nodeB := newNode("a"), newNode("b")
	defer nodeA.Close()
	defer nodeB.Close()
	cipher, err := auth.NewCredentialCipher(bytes.Repeat([]byte{7}, 32))
	if err != nil {
		t.Fatal(err)
	}
	now := time.Date(2026, time.August, 2, 5, 0, 0, 0, time.UTC)
	if _, err := store.Pool().Exec(ctx, `
		INSERT INTO users (id,email,display_name,password_hash,role,enabled,created_at,updated_at)
		VALUES ($1,'dns-operator@example.test','DNS Operator','hash','administrator',true,$5,$5);
		INSERT INTO clusters (id,name,description,created_at,updated_at)
		VALUES ($2,'DNS Operations','',$5,$5)`, userID, clusterID, nodeAID, nodeBID, now); err != nil {
		t.Fatal(err)
	}
	for _, node := range []struct{ id, name, endpoint string }{{nodeAID, "Primary", nodeA.URL}, {nodeBID, "Secondary", nodeB.URL}} {
		encrypted, err := cipher.Encrypt(node.id, domain.NodeCredentials{Username: "operator", Password: "node-secret"})
		if err != nil {
			t.Fatal(err)
		}
		if _, err := store.Pool().Exec(ctx, `
			INSERT INTO nodes
				(id,cluster_id,name,base_url,encrypted_credentials,credential_nonce,
				 credential_key_version,credential_algorithm,certificate_policy,enabled,
				 version,compatibility_status,created_at,updated_at)
			VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'insecure_http',true,'v0.107.78','supported',$9,$9);
			INSERT INTO node_capability_profiles
				(node_id,product_version,api_compatibility,schema_version,features_json,warnings_json,refreshed_at)
			VALUES ($1,'v0.107.78','supported',2,'{"test_upstream_dns":true,"cache_clear":true}','[]',$9)`,
			node.id, clusterID, node.name, node.endpoint, encrypted.Ciphertext, encrypted.Nonce, encrypted.KeyVersion, encrypted.Algorithm, now); err != nil {
			t.Fatal(err)
		}
	}
	service := operations.NewService(store, cipher)
	observer := &operationObservation{}
	executor := operations.NewExecutor(store, cipher, cipher, adguard.NewConfigurationReader(adguard.NewProbe(2*time.Second)), observer)
	actor := domain.Actor{UserID: userID, RequestID: "request-dns-operations"}

	cache, err := service.StartCacheClear(ctx, actor, clusterID, operations.Target{Scope: "node", NodeID: nodeAID}, operations.ClearDNSCacheConfirmation, keyA)
	if err != nil {
		t.Fatal(err)
	}
	duplicate, err := service.StartCacheClear(ctx, actor, clusterID, operations.Target{Scope: "node", NodeID: nodeAID}, operations.ClearDNSCacheConfirmation, keyA)
	if err != nil || !duplicate.Duplicate || duplicate.ID != cache.ID {
		t.Fatalf("duplicate=%#v err=%v", duplicate, err)
	}
	if worked, err := executor.RunOnce(ctx); err != nil || !worked {
		t.Fatalf("cache worked=%t err=%v", worked, err)
	}
	if calls["a/control/cache_clear"] != 1 || calls["b/control/cache_clear"] != 0 || len(observer.nodes) != 1 || observer.nodes[0] != nodeAID {
		t.Fatalf("cache calls=%#v observations=%#v", calls, observer.nodes)
	}

	upstream, err := service.StartUpstreamTest(ctx, actor, clusterID, operations.Target{Scope: "all_compatible_enabled_nodes"}, operations.UpstreamInput{DraftVersion: 9, UpstreamDNS: []string{"1.1.1.1"}, UpstreamMode: "load_balance"}, keyB)
	if err != nil {
		t.Fatal(err)
	}
	if worked, err := executor.RunOnce(ctx); err != nil || !worked {
		t.Fatalf("upstream worked=%t err=%v", worked, err)
	}
	stored, err := service.Operation(ctx, upstream.ID)
	if err != nil {
		t.Fatal(err)
	}
	if stored.Status != "succeeded" || len(stored.NodeResults) != 2 || stored.NodeResults[0].NodeName != "Primary" || stored.NodeResults[0].ResolverResults[0].ResolverID != "upstream-1" || calls["a/control/test_upstream_dns"] != 1 || calls["b/control/test_upstream_dns"] != 1 {
		t.Fatalf("stored=%#v calls=%#v", stored, calls)
	}
	var drafts, revisions int
	if err := store.Pool().QueryRow(ctx, `SELECT (SELECT count(*) FROM configuration_drafts WHERE cluster_id=$1),(SELECT count(*) FROM configuration_revisions WHERE cluster_id=$1)`, clusterID).Scan(&drafts, &revisions); err != nil {
		t.Fatal(err)
	}
	if drafts != 0 || revisions != 0 {
		t.Fatalf("operational commands changed desired state: drafts=%d revisions=%d", drafts, revisions)
	}
	var payloadRows, auditLeaks int
	if err := store.Pool().QueryRow(ctx, `SELECT count(*) FROM operational_commands WHERE cluster_id=$1 AND payload_ciphertext IS NOT NULL`, clusterID).Scan(&payloadRows); err != nil {
		t.Fatal(err)
	}
	if err := store.Pool().QueryRow(ctx, `SELECT count(*) FROM audit_events WHERE metadata::text LIKE '%1.1.1.1%' OR metadata::text LIKE '%node-secret%'`).Scan(&auditLeaks); err != nil {
		t.Fatal(err)
	}
	if payloadRows != 0 || auditLeaks != 0 {
		t.Fatalf("terminal payloads or audit metadata leaked sensitive input: payloads=%d audits=%d", payloadRows, auditLeaks)
	}
}
