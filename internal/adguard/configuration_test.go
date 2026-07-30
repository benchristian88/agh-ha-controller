package adguard

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/benchristian88/agh-ha-controller/internal/configuration"
	"github.com/benchristian88/agh-ha-controller/internal/domain"
)

func TestVersionFixturesSuppressVolatileFields(t *testing.T) {
	documents := make([]configuration.Document, 0, 2)
	for _, version := range []string{"v0.107.52", "v0.107.61"} {
		var status statusResponse
		readFixture(t, filepath.Join("testdata", version, "status.json"), &status)
		var dns dnsInfoResponse
		readFixture(t, filepath.Join("testdata", version, "dns_info.json"), &dns)
		var filtering filterStatusResponse
		readFixture(t, filepath.Join("testdata", version, "filtering_status.json"), &filtering)
		documents = append(documents, configurationDocument(version, status, dns, filtering))
	}
	if differences := configuration.Diff(documents[0], documents[1]); len(differences) != 0 {
		t.Fatalf("equivalent fixtures differ: %#v", differences)
	}
}

func TestValidateListenerStatusRejectsIncompleteIdentity(t *testing.T) {
	for name, status := range map[string]statusResponse{
		"missing":         {},
		"invalid port":    {DNSAddresses: []string{"0.0.0.0"}, DNSPort: 0},
		"invalid address": {DNSAddresses: []string{"not-an-address"}, DNSPort: 53},
	} {
		t.Run(name, func(t *testing.T) {
			if err := validateListenerStatus(status); err == nil {
				t.Fatal("validateListenerStatus() error = nil")
			}
		})
	}
	if err := validateListenerStatus(statusResponse{DNSAddresses: []string{"0.0.0.0", "::"}, DNSPort: 53}); err != nil {
		t.Fatalf("valid listener status rejected: %v", err)
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

func TestReadConfigurationKeepsV010752OnFrozenSchemaV1(t *testing.T) {
	requests := []string{}
	server := httptest.NewServer(http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
		requests = append(requests, request.URL.Path)
		response.Header().Set("Content-Type", "application/json")
		switch request.URL.Path {
		case "/control/status":
			_, _ = response.Write([]byte(`{"version":"v0.107.52","running":true,"dns_addresses":["0.0.0.0"],"dns_port":53}`))
		case "/control/dns_info":
			_, _ = response.Write([]byte(`{"upstream_dns":["1.1.1.1"]}`))
		case "/control/filtering/status":
			_, _ = response.Write([]byte(`{"enabled":true,"interval":24,"filters":[],"user_rules":[]}`))
		default:
			http.NotFound(response, request)
		}
	}))
	defer server.Close()
	adapter := NewConfigurationReader(NewProbe(2 * time.Second))
	document, profile, err := adapter.ReadConfiguration(context.Background(), probeRequest(server.URL), "v0.107.52")
	if err != nil {
		t.Fatal(err)
	}
	if document.SchemaVersion != configuration.LegacySchemaVersion || profile.SchemaVersion != configuration.LegacySchemaVersion || len(requests) != 3 {
		t.Fatalf("legacy inventory document=%#v profile=%#v requests=%#v", document, profile, requests)
	}
}

func TestReadConfigurationV2MapsBroaderInventoryWithoutTLSSecrets(t *testing.T) {
	responses := map[string]string{
		"/control/status":               `{"version":"v0.107.78","running":true,"dns_addresses":["0.0.0.0"],"dns_port":53}`,
		"/control/dns_info":             `{"upstream_dns":["1.1.1.1"],"protection_enabled":true,"cache_size":4096,"cache_enabled":false,"upstream_timeout":12,"upstream_mode":"parallel"}`,
		"/control/filtering/status":     `{"enabled":true,"interval":24,"filters":[],"whitelist_filters":[{"enabled":true,"url":"https://allow.test/list.txt","name":"allow"}],"user_rules":["||ads.test^"]}`,
		"/control/clients":              `{"clients":[{"name":"printer","ids":["192.0.2.10"],"use_global_settings":true,"safe_search":{"enabled":false},"blocked_services_schedule":{"time_zone":"Local"}}]}`,
		"/control/rewrite/list":         `[{"domain":"router.test","answer":"192.0.2.1","enabled":false}]`,
		"/control/rewrite/settings":     `{"enabled":false}`,
		"/control/blocked_services/get": `{"ids":["youtube"],"schedule":{"time_zone":"Pacific/Auckland"}}`,
		"/control/safebrowsing/status":  `{"enabled":true}`,
		"/control/parental/status":      `{"enabled":false}`,
		"/control/safesearch/status":    `{"enabled":true,"google":true,"ecosia":true}`,
		"/control/querylog/config":      `{"enabled":true,"interval":604800000,"anonymize_client_ip":true,"ignored":["health.test"],"ignored_enabled":false}`,
		"/control/stats/config":         `{"enabled":true,"interval":2592000000,"ignored":[],"ignored_enabled":true}`,
		"/control/tls/status":           `{"enabled":true,"server_name":"dns.test","valid_pair":true,"certificate_chain":"SECRET CERT","private_key":"SECRET KEY"}`,
		"/control/dhcp/status":          `{"enabled":true,"interface_name":"eth0","v4":{"gateway_ip":"192.0.2.1","subnet_mask":"255.255.255.0","range_start":"192.0.2.100","range_end":"192.0.2.200","lease_duration":3600},"v6":{},"leases":[],"static_leases":[{"mac":"00:11:22:33:44:55","ip":"192.0.2.10","hostname":"printer"}]}`,
	}
	server := httptest.NewServer(http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
		body, ok := responses[request.URL.Path]
		if !ok {
			http.NotFound(response, request)
			return
		}
		response.Header().Set("Content-Type", "application/json")
		_, _ = response.Write([]byte(body))
	}))
	defer server.Close()
	adapter := NewConfigurationReader(NewProbe(2 * time.Second))
	document, profile, err := adapter.ReadConfiguration(context.Background(), probeRequest(server.URL), "v0.107.78")
	if err != nil {
		t.Fatal(err)
	}
	if document.SchemaVersion != configuration.SchemaVersion || !profile.Features["dhcp"] || !profile.Features["filter_interval_arbitrary"] || len(document.Shared.Clients) != 1 || len(document.Shared.Rewrites) != 1 || document.Shared.RewritesEnabled || document.Shared.Rewrites[0].Enabled || document.Shared.DNS.CacheEnabled || document.Shared.DNS.UpstreamTimeout != 12 || document.Shared.QueryLog.IgnoredEnabled || document.NodeSpecific.DHCP == nil || !document.ObservedOnly.TLS.ValidPair {
		t.Fatalf("broader inventory was incomplete: document=%#v profile=%#v", document, profile)
	}
	body, _, err := configuration.Marshal(document)
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(string(body), "SECRET") {
		t.Fatalf("TLS secret entered canonical inventory: %s", body)
	}
}

func TestApplyConfigurationV2UsesDocumentedMethods(t *testing.T) {
	methods := map[string]string{}
	server := httptest.NewServer(http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
		methods[request.URL.Path] = request.Method
		response.Header().Set("Content-Type", "application/json")
		if request.Method == http.MethodGet {
			switch request.URL.Path {
			case "/control/filtering/status":
				_, _ = response.Write([]byte(`{"enabled":true,"filters":[],"whitelist_filters":[]}`))
			case "/control/dns_info":
				_, _ = response.Write([]byte(`{"cache_enabled":true,"upstream_timeout":10}`))
			case "/control/clients":
				_, _ = response.Write([]byte(`{"clients":[]}`))
			case "/control/rewrite/list":
				_, _ = response.Write([]byte(`[]`))
			case "/control/rewrite/settings":
				_, _ = response.Write([]byte(`{"enabled":true}`))
			case "/control/querylog/config", "/control/stats/config":
				_, _ = response.Write([]byte(`{"enabled":true,"interval":86400000,"ignored":[],"ignored_enabled":true}`))
			case "/control/dhcp/status":
				_, _ = response.Write([]byte(`{"static_leases":[]}`))
			default:
				http.NotFound(response, request)
			}
			return
		}
		response.WriteHeader(http.StatusOK)
	}))
	defer server.Close()
	desired := configuration.Document{SchemaVersion: configuration.SchemaVersion, Shared: configuration.Shared{Filtering: configuration.Filtering{UpdateInterval: 24}, Services: configuration.Services{BlockedSchedule: configuration.Schedule{TimeZone: "Local", Days: map[string]configuration.DayRange{}}}}, NodeSpecific: configuration.NodeSpecific{DHCP: &configuration.DHCPConfig{}}}
	adapter := NewConfigurationReader(NewProbe(2 * time.Second))
	if err := adapter.ApplyConfiguration(context.Background(), probeRequest(server.URL), desired); err != nil {
		t.Fatal(err)
	}
	for path, method := range map[string]string{
		"/control/blocked_services/update": http.MethodPut,
		"/control/safesearch/settings":     http.MethodPut,
		"/control/querylog/config/update":  http.MethodPut,
		"/control/stats/config/update":     http.MethodPut,
		"/control/dhcp/set_config":         http.MethodPost,
		"/control/dns_config":              http.MethodPost,
		"/control/rewrite/settings/update": http.MethodPut,
	} {
		if methods[path] != method {
			t.Errorf("%s method = %q, want %q", path, methods[path], method)
		}
	}
}

func TestOptionalDHCPReadOnlyTreatsUnavailableStatusesAsUnsupported(t *testing.T) {
	for name, status := range map[string]int{"not found": http.StatusNotFound, "platform unsupported": http.StatusInternalServerError, "not implemented": http.StatusNotImplemented} {
		t.Run(name, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(response http.ResponseWriter, _ *http.Request) {
				response.WriteHeader(status)
			}))
			defer server.Close()
			adapter := NewConfigurationReader(NewProbe(2 * time.Second))
			supported, err := adapter.getOptional(context.Background(), probeRequest(server.URL), "/control/dhcp/status", &dhcpStatusResponse{})
			if err != nil || supported {
				t.Fatalf("getOptional() supported=%t err=%v", supported, err)
			}
		})
	}
}

func TestOptionalDHCPReadRejectsMalformedSuccessfulResponse(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(response http.ResponseWriter, _ *http.Request) {
		_, _ = response.Write([]byte(`{"enabled":`))
	}))
	defer server.Close()
	adapter := NewConfigurationReader(NewProbe(2 * time.Second))
	if supported, err := adapter.getOptional(context.Background(), probeRequest(server.URL), "/control/dhcp/status", &dhcpStatusResponse{}); err == nil || supported {
		t.Fatalf("malformed optional response supported=%t err=%v", supported, err)
	}
}

func probeRequest(baseURL string) domain.NodeProbeRequest {
	return domain.NodeProbeRequest{BaseURL: baseURL, CertificatePolicy: domain.CertificateInsecureHTTP, Credentials: domain.NodeCredentials{Username: "admin", Password: "secret"}}
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
