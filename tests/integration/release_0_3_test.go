package integration_test

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
	"time"

	"github.com/benchristian88/agh-ha-controller/internal/adguard"
	"github.com/benchristian88/agh-ha-controller/internal/auth"
	"github.com/benchristian88/agh-ha-controller/internal/controlplane"
	"github.com/benchristian88/agh-ha-controller/internal/domain"
	"github.com/benchristian88/agh-ha-controller/internal/inventory"
)

type adGuardState struct {
	mu          sync.Mutex
	upstreamDNS []string
	userRules   []string
}

func (s *adGuardState) handler(response http.ResponseWriter, request *http.Request) {
	username, password, ok := request.BasicAuth()
	if !ok || username != "admin" || password != "secret" {
		response.WriteHeader(http.StatusUnauthorized)
		return
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	response.Header().Set("Content-Type", "application/json")
	switch request.URL.Path {
	case "/control/status":
		_, _ = io.WriteString(response, `{"version":"v0.107.65","running":true,"dns_addresses":["0.0.0.0"],"dns_port":53}`)
	case "/control/dns_info":
		_ = json.NewEncoder(response).Encode(map[string]any{"upstream_dns": s.upstreamDNS, "bootstrap_dns": []string{}, "fallback_dns": []string{}, "local_ptr_upstreams": []string{}, "cache_enabled": true, "cache_size": 4_194_304, "upstream_timeout": 10})
	case "/control/filtering/status":
		_ = json.NewEncoder(response).Encode(map[string]any{"enabled": true, "interval": 24, "filters": []any{}, "whitelist_filters": []any{}, "user_rules": s.userRules})
	case "/control/clients":
		_, _ = io.WriteString(response, `{"clients":[]}`)
	case "/control/rewrite/list":
		_, _ = io.WriteString(response, `[]`)
	case "/control/blocked_services/get":
		_, _ = io.WriteString(response, `{"ids":[],"schedule":{"time_zone":"Local"}}`)
	case "/control/safebrowsing/status", "/control/parental/status":
		_, _ = io.WriteString(response, `{"enabled":false}`)
	case "/control/safesearch/status":
		_, _ = io.WriteString(response, `{"enabled":false,"bing":true,"duckduckgo":true,"ecosia":true,"google":true,"pixabay":true,"yandex":true,"youtube":true}`)
	case "/control/querylog/config", "/control/stats/config":
		_, _ = io.WriteString(response, `{"enabled":false,"interval":0,"ignored":[]}`)
	case "/control/tls/status":
		_, _ = io.WriteString(response, `{"enabled":false,"serve_plain_dns":true}`)
	case "/control/dhcp/status":
		response.WriteHeader(http.StatusInternalServerError)
		_, _ = io.WriteString(response, `{"message":"DHCP unavailable"}`)
	case "/control/dns_config":
		var body struct {
			UpstreamDNS []string `json:"upstream_dns"`
		}
		_ = json.NewDecoder(request.Body).Decode(&body)
		s.upstreamDNS = append([]string(nil), body.UpstreamDNS...)
	case "/control/filtering/set_rules":
		var body struct {
			Rules []string `json:"rules"`
		}
		_ = json.NewDecoder(request.Body).Decode(&body)
		s.userRules = append([]string(nil), body.Rules...)
	default:
		if request.Method != http.MethodPost && request.Method != http.MethodPut {
			http.NotFound(response, request)
		}
	}
}

func (s *adGuardState) setUpstream(values ...string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.upstreamDNS = append([]string(nil), values...)
}

func TestRelease03AuthoritativeConfigurationWorkflow(t *testing.T) {
	store := integrationStore(t)
	ctx := context.Background()
	credentialCipher, err := auth.NewCredentialCipher(bytes.Repeat([]byte{7}, 32))
	if err != nil {
		t.Fatal(err)
	}
	tokens, err := auth.NewTokenManager(bytes.Repeat([]byte{8}, 32))
	if err != nil {
		t.Fatal(err)
	}
	authService, err := auth.NewService(store, tokens, time.Hour)
	if err != nil {
		t.Fatal(err)
	}
	requestID := mustID(t)
	setup, err := authService.Setup(ctx, "release03@example.test", "Release 0.3", "correct horse battery staple", requestID, "127.0.0.1", "integration-test")
	if err != nil {
		t.Fatal(err)
	}
	actor := domain.Actor{UserID: setup.User.ID, RequestID: mustID(t)}
	probe := adguard.NewProbe(2 * time.Second)
	management := domain.NewManagementService(store, credentialCipher, probe)
	cluster, err := management.CreateCluster(ctx, actor, domain.CreateClusterInput{Name: "Release 0.3", ReconciliationPolicy: domain.ReconciliationEnforce})
	if err != nil {
		t.Fatal(err)
	}
	states := []*adGuardState{{upstreamDNS: []string{"9.9.9.9"}}, {upstreamDNS: []string{"9.9.9.9"}}}
	servers := make([]*httptest.Server, 0, len(states))
	for _, state := range states {
		server := httptest.NewServer(http.HandlerFunc(state.handler))
		servers = append(servers, server)
		t.Cleanup(server.Close)
	}
	nodes := make([]domain.Node, 0, 2)
	for index, server := range servers {
		node, err := management.CreateNode(ctx, domain.Actor{UserID: setup.User.ID, RequestID: mustID(t)}, domain.CreateNodeInput{ClusterID: cluster.ID, Name: "Node " + string(rune('A'+index)), BaseURL: server.URL, CertificatePolicy: domain.CertificateInsecureHTTP, Username: "admin", Password: "secret", Enabled: true})
		if err != nil {
			t.Fatal(err)
		}
		nodes = append(nodes, node)
	}
	adapter := adguard.NewConfigurationReader(probe)
	inventoryService := inventory.NewService(store, credentialCipher, adapter)
	var draft inventory.Draft
	for index, node := range nodes {
		snapshot, err := inventoryService.Observe(ctx, node.ID)
		if err != nil {
			t.Fatal(err)
		}
		draft, err = inventoryService.Import(ctx, domain.Actor{UserID: setup.User.ID, RequestID: mustID(t)}, cluster.ID, snapshot.ID, index, true)
		if err != nil {
			t.Fatal(err)
		}
	}
	service := controlplane.NewService(store)
	// Exercise the operator's initial workflow exactly: import every node, edit
	// shared desired state, and save before any revision is published or active.
	draft.Document.Shared.DNS.UpstreamDNS = []string{"9.9.9.9", "149.112.112.112"}
	draft, issues, err := service.UpdateDraft(ctx, domain.Actor{UserID: setup.User.ID, RequestID: mustID(t)}, cluster.ID, draft.Version, draft.Document)
	if err != nil || len(issues) != 0 {
		t.Fatalf("update imported draft issues=%v error=%v", issues, err)
	}
	revisionOne, err := service.Publish(ctx, domain.Actor{UserID: setup.User.ID, RequestID: mustID(t)}, cluster.ID, "Initial authoritative DNS policy", draft.Version)
	if err != nil {
		t.Fatal(err)
	}
	deployment, err := service.StartDeployment(ctx, domain.Actor{UserID: setup.User.ID, RequestID: mustID(t)}, cluster.ID, revisionOne.ID, "manual", nil, nil)
	if err != nil {
		t.Fatal(err)
	}
	executor := controlplane.NewExecutor(store, credentialCipher, adapter, inventoryService)
	if worked, err := executor.RunOnce(ctx); err != nil || !worked {
		t.Fatalf("initial deployment worked=%v error=%v", worked, err)
	}
	assertDeploymentSucceeded(t, service, deployment.ID, 2)

	states[0].setUpstream("8.8.8.8")
	reconciler := controlplane.NewReconciler(store, service, inventoryService, slog.New(slog.NewTextHandler(io.Discard, nil)))
	if err := reconciler.RunOnce(ctx); err != nil {
		t.Fatal(err)
	}
	drift, err := service.ListDrift(ctx, cluster.ID)
	if err != nil || len(drift) != 1 || drift[0].Status != "open" || drift[0].RelatedDeploymentID == nil {
		t.Fatalf("automatic drift record = %#v, error=%v", drift, err)
	}
	if worked, err := executor.RunOnce(ctx); err != nil || !worked {
		t.Fatalf("reconciliation deployment worked=%v error=%v", worked, err)
	}
	if err := reconciler.RunOnce(ctx); err != nil {
		t.Fatal(err)
	}
	drift, err = service.ListDrift(ctx, cluster.ID)
	if err != nil || drift[0].Status != "resolved" {
		t.Fatalf("resolved drift = %#v, error=%v", drift, err)
	}

	draft, err = store.DraftByCluster(ctx, cluster.ID)
	if err != nil {
		t.Fatal(err)
	}
	draft.Document.Shared.DNS.UpstreamDNS = []string{"1.1.1.1"}
	draft, issues, err = service.UpdateDraft(ctx, domain.Actor{UserID: setup.User.ID, RequestID: mustID(t)}, cluster.ID, draft.Version, draft.Document)
	if err != nil || len(issues) != 0 {
		t.Fatalf("update second draft issues=%v error=%v", issues, err)
	}
	revisionTwo, err := service.Publish(ctx, domain.Actor{UserID: setup.User.ID, RequestID: mustID(t)}, cluster.ID, "Use Cloudflare upstream", draft.Version)
	if err != nil {
		t.Fatal(err)
	}
	second, err := service.StartDeployment(ctx, domain.Actor{UserID: setup.User.ID, RequestID: mustID(t)}, cluster.ID, revisionTwo.ID, "manual", nil, nil)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := executor.RunOnce(ctx); err != nil {
		t.Fatal(err)
	}
	assertDeploymentSucceeded(t, service, second.ID, 2)
	rollback, err := service.Rollback(ctx, domain.Actor{UserID: setup.User.ID, RequestID: mustID(t)}, cluster.ID, revisionOne.ID)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := executor.RunOnce(ctx); err != nil {
		t.Fatal(err)
	}
	assertDeploymentSucceeded(t, service, rollback.ID, 2)
	active, err := store.ClusterByID(ctx, cluster.ID)
	if err != nil || active.ActiveRevisionID == nil || *active.ActiveRevisionID != revisionOne.ID {
		t.Fatalf("active revision = %#v, error=%v", active.ActiveRevisionID, err)
	}
}

func assertDeploymentSucceeded(t *testing.T, service *controlplane.Service, id string, nodeCount int) {
	t.Helper()
	deployment, err := service.Deployment(context.Background(), id)
	if err != nil {
		t.Fatal(err)
	}
	if deployment.Status != "succeeded" || len(deployment.Nodes) != nodeCount {
		t.Fatalf("deployment = %#v", deployment)
	}
	for _, node := range deployment.Nodes {
		if node.Status != "succeeded" || node.VerificationSnapshotID == nil {
			t.Fatalf("deployment node = %#v", node)
		}
	}
}

func mustID(t *testing.T) string {
	t.Helper()
	id, err := domain.NewID()
	if err != nil {
		t.Fatal(err)
	}
	return id
}
