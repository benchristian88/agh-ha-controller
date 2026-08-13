package inventory

import (
	"context"
	"errors"
	"time"

	"github.com/benchristian88/atlas-dns/internal/domain"
)

type DHCPOperationCommand string

const (
	DHCPOperationResetLeases        DHCPOperationCommand = "dhcp_reset_leases"
	DHCPOperationResetConfiguration DHCPOperationCommand = "dhcp_reset_configuration"

	DHCPResetLeasesConfirmation        = "RESET_LEASES"
	DHCPResetConfigurationConfirmation = "RESET_DHCP_CONFIGURATION"
)

type DHCPOperationNodeResult struct {
	ID          string     `json:"id"`
	NodeID      string     `json:"nodeId"`
	NodeName    string     `json:"nodeName"`
	Status      string     `json:"status"`
	ErrorCode   string     `json:"errorCode,omitempty"`
	StartedAt   time.Time  `json:"startedAt"`
	CompletedAt *time.Time `json:"completedAt,omitempty"`
}

type DHCPOperation struct {
	ID                    string                    `json:"id"`
	ClusterID             string                    `json:"clusterId"`
	ClusterName           string                    `json:"clusterName"`
	Command               DHCPOperationCommand      `json:"command"`
	Status                string                    `json:"status"`
	RequestID             string                    `json:"requestId"`
	IdempotencyKey        string                    `json:"-"`
	RequestedBy           string                    `json:"-"`
	ObservationStatus     string                    `json:"observationStatus"`
	ObservationSnapshotID string                    `json:"observationSnapshotId,omitempty"`
	ObservationErrorCode  string                    `json:"observationErrorCode,omitempty"`
	AuditReference        string                    `json:"auditReference,omitempty"`
	RequestedAt           time.Time                 `json:"requestedAt"`
	CompletedAt           *time.Time                `json:"completedAt,omitempty"`
	NodeResults           []DHCPOperationNodeResult `json:"nodeResults"`
	Duplicate             bool                      `json:"duplicate,omitempty"`
}

type DHCPOperationExecutor interface {
	ResetDHCPLeases(context.Context, domain.NodeProbeRequest) error
	ResetDHCPConfiguration(context.Context, domain.NodeProbeRequest) error
}

type DHCPOperationStore interface {
	BeginDHCPOperation(context.Context, DHCPOperation, domain.AuditEvent) (DHCPOperation, bool, error)
	FinishDHCPOperation(context.Context, DHCPOperation, domain.AuditEvent) error
	ListDHCPOperations(context.Context, string, int) ([]DHCPOperation, error)
	ClusterHasActiveDeployment(context.Context, string) (bool, error)
}

func (s *Service) RunDHCPOperation(ctx context.Context, actor domain.Actor, nodeID string, command DHCPOperationCommand, confirmation, idempotencyKey string) (DHCPOperation, error) {
	if !domain.ValidID(nodeID) {
		return DHCPOperation{}, domain.Validation("nodeId", "must be a valid UUID")
	}
	if !domain.ValidID(idempotencyKey) {
		return DHCPOperation{}, domain.Validation("idempotencyKey", "must be a valid UUID")
	}
	wantConfirmation, actionName, err := dhcpOperationContract(command)
	if err != nil {
		return DHCPOperation{}, err
	}
	if confirmation != wantConfirmation {
		return DHCPOperation{}, domain.Validation("confirmation", "does not match the required destructive action")
	}
	executor, ok := s.reader.(DHCPOperationExecutor)
	if !ok {
		return DHCPOperation{}, domain.NewError(domain.ErrorCapability, "DHCP reset operations are unavailable")
	}
	store, ok := s.repository.(DHCPOperationStore)
	if !ok {
		return DHCPOperation{}, domain.NewError(domain.ErrorCapability, "durable DHCP reset operations are unavailable")
	}
	record, err := s.repository.NodeRecordByID(ctx, nodeID)
	if err != nil {
		return DHCPOperation{}, err
	}
	cluster, err := s.repository.ClusterByID(ctx, record.Node.ClusterID)
	if err != nil {
		return DHCPOperation{}, err
	}
	operationID, err := domain.NewID()
	if err != nil {
		return DHCPOperation{}, err
	}
	resultID, err := domain.NewID()
	if err != nil {
		return DHCPOperation{}, err
	}
	now := s.now().UTC()
	operation := DHCPOperation{
		ID: operationID, ClusterID: cluster.ID, ClusterName: cluster.Name, Command: command,
		Status: "running", RequestID: actor.RequestID, IdempotencyKey: idempotencyKey,
		RequestedBy: actor.UserID, ObservationStatus: "not_run", RequestedAt: now,
		NodeResults: []DHCPOperationNodeResult{{
			ID: resultID, NodeID: nodeID, NodeName: record.Node.Name, Status: "running", StartedAt: now,
		}},
	}
	requested, err := dhcpOperationAudit(actor, "dhcp."+actionName+"_requested", operation, map[string]any{"status": "running"}, now)
	if err != nil {
		return DHCPOperation{}, err
	}
	stored, created, err := store.BeginDHCPOperation(ctx, operation, requested)
	if err != nil {
		return DHCPOperation{}, err
	}
	if !created {
		if stored.Command != command || len(stored.NodeResults) != 1 || stored.NodeResults[0].NodeID != nodeID {
			return DHCPOperation{}, domain.NewError(domain.ErrorConflict, "the idempotency key is already used for another operation")
		}
		if stored.Status == "running" {
			return DHCPOperation{}, domain.NewError(domain.ErrorConflict, "the DHCP operation is already running")
		}
		stored.Duplicate = true
		return stored, nil
	}
	operation = stored

	if !record.Node.Enabled {
		return s.failDHCPOperation(ctx, actor, store, operation, actionName, domain.NewError(domain.ErrorConflict, "DHCP reset requires an enabled node"))
	}
	if !record.Node.MaintenanceMode {
		return s.failDHCPOperation(ctx, actor, store, operation, actionName, domain.NewError(domain.ErrorConflict, "DHCP reset requires the node to be in maintenance mode"))
	}
	activeDeployment, err := store.ClusterHasActiveDeployment(ctx, cluster.ID)
	if err != nil {
		return s.failDHCPOperation(ctx, actor, store, operation, actionName, err)
	}
	if activeDeployment {
		return s.failDHCPOperation(ctx, actor, store, operation, actionName, domain.NewError(domain.ErrorConflict, "DHCP reset is blocked while the cluster has an active deployment"))
	}
	if command == DHCPOperationResetConfiguration && cluster.ReconciliationPolicy == domain.ReconciliationEnforce {
		return s.failDHCPOperation(ctx, actor, store, operation, actionName, domain.NewError(domain.ErrorConflict, "DHCP reset requires Manual or Alert reconciliation so the operator can choose restore or adopt"))
	}
	credentials, err := s.credentials.Decrypt(nodeID, record.Secrets.Credentials)
	if err != nil {
		return s.failDHCPOperation(ctx, actor, store, operation, actionName, errors.New("stored node credentials could not be decrypted"))
	}
	request := domain.NodeProbeRequest{BaseURL: record.Node.BaseURL, CertificatePolicy: record.Node.CertificatePolicy, CustomCAPEM: record.Secrets.CustomCAPEM, Credentials: credentials}
	if command == DHCPOperationResetLeases {
		err = executor.ResetDHCPLeases(ctx, request)
	} else {
		err = executor.ResetDHCPConfiguration(ctx, request)
	}
	if err != nil {
		return s.failDHCPOperation(ctx, actor, store, operation, actionName, err)
	}

	operation.Status = "succeeded"
	operation.NodeResults[0].Status = "succeeded"
	nodeCompleted := s.now().UTC()
	operation.NodeResults[0].CompletedAt = &nodeCompleted
	snapshot, observationErr := s.Observe(ctx, nodeID)
	if observationErr != nil {
		operation.ObservationStatus = "failed"
		operation.ObservationErrorCode = errorCode(observationErr)
	} else {
		operation.ObservationStatus = "succeeded"
		operation.ObservationSnapshotID = snapshot.ID
	}
	metadata := map[string]any{
		"status": operation.Status, "observationStatus": operation.ObservationStatus,
	}
	if operation.ObservationSnapshotID != "" {
		metadata["observationSnapshotId"] = operation.ObservationSnapshotID
	}
	if operation.ObservationErrorCode != "" {
		metadata["observationErrorCode"] = operation.ObservationErrorCode
	}
	completed := s.now().UTC()
	operation.CompletedAt = &completed
	terminal, err := dhcpOperationAudit(actor, "dhcp."+actionName+"_succeeded", operation, metadata, completed)
	if err != nil {
		return DHCPOperation{}, err
	}
	operation.AuditReference = terminal.ID
	auditCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), 5*time.Second)
	defer cancel()
	if err := store.FinishDHCPOperation(auditCtx, operation, terminal); err != nil {
		return DHCPOperation{}, err
	}
	return operation, nil
}

func (s *Service) ListDHCPOperations(ctx context.Context, nodeID string, limit int) ([]DHCPOperation, error) {
	if !domain.ValidID(nodeID) {
		return nil, domain.Validation("nodeId", "must be a valid UUID")
	}
	if limit < 1 || limit > 20 {
		return nil, domain.Validation("limit", "must be between 1 and 20")
	}
	if _, err := s.repository.NodeRecordByID(ctx, nodeID); err != nil {
		return nil, err
	}
	store, ok := s.repository.(DHCPOperationStore)
	if !ok {
		return nil, domain.NewError(domain.ErrorCapability, "durable DHCP reset operations are unavailable")
	}
	return store.ListDHCPOperations(ctx, nodeID, limit)
}

func (s *Service) failDHCPOperation(ctx context.Context, actor domain.Actor, store DHCPOperationStore, operation DHCPOperation, actionName string, commandErr error) (DHCPOperation, error) {
	completed := s.now().UTC()
	operation.Status = "failed"
	operation.CompletedAt = &completed
	operation.NodeResults[0].Status = "failed"
	operation.NodeResults[0].ErrorCode = errorCode(commandErr)
	operation.NodeResults[0].CompletedAt = &completed
	metadata := map[string]any{"status": "failed", "errorCode": operation.NodeResults[0].ErrorCode, "observationStatus": "not_run"}
	terminal, err := dhcpOperationAudit(actor, "dhcp."+actionName+"_failed", operation, metadata, completed)
	if err != nil {
		return DHCPOperation{}, err
	}
	operation.AuditReference = terminal.ID
	auditCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), 5*time.Second)
	defer cancel()
	if err := store.FinishDHCPOperation(auditCtx, operation, terminal); err != nil {
		return DHCPOperation{}, err
	}
	return operation, commandErr
}

func dhcpOperationContract(command DHCPOperationCommand) (confirmation, auditName string, err error) {
	switch command {
	case DHCPOperationResetLeases:
		return DHCPResetLeasesConfirmation, "reset_leases", nil
	case DHCPOperationResetConfiguration:
		return DHCPResetConfigurationConfirmation, "reset_configuration", nil
	default:
		return "", "", domain.Validation("command", "is not a supported DHCP operation")
	}
}

func dhcpOperationAudit(actor domain.Actor, action string, operation DHCPOperation, extra map[string]any, at time.Time) (domain.AuditEvent, error) {
	id, err := domain.NewID()
	if err != nil {
		return domain.AuditEvent{}, err
	}
	metadata := map[string]any{
		"clusterId":   operation.ClusterID,
		"nodeId":      operation.NodeResults[0].NodeID,
		"command":     operation.Command,
		"operationId": operation.ID,
	}
	for key, value := range extra {
		metadata[key] = value
	}
	userID, resourceID := actor.UserID, operation.ID
	return domain.AuditEvent{
		ID: id, ActorType: "user", ActorUserID: &userID, Action: action,
		ResourceType: "operational_command", ResourceID: &resourceID,
		RequestID: actor.RequestID, Metadata: metadata, CreatedAt: at,
	}, nil
}
