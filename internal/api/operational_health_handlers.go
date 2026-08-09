package api

import (
	"net/http"

	"github.com/benchristian88/agh-ha-controller/internal/domain"
)

func (s *Server) handleOperationalStatus(response http.ResponseWriter, request *http.Request) {
	if s.operational == nil {
		s.writeError(response, request, domain.NewError(domain.ErrorNotFound, "operational status is unavailable"))
		return
	}
	status, err := s.operational.Status(request.Context(), request.PathValue("clusterId"))
	if err != nil {
		s.writeError(response, request, err)
		return
	}
	if err := status.ValidateBounded(); err != nil {
		s.logger.Error("operational status payload exceeded bound", "request_id", requestID(request.Context()), "error", err)
		s.writeError(response, request, domain.NewError(domain.ErrorInternal, "operational status is temporarily unavailable"))
		return
	}
	writeJSON(response, http.StatusOK, status)
}
