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
		VALUES ($1,'operator@example.test','Operator','hash','administrator',true,$2,$2)`, userID, now); err != nil {
		t.Fatal(err)
	}
	if _, err := store.Pool().Exec(ctx, `
		INSERT INTO clusters (id,name,description,created_at,updated_at)
		VALUES ($1,'Home','',$2,$2)`, clusterID, now); err != nil {
		t.Fatal(err)
	}
	if _, err := store.Pool().Exec(ctx, `
		INSERT INTO nodes
			(id,cluster_id,name,base_url,encrypted_credentials,credential_nonce,
			 credential_key_version,credential_algorithm,certificate_policy,enabled,
			 created_at,updated_at)
		VALUES ($1,$2,'Primary','http://node.test',$4,$5,1,'AES-256-GCM','insecure_http',true,$3,$3)`,
		nodeID, clusterID, now, []byte("ciphertext"), []byte("nonce")); err != nil {
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
		keyC      = "20000000-0000-4000-8000-000000000007"
		keyD      = "20000000-0000-4000-8000-000000000008"
		keyE      = "20000000-0000-4000-8000-000000000009"
	)
	calls := map[string]int{}
	newNode := func(name string) *httptest.Server {
		return httptest.NewServer(http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
			calls[name+request.URL.Path]++
			switch request.URL.Path {
			case "/control/test_upstream_dns":
				response.Header().Set("Content-Type", "application/json")
				_, _ = response.Write([]byte(`{"1.1.1.1":"OK"}`))
			case "/control/cache_clear":
				response.WriteHeader(http.StatusOK)
			case "/control/filtering/check_host":
				if request.URL.Query().Get("name") != "ads.example" || request.URL.Query().Get("client") != "192.0.2.10" || request.URL.Query().Get("qtype") != "AAAA" {
					t.Fatalf("host-filter query=%s", request.URL.RawQuery)
				}
				response.Header().Set("Content-Type", "application/json")
				_, _ = response.Write([]byte(`{"reason":"FilteredBlackList","rules":[{"text":"||ads.example^","filter_list_id":0}]}`))
			case "/control/querylog_clear", "/control/stats_reset":
				if request.Method != http.MethodPost {
					t.Fatalf("policy operation method=%s", request.Method)
				}
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
		VALUES ($1,'dns-operator@example.test','DNS Operator','hash','administrator',true,$2,$2)`, userID, now); err != nil {
		t.Fatal(err)
	}
	if _, err := store.Pool().Exec(ctx, `
		INSERT INTO clusters (id,name,description,created_at,updated_at)
		VALUES ($1,'DNS Operations','',$2,$2)`, clusterID, now); err != nil {
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
			VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'insecure_http',true,'v0.107.78','supported',$9,$9)`,
			node.id, clusterID, node.name, node.endpoint, encrypted.Ciphertext, encrypted.Nonce, encrypted.KeyVersion, encrypted.Algorithm, now); err != nil {
			t.Fatal(err)
		}
		if _, err := store.Pool().Exec(ctx, `
			INSERT INTO node_capability_profiles
				(node_id,product_version,api_compatibility,schema_version,features_json,warnings_json,refreshed_at)
			VALUES ($1,'v0.107.78','supported',2,'{"test_upstream_dns":true,"test_host_filtering":true,"test_host_filtering_context":true,"cache_clear":true,"querylog_clear":true,"stats_reset":true}','[]',$2)`,
			node.id, now); err != nil {
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
	host, err := service.StartHostFilterTest(ctx, actor, clusterID, operations.Target{Scope: "all_compatible_enabled_nodes"}, operations.HostFilterInput{Hostname: "ads.example", Client: "192.0.2.10", QueryType: "AAAA"}, keyC)
	if err != nil {
		t.Fatal(err)
	}
	if worked, err := executor.RunOnce(ctx); err != nil || !worked {
		t.Fatalf("host filter worked=%t err=%v", worked, err)
	}
	stored, err = service.Operation(ctx, host.ID)
	if err != nil {
		t.Fatal(err)
	}
	if stored.Status != "succeeded" || len(stored.NodeResults) != 2 || stored.NodeResults[0].HostFilterResult == nil || stored.NodeResults[0].HostFilterResult.Rules[0].Text != "||ads.example^" || calls["a/control/filtering/check_host"] != 1 || calls["b/control/filtering/check_host"] != 1 {
		t.Fatalf("host stored=%#v calls=%#v", stored, calls)
	}
	queryLog, err := service.StartQueryLogClear(ctx, actor, clusterID, operations.Target{Scope: "node", NodeID: nodeAID}, operations.ClearQueryLogConfirmation, keyD)
	if err != nil {
		t.Fatal(err)
	}
	if worked, err := executor.RunOnce(ctx); err != nil || !worked {
		t.Fatalf("query-log clear worked=%t err=%v", worked, err)
	}
	stored, err = service.Operation(ctx, queryLog.ID)
	if err != nil {
		t.Fatal(err)
	}
	if stored.Status != "succeeded" || len(stored.NodeResults) != 1 || calls["a/control/querylog_clear"] != 1 || calls["b/control/querylog_clear"] != 0 {
		t.Fatalf("query-log stored=%#v calls=%#v", stored, calls)
	}
	statistics, err := service.StartStatisticsReset(ctx, actor, clusterID, operations.Target{Scope: "all_compatible_enabled_nodes"}, operations.ResetStatisticsConfirmation, keyE)
	if err != nil {
		t.Fatal(err)
	}
	if worked, err := executor.RunOnce(ctx); err != nil || !worked {
		t.Fatalf("statistics reset worked=%t err=%v", worked, err)
	}
	stored, err = service.Operation(ctx, statistics.ID)
	if err != nil {
		t.Fatal(err)
	}
	if stored.Status != "succeeded" || len(stored.NodeResults) != 2 || calls["a/control/stats_reset"] != 1 || calls["b/control/stats_reset"] != 1 || len(observer.nodes) != 4 {
		t.Fatalf("statistics stored=%#v calls=%#v observations=%#v", stored, calls, observer.nodes)
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
	if err := store.Pool().QueryRow(ctx, `SELECT count(*) FROM audit_events WHERE metadata_json::text LIKE '%1.1.1.1%' OR metadata_json::text LIKE '%ads.example%' OR metadata_json::text LIKE '%192.0.2.10%' OR metadata_json::text LIKE '%node-secret%'`).Scan(&auditLeaks); err != nil {
		t.Fatal(err)
	}
	if payloadRows != 0 || auditLeaks != 0 {
		t.Fatalf("terminal payloads or audit metadata leaked sensitive input: payloads=%d audits=%d", payloadRows, auditLeaks)
	}
}
