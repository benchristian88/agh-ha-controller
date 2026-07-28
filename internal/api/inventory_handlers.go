package api

import (
	"net/http"
	"strconv"

	"github.com/benchristian88/agh-ha-controller/internal/domain"
)

func (s *Server) handleObserveNode(response http.ResponseWriter, request *http.Request) {
	snapshot, err := s.inventory.Observe(request.Context(), request.PathValue("nodeId"))
	if err != nil {
		s.writeError(response, request, err)
		return
	}
	writeJSON(response, http.StatusCreated, snapshot)
}

func (s *Server) handleConfigurationInventory(response http.ResponseWriter, request *http.Request) {
	snapshots, profiles, draft, err := s.inventory.Inventory(request.Context(), request.PathValue("clusterId"))
	if err != nil {
		s.writeError(response, request, err)
		return
	}
	writeJSON(response, http.StatusOK, map[string]any{"schemaVersion": 1, "snapshots": snapshots, "capabilities": profiles, "draft": draft})
}

func (s *Server) handleConfigurationComparison(response http.ResponseWriter, request *http.Request) {
	left, right := request.URL.Query().Get("leftSnapshotId"), request.URL.Query().Get("rightSnapshotId")
	if !domain.ValidID(left) || !domain.ValidID(right) {
		s.writeError(response, request, domain.Validation("snapshotId", "two valid snapshot identifiers are required"))
		return
	}
	differences, err := s.inventory.Compare(request.Context(), left, right)
	if err != nil {
		s.writeError(response, request, err)
		return
	}
	writeJSON(response, http.StatusOK, map[string]any{"equal": len(differences) == 0, "differences": differences})
}

func (s *Server) handleImportConfiguration(response http.ResponseWriter, request *http.Request) {
	var input struct {
		SnapshotID      string `json:"snapshotId"`
		ExpectedVersion int    `json:"expectedVersion"`
		Confirmed       bool   `json:"confirmed"`
	}
	if err := decodeJSON(response, request, &input); err != nil {
		s.writeError(response, request, err)
		return
	}
	if !domain.ValidID(input.SnapshotID) {
		s.writeError(response, request, domain.Validation("snapshotId", "must be a valid UUID"))
		return
	}
	draft, err := s.inventory.Import(request.Context(), actor(request.Context()), request.PathValue("clusterId"), input.SnapshotID, input.ExpectedVersion, input.Confirmed)
	if err != nil {
		s.writeError(response, request, err)
		return
	}
	response.Header().Set("ETag", strconv.Quote(strconv.Itoa(draft.Version)))
	writeJSON(response, http.StatusOK, draft)
}
