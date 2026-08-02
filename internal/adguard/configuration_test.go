package adguard

import (
	"context"
	"encoding/json"
	"errors"
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

func TestReadBlocklistsPreservesVolatileMetadataOutsideConfiguration(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
		if request.URL.Path != "/control/filtering/status" {
			http.NotFound(response, request)
			return
		}
		_, _ = response.Write([]byte(`{"enabled":true,"filters":[{"id":7,"enabled":true,"url":"https://filters.test/list.txt","name":"Primary list","rules_count":321,"last_updated":"2026-08-01T01:02:03Z"},{"id":8,"enabled":false,"url":"/opt/adguard/local.txt","name":"Local list","rules_count":4}]}`))
	}))
	defer server.Close()

	adapter := NewConfigurationReader(NewProbe(2 * time.Second))
	lists, err := adapter.ReadBlocklists(context.Background(), probeRequest(server.URL), "v0.107.78")
	if err != nil {
		t.Fatal(err)
	}
	if len(lists) != 2 || lists[0].ID != 7 || lists[0].RulesCount != 321 || lists[0].LastUpdated == nil || lists[1].Enabled {
		t.Fatalf("metadata was not retained: %#v", lists)
	}
}

func TestReadAllowlistsUsesAllowlistSemanticsWithoutBlocklistContamination(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
		if request.URL.Path != "/control/filtering/status" {
			http.NotFound(response, request)
			return
		}
		_, _ = response.Write([]byte(`{"filters":[{"id":7,"enabled":true,"url":"https://filters.test/list.txt","name":"Block","rules_count":321},{"id":8,"enabled":true,"url":"https://legacy-allow.test/list.txt","name":"Legacy allow","rules_count":12,"whitelist":true}],"whitelist_filters":[{"id":9,"enabled":false,"url":"https://allow.test/list.txt","name":"Allow","rules_count":22,"last_updated":"2026-08-01T01:02:03Z"}]}`))
	}))
	defer server.Close()

	adapter := NewConfigurationReader(NewProbe(2 * time.Second))
	lists, err := adapter.ReadAllowlists(context.Background(), probeRequest(server.URL), "v0.107.78")
	if err != nil {
		t.Fatal(err)
	}
	if len(lists) != 2 || lists[0].ID != 8 || lists[1].ID != 9 || lists[1].RulesCount != 22 || lists[1].LastUpdated == nil {
		t.Fatalf("allowlist metadata was not retained or categories crossed: %#v", lists)
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

func TestAllowlistReconciliationUsesWhitelistFlagAndPreservesBlocklists(t *testing.T) {
	type recordedRequest struct {
		path string
		body map[string]any
	}
	requests := []recordedRequest{}
	server := httptest.NewServer(http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
		if (request.URL.Path != "/control/filtering/set_url" && request.URL.Path != "/control/filtering/add_url") || request.Method != http.MethodPost {
			http.NotFound(response, request)
			return
		}
		var body map[string]any
		if err := json.NewDecoder(request.Body).Decode(&body); err != nil {
			t.Errorf("decode set_url request: %v", err)
			return
		}
		requests = append(requests, recordedRequest{path: request.URL.Path, body: body})
		response.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	current := filterStatusResponse{
		Filters: []filterListResponse{
			{Name: "Block", URL: "https://filters.test/list.txt", Enabled: true},
			{Name: "Legacy allow", URL: "https://allow.test/wanted.txt", Enabled: false, Whitelist: true},
		},
		WhitelistFilters: []filterListResponse{{Name: "Old allow", URL: "https://allow.test/old.txt", Enabled: true}},
	}
	adapter := NewConfigurationReader(NewProbe(2 * time.Second))
	if err := adapter.reconcileFilterURLs(context.Background(), probeRequest(server.URL), current, []string{"https://allow.test/wanted.txt", "https://allow.test/new.txt"}, true); err != nil {
		t.Fatal(err)
	}
	if len(requests) != 3 {
		t.Fatalf("filter URL requests = %d, want enable, add, and disable: %#v", len(requests), requests)
	}
	foundAdd := false
	for _, request := range requests {
		if request.body["whitelist"] != true || request.body["url"] == "https://filters.test/list.txt" {
			t.Fatalf("allowlist flag or category isolation failed: %#v", requests)
		}
		if request.path == "/control/filtering/add_url" && request.body["url"] == "https://allow.test/new.txt" {
			foundAdd = true
		}
	}
	if !foundAdd {
		t.Fatalf("allowlist add_url request missing or incorrect: %#v", requests)
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
	desired := configuration.Document{SchemaVersion: configuration.SchemaVersion, Shared: configuration.Shared{Filtering: configuration.Filtering{UpdateInterval: 24}, Services: configuration.Services{BlockedSchedule: configuration.Schedule{TimeZone: "Local", Days: map[string]configuration.DayRange{}}}}, NodeSpecific: configuration.NodeSpecific{DHCP: &configuration.DHCPConfig{Enabled: true, InterfaceName: "eth0", IPv4: configuration.DHCPIPv4{Gateway: "192.0.2.1", SubnetMask: "255.255.255.0", RangeStart: "192.0.2.100", RangeEnd: "192.0.2.200", LeaseDuration: 3600}}}}
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

func TestReconcileDHCPSkipsConfigurationWriteWhenAlreadyConverged(t *testing.T) {
	requests := []string{}
	server := httptest.NewServer(http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
		requests = append(requests, request.Method+" "+request.URL.Path)
		if request.Method == http.MethodGet && request.URL.Path == "/control/dhcp/status" {
			_, _ = response.Write([]byte(`{"enabled":false,"interface_name":"","v4":{"gateway_ip":"","subnet_mask":"","range_start":"","range_end":"","lease_duration":0},"v6":{"range_start":"","lease_duration":0},"static_leases":[]}`))
			return
		}
		if request.Method == http.MethodPost && request.URL.Path == "/control/dhcp/add_static_lease" {
			response.WriteHeader(http.StatusOK)
			return
		}
		http.Error(response, "unexpected mutation", http.StatusBadRequest)
	}))
	defer server.Close()

	adapter := NewConfigurationReader(NewProbe(time.Second))
	desired := configuration.DHCPConfig{StaticLeases: []configuration.DHCPStaticLease{{MAC: "00:11:22:33:44:55", IP: "192.0.2.10", Hostname: "printer"}}}
	if err := adapter.reconcileDHCP(context.Background(), probeRequest(server.URL), desired); err != nil {
		t.Fatal(err)
	}
	want := []string{"GET /control/dhcp/status", "POST /control/dhcp/add_static_lease"}
	if len(requests) != len(want) || requests[0] != want[0] || requests[1] != want[1] {
		t.Fatalf("requests = %#v, want %#v without set_config", requests, want)
	}
}

func TestMutationFailureIncludesSafeOperationAndStatus(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(response http.ResponseWriter, _ *http.Request) {
		http.Error(response, "rejected payload containing secret-value", http.StatusBadRequest)
	}))
	defer server.Close()

	adapter := NewConfigurationReader(NewProbe(time.Second))
	err := adapter.post(context.Background(), probeRequest(server.URL), "/control/dhcp/set_config", map[string]any{"enabled": false})
	var domainError *domain.Error
	if !errors.As(err, &domainError) || domainError.Kind != domain.ErrorNodeApply {
		t.Fatalf("error = %#v, want NODE_APPLY_FAILED", err)
	}
	if !strings.Contains(domainError.Message, "POST /control/dhcp/set_config") || !strings.Contains(domainError.Message, "HTTP 400") {
		t.Fatalf("safe operation detail missing from %q", domainError.Message)
	}
	if strings.Contains(domainError.Message, "secret-value") {
		t.Fatalf("node response body leaked into error: %q", domainError.Message)
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

func TestReadBlockedServicesCatalogueSupportsUngroupedAndGroupedContracts(t *testing.T) {
	tests := []struct {
		name, version, body string
		wantGroups          int
		wantGroupID         string
	}{
		{
			name: "frozen schema catalogue", version: "v0.107.52",
			body: `{"blocked_services":[{"id":"youtube","name":"YouTube","rules":["||youtube.com^"],"icon_svg":"PHN2Zy8+"}]}`,
		},
		{
			name: "pre-group catalogue", version: "v0.107.61",
			body: `{"blocked_services":[{"id":"youtube","name":"YouTube","rules":["||youtube.com^"],"icon_svg":"PHN2Zy8+"}]}`,
		},
		{
			name: "grouped catalogue", version: "v0.107.78",
			body:       `{"blocked_services":[{"id":"youtube","name":"YouTube","rules":["||youtube.com^"],"icon_svg":"PHN2Zy8+","group_id":"streaming"}],"groups":[{"id":"streaming"}]}`,
			wantGroups: 1, wantGroupID: "streaming",
		},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			var method, path string
			server := httptest.NewServer(http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
				method, path = request.Method, request.URL.Path
				response.Header().Set("Content-Type", "application/json")
				_, _ = response.Write([]byte(test.body))
			}))
			defer server.Close()

			reader := NewConfigurationReader(NewProbe(time.Second))
			catalogue, err := reader.ReadBlockedServicesCatalogue(context.Background(), probeRequest(server.URL), test.version)
			if err != nil {
				t.Fatal(err)
			}
			if method != http.MethodGet || path != "/control/blocked_services/all" {
				t.Fatalf("unexpected request %s %s", method, path)
			}
			if len(catalogue.Services) != 1 || catalogue.Services[0].ID != "youtube" || catalogue.Services[0].Name != "YouTube" || catalogue.Services[0].GroupID != test.wantGroupID || len(catalogue.Groups) != test.wantGroups {
				t.Fatalf("unexpected catalogue: %#v", catalogue)
			}
		})
	}
}

func TestReadBlockedServicesCatalogueRejectsInvalidMetadataAndUnsupportedVersion(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(response http.ResponseWriter, _ *http.Request) {
		response.Header().Set("Content-Type", "application/json")
		_, _ = response.Write([]byte(`{"blocked_services":[{"id":"","name":"Missing ID"}]}`))
	}))
	defer server.Close()
	reader := NewConfigurationReader(NewProbe(time.Second))
	request := probeRequest(server.URL)
	if _, err := reader.ReadBlockedServicesCatalogue(context.Background(), request, "v0.107.78"); err == nil {
		t.Fatal("invalid catalogue metadata was accepted")
	}
	if _, err := reader.ReadBlockedServicesCatalogue(context.Background(), request, "v0.108.0"); err == nil {
		t.Fatal("unsupported version was accepted")
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
