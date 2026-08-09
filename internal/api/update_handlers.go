package api

import "net/http"

func (s *Server) handleControllerUpdate(response http.ResponseWriter, request *http.Request) {
	status, err := s.updates.Status(request.Context(), false)
	if err != nil {
		s.writeError(response, request, err)
		return
	}
	writeJSON(response, http.StatusOK, status)
}

func (s *Server) handleCheckControllerUpdate(response http.ResponseWriter, request *http.Request) {
	status, err := s.updates.Status(request.Context(), true)
	if err != nil {
		s.writeError(response, request, err)
		return
	}
	writeJSON(response, http.StatusOK, status)
}
