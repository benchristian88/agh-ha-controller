package adguard

import (
	"context"
	"encoding/pem"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/benchristian88/atlas-dns/internal/domain"
)

func TestProbeStatus(t *testing.T) {
	t.Parallel()
	server := httptest.NewServer(http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
		username, password, ok := request.BasicAuth()
		if !ok || username != "admin" || password != "secret" {
			response.WriteHeader(http.StatusUnauthorized)
			return
		}
		if request.URL.Path != "/control/status" {
			t.Errorf("path = %q", request.URL.Path)
		}
		_, _ = response.Write([]byte(`{"version":"v0.107.65","running":true}`))
	}))
	defer server.Close()
	result, err := NewProbe(time.Second).Status(context.Background(), domain.NodeProbeRequest{
		BaseURL: server.URL, CertificatePolicy: domain.CertificateInsecureHTTP,
		Credentials: domain.NodeCredentials{Username: "admin", Password: "secret"},
	})
	if err != nil {
		t.Fatalf("Status() error = %v", err)
	}
	if result.Version != "v0.107.65" || result.Compatibility != domain.CompatibilitySupported || !result.Running {
		t.Fatalf("Status() = %#v", result)
	}
}

func TestProbeSeparatesAuthenticationAndTLSFailures(t *testing.T) {
	t.Parallel()
	authServer := httptest.NewServer(http.HandlerFunc(func(response http.ResponseWriter, _ *http.Request) {
		response.WriteHeader(http.StatusUnauthorized)
	}))
	defer authServer.Close()
	_, authErr := NewProbe(time.Second).Status(context.Background(), domain.NodeProbeRequest{
		BaseURL: authServer.URL, CertificatePolicy: domain.CertificateInsecureHTTP,
	})
	assertDomainErrorKind(t, authErr, domain.ErrorNodeAuth)

	tlsServer := httptest.NewTLSServer(http.HandlerFunc(func(response http.ResponseWriter, _ *http.Request) {
		_, _ = response.Write([]byte(`{"version":"v0.107.65","running":true}`))
	}))
	defer tlsServer.Close()
	_, tlsErr := NewProbe(time.Second).Status(context.Background(), domain.NodeProbeRequest{
		BaseURL: tlsServer.URL, CertificatePolicy: domain.CertificateSystemTrust,
	})
	assertDomainErrorKind(t, tlsErr, domain.ErrorNodeTLS)
}

func TestProbeSupportsCustomCA(t *testing.T) {
	t.Parallel()
	server := httptest.NewTLSServer(http.HandlerFunc(func(response http.ResponseWriter, _ *http.Request) {
		_, _ = response.Write([]byte(`{"version":"v0.107.65","running":true}`))
	}))
	defer server.Close()
	certificate := server.Certificate()
	ca := pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: certificate.Raw})
	result, err := NewProbe(time.Second).Status(context.Background(), domain.NodeProbeRequest{
		BaseURL: server.URL, CertificatePolicy: domain.CertificateCustomCA, CustomCAPEM: string(ca),
	})
	if err != nil {
		t.Fatalf("Status(custom CA) error = %v", err)
	}
	if !result.Running {
		t.Fatal("Status(custom CA) reported node not running")
	}
}

func TestVersionCompatibility(t *testing.T) {
	t.Parallel()
	for version, want := range map[string]domain.Compatibility{
		"v0.107.0": domain.CompatibilitySupported,
		"v0.106.3": domain.CompatibilityUnsupported,
		"v1.0.0":   domain.CompatibilitySupported,
		"invalid":  domain.CompatibilityUnknown,
	} {
		if got := VersionCompatibility(version); got != want {
			t.Errorf("VersionCompatibility(%q) = %q, want %q", version, got, want)
		}
	}
}

func TestConfigurationCompatibilityBoundaries(t *testing.T) {
	t.Parallel()
	for version, want := range map[string]domain.Compatibility{
		"v0.107.51": domain.CompatibilityUnsupported,
		"v0.107.52": domain.CompatibilitySupported,
		"v0.107.53": domain.CompatibilitySupported,
		"v0.107.78": domain.CompatibilitySupported,
		"v0.107.79": domain.CompatibilityUnknown,
		"v0.108.0":  domain.CompatibilityUnknown,
		"invalid":   domain.CompatibilityUnknown,
	} {
		if got := ConfigurationCompatibility(version); got != want {
			t.Errorf("ConfigurationCompatibility(%q) = %q, want %q", version, got, want)
		}
	}
	if supportsSchemaV2("v0.107.52") || !supportsSchemaV2("v0.107.53") {
		t.Fatal("schema-v2 compatibility boundary must start at v0.107.53")
	}
}

func TestProbeRejectsIncompleteStatusDocument(t *testing.T) {
	t.Parallel()
	server := httptest.NewServer(http.HandlerFunc(func(response http.ResponseWriter, _ *http.Request) {
		_, _ = response.Write([]byte(`{"version":"v0.107.65"}`))
	}))
	defer server.Close()
	_, err := NewProbe(time.Second).Status(context.Background(), domain.NodeProbeRequest{
		BaseURL: server.URL, CertificatePolicy: domain.CertificateInsecureHTTP,
	})
	assertDomainErrorKind(t, err, domain.ErrorNodeResponse)
}

func assertDomainErrorKind(t *testing.T, err error, want domain.ErrorKind) {
	t.Helper()
	if err == nil || !strings.Contains(err.Error(), "node") {
		t.Fatalf("error = %v", err)
	}
	domainError, ok := err.(*domain.Error)
	if !ok || domainError.Kind != want {
		t.Fatalf("error = %#v, want kind %s", err, want)
	}
}
