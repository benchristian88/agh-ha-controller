package api

import (
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/benchristian88/agh-ha-controller/internal/telemetry"
)

type statisticsServiceFake struct {
	report telemetry.Report
	window telemetry.Range
	nodeID string
	limit  int
}

func (s *statisticsServiceFake) Statistics(_ context.Context, _ string, window telemetry.Range, nodeID string, limit int) (telemetry.Report, error) {
	s.window, s.nodeID, s.limit = window, nodeID, limit
	return s.report, nil
}

func TestStatisticsHandlerReturnsPresentationReport(t *testing.T) {
	service := &statisticsServiceFake{report: telemetry.Report{Range: telemetry.Range7Days, State: "partial"}}
	server := &Server{statistics: service, logger: slog.New(slog.NewTextHandler(io.Discard, nil))}
	request := httptest.NewRequest(http.MethodGet, "/api/v1/clusters/11111111-1111-4111-8111-111111111111/statistics?range=7d&nodeId=22222222-2222-4222-8222-222222222222&limit=5", nil)
	request.SetPathValue("clusterId", "11111111-1111-4111-8111-111111111111")
	response := httptest.NewRecorder()

	server.handleStatistics(response, request)

	if response.Code != http.StatusOK || service.window != telemetry.Range7Days || service.limit != 5 || service.nodeID != "22222222-2222-4222-8222-222222222222" {
		t.Fatalf("response=%d window=%q node=%q limit=%d body=%s", response.Code, service.window, service.nodeID, service.limit, response.Body.String())
	}
	var body telemetry.Report
	if err := json.Unmarshal(response.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	if body.State != "partial" {
		t.Fatalf("state = %q", body.State)
	}
}

func TestStatisticsHandlerRejectsUnknownRange(t *testing.T) {
	server := &Server{statistics: &statisticsServiceFake{}, logger: slog.New(slog.NewTextHandler(io.Discard, nil))}
	request := httptest.NewRequest(http.MethodGet, "/?range=year", nil)
	response := httptest.NewRecorder()
	server.handleStatistics(response, request)
	if response.Code != http.StatusBadRequest || !json.Valid(response.Body.Bytes()) {
		t.Fatalf("unexpected response: %d %s", response.Code, response.Body.String())
	}
}
