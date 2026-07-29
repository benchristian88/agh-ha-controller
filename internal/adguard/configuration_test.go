package adguard

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/benchristian88/agh-ha-controller/internal/configuration"
	"github.com/benchristian88/agh-ha-controller/internal/domain"
)

func TestVersionFixturesSuppressVolatileFields(t *testing.T) {
	documents := make([]configuration.Document, 0, 2)
	for _, version := range []string{"v0.107.52", "v0.107.61"} {
		var dns dnsInfoResponse
		readFixture(t, filepath.Join("testdata", version, "dns_info.json"), &dns)
		var filtering filterStatusResponse
		readFixture(t, filepath.Join("testdata", version, "filtering_status.json"), &filtering)
		documents = append(documents, configurationDocument(version, dns, filtering))
	}
	if differences := configuration.Diff(documents[0], documents[1]); len(differences) != 0 {
		t.Fatalf("equivalent fixtures differ: %#v", differences)
	}
}

func TestApplyConfigurationUsesSupportedEndpointsAndPreservesWhitelistFilters(t *testing.T) {
	requests := map[string][]map[string]any{}
	server := httptest.NewServer(http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
		username, password, ok := request.BasicAuth()
		if !ok || username != "admin" || password != "secret" {
			t.Errorf("basic authentication was not preserved")
		}
		if request.Method == http.MethodGet && request.URL.Path == "/control/filtering/status" {
			_ = json.NewEncoder(response).Encode(map[string]any{"enabled": true, "interval": 24, "filters": []map[string]any{
				{"name": "wanted", "url": "https://example.test/wanted.txt", "enabled": false, "whitelist": false},
				{"name": "extra", "url": "https://example.test/extra.txt", "enabled": true, "whitelist": false},
				{"name": "allow", "url": "https://example.test/allow.txt", "enabled": true, "whitelist": true},
			}})
			return
		}
		if request.Method != http.MethodPost {
			http.Error(response, "unexpected method", http.StatusMethodNotAllowed)
			return
		}
		var body map[string]any
		if err := json.NewDecoder(request.Body).Decode(&body); err != nil {
			t.Errorf("decode request: %v", err)
		}
		requests[request.URL.Path] = append(requests[request.URL.Path], body)
		response.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	adapter := NewConfigurationReader(NewProbe(2 * time.Second))
	desired := configuration.Document{SchemaVersion: 1, Shared: configuration.Shared{
		DNS:       configuration.DNS{UpstreamDNS: []string{"1.1.1.1"}},
		Filtering: configuration.Filtering{Enabled: true, UpdateInterval: 24, FilterURLs: []string{"https://example.test/wanted.txt"}, UserRules: []string{"||ads.test^"}},
	}}
	err := adapter.ApplyConfiguration(context.Background(), domain.NodeProbeRequest{BaseURL: server.URL, CertificatePolicy: domain.CertificateInsecureHTTP, Credentials: domain.NodeCredentials{Username: "admin", Password: "secret"}}, desired)
	if err != nil {
		t.Fatalf("ApplyConfiguration() error = %v", err)
	}
	for _, path := range []string{"/control/dns_config", "/control/filtering/config", "/control/filtering/set_rules"} {
		if len(requests[path]) != 1 {
			t.Fatalf("%s requests = %d, want 1", path, len(requests[path]))
		}
	}
	setURLs := requests["/control/filtering/set_url"]
	if len(setURLs) != 2 {
		t.Fatalf("set_url requests = %d, want enable and disable", len(setURLs))
	}
	for _, payload := range setURLs {
		if payload["url"] == "https://example.test/allow.txt" {
			t.Fatal("whitelist filter was mutated")
		}
	}
}

func readFixture(t *testing.T, path string, target any) {
	t.Helper()
	body, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	if err := json.Unmarshal(body, target); err != nil {
		t.Fatal(err)
	}
}
