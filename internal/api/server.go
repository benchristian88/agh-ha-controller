package api

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"runtime/debug"
	"strings"
	"time"

	"github.com/benchristian88/agh-ha-controller/internal/auth"
	"github.com/benchristian88/agh-ha-controller/internal/controlplane"
	"github.com/benchristian88/agh-ha-controller/internal/domain"
	"github.com/benchristian88/agh-ha-controller/internal/inventory"
)

const (
	sessionCookieName = "aghha_session"
	csrfCookieName    = "aghha_csrf"
	requestIDHeader   = "X-Request-ID"
	csrfHeader        = "X-CSRF-Token"
)

type AuditReader interface {
	ListAuditEvents(context.Context, int, int) ([]domain.AuditEvent, error)
}

type HealthChecker interface {
	Ping(context.Context) error
}

type BlockedServicesCatalogueReader interface {
	BlockedServicesCatalogue(context.Context, string) (inventory.BlockedServicesCatalogue, error)
}

type BlocklistPresentationReader interface {
	BlocklistPresentation(context.Context, string) (inventory.BlocklistPresentation, error)
}

type AllowlistPresentationReader interface {
	AllowlistPresentation(context.Context, string) (inventory.AllowlistPresentation, error)
}

type DHCPInterfacesReader interface {
	DHCPInterfaces(context.Context, string) (inventory.DHCPInterfaces, error)
}

type DHCPActiveChecker interface {
	FindActiveDHCP(context.Context, domain.Actor, string, string) (inventory.DHCPActiveCheckResult, error)
}

type Server struct {
	auth           *auth.Service
	management     *domain.ManagementService
	inventory      *inventory.Service
	catalogue      BlockedServicesCatalogueReader
	blocklists     BlocklistPresentationReader
	allowlists     AllowlistPresentationReader
	dhcpInterfaces DHCPInterfacesReader
	dhcpChecker    DHCPActiveChecker
	controlplane   *controlplane.Service
	audit          AuditReader
	health         HealthChecker
	logger         *slog.Logger
	secureCookies  bool
	publicBaseURL  string
	healthInterval time.Duration
	webDist        string
	mux            *http.ServeMux
}

func NewServer(authService *auth.Service, management *domain.ManagementService, inventoryService *inventory.Service, audit AuditReader, health HealthChecker, logger *slog.Logger, secureCookies bool, publicBaseURL string, healthInterval time.Duration, webDist string, controlplanes ...*controlplane.Service) *Server {
	var controlplaneService *controlplane.Service
	if len(controlplanes) > 0 {
		controlplaneService = controlplanes[0]
	}
	server := &Server{
		auth: authService, management: management, inventory: inventoryService, catalogue: inventoryService, blocklists: inventoryService, allowlists: inventoryService, dhcpInterfaces: inventoryService, dhcpChecker: inventoryService, audit: audit, health: health,
		controlplane: controlplaneService,
		logger:       logger, secureCookies: secureCookies, publicBaseURL: publicBaseURL, healthInterval: healthInterval,
		webDist: webDist, mux: http.NewServeMux(),
	}
	server.routes()
	return server
}

func (s *Server) Handler() http.Handler {
	return s.securityHeaders(s.requestID(s.recover(s.accessLog(s.mux))))
}

func (s *Server) routes() {
	s.mux.HandleFunc("GET /health", s.handleHealth)
	s.mux.HandleFunc("GET /ready", s.handleReady)
	s.mux.HandleFunc("GET /api/v1/setup/status", s.handleSetupStatus)
	s.mux.HandleFunc("POST /api/v1/setup", s.handleSetup)
	s.mux.HandleFunc("POST /api/v1/auth/login", s.handleLogin)
	s.mux.Handle("POST /api/v1/auth/logout", s.authenticated(true, http.HandlerFunc(s.handleLogout)))
	s.mux.Handle("GET /api/v1/auth/me", s.authenticated(false, http.HandlerFunc(s.handleMe)))
	s.mux.Handle("GET /api/v1/clusters", s.authenticated(false, http.HandlerFunc(s.handleListClusters)))
	s.mux.Handle("POST /api/v1/clusters", s.authenticated(true, http.HandlerFunc(s.handleCreateCluster)))
	s.mux.Handle("GET /api/v1/clusters/{clusterId}", s.authenticated(false, http.HandlerFunc(s.handleGetCluster)))
	s.mux.Handle("PATCH /api/v1/clusters/{clusterId}", s.authenticated(true, http.HandlerFunc(s.handleUpdateCluster)))
	s.mux.Handle("GET /api/v1/clusters/{clusterId}/nodes", s.authenticated(false, http.HandlerFunc(s.handleListNodes)))
	s.mux.Handle("POST /api/v1/clusters/{clusterId}/nodes", s.authenticated(true, http.HandlerFunc(s.handleCreateNode)))
	s.mux.Handle("GET /api/v1/nodes/{nodeId}", s.authenticated(false, http.HandlerFunc(s.handleGetNode)))
	s.mux.Handle("PATCH /api/v1/nodes/{nodeId}", s.authenticated(true, http.HandlerFunc(s.handleUpdateNode)))
	s.mux.Handle("DELETE /api/v1/nodes/{nodeId}", s.authenticated(true, http.HandlerFunc(s.handleDeleteNode)))
	s.mux.Handle("POST /api/v1/nodes/{nodeId}/test-connection", s.authenticated(true, http.HandlerFunc(s.handleTestNode)))
	s.mux.Handle("POST /api/v1/nodes/{nodeId}/maintenance", s.authenticated(true, http.HandlerFunc(s.handleNodeMaintenance)))
	s.mux.Handle("POST /api/v1/nodes/{nodeId}/observations", s.authenticated(true, http.HandlerFunc(s.handleObserveNode)))
	s.mux.Handle("POST /api/v1/nodes/{nodeId}/filter-refresh", s.authenticated(true, http.HandlerFunc(s.handleFilterRefresh)))
	s.mux.Handle("GET /api/v1/nodes/{nodeId}/dhcp/interfaces", s.authenticated(false, http.HandlerFunc(s.handleDHCPInterfaces)))
	s.mux.Handle("POST /api/v1/nodes/{nodeId}/dhcp/active-check", s.authenticated(true, http.HandlerFunc(s.handleDHCPActiveCheck)))
	s.mux.Handle("GET /api/v1/clusters/{clusterId}/configuration-inventory", s.authenticated(false, http.HandlerFunc(s.handleConfigurationInventory)))
	s.mux.Handle("GET /api/v1/clusters/{clusterId}/blocklists/presentation", s.authenticated(false, http.HandlerFunc(s.handleBlocklistPresentation)))
	s.mux.Handle("GET /api/v1/clusters/{clusterId}/allowlists/presentation", s.authenticated(false, http.HandlerFunc(s.handleAllowlistPresentation)))
	s.mux.Handle("GET /api/v1/clusters/{clusterId}/blocked-services/catalogue", s.authenticated(false, http.HandlerFunc(s.handleBlockedServicesCatalogue)))
	s.mux.Handle("GET /api/v1/configuration-comparisons", s.authenticated(false, http.HandlerFunc(s.handleConfigurationComparison)))
	s.mux.Handle("POST /api/v1/clusters/{clusterId}/configuration-draft/import", s.authenticated(true, http.HandlerFunc(s.handleImportConfiguration)))
	if s.controlplane != nil {
		s.mux.Handle("PUT /api/v1/clusters/{clusterId}/configuration-draft", s.authenticated(true, http.HandlerFunc(s.handleUpdateConfigurationDraft)))
		s.mux.Handle("POST /api/v1/clusters/{clusterId}/configuration-draft/validate", s.authenticated(true, http.HandlerFunc(s.handleValidateConfigurationDraft)))
		s.mux.Handle("POST /api/v1/clusters/{clusterId}/configuration-revisions", s.authenticated(true, http.HandlerFunc(s.handlePublishConfigurationRevision)))
		s.mux.Handle("GET /api/v1/clusters/{clusterId}/configuration-revisions", s.authenticated(false, http.HandlerFunc(s.handleListConfigurationRevisions)))
		s.mux.Handle("GET /api/v1/configuration-revisions/{revisionId}", s.authenticated(false, http.HandlerFunc(s.handleGetConfigurationRevision)))
		s.mux.Handle("GET /api/v1/configuration-revision-comparisons", s.authenticated(false, http.HandlerFunc(s.handleConfigurationRevisionComparison)))
		s.mux.Handle("POST /api/v1/clusters/{clusterId}/configuration-revisions/{revisionId}/deployment-preview", s.authenticated(true, http.HandlerFunc(s.handleDeploymentPreview)))
		s.mux.Handle("POST /api/v1/clusters/{clusterId}/configuration-revisions/{revisionId}/deployments", s.authenticated(true, http.HandlerFunc(s.handleStartDeployment)))
		s.mux.Handle("POST /api/v1/clusters/{clusterId}/configuration-revisions/{revisionId}/rollback", s.authenticated(true, http.HandlerFunc(s.handleRollback)))
		s.mux.Handle("GET /api/v1/clusters/{clusterId}/deployments", s.authenticated(false, http.HandlerFunc(s.handleListDeployments)))
		s.mux.Handle("GET /api/v1/deployments/{deploymentId}", s.authenticated(false, http.HandlerFunc(s.handleGetDeployment)))
		s.mux.Handle("POST /api/v1/deployments/{deploymentId}/cancel", s.authenticated(true, http.HandlerFunc(s.handleCancelDeployment)))
		s.mux.Handle("GET /api/v1/clusters/{clusterId}/drift-events", s.authenticated(false, http.HandlerFunc(s.handleListDriftEvents)))
		s.mux.Handle("POST /api/v1/drift-events/{driftId}/restore", s.authenticated(true, http.HandlerFunc(s.handleRestoreDrift)))
		s.mux.Handle("POST /api/v1/drift-events/{driftId}/adopt", s.authenticated(true, http.HandlerFunc(s.handleAdoptDrift)))
	}
	s.mux.Handle("GET /api/v1/audit-events", s.authenticated(false, http.HandlerFunc(s.handleAuditEvents)))
	s.mux.Handle("GET /api/v1/system/version", s.authenticated(false, http.HandlerFunc(s.handleVersion)))
	s.mux.HandleFunc("/", s.handleFrontend)
}

type contextKey string

const (
	requestIDKey contextKey = "request-id"
	sessionKey   contextKey = "session"
	userKey      contextKey = "user"
)

func requestID(ctx context.Context) string {
	value, _ := ctx.Value(requestIDKey).(string)
	return value
}

func authenticatedUser(ctx context.Context) domain.User {
	value, _ := ctx.Value(userKey).(domain.User)
	return value
}

func authenticatedSession(ctx context.Context) domain.Session {
	value, _ := ctx.Value(sessionKey).(domain.Session)
	return value
}

func actor(ctx context.Context) domain.Actor {
	return domain.Actor{UserID: authenticatedUser(ctx).ID, RequestID: requestID(ctx)}
}

func (s *Server) authenticated(requireCSRF bool, next http.Handler) http.Handler {
	return http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
		cookie, err := request.Cookie(sessionCookieName)
		if err != nil {
			s.writeError(response, request, domain.NewError(domain.ErrorAuthentication, "authentication is required"))
			return
		}
		session, user, err := s.auth.Authenticate(request.Context(), cookie.Value)
		if err != nil {
			s.clearAuthCookies(response)
			s.writeError(response, request, err)
			return
		}
		if requireCSRF {
			csrfCookie, cookieErr := request.Cookie(csrfCookieName)
			headerToken := request.Header.Get(csrfHeader)
			if cookieErr != nil || csrfCookie.Value == "" || headerToken == "" || headerToken != csrfCookie.Value || !s.auth.ValidateCSRF(session, headerToken) {
				s.writeError(response, request, domain.NewError(domain.ErrorAuthorisation, "the CSRF token is missing or invalid"))
				return
			}
		}
		ctx := context.WithValue(request.Context(), sessionKey, session)
		ctx = context.WithValue(ctx, userKey, user)
		next.ServeHTTP(response, request.WithContext(ctx))
	})
}

func (s *Server) requestID(next http.Handler) http.Handler {
	return http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
		id := strings.TrimSpace(request.Header.Get(requestIDHeader))
		if !domain.ValidID(id) {
			generated, err := domain.NewID()
			if err != nil {
				http.Error(response, "request identifier unavailable", http.StatusInternalServerError)
				return
			}
			id = generated
		}
		response.Header().Set(requestIDHeader, id)
		next.ServeHTTP(response, request.WithContext(context.WithValue(request.Context(), requestIDKey, id)))
	})
}

func (s *Server) securityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
		response.Header().Set("X-Content-Type-Options", "nosniff")
		response.Header().Set("Referrer-Policy", "no-referrer")
		response.Header().Set("X-Frame-Options", "DENY")
		response.Header().Set("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'")
		response.Header().Set("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
		if strings.HasPrefix(request.URL.Path, "/api/") {
			response.Header().Set("Cache-Control", "no-store")
		}
		next.ServeHTTP(response, request)
	})
}

type statusWriter struct {
	http.ResponseWriter
	status int
}

func (writer *statusWriter) WriteHeader(status int) {
	writer.status = status
	writer.ResponseWriter.WriteHeader(status)
}

func (s *Server) accessLog(next http.Handler) http.Handler {
	return http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
		writer := &statusWriter{ResponseWriter: response, status: http.StatusOK}
		started := time.Now()
		next.ServeHTTP(writer, request)
		s.logger.Info("http request completed",
			"request_id", requestID(request.Context()), "method", request.Method,
			"path", request.URL.Path, "status", writer.status,
			"duration_ms", time.Since(started).Milliseconds())
	})
}

func (s *Server) recover(next http.Handler) http.Handler {
	return http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
		defer func() {
			if recovered := recover(); recovered != nil {
				s.logger.Error("http handler panic", "request_id", requestID(request.Context()), "panic", fmt.Sprint(recovered), "stack", string(debug.Stack()))
				s.writeError(response, request, errors.New("handler panic"))
			}
		}()
		next.ServeHTTP(response, request)
	})
}

func (s *Server) setAuthCookies(response http.ResponseWriter, result auth.SessionResult) {
	maxAge := int(time.Until(result.Session.ExpiresAt).Seconds())
	http.SetCookie(response, &http.Cookie{
		Name: sessionCookieName, Value: result.Token, Path: "/", MaxAge: maxAge,
		Expires: result.Session.ExpiresAt, HttpOnly: true, Secure: s.secureCookies,
		SameSite: http.SameSiteStrictMode,
	})
	http.SetCookie(response, &http.Cookie{
		Name: csrfCookieName, Value: result.CSRFToken, Path: "/", MaxAge: maxAge,
		Expires: result.Session.ExpiresAt, HttpOnly: false, Secure: s.secureCookies,
		SameSite: http.SameSiteStrictMode,
	})
}

func (s *Server) clearAuthCookies(response http.ResponseWriter) {
	expired := time.Unix(1, 0)
	for _, cookie := range []*http.Cookie{
		{Name: sessionCookieName, HttpOnly: true},
		{Name: csrfCookieName, HttpOnly: false},
	} {
		cookie.Value = ""
		cookie.Path = "/"
		cookie.MaxAge = -1
		cookie.Expires = expired
		cookie.Secure = s.secureCookies
		cookie.SameSite = http.SameSiteStrictMode
		http.SetCookie(response, cookie)
	}
}

func remoteIP(request *http.Request) string {
	host, _, err := net.SplitHostPort(request.RemoteAddr)
	if err == nil {
		return host
	}
	return request.RemoteAddr
}

func (s *Server) handleFrontend(response http.ResponseWriter, request *http.Request) {
	if request.Method != http.MethodGet && request.Method != http.MethodHead {
		s.writeError(response, request, domain.NewError(domain.ErrorNotFound, "route was not found"))
		return
	}
	if strings.HasPrefix(request.URL.Path, "/api/") {
		s.writeError(response, request, domain.NewError(domain.ErrorNotFound, "API route was not found"))
		return
	}
	relative := strings.TrimPrefix(filepath.Clean(request.URL.Path), string(filepath.Separator))
	if relative == "." || relative == "" {
		relative = "index.html"
	}
	filePath := filepath.Join(s.webDist, relative)
	if info, err := os.Stat(filePath); err == nil && !info.IsDir() {
		http.ServeFile(response, request, filePath)
		return
	}
	indexPath := filepath.Join(s.webDist, "index.html")
	if _, err := os.Stat(indexPath); err != nil {
		response.Header().Set("Content-Type", "text/plain; charset=utf-8")
		response.WriteHeader(http.StatusServiceUnavailable)
		_, _ = response.Write([]byte("AGH HA Controller frontend has not been built.\n"))
		return
	}
	http.ServeFile(response, request, indexPath)
}
