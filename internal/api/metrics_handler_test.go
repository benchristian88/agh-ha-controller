package api

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/benchristian88/atlas-dns/internal/operationalhealth"
)

func TestMetricsRequiresExplicitTokenAndUsesBoundedLabels(t *testing.T) {
	tracker := operationalhealth.NewTracker()
	tracker.Register("statistics_collection", false)
	tracker.Start("statistics_collection", time.Now().Add(time.Minute))
	tracker.Failure("statistics_collection", "SAFE_ERROR", time.Now().Add(time.Minute))
	server := &Server{metrics: tracker, metricsToken: strings.Repeat("x", 32)}

	disabled := httptest.NewRecorder()
	(&Server{}).handleMetrics(disabled, httptest.NewRequest(http.MethodGet, "/metrics", nil))
	if disabled.Code != http.StatusNotFound {
		t.Fatalf("disabled status = %d", disabled.Code)
	}

	unauthorized := httptest.NewRecorder()
	server.handleMetrics(unauthorized, httptest.NewRequest(http.MethodGet, "/metrics", nil))
	if unauthorized.Code != http.StatusUnauthorized {
		t.Fatalf("unauthorized status = %d", unauthorized.Code)
	}

	request := httptest.NewRequest(http.MethodGet, "/metrics", nil)
	request.Header.Set("Authorization", "Bearer "+strings.Repeat("x", 32))
	response := httptest.NewRecorder()
	server.handleMetrics(response, request)
	body := response.Body.String()
	if response.Code != http.StatusOK || !strings.Contains(body, `atlas_worker_failures_total{worker="statistics_collection"} 1`) {
		t.Fatalf("unexpected metrics response: status=%d body=%q", response.Code, body)
	}
	if strings.Contains(body, "SAFE_ERROR") {
		t.Fatal("metrics exposed error text")
	}
}
