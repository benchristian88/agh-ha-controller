package api

import (
	"net/http"
	"strconv"

	"github.com/benchristian88/agh-ha-controller/internal/domain"
	"github.com/benchristian88/agh-ha-controller/internal/operations"
)

func (s *Server) handleTestUpstreamDNS(response http.ResponseWriter, request *http.Request) {
	var input struct {
		Target operations.Target        `json:"target"`
		Input  operations.UpstreamInput `json:"input"`
	}
	if err := decodeJSON(response, request, &input); err != nil {
		s.writeError(response, request, err)
		return
	}
	if s.dnsOperations == nil {
		s.writeError(response, request, domain.NewError(domain.ErrorCapability, "DNS operational commands are unavailable"))
		return
	}
	result, err := s.dnsOperations.StartUpstreamTest(request.Context(), actor(request.Context()), request.PathValue("clusterId"), input.Target, input.Input, request.Header.Get(idempotencyHeader))
	if err != nil {
		s.writeError(response, request, err)
		return
	}
	writeJSON(response, operationHTTPStatus(result), result)
}

func (s *Server) handleClearDNSCache(response http.ResponseWriter, request *http.Request) {
	var input struct {
		Target       operations.Target `json:"target"`
		Confirmation string            `json:"confirmation"`
	}
	if err := decodeJSON(response, request, &input); err != nil {
		s.writeError(response, request, err)
		return
	}
	if s.dnsOperations == nil {
		s.writeError(response, request, domain.NewError(domain.ErrorCapability, "DNS operational commands are unavailable"))
		return
	}
	result, err := s.dnsOperations.StartCacheClear(request.Context(), actor(request.Context()), request.PathValue("clusterId"), input.Target, input.Confirmation, request.Header.Get(idempotencyHeader))
	if err != nil {
		s.writeError(response, request, err)
		return
	}
	writeJSON(response, operationHTTPStatus(result), result)
}

func (s *Server) handleGetDNSOperation(response http.ResponseWriter, request *http.Request) {
	if s.dnsOperations == nil {
		s.writeError(response, request, domain.NewError(domain.ErrorCapability, "DNS operational commands are unavailable"))
		return
	}
	result, err := s.dnsOperations.Operation(request.Context(), request.PathValue("operationId"))
	if err != nil {
		s.writeError(response, request, err)
		return
	}
	writeJSON(response, http.StatusOK, result)
}

func (s *Server) handleListDNSOperations(response http.ResponseWriter, request *http.Request) {
	if s.dnsOperations == nil {
		s.writeError(response, request, domain.NewError(domain.ErrorCapability, "DNS operational commands are unavailable"))
		return
	}
	limit := 10
	if value := request.URL.Query().Get("limit"); value != "" {
		parsed, err := strconv.Atoi(value)
		if err != nil {
			s.writeError(response, request, domain.Validation("limit", "must be an integer"))
			return
		}
		limit = parsed
	}
	items, err := s.dnsOperations.List(request.Context(), request.PathValue("clusterId"), operations.Command(request.URL.Query().Get("command")), limit)
	if err != nil {
		s.writeError(response, request, err)
		return
	}
	writeJSON(response, http.StatusOK, map[string]any{"items": items})
}

func operationHTTPStatus(operation operations.Operation) int {
	if operation.Status == "queued" || operation.Status == "running" {
		return http.StatusAccepted
	}
	return http.StatusOK
}
