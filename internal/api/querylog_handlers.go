package api

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/benchristian88/agh-ha-controller/internal/domain"
	"github.com/benchristian88/agh-ha-controller/internal/querylog"
)

func (s *Server) handleQueryEvents(response http.ResponseWriter, request *http.Request) {
	if s.queryLog == nil {
		s.writeError(response, request, domain.NewError(domain.ErrorCapability, "query-log collection is unavailable"))
		return
	}
	limit := 50
	if value := strings.TrimSpace(request.URL.Query().Get("limit")); value != "" {
		parsed, err := strconv.Atoi(value)
		if err != nil {
			s.writeError(response, request, domain.Validation("limit", "must be an integer between 1 and 100"))
			return
		}
		limit = parsed
	}
	page, err := s.queryLog.List(request.Context(), querylog.ListRequest{
		ClusterID: request.PathValue("clusterId"), NodeID: strings.TrimSpace(request.URL.Query().Get("nodeId")),
		Cursor: strings.TrimSpace(request.URL.Query().Get("cursor")), Search: request.URL.Query().Get("search"),
		Status: strings.TrimSpace(request.URL.Query().Get("status")), QueryType: strings.TrimSpace(request.URL.Query().Get("queryType")),
		Client: request.URL.Query().Get("client"), Limit: limit,
	})
	if err != nil {
		s.writeError(response, request, err)
		return
	}
	writeJSON(response, http.StatusOK, page)
}

func (s *Server) handleQueryEventDetail(response http.ResponseWriter, request *http.Request) {
	if s.queryLog == nil {
		s.writeError(response, request, domain.NewError(domain.ErrorCapability, "query-log collection is unavailable"))
		return
	}
	event, err := s.queryLog.Detail(request.Context(), request.PathValue("clusterId"), request.PathValue("eventId"))
	if err != nil {
		s.writeError(response, request, err)
		return
	}
	writeJSON(response, http.StatusOK, event)
}
