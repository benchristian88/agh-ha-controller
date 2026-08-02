package database

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5"

	"github.com/benchristian88/agh-ha-controller/internal/domain"
	"github.com/benchristian88/agh-ha-controller/internal/inventory"
)

const dhcpOperationSelect = `
	SELECT o.id,o.cluster_id,c.name,o.command_type,o.status,o.request_id,
	       o.idempotency_key,o.requested_by,o.observation_status,
	       o.observation_snapshot_id,o.observation_error_code,o.audit_reference,
	       o.requested_at,o.completed_at,
	       r.id,r.node_id,n.name,r.status,r.error_code,r.started_at,r.completed_at
	FROM operational_commands o
	JOIN clusters c ON c.id=o.cluster_id
	JOIN operational_command_node_results r ON r.command_id=o.id
	JOIN nodes n ON n.id=r.node_id`

func (s *Store) BeginDHCPOperation(ctx context.Context, operation inventory.DHCPOperation, event domain.AuditEvent) (inventory.DHCPOperation, bool, error) {
	tx, err := s.pool.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return inventory.DHCPOperation{}, false, fmt.Errorf("begin DHCP operation: %w", err)
	}
	defer func() { _ = tx.Rollback(context.Background()) }()
	result, err := tx.Exec(ctx, `
		INSERT INTO operational_commands
			(id,cluster_id,command_type,status,requested_by,request_id,idempotency_key,
			 observation_status,requested_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
		ON CONFLICT (requested_by,idempotency_key) DO NOTHING`,
		operation.ID, operation.ClusterID, operation.Command, operation.Status,
		operation.RequestedBy, operation.RequestID, operation.IdempotencyKey,
		operation.ObservationStatus, operation.RequestedAt)
	if err != nil {
		return inventory.DHCPOperation{}, false, fmt.Errorf("insert DHCP operation: %w", err)
	}
	if result.RowsAffected() == 0 {
		if err := tx.Rollback(ctx); err != nil {
			return inventory.DHCPOperation{}, false, err
		}
		stored, err := scanDHCPOperation(s.pool.QueryRow(ctx, dhcpOperationSelect+` WHERE o.requested_by=$1 AND o.idempotency_key=$2`, operation.RequestedBy, operation.IdempotencyKey))
		return stored, false, err
	}
	if len(operation.NodeResults) != 1 {
		return inventory.DHCPOperation{}, false, errorsForOperationResultCount()
	}
	node := operation.NodeResults[0]
	if _, err := tx.Exec(ctx, `
		INSERT INTO operational_command_node_results
			(id,command_id,node_id,status,error_code,started_at)
		VALUES ($1,$2,$3,$4,$5,$6)`,
		node.ID, operation.ID, node.NodeID, node.Status, node.ErrorCode, node.StartedAt); err != nil {
		return inventory.DHCPOperation{}, false, fmt.Errorf("insert DHCP operation node result: %w", err)
	}
	if err := audit(ctx, tx, event); err != nil {
		return inventory.DHCPOperation{}, false, err
	}
	if err := tx.Commit(ctx); err != nil {
		return inventory.DHCPOperation{}, false, fmt.Errorf("commit DHCP operation: %w", err)
	}
	return operation, true, nil
}

func (s *Store) FinishDHCPOperation(ctx context.Context, operation inventory.DHCPOperation, event domain.AuditEvent) error {
	if len(operation.NodeResults) != 1 {
		return errorsForOperationResultCount()
	}
	tx, err := s.pool.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return fmt.Errorf("begin DHCP operation completion: %w", err)
	}
	defer func() { _ = tx.Rollback(context.Background()) }()
	if err := audit(ctx, tx, event); err != nil {
		return err
	}
	result, err := tx.Exec(ctx, `
		UPDATE operational_commands
		SET status=$2,observation_status=$3,observation_snapshot_id=$4,
		    observation_error_code=$5,audit_reference=$6,completed_at=$7
		WHERE id=$1 AND status='running'`,
		operation.ID, operation.Status, operation.ObservationStatus,
		nullableString(operation.ObservationSnapshotID), operation.ObservationErrorCode,
		operation.AuditReference, operation.CompletedAt)
	if err != nil {
		return fmt.Errorf("complete DHCP operation: %w", err)
	}
	if result.RowsAffected() != 1 {
		return domain.NewError(domain.ErrorConflict, "the DHCP operation is no longer running")
	}
	node := operation.NodeResults[0]
	result, err = tx.Exec(ctx, `
		UPDATE operational_command_node_results
		SET status=$2,error_code=$3,completed_at=$4
		WHERE id=$1 AND command_id=$5 AND status='running'`,
		node.ID, node.Status, node.ErrorCode, node.CompletedAt, operation.ID)
	if err != nil {
		return fmt.Errorf("complete DHCP operation node result: %w", err)
	}
	if result.RowsAffected() != 1 {
		return domain.NewError(domain.ErrorConflict, "the DHCP operation node result is no longer running")
	}
	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit DHCP operation completion: %w", err)
	}
	return nil
}

func (s *Store) ListDHCPOperations(ctx context.Context, nodeID string, limit int) ([]inventory.DHCPOperation, error) {
	rows, err := s.pool.Query(ctx, dhcpOperationSelect+` WHERE r.node_id=$1 ORDER BY o.requested_at DESC,o.id DESC LIMIT $2`, nodeID, limit)
	if err != nil {
		return nil, fmt.Errorf("list DHCP operations: %w", err)
	}
	defer rows.Close()
	items := make([]inventory.DHCPOperation, 0)
	for rows.Next() {
		item, err := scanDHCPOperation(rows)
		if err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate DHCP operations: %w", err)
	}
	return items, nil
}

func scanDHCPOperation(row rowScanner) (inventory.DHCPOperation, error) {
	var item inventory.DHCPOperation
	var node inventory.DHCPOperationNodeResult
	var snapshotID, auditReference *string
	if err := row.Scan(
		&item.ID, &item.ClusterID, &item.ClusterName, &item.Command, &item.Status,
		&item.RequestID, &item.IdempotencyKey, &item.RequestedBy,
		&item.ObservationStatus, &snapshotID, &item.ObservationErrorCode,
		&auditReference, &item.RequestedAt, &item.CompletedAt,
		&node.ID, &node.NodeID, &node.NodeName, &node.Status, &node.ErrorCode,
		&node.StartedAt, &node.CompletedAt,
	); err != nil {
		return item, fmt.Errorf("scan DHCP operation: %w", err)
	}
	if snapshotID != nil {
		item.ObservationSnapshotID = *snapshotID
	}
	if auditReference != nil {
		item.AuditReference = *auditReference
	}
	item.NodeResults = []inventory.DHCPOperationNodeResult{node}
	return item, nil
}

func errorsForOperationResultCount() error {
	return domain.NewError(domain.ErrorValidation, "a DHCP operation must have exactly one node result")
}
