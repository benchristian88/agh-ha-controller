package api

import "net/http"

func (s *Server) handleSystemSettings(response http.ResponseWriter, request *http.Request) {
	settings, err := s.settings.Get(request.Context())
	if err != nil {
		s.writeError(response, request, err)
		return
	}
	writeJSON(response, http.StatusOK, settings)
}

func (s *Server) handleUpdateSystemSettings(response http.ResponseWriter, request *http.Request) {
	var input struct {
		UpdateChecksEnabled bool `json:"updateChecksEnabled"`
		RecordVersion       int  `json:"recordVersion"`
	}
	if err := decodeJSON(response, request, &input); err != nil {
		s.writeError(response, request, err)
		return
	}
	settings, err := s.settings.Update(request.Context(), actor(request.Context()), input.UpdateChecksEnabled, input.RecordVersion)
	if err != nil {
		s.writeError(response, request, err)
		return
	}
	writeJSON(response, http.StatusOK, settings)
}
