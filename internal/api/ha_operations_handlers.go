package api

import (
	"net/http"

	"github.com/benchristian88/agh-ha-controller/internal/domain"
	"github.com/benchristian88/agh-ha-controller/internal/haoperations"
)

func (s *Server) requireHA(response http.ResponseWriter, request *http.Request) bool {
	if s.haOperations == nil {
		s.writeError(response, request, domain.NewError(domain.ErrorNotFound, "HA operations are unavailable"))
		return false
	}
	return true
}

func (s *Server) handleHAStatus(response http.ResponseWriter, request *http.Request) {
	if !s.requireHA(response, request) {
		return
	}
	value, err := s.haOperations.Summary(request.Context(), request.PathValue("clusterId"))
	if err != nil {
		s.writeError(response, request, err)
		return
	}
	writeJSON(response, http.StatusOK, value)
}
func (s *Server) handleNodeLifecycle(response http.ResponseWriter, request *http.Request) {
	if !s.requireHA(response, request) {
		return
	}
	value, err := s.haOperations.Lifecycle(request.Context(), request.PathValue("nodeId"))
	if err != nil {
		s.writeError(response, request, err)
		return
	}
	writeJSON(response, http.StatusOK, value)
}
func (s *Server) handleHAHistory(response http.ResponseWriter, request *http.Request) {
	if !s.requireHA(response, request) {
		return
	}
	limit := parseBoundedInt(request.URL.Query().Get("limit"), 100, 1, 200)
	value, err := s.haOperations.History(request.Context(), request.PathValue("clusterId"), request.URL.Query().Get("nodeId"), limit)
	if err != nil {
		s.writeError(response, request, err)
		return
	}
	writeJSON(response, http.StatusOK, map[string]any{"items": value})
}
func (s *Server) handleCertificates(response http.ResponseWriter, request *http.Request) {
	if !s.requireHA(response, request) {
		return
	}
	value, err := s.haOperations.Certificates(request.Context(), request.PathValue("clusterId"))
	if err != nil {
		s.writeError(response, request, err)
		return
	}
	writeJSON(response, http.StatusOK, map[string]any{"items": value})
}
func (s *Server) handleVersions(response http.ResponseWriter, request *http.Request) {
	if !s.requireHA(response, request) {
		return
	}
	value, err := s.haOperations.Versions(request.Context(), request.PathValue("clusterId"))
	if err != nil {
		s.writeError(response, request, err)
		return
	}
	writeJSON(response, http.StatusOK, map[string]any{"items": value})
}
func (s *Server) handleMaintenancePreflight(response http.ResponseWriter, request *http.Request) {
	if !s.requireHA(response, request) {
		return
	}
	value, err := s.haOperations.MaintenancePreflight(request.Context(), request.PathValue("nodeId"))
	if err != nil {
		s.writeError(response, request, err)
		return
	}
	writeJSON(response, http.StatusOK, value)
}
func (s *Server) handleDNSProbe(response http.ResponseWriter, request *http.Request) {
	if !s.requireHA(response, request) {
		return
	}
	value, err := s.haOperations.ProbeNode(request.Context(), request.PathValue("nodeId"))
	if err != nil {
		s.writeError(response, request, err)
		return
	}
	writeJSON(response, http.StatusOK, value)
}

func (s *Server) handleLifecycleSettings(response http.ResponseWriter, request *http.Request) {
	if !s.requireHA(response, request) {
		return
	}
	var input struct {
		haoperations.NodeSettings
		RecordVersion int `json:"recordVersion"`
	}
	if err := decodeJSON(response, request, &input); err != nil {
		s.writeError(response, request, err)
		return
	}
	value, err := s.haOperations.UpdateSettings(request.Context(), actor(request.Context()), request.PathValue("nodeId"), input.NodeSettings, input.RecordVersion)
	if err != nil {
		s.writeError(response, request, err)
		return
	}
	writeJSON(response, http.StatusOK, value)
}

func (s *Server) handleReturnToService(response http.ResponseWriter, request *http.Request) {
	if !s.requireHA(response, request) {
		return
	}
	var input struct {
		RecordVersion int `json:"recordVersion"`
	}
	if err := decodeJSON(response, request, &input); err != nil {
		s.writeError(response, request, err)
		return
	}
	value, err := s.haOperations.ReturnToService(request.Context(), actor(request.Context()), request.PathValue("nodeId"), input.RecordVersion)
	if err != nil {
		s.writeError(response, request, err)
		return
	}
	writeJSON(response, http.StatusOK, value)
}

func (s *Server) handleStartUpgrade(response http.ResponseWriter, request *http.Request) {
	if !s.requireHA(response, request) {
		return
	}
	var input struct {
		TargetVersion string `json:"targetVersion"`
	}
	if err := decodeJSON(response, request, &input); err != nil {
		s.writeError(response, request, err)
		return
	}
	value, err := s.haOperations.StartUpgrade(request.Context(), actor(request.Context()), request.PathValue("nodeId"), input.TargetVersion)
	if err != nil {
		s.writeError(response, request, err)
		return
	}
	writeJSON(response, http.StatusAccepted, value)
}
func (s *Server) handleValidateUpgrade(response http.ResponseWriter, request *http.Request) {
	if !s.requireHA(response, request) {
		return
	}
	var input struct {
		RecordVersion int `json:"recordVersion"`
	}
	if err := decodeJSON(response, request, &input); err != nil {
		s.writeError(response, request, err)
		return
	}
	value, err := s.haOperations.CompleteUpgrade(request.Context(), actor(request.Context()), request.PathValue("upgradeId"), input.RecordVersion)
	if err != nil {
		s.writeError(response, request, err)
		return
	}
	writeJSON(response, http.StatusOK, value)
}
func (s *Server) handleUpgrades(response http.ResponseWriter, request *http.Request) {
	if !s.requireHA(response, request) {
		return
	}
	value, err := s.haOperations.Upgrades(request.Context(), request.PathValue("clusterId"), parseBoundedInt(request.URL.Query().Get("limit"), 100, 1, 200))
	if err != nil {
		s.writeError(response, request, err)
		return
	}
	writeJSON(response, http.StatusOK, map[string]any{"items": value})
}

func (s *Server) handleNotificationChannels(response http.ResponseWriter, request *http.Request) {
	if s.notifications == nil {
		s.writeError(response, request, domain.NewError(domain.ErrorNotFound, "notification settings are unavailable"))
		return
	}
	value, err := s.notifications.List(request.Context(), request.PathValue("clusterId"))
	if err != nil {
		s.writeError(response, request, err)
		return
	}
	writeJSON(response, http.StatusOK, map[string]any{"items": value})
}
func (s *Server) handleSaveNotificationChannel(response http.ResponseWriter, request *http.Request) {
	if s.notifications == nil {
		s.writeError(response, request, domain.NewError(domain.ErrorNotFound, "notification settings are unavailable"))
		return
	}
	var input struct {
		ID            string `json:"id"`
		Name          string `json:"name"`
		Destination   string `json:"destination"`
		Enabled       bool   `json:"enabled"`
		RecordVersion int    `json:"recordVersion"`
	}
	if err := decodeJSON(response, request, &input); err != nil {
		s.writeError(response, request, err)
		return
	}
	value, err := s.notifications.Save(request.Context(), actor(request.Context()), request.PathValue("clusterId"), input.ID, input.Name, input.Destination, input.Enabled, input.RecordVersion)
	if err != nil {
		s.writeError(response, request, err)
		return
	}
	writeJSON(response, http.StatusOK, value)
}
func (s *Server) handleDeleteNotificationChannel(response http.ResponseWriter, request *http.Request) {
	if s.notifications == nil {
		s.writeError(response, request, domain.NewError(domain.ErrorNotFound, "notification settings are unavailable"))
		return
	}
	var input struct {
		RecordVersion int `json:"recordVersion"`
	}
	if err := decodeJSON(response, request, &input); err != nil {
		s.writeError(response, request, err)
		return
	}
	if err := s.notifications.Delete(request.Context(), actor(request.Context()), request.PathValue("channelId"), input.RecordVersion); err != nil {
		s.writeError(response, request, err)
		return
	}
	response.WriteHeader(http.StatusNoContent)
}
