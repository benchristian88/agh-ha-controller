package operations

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"strings"
	"time"

	"github.com/benchristian88/atlas-dns/internal/domain"
	"github.com/benchristian88/atlas-dns/internal/inventory"
)

type Repository interface {
	ClusterByID(context.Context, string) (domain.Cluster, error)
	ListNodes(context.Context, string) ([]domain.Node, error)
	CapabilityProfiles(context.Context, string) ([]inventory.CapabilityProfile, error)
	CreateOperationalCommand(context.Context, Operation, domain.AuditEvent) (Operation, bool, error)
	OperationalCommandByID(context.Context, string) (Operation, error)
	ListOperationalCommands(context.Context, string, Command, int) ([]Operation, error)
}

type Service struct {
	repository Repository
	payloads   PayloadProtector
	now        func() time.Time
}

func NewService(repository Repository, payloads PayloadProtector) *Service {
	return &Service{repository: repository, payloads: payloads, now: time.Now}
}

func (s *Service) StartUpstreamTest(ctx context.Context, actor domain.Actor, clusterID string, target Target, input UpstreamInput, idempotencyKey string) (Operation, error) {
	if err := validateUpstreamInput(input); err != nil {
		return Operation{}, err
	}
	return s.start(ctx, actor, clusterID, target, TestUpstreamDNS, "", input, idempotencyKey)
}

func (s *Service) StartHostFilterTest(ctx context.Context, actor domain.Actor, clusterID string, target Target, input HostFilterInput, idempotencyKey string) (Operation, error) {
	if err := validateHostFilterInput(&input); err != nil {
		return Operation{}, err
	}
	return s.start(ctx, actor, clusterID, target, TestHostFiltering, "", input, idempotencyKey)
}

func (s *Service) StartCacheClear(ctx context.Context, actor domain.Actor, clusterID string, target Target, confirmation, idempotencyKey string) (Operation, error) {
	if confirmation != ClearDNSCacheConfirmation {
		return Operation{}, domain.Validation("confirmation", "does not match the required destructive action")
	}
	return s.start(ctx, actor, clusterID, target, ClearDNSCache, confirmation, struct{}{}, idempotencyKey)
}

func (s *Service) StartQueryLogClear(ctx context.Context, actor domain.Actor, clusterID string, target Target, confirmation, idempotencyKey string) (Operation, error) {
	if confirmation != ClearQueryLogConfirmation {
		return Operation{}, domain.Validation("confirmation", "does not match the required destructive action")
	}
	return s.start(ctx, actor, clusterID, target, ClearQueryLog, confirmation, struct{}{}, idempotencyKey)
}

func (s *Service) StartStatisticsReset(ctx context.Context, actor domain.Actor, clusterID string, target Target, confirmation, idempotencyKey string) (Operation, error) {
	if confirmation != ResetStatisticsConfirmation {
		return Operation{}, domain.Validation("confirmation", "does not match the required destructive action")
	}
	return s.start(ctx, actor, clusterID, target, ResetStatistics, confirmation, struct{}{}, idempotencyKey)
}

func (s *Service) start(ctx context.Context, actor domain.Actor, clusterID string, target Target, command Command, confirmation string, input any, idempotencyKey string) (Operation, error) {
	if !domain.ValidID(clusterID) {
		return Operation{}, domain.Validation("clusterId", "must be a valid UUID")
	}
	if !domain.ValidID(idempotencyKey) {
		return Operation{}, domain.Validation("idempotencyKey", "must be a valid UUID")
	}
	if target.Scope != "node" && target.Scope != "all_compatible_enabled_nodes" {
		return Operation{}, domain.Validation("target.scope", "must be node or all_compatible_enabled_nodes")
	}
	if target.Scope == "node" && !domain.ValidID(target.NodeID) {
		return Operation{}, domain.Validation("target.nodeId", "must be a valid UUID for node scope")
	}
	if target.Scope != "node" && target.NodeID != "" {
		return Operation{}, domain.Validation("target.nodeId", "must be omitted for fleet scope")
	}
	cluster, err := s.repository.ClusterByID(ctx, clusterID)
	if err != nil {
		return Operation{}, err
	}
	nodes, err := s.repository.ListNodes(ctx, clusterID)
	if err != nil {
		return Operation{}, err
	}
	profiles, err := s.repository.CapabilityProfiles(ctx, clusterID)
	if err != nil {
		return Operation{}, err
	}
	profileByNode := make(map[string]inventory.CapabilityProfile, len(profiles))
	for _, profile := range profiles {
		profileByNode[profile.NodeID] = profile
	}
	feature := "test_upstream_dns"
	switch command {
	case ClearDNSCache:
		feature = "cache_clear"
	case TestHostFiltering:
		feature = "test_host_filtering"
		if host, ok := input.(HostFilterInput); ok && (host.Client != "" || host.QueryType != "") {
			feature = "test_host_filtering_context"
		}
	case ClearQueryLog:
		feature = "querylog_clear"
	case ResetStatistics:
		feature = "stats_reset"
	}
	selected := make([]domain.Node, 0, len(nodes))
	excluded := make([]ExcludedNode, 0)
	foundSelected := target.Scope != "node"
	for _, node := range nodes {
		if target.Scope == "node" && node.ID != target.NodeID {
			continue
		}
		foundSelected = true
		if !node.Enabled {
			if target.Scope == "node" {
				return Operation{}, domain.NewError(domain.ErrorConflict, "operational commands require an enabled node")
			}
			continue
		}
		code := ""
		if node.MaintenanceMode {
			code = "NODE_IN_MAINTENANCE"
		} else if profile, ok := profileByNode[node.ID]; !ok || profile.Compatibility != string(domain.CompatibilitySupported) || profile.ProductVersion != node.Version || !profile.Features[feature] {
			code = string(domain.ErrorCapability)
		}
		if code != "" {
			if target.Scope == "node" {
				if code == "NODE_IN_MAINTENANCE" {
					return Operation{}, domain.NewError(domain.ErrorConflict, "operational commands are unavailable while the node is in maintenance")
				}
				return Operation{}, domain.NewError(domain.ErrorCapability, "the selected node does not support this operational command")
			}
			excluded = append(excluded, ExcludedNode{NodeID: node.ID, NodeName: node.Name, ErrorCode: code})
			continue
		}
		selected = append(selected, node)
	}
	if !foundSelected {
		return Operation{}, domain.NewError(domain.ErrorNotFound, "node was not found in the cluster")
	}
	if len(selected) == 0 {
		return Operation{}, domain.NewError(domain.ErrorCapability, "no compatible enabled nodes are available for this command")
	}
	payload, err := json.Marshal(input)
	if err != nil {
		return Operation{}, err
	}
	operationID, err := domain.NewID()
	if err != nil {
		return Operation{}, err
	}
	encrypted, err := s.payloads.EncryptPayload(operationID, payload)
	if err != nil {
		return Operation{}, err
	}
	fingerprintBody, _ := json.Marshal(struct {
		Command Command `json:"command"`
		Target  Target  `json:"target"`
		Input   any     `json:"input"`
	}{command, target, input})
	digest := sha256.Sum256(fingerprintBody)
	now := s.now().UTC()
	operation := Operation{
		ID: operationID, ClusterID: clusterID, ClusterName: cluster.Name, Command: command,
		Target: target, Status: "queued", RequestID: actor.RequestID, IdempotencyKey: idempotencyKey,
		RequestedBy: actor.UserID, InputFingerprint: hex.EncodeToString(digest[:]), Payload: encrypted,
		RequestedAt: now, ExcludedNodes: excluded, NodeResults: make([]NodeResult, 0, len(selected)),
	}
	for position, node := range selected {
		resultID, idErr := domain.NewID()
		if idErr != nil {
			return Operation{}, idErr
		}
		operation.NodeResults = append(operation.NodeResults, NodeResult{ID: resultID, NodeID: node.ID, NodeName: node.Name, Position: position + 1, Status: "pending"})
	}
	event, err := operationAudit(actor, commandAuditPrefix(command)+"_requested", operation, map[string]any{
		"status": "queued", "targetScope": target.Scope, "targetCount": len(selected),
		"excludedCount": len(excluded), "inputFingerprint": operation.InputFingerprint,
	}, now)
	if err != nil {
		return Operation{}, err
	}
	stored, created, err := s.repository.CreateOperationalCommand(ctx, operation, event)
	if err != nil {
		return Operation{}, err
	}
	if !created {
		if stored.ClusterID != clusterID || stored.Command != command || stored.Target != target || stored.InputFingerprint != operation.InputFingerprint {
			return Operation{}, domain.NewError(domain.ErrorConflict, "the idempotency key is already used for another operation")
		}
		stored.Duplicate = true
		return stored, nil
	}
	return stored, nil
}

func (s *Service) Operation(ctx context.Context, id string) (Operation, error) {
	if !domain.ValidID(id) {
		return Operation{}, domain.Validation("operationId", "must be a valid UUID")
	}
	operation, err := s.repository.OperationalCommandByID(ctx, id)
	if err != nil {
		return Operation{}, err
	}
	if !supportedCommand(operation.Command) {
		return Operation{}, domain.NewError(domain.ErrorNotFound, "operational command was not found")
	}
	return operation, nil
}

func (s *Service) List(ctx context.Context, clusterID string, command Command, limit int) ([]Operation, error) {
	if !domain.ValidID(clusterID) {
		return nil, domain.Validation("clusterId", "must be a valid UUID")
	}
	if command != "" && !supportedCommand(command) {
		return nil, domain.Validation("command", "is not a supported operational command")
	}
	if limit < 1 || limit > 20 {
		return nil, domain.Validation("limit", "must be between 1 and 20")
	}
	return s.repository.ListOperationalCommands(ctx, clusterID, command, limit)
}

func supportedCommand(command Command) bool {
	switch command {
	case TestUpstreamDNS, TestHostFiltering, ClearDNSCache, ClearQueryLog, ResetStatistics:
		return true
	default:
		return false
	}
}

func validateHostFilterInput(input *HostFilterInput) error {
	input.Hostname = strings.TrimSpace(input.Hostname)
	input.Client = strings.TrimSpace(input.Client)
	input.QueryType = strings.ToUpper(strings.TrimSpace(input.QueryType))
	if input.Hostname == "" || len(input.Hostname) > 253 || strings.ContainsAny(input.Hostname, "\t\r\n /?#") {
		return domain.Validation("input.hostname", "must be a valid host name without a URL scheme or path")
	}
	if len(input.Client) > 256 || strings.ContainsAny(input.Client, "\r\n\t") {
		return domain.Validation("input.client", "must be at most 256 characters without control characters")
	}
	if input.QueryType != "" {
		allowed := map[string]bool{"A": true, "AAAA": true, "ANY": true, "CAA": true, "CNAME": true, "DNSKEY": true, "DS": true, "HTTPS": true, "MX": true, "NS": true, "PTR": true, "SOA": true, "SRV": true, "SVCB": true, "TXT": true}
		if !allowed[input.QueryType] {
			return domain.Validation("input.queryType", "is not a supported DNS query type")
		}
	}
	return nil
}

func validateUpstreamInput(input UpstreamInput) error {
	if input.DraftVersion < 1 {
		return domain.Validation("input.draftVersion", "must be a positive integer")
	}
	if input.UpstreamMode == "" {
		input.UpstreamMode = "load_balance"
	}
	if input.UpstreamMode != "load_balance" && input.UpstreamMode != "parallel" && input.UpstreamMode != "fastest_addr" {
		return domain.Validation("input.upstreamMode", "must be load_balance, parallel, or fastest_addr")
	}
	if len(input.UpstreamDNS) == 0 {
		return domain.Validation("input.upstreamDns", "must contain at least one upstream")
	}
	total := 0
	for field, values := range map[string][]string{
		"input.upstreamDns": input.UpstreamDNS, "input.bootstrapDns": input.BootstrapDNS,
		"input.fallbackDns": input.FallbackDNS, "input.privateReverseDns": input.PrivateReverseDNS,
	} {
		total += len(values)
		if len(values) > 64 {
			return domain.Validation(field, "must not contain more than 64 entries")
		}
		for _, value := range values {
			if strings.TrimSpace(value) == "" || len(value) > 2048 {
				return domain.Validation(field, "contains an empty or oversized resolver entry")
			}
		}
	}
	if total > 128 {
		return domain.Validation("input", "must not contain more than 128 resolver entries")
	}
	return nil
}

func operationAudit(actor domain.Actor, action string, operation Operation, extra map[string]any, at time.Time) (domain.AuditEvent, error) {
	id, err := domain.NewID()
	if err != nil {
		return domain.AuditEvent{}, err
	}
	metadata := map[string]any{"clusterId": operation.ClusterID, "command": operation.Command, "operationId": operation.ID}
	for key, value := range extra {
		metadata[key] = value
	}
	userID, resourceID := actor.UserID, operation.ID
	return domain.AuditEvent{ID: id, ActorType: "user", ActorUserID: &userID, Action: action, ResourceType: "operational_command", ResourceID: &resourceID, RequestID: actor.RequestID, Metadata: metadata, CreatedAt: at}, nil
}

func commandAuditPrefix(command Command) string {
	switch command {
	case TestUpstreamDNS:
		return "dns.test_upstream"
	case TestHostFiltering:
		return "filtering.test_host"
	case ClearQueryLog:
		return "querylog.clear"
	case ResetStatistics:
		return "statistics.reset"
	default:
		return "dns.cache_clear"
	}
}
