package api

import (
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/benchristian88/atlas-dns/internal/auth"
	"github.com/benchristian88/atlas-dns/internal/domain"
	"github.com/benchristian88/atlas-dns/internal/haoperations"
)

func TestHAOperationsRoutesRequireAuthentication(t *testing.T) {
	tests := []struct {
		method string
		path   string
	}{
		{http.MethodGet, "/api/v1/clusters/11111111-1111-4111-8111-111111111111/ha-status"},
		{http.MethodGet, "/api/v1/clusters/11111111-1111-4111-8111-111111111111/ha-history"},
		{http.MethodGet, "/api/v1/nodes/22222222-2222-4222-8222-222222222222/lifecycle"},
		{http.MethodPost, "/api/v1/nodes/22222222-2222-4222-8222-222222222222/dns-probe"},
		{http.MethodPost, "/api/v1/nodes/22222222-2222-4222-8222-222222222222/maintenance"},
		{http.MethodPost, "/api/v1/nodes/22222222-2222-4222-8222-222222222222/return-to-service"},
		{http.MethodPost, "/api/v1/nodes/22222222-2222-4222-8222-222222222222/upgrades"},
		{http.MethodPost, "/api/v1/clusters/11111111-1111-4111-8111-111111111111/notification-channels"},
		{http.MethodPatch, "/api/v1/notification-channels/22222222-2222-4222-8222-222222222222"},
		{http.MethodPost, "/api/v1/notification-channels/22222222-2222-4222-8222-222222222222/test"},
		{http.MethodDelete, "/api/v1/notification-channels/22222222-2222-4222-8222-222222222222"},
	}
	for _, test := range tests {
		t.Run(test.method+test.path, func(t *testing.T) {
			server := &Server{mux: http.NewServeMux()}
			server.routes()
			response := httptest.NewRecorder()
			server.mux.ServeHTTP(response, httptest.NewRequest(test.method, test.path, strings.NewReader(`{}`)))
			if response.Code != http.StatusUnauthorized || !strings.Contains(response.Body.String(), `"code":"AUTHENTICATION_REQUIRED"`) {
				t.Fatalf("status=%d body=%s", response.Code, response.Body.String())
			}
		})
	}
}

func TestReturnToServiceLogDiagnosticsContainOnlySafeFailedCheckFields(t *testing.T) {
	diagnostics := safeFailedCheckDiagnostics([]haoperations.Check{
		{Name: "api", Status: "fail", Required: true, ErrorCode: "NODE_UNREACHABLE", Message: "safe presentation"},
		{Name: "convergence_drift", Status: "warning", Required: false, ErrorCode: "CONFIGURATION_RECONCILIATION_PENDING"},
		{Name: "dns", Status: "pass", Required: true},
	})
	if len(diagnostics) != 1 || diagnostics[0]["name"] != "api" || diagnostics[0]["errorCode"] != "NODE_UNREACHABLE" {
		t.Fatalf("diagnostics=%#v", diagnostics)
	}
	if _, exposed := diagnostics[0]["message"]; exposed {
		t.Fatalf("diagnostics exposed check message: %#v", diagnostics)
	}
}

func TestHAOperationsMutationRequiresMatchingCSRF(t *testing.T) {
	tokens, err := auth.NewTokenManager([]byte("0123456789abcdef0123456789abcdef"))
	if err != nil {
		t.Fatal(err)
	}
	const csrf = "csrf-token"
	repository := &apiAuthRepositoryFake{
		session: domain.Session{ID: "session-a", CSRFHash: tokens.HashCSRFToken(csrf)},
		user:    domain.User{ID: "33333333-3333-4333-8333-333333333333", Enabled: true, Role: domain.RoleAdministrator},
	}
	authService, err := auth.NewService(repository, tokens, time.Hour)
	if err != nil {
		t.Fatal(err)
	}
	server := &Server{auth: authService, logger: slog.New(slog.NewTextHandler(io.Discard, nil)), mux: http.NewServeMux()}
	server.routes()
	tests := []struct{ method, path string }{
		{http.MethodPost, "/api/v1/nodes/22222222-2222-4222-8222-222222222222/dns-probe"},
		{http.MethodPost, "/api/v1/nodes/22222222-2222-4222-8222-222222222222/return-to-service"},
		{http.MethodPost, "/api/v1/clusters/11111111-1111-4111-8111-111111111111/notification-channels"},
		{http.MethodPatch, "/api/v1/notification-channels/22222222-2222-4222-8222-222222222222"},
		{http.MethodPost, "/api/v1/notification-channels/22222222-2222-4222-8222-222222222222/test"},
		{http.MethodDelete, "/api/v1/notification-channels/22222222-2222-4222-8222-222222222222"},
	}
	for _, test := range tests {
		t.Run(test.method+test.path, func(t *testing.T) {
			without := httptest.NewRequest(test.method, test.path, strings.NewReader(`{}`))
			without.AddCookie(&http.Cookie{Name: sessionCookieName, Value: "session-token"})
			withoutResponse := httptest.NewRecorder()
			server.mux.ServeHTTP(withoutResponse, without)
			if withoutResponse.Code != http.StatusForbidden || !strings.Contains(withoutResponse.Body.String(), `"code":"AUTHORISATION_DENIED"`) {
				t.Fatalf("missing CSRF status=%d body=%s", withoutResponse.Code, withoutResponse.Body.String())
			}

			with := httptest.NewRequest(test.method, test.path, strings.NewReader(`{}`))
			with.AddCookie(&http.Cookie{Name: sessionCookieName, Value: "session-token"})
			with.AddCookie(&http.Cookie{Name: csrfCookieName, Value: csrf})
			with.Header.Set(csrfHeader, csrf)
			withResponse := httptest.NewRecorder()
			server.mux.ServeHTTP(withResponse, with)
			if withResponse.Code != http.StatusNotFound || !strings.Contains(withResponse.Body.String(), `"code":"NOT_FOUND"`) {
				t.Fatalf("matching CSRF did not reach handler: status=%d body=%s", withResponse.Code, withResponse.Body.String())
			}
		})
	}
}
