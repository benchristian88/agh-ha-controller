package operations

import (
	"context"
	"encoding/json"
	"errors"
	"sort"
	"time"

	"github.com/benchristian88/agh-ha-controller/internal/domain"
	"github.com/benchristian88/agh-ha-controller/internal/inventory"
)

type ExecutionRepository interface {
	ClaimOperationalCommand(context.Context, time.Time) (Operation, error)
	RunningOperationalCommands(context.Context) ([]Operation, error)
	NodeRecordByID(context.Context, string) (domain.NodeRecord, error)
	UpdateOperationalCommandNode(context.Context, string, NodeResult) error
	FinishOperationalCommand(context.Context, Operation, domain.AuditEvent) error
}

type Observer interface {
	Observe(context.Context, string) (inventory.Snapshot, error)
}

type CommandExecutor struct {
	repository  ExecutionRepository
	credentials CredentialProtector
	payloads    PayloadProtector
	executor    Executor
	observer    Observer
	now         func() time.Time
}

func NewExecutor(repository ExecutionRepository, credentials CredentialProtector, payloads PayloadProtector, executor Executor, observer Observer) *CommandExecutor {
	return &CommandExecutor{repository: repository, credentials: credentials, payloads: payloads, executor: executor, observer: observer, now: time.Now}
}

func (e *CommandExecutor) RecoverInterrupted(ctx context.Context) error {
	items, err := e.repository.RunningOperationalCommands(ctx)
	if err != nil {
		return err
	}
	for index := range items {
		operation := &items[index]
		now := e.now().UTC()
		for resultIndex := range operation.NodeResults {
			result := &operation.NodeResults[resultIndex]
			if result.Status == "succeeded" || result.Status == "failed" || result.Status == "skipped" {
				continue
			}
			result.Status, result.ErrorCode, result.CompletedAt = "failed", "OPERATION_INTERRUPTED", &now
			if err := e.repository.UpdateOperationalCommandNode(ctx, operation.ID, *result); err != nil {
				return err
			}
		}
		operation.Status, operation.CompletedAt = "interrupted", &now
		actor := domain.Actor{UserID: operation.RequestedBy, RequestID: operation.RequestID}
		event, err := operationAudit(actor, commandAuditPrefix(operation.Command)+"_failed", *operation, map[string]any{
			"status": "interrupted", "errorCode": "CONTROLLER_RESTARTED", "automaticReplay": false,
		}, now)
		if err != nil {
			return err
		}
		operation.AuditReference = event.ID
		if err := e.repository.FinishOperationalCommand(ctx, *operation, event); err != nil {
			return err
		}
	}
	return nil
}

func (e *CommandExecutor) RunOnce(ctx context.Context) (bool, error) {
	operation, err := e.repository.ClaimOperationalCommand(ctx, e.now().UTC())
	if err != nil {
		if errors.Is(err, domain.ErrNoWork) {
			return false, nil
		}
		return false, err
	}
	payload, err := e.payloads.DecryptPayload(operation.ID, operation.Payload)
	if err != nil {
		return true, e.failAll(ctx, &operation, domain.NewError(domain.ErrorInternal, "the operational command input could not be decrypted"))
	}
	var upstream UpstreamInput
	var hostFilter HostFilterInput
	if operation.Command == TestUpstreamDNS {
		if err := json.Unmarshal(payload, &upstream); err != nil {
			return true, e.failAll(ctx, &operation, domain.NewError(domain.ErrorInternal, "the operational command input could not be decoded"))
		}
	} else if operation.Command == TestHostFiltering {
		if err := json.Unmarshal(payload, &hostFilter); err != nil {
			return true, e.failAll(ctx, &operation, domain.NewError(domain.ErrorInternal, "the operational command input could not be decoded"))
		}
	}
	sort.Slice(operation.NodeResults, func(i, j int) bool { return operation.NodeResults[i].Position < operation.NodeResults[j].Position })
	succeeded, failed, resolverSucceeded, resolverFailed := 0, 0, 0, 0
	for index := range operation.NodeResults {
		if ctx.Err() != nil {
			return true, ctx.Err()
		}
		result := &operation.NodeResults[index]
		if result.Status != "pending" {
			continue
		}
		started := e.now().UTC()
		result.Status, result.StartedAt = "running", &started
		if err := e.repository.UpdateOperationalCommandNode(ctx, operation.ID, *result); err != nil {
			return true, err
		}
		record, commandErr := e.repository.NodeRecordByID(ctx, result.NodeID)
		var request domain.NodeProbeRequest
		if commandErr == nil {
			var credentials domain.NodeCredentials
			credentials, commandErr = e.credentials.Decrypt(result.NodeID, record.Secrets.Credentials)
			if commandErr == nil {
				request = domain.NodeProbeRequest{BaseURL: record.Node.BaseURL, CertificatePolicy: record.Node.CertificatePolicy, CustomCAPEM: record.Secrets.CustomCAPEM, Credentials: credentials}
			}
		}
		if commandErr == nil {
			switch operation.Command {
			case TestUpstreamDNS:
				result.ResolverResults, commandErr = e.executor.TestUpstreamDNS(ctx, request, upstream)
			case TestHostFiltering:
				var filterResult HostFilterResult
				filterResult, commandErr = e.executor.TestHostFiltering(ctx, request, hostFilter)
				if commandErr == nil {
					result.HostFilterResult = &filterResult
				}
			case ClearDNSCache:
				commandErr = e.executor.ClearDNSCache(ctx, request)
			default:
				commandErr = domain.NewError(domain.ErrorCapability, "the operational command is not supported")
			}
		}
		completed := e.now().UTC()
		result.CompletedAt = &completed
		if commandErr != nil {
			result.Status, result.ErrorCode = "failed", operationErrorCode(commandErr)
			failed++
		} else {
			result.Status = "succeeded"
			succeeded++
			for _, resolver := range result.ResolverResults {
				if resolver.Status == "succeeded" {
					resolverSucceeded++
				} else {
					resolverFailed++
				}
			}
			if operation.Command == ClearDNSCache {
				snapshot, observationErr := e.observer.Observe(ctx, result.NodeID)
				if observationErr != nil {
					result.ObservationStatus, result.ObservationErrorCode = "failed", operationErrorCode(observationErr)
				} else {
					result.ObservationStatus, result.ObservationSnapshotID = "succeeded", snapshot.ID
				}
			}
		}
		if err := e.repository.UpdateOperationalCommandNode(ctx, operation.ID, *result); err != nil {
			return true, err
		}
	}
	operation.Status = "succeeded"
	if failed > 0 && succeeded > 0 {
		operation.Status = "partial_success"
	} else if failed > 0 {
		operation.Status = "failed"
	}
	completed := e.now().UTC()
	operation.CompletedAt = &completed
	actionStatus := operation.Status
	if actionStatus == "partial_success" {
		actionStatus = "partially_succeeded"
	}
	actor := domain.Actor{UserID: operation.RequestedBy, RequestID: operation.RequestID}
	event, err := operationAudit(actor, commandAuditPrefix(operation.Command)+"_"+actionStatus, operation, map[string]any{
		"status": operation.Status, "succeededCount": succeeded, "failedCount": failed,
		"resolverSucceededCount": resolverSucceeded, "resolverFailedCount": resolverFailed,
	}, completed)
	if err != nil {
		return true, err
	}
	operation.AuditReference = event.ID
	return true, e.repository.FinishOperationalCommand(ctx, operation, event)
}

func (e *CommandExecutor) failAll(ctx context.Context, operation *Operation, commandErr error) error {
	now := e.now().UTC()
	for index := range operation.NodeResults {
		result := &operation.NodeResults[index]
		if result.Status == "succeeded" || result.Status == "failed" {
			continue
		}
		result.Status, result.ErrorCode, result.CompletedAt = "failed", operationErrorCode(commandErr), &now
		if err := e.repository.UpdateOperationalCommandNode(ctx, operation.ID, *result); err != nil {
			return err
		}
	}
	operation.Status, operation.CompletedAt = "failed", &now
	actor := domain.Actor{UserID: operation.RequestedBy, RequestID: operation.RequestID}
	event, err := operationAudit(actor, commandAuditPrefix(operation.Command)+"_failed", *operation, map[string]any{"status": "failed", "errorCode": operationErrorCode(commandErr)}, now)
	if err != nil {
		return err
	}
	operation.AuditReference = event.ID
	return e.repository.FinishOperationalCommand(ctx, *operation, event)
}

func operationErrorCode(err error) string {
	var domainError *domain.Error
	if errors.As(err, &domainError) {
		return string(domainError.Kind)
	}
	return string(domain.ErrorInternal)
}
