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
func (s *Server) handleCreateNotificationChannel(response http.ResponseWriter, request *http.Request) {
	if s.notifications == nil {
		s.writeError(response, request, domain.NewError(domain.ErrorNotFound, "notification settings are unavailable"))
		return
	}
	var input struct {
		Name        string `json:"name"`
		Destination string `json:"destination"`
		Enabled     bool   `json:"enabled"`
	}
	if err := decodeJSON(response, request, &input); err != nil {
		s.writeError(response, request, err)
		return
	}
	value, err := s.notifications.Create(request.Context(), actor(request.Context()), request.PathValue("clusterId"), input.Name, input.Destination, input.Enabled)
	if err != nil {
		s.writeError(response, request, err)
		return
	}
	writeJSON(response, http.StatusCreated, value)
}
func (s *Server) handleUpdateNotificationChannel(response http.ResponseWriter, request *http.Request) {
	if s.notifications == nil {
		s.writeError(response, request, domain.NewError(domain.ErrorNotFound, "notification settings are unavailable"))
		return
	}
	var input struct {
		Name               string  `json:"name"`
		Destination        *string `json:"destination"`
		ReplaceDestination bool    `json:"replaceDestination"`
		Enabled            bool    `json:"enabled"`
		RecordVersion      int     `json:"recordVersion"`
	}
	if err := decodeJSON(response, request, &input); err != nil {
		s.writeError(response, request, err)
		return
	}
	if input.Destination != nil && !input.ReplaceDestination {
		s.writeError(response, request, domain.Validation("replaceDestination", "must be true to replace the hidden destination"))
		return
	}
	if input.ReplaceDestination && input.Destination == nil {
		s.writeError(response, request, domain.Validation("destination", "is required when replacing the hidden destination"))
		return
	}
	destination := input.Destination
	if !input.ReplaceDestination {
		destination = nil
	}
	value, err := s.notifications.Update(request.Context(), actor(request.Context()), request.PathValue("channelId"), input.Name, destination, input.Enabled, input.RecordVersion)
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
		RecordVersion int    `json:"recordVersion"`
		Confirmation  string `json:"confirmation"`
	}
	if err := decodeJSON(response, request, &input); err != nil {
		s.writeError(response, request, err)
		return
	}
	if err := s.notifications.Delete(request.Context(), actor(request.Context()), request.PathValue("channelId"), input.Confirmation, input.RecordVersion); err != nil {
		s.writeError(response, request, err)
		return
	}
	response.WriteHeader(http.StatusNoContent)
}
func (s *Server) handleTestNotificationChannel(response http.ResponseWriter, request *http.Request) {
	if s.notifications == nil {
		s.writeError(response, request, domain.NewError(domain.ErrorNotFound, "notification settings are unavailable"))
		return
	}
	value, err := s.notifications.Test(request.Context(), actor(request.Context()), request.PathValue("channelId"))
	if err != nil {
		s.writeError(response, request, err)
		return
	}
	writeJSON(response, http.StatusOK, value)
}
