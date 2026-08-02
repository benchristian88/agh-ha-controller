package api

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/benchristian88/agh-ha-controller/internal/inventory"
)

func TestConfigurationInventoryResponseOmitsMissingDraft(t *testing.T) {
	body, err := json.Marshal(configurationInventoryResponse{
		SchemaVersion: 1,
		Snapshots:     nil,
		Capabilities:  nil,
	})
	if err != nil {
		t.Fatal(err)
	}
	var response map[string]json.RawMessage
	if err := json.Unmarshal(body, &response); err != nil {
		t.Fatal(err)
	}
	if _, exists := response["draft"]; exists {
		t.Fatalf("missing draft must be omitted, response was %s", body)
	}
}

func TestPresentationEndpointsRequireAuthentication(t *testing.T) {
	for _, path := range []string{
		"/api/v1/clusters/11111111-1111-4111-8111-111111111111/blocked-services/catalogue",
		"/api/v1/clusters/11111111-1111-4111-8111-111111111111/blocklists/presentation",
		"/api/v1/clusters/11111111-1111-4111-8111-111111111111/allowlists/presentation",
	} {
		t.Run(path, func(t *testing.T) {
			server := &Server{mux: http.NewServeMux()}
			server.routes()
			request := httptest.NewRequest(http.MethodGet, path, nil)
			response := httptest.NewRecorder()
			server.mux.ServeHTTP(response, request)
			if response.Code != http.StatusUnauthorized {
				t.Fatalf("status = %d, want %d; body=%s", response.Code, http.StatusUnauthorized, response.Body.String())
			}
			var body struct {
				Error struct {
					Code string `json:"code"`
				} `json:"error"`
			}
			if err := json.Unmarshal(response.Body.Bytes(), &body); err != nil {
				t.Fatal(err)
			}
			if body.Error.Code != "AUTHENTICATION_REQUIRED" {
				t.Fatalf("unexpected safe error body: %s", response.Body.String())
			}
		})
	}
}

type catalogueReaderFake struct {
	result inventory.BlockedServicesCatalogue
	err    error
}

type blocklistReaderFake struct {
	result inventory.BlocklistPresentation
	err    error
}

type allowlistReaderFake struct {
	result inventory.AllowlistPresentation
	err    error
}

func (f blocklistReaderFake) BlocklistPresentation(context.Context, string) (inventory.BlocklistPresentation, error) {
	return f.result, f.err
}

func (f allowlistReaderFake) AllowlistPresentation(context.Context, string) (inventory.AllowlistPresentation, error) {
	return f.result, f.err
}

func TestBlocklistPresentationEndpointReturnsOnlySanitisedMetadata(t *testing.T) {
	server := &Server{
		blocklists: blocklistReaderFake{result: inventory.BlocklistPresentation{
			Nodes: []inventory.BlocklistNodePresentation{{NodeID: "node-a", NodeName: "Primary", Status: "available", Lists: []inventory.FilterListMetadata{{ID: 7, URL: "https://filters.test/list.txt", Name: "Example", Enabled: true, RulesCount: 321, Portable: true}}}},
		}},
		logger: slog.New(slog.NewTextHandler(io.Discard, nil)),
	}
	request := httptest.NewRequest(http.MethodGet, "/api/v1/clusters/11111111-1111-4111-8111-111111111111/blocklists/presentation", nil)
	request.SetPathValue("clusterId", "11111111-1111-4111-8111-111111111111")
	response := httptest.NewRecorder()
	server.handleBlocklistPresentation(response, request)
	if response.Code != http.StatusOK || !strings.Contains(response.Body.String(), `"ruleCount":321`) {
		t.Fatalf("unexpected response: status=%d body=%s", response.Code, response.Body.String())
	}
	for _, forbidden := range []string{"credentials", "baseUrl", "canonicalHash", "document"} {
		if strings.Contains(response.Body.String(), forbidden) {
			t.Fatalf("response exposed %q: %s", forbidden, response.Body.String())
		}
	}
}

func TestAllowlistPresentationEndpointReturnsOnlySanitisedMetadata(t *testing.T) {
	server := &Server{
		allowlists: allowlistReaderFake{result: inventory.AllowlistPresentation{
			Nodes: []inventory.BlocklistNodePresentation{{NodeID: "node-a", NodeName: "Primary", Status: "available", Lists: []inventory.FilterListMetadata{{ID: 8, URL: "https://allow.test/list.txt", Name: "Allow", Enabled: true, RulesCount: 12, Portable: true}}}},
		}},
		logger: slog.New(slog.NewTextHandler(io.Discard, nil)),
	}
	request := httptest.NewRequest(http.MethodGet, "/api/v1/clusters/11111111-1111-4111-8111-111111111111/allowlists/presentation", nil)
	request.SetPathValue("clusterId", "11111111-1111-4111-8111-111111111111")
	response := httptest.NewRecorder()
	server.handleAllowlistPresentation(response, request)
	if response.Code != http.StatusOK || !strings.Contains(response.Body.String(), `"ruleCount":12`) {
		t.Fatalf("unexpected response: status=%d body=%s", response.Code, response.Body.String())
	}
	for _, forbidden := range []string{"credentials", "baseUrl", "canonicalHash", "document"} {
		if strings.Contains(response.Body.String(), forbidden) {
			t.Fatalf("response exposed %q: %s", forbidden, response.Body.String())
		}
	}
}

func (f catalogueReaderFake) BlockedServicesCatalogue(context.Context, string) (inventory.BlockedServicesCatalogue, error) {
	return f.result, f.err
}

func TestBlockedServicesCatalogueEndpointReturnsSanitisedControllerDTO(t *testing.T) {
	server := &Server{
		catalogue: catalogueReaderFake{result: inventory.BlockedServicesCatalogue{
			Services: []inventory.MergedBlockedService{{ID: "youtube", Name: "YouTube", SupportedNodeIDs: []string{"node-a"}, UnsupportedNodeIDs: []string{}}},
			Groups:   []inventory.BlockedServiceGroup{},
			Nodes:    []inventory.BlockedServicesCatalogueNode{{NodeID: "node-a", NodeName: "Primary", Status: "available", ServiceCount: 1}},
		}},
		logger: slog.New(slog.NewTextHandler(io.Discard, nil)),
	}
	request := httptest.NewRequest(http.MethodGet, "/api/v1/clusters/11111111-1111-4111-8111-111111111111/blocked-services/catalogue", nil)
	request.SetPathValue("clusterId", "11111111-1111-4111-8111-111111111111")
	response := httptest.NewRecorder()
	server.handleBlockedServicesCatalogue(response, request)
	if response.Code != http.StatusOK || !strings.Contains(response.Body.String(), `"name":"YouTube"`) {
		t.Fatalf("unexpected response: status=%d body=%s", response.Code, response.Body.String())
	}
	for _, forbidden := range []string{"icon_svg", "rules", "baseUrl", "credentials"} {
		if strings.Contains(response.Body.String(), forbidden) {
			t.Fatalf("response exposed %q: %s", forbidden, response.Body.String())
		}
	}
}

func TestBlockedServicesCatalogueEndpointMapsInternalErrorsSafely(t *testing.T) {
	server := &Server{
		catalogue: catalogueReaderFake{err: errors.New("secret node response from http://private-node.test")},
		logger:    slog.New(slog.NewTextHandler(io.Discard, nil)),
	}
	request := httptest.NewRequest(http.MethodGet, "/api/v1/clusters/11111111-1111-4111-8111-111111111111/blocked-services/catalogue", nil)
	request.SetPathValue("clusterId", "11111111-1111-4111-8111-111111111111")
	response := httptest.NewRecorder()
	server.handleBlockedServicesCatalogue(response, request)
	if response.Code != http.StatusInternalServerError || strings.Contains(response.Body.String(), "private-node") {
		t.Fatalf("unsafe error response: status=%d body=%s", response.Code, response.Body.String())
	}
	if !strings.Contains(response.Body.String(), `"code":"INTERNAL_ERROR"`) {
		t.Fatalf("stable error code missing: %s", response.Body.String())
	}
}
