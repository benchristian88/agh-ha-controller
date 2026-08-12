package updates

import (
	"context"
	"io"
	"net/http"
	"strings"
	"testing"
	"time"
)

type repositoryStub struct {
	cache         Cache
	checksEnabled *bool
}

func (r *repositoryStub) ControllerReleaseCache(context.Context) (Cache, error) { return r.cache, nil }
func (r *repositoryStub) SaveControllerReleaseCache(_ context.Context, value Cache) error {
	r.cache = value
	return nil
}
func (r *repositoryStub) UpdateChecksEnabled(context.Context) (bool, error) {
	if r.checksEnabled == nil {
		return true, nil
	}
	return *r.checksEnabled, nil
}

type roundTripper func(*http.Request) (*http.Response, error)

func (r roundTripper) RoundTrip(request *http.Request) (*http.Response, error) { return r(request) }

func TestStatusCachesStableReleaseAndReportsUpdate(t *testing.T) {
	repository := &repositoryStub{}
	service := NewService(repository, "docker")
	service.now = func() time.Time { return time.Unix(100, 0).UTC() }
	service.client = &http.Client{Transport: roundTripper(func(request *http.Request) (*http.Response, error) {
		return &http.Response{StatusCode: http.StatusOK, Body: io.NopCloser(strings.NewReader(`{"tag_name":"v9.0.0","html_url":"https://github.com/benchristian88/atlas-dns/releases/tag/v9.0.0","body":"notes"}`))}, nil
	})}
	status, err := service.Status(context.Background(), false)
	if err != nil {
		t.Fatal(err)
	}
	if status.LatestVersion != "9.0.0" || status.UpdateCommand == "" {
		t.Fatalf("unexpected status: %#v", status)
	}
	if !strings.Contains(status.UpdateCommand, "docker compose pull atlas-dns") || strings.Contains(status.UpdateCommand, "git ") || strings.Contains(status.UpdateCommand, "build") {
		t.Fatalf("docker guidance must consume the prebuilt Atlas image: %q", status.UpdateCommand)
	}
}

func TestNativeStatusRequiresVerifiedReleaseInstaller(t *testing.T) {
	repository := &repositoryStub{cache: Cache{Version: "1.0.1", ReleaseURL: "https://github.com/benchristian88/atlas-dns/releases/tag/v1.0.1", ExpiresAt: time.Now().Add(time.Hour)}}
	service := NewService(repository, "native_systemd")
	status, err := service.Status(context.Background(), false)
	if err != nil {
		t.Fatal(err)
	}
	for _, required := range []string{"releases/download/v1.0.1/install-systemd.sh", "checksums.txt", "sha256sum --check", "ATLAS_DNS_VERSION=1.0.1"} {
		if !strings.Contains(status.UpdateCommand, required) {
			t.Fatalf("native update guidance is missing %q: %q", required, status.UpdateCommand)
		}
	}
	if strings.Contains(status.UpdateCommand, "git checkout") || strings.Contains(status.UpdateCommand, "go build") {
		t.Fatalf("native guidance must not compile source: %q", status.UpdateCommand)
	}
}

func TestMalformedMetadataIsFailureSafe(t *testing.T) {
	repository := &repositoryStub{cache: Cache{Version: "0.9.0", ReleaseURL: "https://github.com/benchristian88/atlas-dns/releases/tag/v0.9.0"}}
	service := NewService(repository, "unknown")
	service.client = &http.Client{Transport: roundTripper(func(request *http.Request) (*http.Response, error) {
		return &http.Response{StatusCode: http.StatusOK, Body: io.NopCloser(strings.NewReader(`{"tag_name":"bad","html_url":"https://evil.example/release"}`))}, nil
	})}
	status, err := service.Status(context.Background(), true)
	if err != nil {
		t.Fatal(err)
	}
	if status.ErrorCode != "CONTROLLER_UPDATE_METADATA_INVALID" || status.LatestVersion != "0.9.0" {
		t.Fatalf("unexpected failure state: %#v", status)
	}
}

func TestCompareStableVersions(t *testing.T) {
	if compare("0.9.1", "0.9.0") != 1 || compare("0.8.9", "0.9.0") != -1 || compare("0.9.0", "0.9.0") != 0 {
		t.Fatal("version comparison failed")
	}
}

func TestDisabledChecksNeverCallExternalReleaseSource(t *testing.T) {
	disabled := false
	repository := &repositoryStub{checksEnabled: &disabled}
	service := NewService(repository, "native_systemd")
	service.client = &http.Client{Transport: roundTripper(func(request *http.Request) (*http.Response, error) {
		t.Fatal("external release source was called while checks were disabled")
		return nil, nil
	})}
	status, err := service.Status(context.Background(), true)
	if err != nil {
		t.Fatal(err)
	}
	if status.State != "unknown" || status.ErrorCode != "CONTROLLER_UPDATE_CHECKS_DISABLED" {
		t.Fatalf("unexpected disabled state: %#v", status)
	}
}

func TestRateLimitRetainsLastKnownRelease(t *testing.T) {
	repository := &repositoryStub{cache: Cache{Version: "0.9.0", ReleaseURL: "https://github.com/benchristian88/atlas-dns/releases/tag/v0.9.0"}}
	service := NewService(repository, "docker")
	service.client = &http.Client{Transport: roundTripper(func(request *http.Request) (*http.Response, error) {
		return &http.Response{StatusCode: http.StatusTooManyRequests, Body: io.NopCloser(strings.NewReader("rate limited"))}, nil
	})}
	status, err := service.Status(context.Background(), true)
	if err != nil {
		t.Fatal(err)
	}
	if status.ErrorCode != "CONTROLLER_UPDATE_CHECK_RATE_LIMITED" || status.LatestVersion != "0.9.0" {
		t.Fatalf("unexpected rate-limit state: %#v", status)
	}
}
