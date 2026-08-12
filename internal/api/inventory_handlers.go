package api

import (
	"net/http"
	"strconv"

	"github.com/benchristian88/atlas-dns/internal/configuration"
	"github.com/benchristian88/atlas-dns/internal/domain"
	"github.com/benchristian88/atlas-dns/internal/inventory"
)

type configurationInventoryResponse struct {
	SchemaVersion int                           `json:"schemaVersion"`
	Snapshots     []inventory.Snapshot          `json:"snapshots"`
	Capabilities  []inventory.CapabilityProfile `json:"capabilities"`
	Draft         *inventory.Draft              `json:"draft,omitempty"`
}

func (s *Server) handleObserveNode(response http.ResponseWriter, request *http.Request) {
	snapshot, err := s.inventory.Observe(request.Context(), request.PathValue("nodeId"))
	if err != nil {
		s.writeError(response, request, err)
		return
	}
	writeJSON(response, http.StatusCreated, snapshot)
}

func (s *Server) handleFilterRefresh(response http.ResponseWriter, request *http.Request) {
	var input struct {
		Whitelist bool `json:"whitelist"`
	}
	if err := decodeJSON(response, request, &input); err != nil {
		s.writeError(response, request, err)
		return
	}
	if err := s.inventory.RefreshFilters(request.Context(), actor(request.Context()), request.PathValue("nodeId"), input.Whitelist); err != nil {
		s.writeError(response, request, err)
		return
	}
	writeJSON(response, http.StatusOK, map[string]any{"nodeId": request.PathValue("nodeId"), "whitelist": input.Whitelist, "status": "succeeded"})
}

func (s *Server) handleDHCPInterfaces(response http.ResponseWriter, request *http.Request) {
	result, err := s.dhcpInterfaces.DHCPInterfaces(request.Context(), request.PathValue("nodeId"))
	if err != nil {
		s.writeError(response, request, err)
		return
	}
	writeJSON(response, http.StatusOK, result)
}

func (s *Server) handleDHCPActiveCheck(response http.ResponseWriter, request *http.Request) {
	var input struct {
		InterfaceName string `json:"interfaceName"`
	}
	if err := decodeJSON(response, request, &input); err != nil {
		s.writeError(response, request, err)
		return
	}
	result, err := s.dhcpChecker.FindActiveDHCP(request.Context(), actor(request.Context()), request.PathValue("nodeId"), input.InterfaceName)
	if err != nil {
		s.writeError(response, request, err)
		return
	}
	writeJSON(response, http.StatusOK, result)
}

func (s *Server) handleDHCPResetLeases(response http.ResponseWriter, request *http.Request) {
	s.handleDHCPOperation(response, request, inventory.DHCPOperationResetLeases)
}

func (s *Server) handleDHCPResetConfiguration(response http.ResponseWriter, request *http.Request) {
	s.handleDHCPOperation(response, request, inventory.DHCPOperationResetConfiguration)
}

func (s *Server) handleDHCPOperation(response http.ResponseWriter, request *http.Request, command inventory.DHCPOperationCommand) {
	var input struct {
		Confirmation string `json:"confirmation"`
	}
	if err := decodeJSON(response, request, &input); err != nil {
		s.writeError(response, request, err)
		return
	}
	result, err := s.dhcpOperations.RunDHCPOperation(
		request.Context(), actor(request.Context()), request.PathValue("nodeId"),
		command, input.Confirmation, request.Header.Get(idempotencyHeader),
	)
	if err != nil {
		s.writeError(response, request, err)
		return
	}
	writeJSON(response, http.StatusOK, result)
}

func (s *Server) handleListDHCPOperations(response http.ResponseWriter, request *http.Request) {
	limit := 10
	if value := request.URL.Query().Get("limit"); value != "" {
		parsed, err := strconv.Atoi(value)
		if err != nil {
			s.writeError(response, request, domain.Validation("limit", "must be an integer"))
			return
		}
		limit = parsed
	}
	items, err := s.dhcpOperations.ListDHCPOperations(request.Context(), request.PathValue("nodeId"), limit)
	if err != nil {
		s.writeError(response, request, err)
		return
	}
	writeJSON(response, http.StatusOK, map[string]any{"items": items})
}

func (s *Server) handleConfigurationInventory(response http.ResponseWriter, request *http.Request) {
	snapshots, profiles, draft, err := s.inventory.Inventory(request.Context(), request.PathValue("clusterId"))
	if err != nil {
		s.writeError(response, request, err)
		return
	}
	writeJSON(response, http.StatusOK, configurationInventoryResponse{
		SchemaVersion: configuration.SchemaVersion,
		Snapshots:     snapshots,
		Capabilities:  profiles,
		Draft:         draft,
	})
}

func (s *Server) handleBlockedServicesCatalogue(response http.ResponseWriter, request *http.Request) {
	catalogue, err := s.catalogue.BlockedServicesCatalogue(request.Context(), request.PathValue("clusterId"))
	if err != nil {
		s.writeError(response, request, err)
		return
	}
	writeJSON(response, http.StatusOK, catalogue)
}

func (s *Server) handleBlocklistPresentation(response http.ResponseWriter, request *http.Request) {
	presentation, err := s.blocklists.BlocklistPresentation(request.Context(), request.PathValue("clusterId"))
	if err != nil {
		s.writeError(response, request, err)
		return
	}
	writeJSON(response, http.StatusOK, presentation)
}

func (s *Server) handleAllowlistPresentation(response http.ResponseWriter, request *http.Request) {
	presentation, err := s.allowlists.AllowlistPresentation(request.Context(), request.PathValue("clusterId"))
	if err != nil {
		s.writeError(response, request, err)
		return
	}
	writeJSON(response, http.StatusOK, presentation)
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
