package api

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/benchristian88/agh-ha-controller/internal/domain"
	"github.com/benchristian88/agh-ha-controller/internal/telemetry"
)

func (s *Server) handleStatistics(response http.ResponseWriter, request *http.Request) {
	if s.statistics == nil {
		s.writeError(response, request, domain.NewError(domain.ErrorCapability, "statistics aggregation is unavailable"))
		return
	}
	windowValue := strings.TrimSpace(request.URL.Query().Get("range"))
	if windowValue == "" {
		windowValue = string(telemetry.Range24Hours)
	}
	window, ok := telemetry.ParseRange(windowValue)
	if !ok {
		s.writeError(response, request, domain.Validation("range", "must be 24h, 7d, or 30d"))
		return
	}
	limit := 10
	if value := strings.TrimSpace(request.URL.Query().Get("limit")); value != "" {
		parsed, err := strconv.Atoi(value)
		if err != nil {
			s.writeError(response, request, domain.Validation("limit", "must be an integer between 1 and 25"))
			return
		}
		limit = parsed
	}
	report, err := s.statistics.Statistics(request.Context(), request.PathValue("clusterId"), window, strings.TrimSpace(request.URL.Query().Get("nodeId")), limit)
	if err != nil {
		s.writeError(response, request, err)
		return
	}
	writeJSON(response, http.StatusOK, report)
}
