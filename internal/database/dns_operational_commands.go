package database

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/benchristian88/atlas-dns/internal/domain"
	"github.com/benchristian88/atlas-dns/internal/operations"
)

const dnsOperationSelect = `
	SELECT o.id,o.cluster_id,c.name,o.command_type,o.target_scope,o.target_node_id,
	       o.status,o.request_id,o.idempotency_key,o.requested_by,o.input_fingerprint,
	       o.payload_ciphertext,o.payload_nonce,o.payload_key_version,o.payload_algorithm,
	       o.excluded_nodes,o.audit_reference,o.requested_at,o.started_at,o.completed_at
	FROM operational_commands o
	JOIN clusters c ON c.id=o.cluster_id`

func (s *Store) CreateOperationalCommand(ctx context.Context, operation operations.Operation, event domain.AuditEvent) (operations.Operation, bool, error) {
	tx, err := s.pool.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return operations.Operation{}, false, fmt.Errorf("begin operational command: %w", err)
	}
	defer func() { _ = tx.Rollback(context.Background()) }()
	excluded, err := json.Marshal(operation.ExcludedNodes)
	if err != nil {
		return operations.Operation{}, false, fmt.Errorf("encode excluded operational targets: %w", err)
	}
	result, err := tx.Exec(ctx, `
		INSERT INTO operational_commands
			(id,cluster_id,command_type,target_scope,target_node_id,status,requested_by,
			 request_id,idempotency_key,input_fingerprint,payload_ciphertext,payload_nonce,
			 payload_key_version,payload_algorithm,excluded_nodes,observation_status,requested_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,'not_run',$16)
		ON CONFLICT (requested_by,idempotency_key) DO NOTHING`,
		operation.ID, operation.ClusterID, operation.Command, operation.Target.Scope,
		nullableString(operation.Target.NodeID), operation.Status, operation.RequestedBy,
		operation.RequestID, operation.IdempotencyKey, operation.InputFingerprint,
		operation.Payload.Ciphertext, operation.Payload.Nonce, operation.Payload.KeyVersion,
		operation.Payload.Algorithm, excluded, operation.RequestedAt)
	if err != nil {
		return operations.Operation{}, false, fmt.Errorf("insert operational command: %w", err)
	}
	if result.RowsAffected() == 0 {
		if err := tx.Rollback(ctx); err != nil {
			return operations.Operation{}, false, err
		}
		stored, err := s.operationalCommandByIdempotency(ctx, operation.RequestedBy, operation.IdempotencyKey)
		return stored, false, err
	}
	for _, node := range operation.NodeResults {
		if _, err := tx.Exec(ctx, `
			INSERT INTO operational_command_node_results
				(id,command_id,node_id,position,status,result,observation_status)
			VALUES ($1,$2,$3,$4,$5,'{}'::jsonb,'not_run')`,
			node.ID, operation.ID, node.NodeID, node.Position, node.Status); err != nil {
			return operations.Operation{}, false, fmt.Errorf("insert operational command node result: %w", err)
		}
	}
	if err := audit(ctx, tx, event); err != nil {
		return operations.Operation{}, false, err
	}
	if err := tx.Commit(ctx); err != nil {
		return operations.Operation{}, false, fmt.Errorf("commit operational command: %w", err)
	}
	return operation, true, nil
}

func (s *Store) ClaimOperationalCommand(ctx context.Context, at time.Time) (operations.Operation, error) {
	tx, err := s.pool.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return operations.Operation{}, fmt.Errorf("begin operational command claim: %w", err)
	}
	defer func() { _ = tx.Rollback(context.Background()) }()
	var id string
	err = tx.QueryRow(ctx, `
		SELECT id FROM operational_commands
		WHERE status='queued' AND command_type IN ('test_upstream_dns','test_host_filtering','clear_dns_cache','clear_query_log','reset_statistics')
		ORDER BY requested_at,id FOR UPDATE SKIP LOCKED LIMIT 1`).Scan(&id)
	if err == pgx.ErrNoRows {
		return operations.Operation{}, domain.ErrNoWork
	}
	if err != nil {
		return operations.Operation{}, fmt.Errorf("find queued operational command: %w", err)
	}
	if _, err := tx.Exec(ctx, `UPDATE operational_commands SET status='running',started_at=$2 WHERE id=$1 AND status='queued'`, id, at); err != nil {
		return operations.Operation{}, fmt.Errorf("claim operational command: %w", err)
	}
	if err := tx.Commit(ctx); err != nil {
		return operations.Operation{}, fmt.Errorf("commit operational command claim: %w", err)
	}
	return s.OperationalCommandByID(ctx, id)
}

func (s *Store) RunningOperationalCommands(ctx context.Context) ([]operations.Operation, error) {
	rows, err := s.pool.Query(ctx, `SELECT id FROM operational_commands WHERE status='running' AND command_type IN ('test_upstream_dns','test_host_filtering','clear_dns_cache','clear_query_log','reset_statistics') ORDER BY requested_at,id`)
	if err != nil {
		return nil, fmt.Errorf("list interrupted operational commands: %w", err)
	}
	ids := make([]string, 0)
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			rows.Close()
			return nil, err
		}
		ids = append(ids, id)
	}
	if err := rows.Err(); err != nil {
		rows.Close()
		return nil, err
	}
	rows.Close()
	items := make([]operations.Operation, 0, len(ids))
	for _, id := range ids {
		item, err := s.OperationalCommandByID(ctx, id)
		if err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, nil
}

func (s *Store) UpdateOperationalCommandNode(ctx context.Context, commandID string, node operations.NodeResult) error {
	resultBody, err := json.Marshal(struct {
		UpstreamResults  []operations.ResolverResult  `json:"upstreamResults,omitempty"`
		HostFilterResult *operations.HostFilterResult `json:"hostFilterResult,omitempty"`
	}{node.ResolverResults, node.HostFilterResult})
	if err != nil {
		return fmt.Errorf("encode operational command node result: %w", err)
	}
	result, err := s.pool.Exec(ctx, `
		UPDATE operational_command_node_results
		SET status=$3,error_code=$4,result=$5,observation_status=$6,
		    observation_snapshot_id=$7,observation_error_code=$8,started_at=$9,completed_at=$10
		WHERE id=$1 AND command_id=$2`, node.ID, commandID, node.Status, node.ErrorCode,
		resultBody, defaultString(node.ObservationStatus, "not_run"), nullableString(node.ObservationSnapshotID),
		node.ObservationErrorCode, node.StartedAt, node.CompletedAt)
	if err != nil {
		return fmt.Errorf("update operational command node result: %w", err)
	}
	if result.RowsAffected() != 1 {
		return domain.NewError(domain.ErrorConflict, "the operational command node result was not found")
	}
	return nil
}

func (s *Store) FinishOperationalCommand(ctx context.Context, operation operations.Operation, event domain.AuditEvent) error {
	tx, err := s.pool.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return fmt.Errorf("begin operational command completion: %w", err)
	}
	defer func() { _ = tx.Rollback(context.Background()) }()
	if err := audit(ctx, tx, event); err != nil {
		return err
	}
	result, err := tx.Exec(ctx, `
		UPDATE operational_commands
		SET status=$2,audit_reference=$3,completed_at=$4,
		    payload_ciphertext=NULL,payload_nonce=NULL,payload_key_version=NULL,payload_algorithm=NULL
		WHERE id=$1 AND status='running'`, operation.ID, operation.Status, operation.AuditReference, operation.CompletedAt)
	if err != nil {
		return fmt.Errorf("finish operational command: %w", err)
	}
	if result.RowsAffected() != 1 {
		return domain.NewError(domain.ErrorConflict, "the operational command is no longer running")
	}
	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit operational command completion: %w", err)
	}
	return nil
}

func (s *Store) OperationalCommandByID(ctx context.Context, id string) (operations.Operation, error) {
	operation, err := scanDNSOperation(s.pool.QueryRow(ctx, dnsOperationSelect+` WHERE o.id=$1`, id))
	if err != nil {
		return operations.Operation{}, err
	}
	if err := s.loadOperationalCommandNodes(ctx, &operation); err != nil {
		return operations.Operation{}, err
	}
	return operation, nil
}

func (s *Store) operationalCommandByIdempotency(ctx context.Context, userID, key string) (operations.Operation, error) {
	operation, err := scanDNSOperation(s.pool.QueryRow(ctx, dnsOperationSelect+` WHERE o.requested_by=$1 AND o.idempotency_key=$2`, userID, key))
	if err != nil {
		return operations.Operation{}, err
	}
	if err := s.loadOperationalCommandNodes(ctx, &operation); err != nil {
		return operations.Operation{}, err
	}
	return operation, nil
}

func (s *Store) ListOperationalCommands(ctx context.Context, clusterID string, command operations.Command, limit int) ([]operations.Operation, error) {
	query := `SELECT id FROM operational_commands WHERE cluster_id=$1 AND command_type IN ('test_upstream_dns','test_host_filtering','clear_dns_cache','clear_query_log','reset_statistics')`
	args := []any{clusterID}
	if command != "" {
		query += ` AND command_type=$2 ORDER BY requested_at DESC,id DESC LIMIT $3`
		args = append(args, command, limit)
	} else {
		query += ` ORDER BY requested_at DESC,id DESC LIMIT $2`
		args = append(args, limit)
	}
	rows, err := s.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("list operational command ids: %w", err)
	}
	ids := make([]string, 0)
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			rows.Close()
			return nil, err
		}
		ids = append(ids, id)
	}
	if err := rows.Err(); err != nil {
		rows.Close()
		return nil, err
	}
	rows.Close()
	items := make([]operations.Operation, 0, len(ids))
	for _, id := range ids {
		item, err := s.OperationalCommandByID(ctx, id)
		if err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, nil
}

func (s *Store) loadOperationalCommandNodes(ctx context.Context, operation *operations.Operation) error {
	rows, err := s.pool.Query(ctx, `
		SELECT r.id,r.node_id,n.name,r.position,r.status,r.error_code,r.result,
		       r.observation_status,r.observation_snapshot_id,r.observation_error_code,
		       r.started_at,r.completed_at
		FROM operational_command_node_results r JOIN nodes n ON n.id=r.node_id
		WHERE r.command_id=$1 ORDER BY r.position,r.id`, operation.ID)
	if err != nil {
		return fmt.Errorf("read operational command node results: %w", err)
	}
	defer rows.Close()
	operation.NodeResults = []operations.NodeResult{}
	for rows.Next() {
		var node operations.NodeResult
		var body []byte
		var snapshotID *string
		if err := rows.Scan(&node.ID, &node.NodeID, &node.NodeName, &node.Position, &node.Status,
			&node.ErrorCode, &body, &node.ObservationStatus, &snapshotID,
			&node.ObservationErrorCode, &node.StartedAt, &node.CompletedAt); err != nil {
			return fmt.Errorf("scan operational command node result: %w", err)
		}
		if snapshotID != nil {
			node.ObservationSnapshotID = *snapshotID
		}
		var result struct {
			UpstreamResults  []operations.ResolverResult  `json:"upstreamResults"`
			HostFilterResult *operations.HostFilterResult `json:"hostFilterResult"`
		}
		if len(body) > 0 {
			if err := json.Unmarshal(body, &result); err != nil {
				return fmt.Errorf("decode operational command node result: %w", err)
			}
		}
		node.ResolverResults = result.UpstreamResults
		node.HostFilterResult = result.HostFilterResult
		operation.NodeResults = append(operation.NodeResults, node)
	}
	return rows.Err()
}

func scanDNSOperation(row rowScanner) (operations.Operation, error) {
	var item operations.Operation
	var targetNode, auditReference *string
	var excluded []byte
	var payloadKeyVersion *int
	var payloadAlgorithm *string
	if err := row.Scan(&item.ID, &item.ClusterID, &item.ClusterName, &item.Command,
		&item.Target.Scope, &targetNode, &item.Status, &item.RequestID, &item.IdempotencyKey,
		&item.RequestedBy, &item.InputFingerprint, &item.Payload.Ciphertext, &item.Payload.Nonce,
		&payloadKeyVersion, &payloadAlgorithm, &excluded, &auditReference,
		&item.RequestedAt, &item.StartedAt, &item.CompletedAt); err != nil {
		return item, mapDatabaseError(err, "operational command")
	}
	if targetNode != nil {
		item.Target.NodeID = *targetNode
	}
	if payloadKeyVersion != nil {
		item.Payload.KeyVersion = *payloadKeyVersion
	}
	if payloadAlgorithm != nil {
		item.Payload.Algorithm = *payloadAlgorithm
	}
	if auditReference != nil {
		item.AuditReference = *auditReference
	}
	if err := json.Unmarshal(excluded, &item.ExcludedNodes); err != nil {
		return item, fmt.Errorf("decode excluded operational targets: %w", err)
	}
	return item, nil
}

func defaultString(value, fallback string) string {
	if value == "" {
		return fallback
	}
	return value
}
