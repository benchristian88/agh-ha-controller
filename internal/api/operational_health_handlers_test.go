package api

import (
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/benchristian88/agh-ha-controller/internal/operationalhealth"
)

type operationalServiceFake struct{ status operationalhealth.Status }

func (s operationalServiceFake) Status(context.Context, string) (operationalhealth.Status, error) {
	return s.status, nil
}

func TestOperationalStatusHandlerReturnsSafeBoundedPresentation(t *testing.T) {
	service := operationalServiceFake{status: operationalhealth.Status{ClusterID: "11111111-1111-4111-8111-111111111111", Summary: operationalhealth.Summary{State: operationalhealth.Degraded, Message: "Collector is stale."}}}
	server := &Server{operational: service, logger: slog.New(slog.NewTextHandler(io.Discard, nil))}
	request := httptest.NewRequest(http.MethodGet, "/", nil)
	request.SetPathValue("clusterId", "11111111-1111-4111-8111-111111111111")
	response := httptest.NewRecorder()
	server.handleOperationalStatus(response, request)
	if response.Code != http.StatusOK || !json.Valid(response.Body.Bytes()) {
		t.Fatalf("response=%d body=%s", response.Code, response.Body.String())
	}
	for _, forbidden := range []string{"password", "stack", "queryName", "baseUrl"} {
		if strings.Contains(response.Body.String(), forbidden) {
			t.Fatalf("response contains %q", forbidden)
		}
	}
}
