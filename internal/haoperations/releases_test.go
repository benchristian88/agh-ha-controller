package haoperations

import (
	"context"
	"io"
	"net/http"
	"strings"
	"testing"
	"time"
)

type releaseRepositoryFake struct {
	value ReleaseCache
	saves int
}

func (r *releaseRepositoryFake) ReleaseCache(context.Context) (ReleaseCache, error) {
	return r.value, nil
}
func (r *releaseRepositoryFake) SaveReleaseCache(_ context.Context, value ReleaseCache) error {
	r.value = value
	r.saves++
	return nil
}

type roundTripFunc func(*http.Request) (*http.Response, error)

func (f roundTripFunc) RoundTrip(request *http.Request) (*http.Response, error) { return f(request) }

func TestReleaseCheckerCachesSuccessfulPrimarySource(t *testing.T) {
	repository := &releaseRepositoryFake{}
	checker := NewReleaseChecker(repository)
	checker.now = func() time.Time { return time.Date(2026, 8, 9, 0, 0, 0, 0, time.UTC) }
	checker.client = &http.Client{Transport: roundTripFunc(func(request *http.Request) (*http.Response, error) {
		if request.URL.String() != adGuardLatestReleaseURL {
			t.Fatalf("url=%s", request.URL)
		}
		return &http.Response{StatusCode: http.StatusOK, Body: io.NopCloser(strings.NewReader(`{"tag_name":"v0.107.79","html_url":"https://github.com/AdguardTeam/AdGuardHome/releases/tag/v0.107.79"}`)), Header: http.Header{}}, nil
	})}
	if err := checker.Refresh(context.Background()); err != nil {
		t.Fatal(err)
	}
	if repository.value.Version != "v0.107.79" || repository.value.Compatibility != "unknown" || repository.saves != 1 {
		t.Fatalf("cache=%#v saves=%d", repository.value, repository.saves)
	}
	if err := checker.Refresh(context.Background()); err != nil {
		t.Fatal(err)
	}
	if repository.saves != 1 {
		t.Fatalf("fresh cache was not reused: saves=%d", repository.saves)
	}
}
