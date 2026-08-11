package api

import (
	"context"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/benchristian88/agh-ha-controller/internal/auth"
	"github.com/benchristian88/agh-ha-controller/internal/controlplane"
	"github.com/benchristian88/agh-ha-controller/internal/domain"
)

func TestControlPlaneLifecycleRoutesRequireAuthentication(t *testing.T) {
	server := &Server{controlplane: &controlplane.Service{}, mux: http.NewServeMux()}
	server.routes()
	for _, test := range []struct{ method, path string }{
		{http.MethodPost, "/api/v1/configuration-revisions/11111111-1111-4111-8111-111111111111/archive"},
		{http.MethodPost, "/api/v1/configuration-revisions/11111111-1111-4111-8111-111111111111/restore"},
		{http.MethodDelete, "/api/v1/configuration-revisions/11111111-1111-4111-8111-111111111111"},
		{http.MethodPost, "/api/v1/deployments/22222222-2222-4222-8222-222222222222/archive"},
		{http.MethodPost, "/api/v1/deployments/22222222-2222-4222-8222-222222222222/restore"},
		{http.MethodDelete, "/api/v1/deployments/22222222-2222-4222-8222-222222222222"},
	} {
		t.Run(test.method+test.path, func(t *testing.T) {
			response := httptest.NewRecorder()
			server.mux.ServeHTTP(response, httptest.NewRequest(test.method, test.path, strings.NewReader(`{}`)))
			if response.Code != http.StatusUnauthorized || !strings.Contains(response.Body.String(), `"code":"AUTHENTICATION_REQUIRED"`) {
				t.Fatalf("status=%d body=%s", response.Code, response.Body.String())
			}
		})
	}
}

func TestControlPlaneLifecycleRoutesRequireAdministratorAndCSRF(t *testing.T) {
	for _, role := range []struct {
		name       string
		role       domain.UserRole
		wantStatus int
	}{
		{name: "non-administrator", role: domain.UserRole("viewer"), wantStatus: http.StatusForbidden},
		{name: "administrator missing csrf", role: domain.RoleAdministrator, wantStatus: http.StatusForbidden},
	} {
		t.Run(role.name, func(t *testing.T) {
			tokens, err := auth.NewTokenManager([]byte("0123456789abcdef0123456789abcdef"))
			if err != nil {
				t.Fatal(err)
			}
			const csrf = "controlplane-lifecycle-csrf"
			repository := &apiAuthRepositoryFake{
				session: domain.Session{ID: "session-a", CSRFHash: tokens.HashCSRFToken(csrf)},
				user:    domain.User{ID: "33333333-3333-4333-8333-333333333333", Enabled: true, Role: role.role},
			}
			authService, err := auth.NewService(repository, tokens, time.Hour)
			if err != nil {
				t.Fatal(err)
			}
			server := &Server{
				auth: authService, controlplane: &controlplane.Service{},
				logger: slog.New(slog.NewTextHandler(io.Discard, nil)), mux: http.NewServeMux(),
			}
			server.routes()
			request := httptest.NewRequest(http.MethodPost, "/api/v1/configuration-revisions/11111111-1111-4111-8111-111111111111/archive", strings.NewReader(`{"confirmed":true}`))
			request.AddCookie(&http.Cookie{Name: sessionCookieName, Value: "session-token"})
			if role.role != domain.RoleAdministrator {
				request.AddCookie(&http.Cookie{Name: csrfCookieName, Value: csrf})
				request.Header.Set(csrfHeader, csrf)
			}
			response := httptest.NewRecorder()
			server.mux.ServeHTTP(response, request)
			if response.Code != role.wantStatus || !strings.Contains(response.Body.String(), `"code":"AUTHORISATION_DENIED"`) {
				t.Fatalf("status=%d body=%s", response.Code, response.Body.String())
			}
		})
	}
}

type controlplaneLifecycleRepositoryFake struct {
	controlplane.Repository
	revision controlplane.Revision
	archived bool
}

func (f *controlplaneLifecycleRepositoryFake) RevisionByID(_ context.Context, _ string) (controlplane.Revision, error) {
	return f.revision, nil
}

func (f *controlplaneLifecycleRepositoryFake) SetRevisionArchived(_ context.Context, _ string, _ string, archived bool, _ time.Time, _ domain.AuditEvent) error {
	f.archived = archived
	return nil
}

func TestControlPlaneLifecycleRouteAcceptsAdministratorWithMatchingCSRF(t *testing.T) {
	tokens, err := auth.NewTokenManager([]byte("0123456789abcdef0123456789abcdef"))
	if err != nil {
		t.Fatal(err)
	}
	const csrf = "controlplane-lifecycle-csrf"
	authRepository := &apiAuthRepositoryFake{
		session: domain.Session{ID: "session-a", CSRFHash: tokens.HashCSRFToken(csrf)},
		user:    domain.User{ID: "33333333-3333-4333-8333-333333333333", Enabled: true, Role: domain.RoleAdministrator},
	}
	authService, err := auth.NewService(authRepository, tokens, time.Hour)
	if err != nil {
		t.Fatal(err)
	}
	repository := &controlplaneLifecycleRepositoryFake{revision: controlplane.Revision{
		ID: "11111111-1111-4111-8111-111111111111", ClusterID: "22222222-2222-4222-8222-222222222222", RevisionNumber: 4,
	}}
	service := controlplane.NewService(repository)
	server := &Server{
		auth: authService, controlplane: service,
		logger: slog.New(slog.NewTextHandler(io.Discard, nil)), mux: http.NewServeMux(),
	}
	server.routes()
	request := httptest.NewRequest(http.MethodPost, "/api/v1/configuration-revisions/11111111-1111-4111-8111-111111111111/archive", strings.NewReader(`{"confirmed":true}`))
	request.AddCookie(&http.Cookie{Name: sessionCookieName, Value: "session-token"})
	request.AddCookie(&http.Cookie{Name: csrfCookieName, Value: csrf})
	request.Header.Set(csrfHeader, csrf)
	request = request.WithContext(context.WithValue(request.Context(), requestIDKey, "44444444-4444-4444-8444-444444444444"))
	response := httptest.NewRecorder()
	server.mux.ServeHTTP(response, request)
	if response.Code != http.StatusNoContent || !repository.archived {
		t.Fatalf("status=%d archived=%v body=%s", response.Code, repository.archived, response.Body.String())
	}
}
