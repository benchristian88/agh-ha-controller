package api

import (
	"net/http"

	"github.com/benchristian88/agh-ha-controller/internal/configuration"
	"github.com/benchristian88/agh-ha-controller/internal/domain"
)

func (s *Server) handleUpdateConfigurationDraft(response http.ResponseWriter, request *http.Request) {
	var input struct {
		ExpectedVersion int                           `json:"expectedVersion"`
		Document        configuration.DesiredDocument `json:"document"`
	}
	if err := decodeJSON(response, request, &input); err != nil {
		s.writeError(response, request, err)
		return
	}
	draft, issues, err := s.controlplane.UpdateDraft(request.Context(), actor(request.Context()), request.PathValue("clusterId"), input.ExpectedVersion, input.Document)
	if err != nil {
		s.writeError(response, request, err)
		return
	}
	writeJSON(response, http.StatusOK, map[string]any{"draft": draft, "issues": issues})
}

func (s *Server) handleValidateConfigurationDraft(response http.ResponseWriter, request *http.Request) {
	preview, err := s.controlplane.ValidateDraft(request.Context(), request.PathValue("clusterId"))
	if err != nil {
		s.writeError(response, request, err)
		return
	}
	writeJSON(response, http.StatusOK, preview)
}

func (s *Server) handlePublishConfigurationRevision(response http.ResponseWriter, request *http.Request) {
	var input struct {
		Summary         string `json:"summary"`
		ExpectedVersion int    `json:"expectedVersion"`
	}
	if err := decodeJSON(response, request, &input); err != nil {
		s.writeError(response, request, err)
		return
	}
	revision, err := s.controlplane.Publish(request.Context(), actor(request.Context()), request.PathValue("clusterId"), input.Summary, input.ExpectedVersion)
	if err != nil {
		s.writeError(response, request, err)
		return
	}
	writeJSON(response, http.StatusCreated, revision)
}

func (s *Server) handleListConfigurationRevisions(response http.ResponseWriter, request *http.Request) {
	items, err := s.controlplane.ListRevisions(request.Context(), request.PathValue("clusterId"))
	if err != nil {
		s.writeError(response, request, err)
		return
	}
	writeJSON(response, http.StatusOK, map[string]any{"items": items})
}

func (s *Server) handleGetConfigurationRevision(response http.ResponseWriter, request *http.Request) {
	item, err := s.controlplane.Revision(request.Context(), request.PathValue("revisionId"))
	if err != nil {
		s.writeError(response, request, err)
		return
	}
	writeJSON(response, http.StatusOK, item)
}

func (s *Server) handleConfigurationRevisionComparison(response http.ResponseWriter, request *http.Request) {
	differences, err := s.controlplane.CompareRevisions(request.Context(), request.URL.Query().Get("leftRevisionId"), request.URL.Query().Get("rightRevisionId"))
	if err != nil {
		s.writeError(response, request, err)
		return
	}
	writeJSON(response, http.StatusOK, map[string]any{"equal": len(differences) == 0, "differences": differences})
}

func (s *Server) handleDeploymentPreview(response http.ResponseWriter, request *http.Request) {
	preview, err := s.controlplane.PreviewDeployment(request.Context(), request.PathValue("clusterId"), request.PathValue("revisionId"))
	if err != nil {
		s.writeError(response, request, err)
		return
	}
	writeJSON(response, http.StatusOK, preview)
}

func (s *Server) handleStartDeployment(response http.ResponseWriter, request *http.Request) {
	var input struct {
		TargetNodeIDs []string `json:"targetNodeIds"`
	}
	if err := decodeJSON(response, request, &input); err != nil {
		s.writeError(response, request, err)
		return
	}
	deployment, err := s.controlplane.StartDeployment(request.Context(), actor(request.Context()), request.PathValue("clusterId"), request.PathValue("revisionId"), "manual", nil, input.TargetNodeIDs)
	if err != nil {
		s.writeError(response, request, err)
		return
	}
	writeJSON(response, http.StatusAccepted, deployment)
}

func (s *Server) handleRollback(response http.ResponseWriter, request *http.Request) {
	var input struct {
		Confirmed bool `json:"confirmed"`
	}
	if err := decodeJSON(response, request, &input); err != nil {
		s.writeError(response, request, err)
		return
	}
	if !input.Confirmed {
		s.writeError(response, request, domain.Validation("confirmed", "must be true after reviewing the revision difference"))
		return
	}
	deployment, err := s.controlplane.Rollback(request.Context(), actor(request.Context()), request.PathValue("clusterId"), request.PathValue("revisionId"))
	if err != nil {
		s.writeError(response, request, err)
		return
	}
	writeJSON(response, http.StatusAccepted, deployment)
}

func (s *Server) handleListDeployments(response http.ResponseWriter, request *http.Request) {
	items, err := s.controlplane.ListDeployments(request.Context(), request.PathValue("clusterId"))
	if err != nil {
		s.writeError(response, request, err)
		return
	}
	writeJSON(response, http.StatusOK, map[string]any{"items": items})
}

func (s *Server) handleGetDeployment(response http.ResponseWriter, request *http.Request) {
	item, err := s.controlplane.Deployment(request.Context(), request.PathValue("deploymentId"))
	if err != nil {
		s.writeError(response, request, err)
		return
	}
	writeJSON(response, http.StatusOK, item)
}

func (s *Server) handleCancelDeployment(response http.ResponseWriter, request *http.Request) {
	if err := s.controlplane.CancelDeployment(request.Context(), actor(request.Context()), request.PathValue("deploymentId")); err != nil {
		s.writeError(response, request, err)
		return
	}
	response.WriteHeader(http.StatusNoContent)
}

func (s *Server) handleListDriftEvents(response http.ResponseWriter, request *http.Request) {
	items, err := s.controlplane.ListDrift(request.Context(), request.PathValue("clusterId"))
	if err != nil {
		s.writeError(response, request, err)
		return
	}
	writeJSON(response, http.StatusOK, map[string]any{"items": items})
}

func (s *Server) handleRestoreDrift(response http.ResponseWriter, request *http.Request) {
	deployment, err := s.controlplane.RestoreDrift(request.Context(), actor(request.Context()), request.PathValue("driftId"))
	if err != nil {
		s.writeError(response, request, err)
		return
	}
	writeJSON(response, http.StatusAccepted, deployment)
}

func (s *Server) handleAdoptDrift(response http.ResponseWriter, request *http.Request) {
	var input struct {
		ExpectedDraftVersion int `json:"expectedDraftVersion"`
	}
	if err := decodeJSON(response, request, &input); err != nil {
		s.writeError(response, request, err)
		return
	}
	draft, err := s.controlplane.AdoptDrift(request.Context(), actor(request.Context()), request.PathValue("driftId"), input.ExpectedDraftVersion)
	if err != nil {
		s.writeError(response, request, err)
		return
	}
	writeJSON(response, http.StatusOK, draft)
}
