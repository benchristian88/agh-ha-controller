package database

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/benchristian88/agh-ha-controller/internal/domain"
)

func (s *Store) CreateNode(ctx context.Context, record domain.NodeRecord, event domain.AuditEvent) error {
	tx, err := s.pool.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return fmt.Errorf("begin node creation: %w", err)
	}
	defer func() { _ = tx.Rollback(context.Background()) }()
	node := record.Node
	credentials := record.Secrets.Credentials
	_, err = tx.Exec(ctx, `
		INSERT INTO nodes (
			id, cluster_id, name, base_url, encrypted_credentials, credential_nonce,
			credential_key_version, credential_algorithm, certificate_policy, custom_ca_pem,
			enabled, health_status, compatibility_status, version, last_seen_at, last_polled_at,
			latency_ms, last_error_code, record_version, created_at, updated_at
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
			$11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $20
		)`,
		node.ID, node.ClusterID, node.Name, node.BaseURL, credentials.Ciphertext, credentials.Nonce,
		credentials.KeyVersion, credentials.Algorithm, node.CertificatePolicy, record.Secrets.CustomCAPEM,
		node.Enabled, node.HealthStatus, node.CompatibilityStatus, node.Version, node.LastSeenAt,
		node.LastPolledAt, node.LatencyMS, node.LastErrorCode, node.RecordVersion, node.CreatedAt)
	if err != nil {
		if isUniqueViolation(err) {
			return domain.NewError(domain.ErrorConflict, "a node with this name or URL already exists in the cluster")
		}
		return fmt.Errorf("create node: %w", err)
	}
	if err := audit(ctx, tx, event); err != nil {
		return err
	}
	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit node creation: %w", err)
	}
	return nil
}

func (s *Store) ListNodes(ctx context.Context, clusterID string) ([]domain.Node, error) {
	rows, err := s.pool.Query(ctx, nodeSelect+`
		WHERE cluster_id = $1 AND deleted_at IS NULL
		ORDER BY lower(name), id`, clusterID)
	if err != nil {
		return nil, fmt.Errorf("list nodes: %w", err)
	}
	defer rows.Close()
	nodes := make([]domain.Node, 0)
	for rows.Next() {
		node, err := scanNode(rows)
		if err != nil {
			return nil, fmt.Errorf("scan node: %w", err)
		}
		nodes = append(nodes, node)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate nodes: %w", err)
	}
	return nodes, nil
}

func (s *Store) NodeByID(ctx context.Context, id string) (domain.Node, error) {
	node, err := scanNode(s.pool.QueryRow(ctx, nodeSelect+" WHERE id = $1 AND deleted_at IS NULL", id))
	if err != nil {
		return domain.Node{}, mapDatabaseError(err, "node")
	}
	return node, nil
}

func (s *Store) NodeRecordByID(ctx context.Context, id string) (domain.NodeRecord, error) {
	row := s.pool.QueryRow(ctx, nodeSecretSelect+" WHERE id = $1 AND deleted_at IS NULL", id)
	var record domain.NodeRecord
	err := row.Scan(
		&record.Node.ID, &record.Node.ClusterID, &record.Node.Name, &record.Node.BaseURL,
		&record.Node.CertificatePolicy, &record.Node.Enabled, &record.Node.HealthStatus,
		&record.Node.CompatibilityStatus, &record.Node.Version, &record.Node.LastSeenAt,
		&record.Node.LastPolledAt, &record.Node.LatencyMS, &record.Node.LastErrorCode,
		&record.Node.MaintenanceMode, &record.Node.AppliedRevisionID, &record.Node.AppliedHash,
		&record.Node.ConvergenceStatus, &record.Node.LastReconciledAt,
		&record.Node.RecordVersion, &record.Node.CreatedAt, &record.Node.UpdatedAt,
		&record.Secrets.Credentials.Ciphertext, &record.Secrets.Credentials.Nonce,
		&record.Secrets.Credentials.KeyVersion, &record.Secrets.Credentials.Algorithm,
		&record.Secrets.CustomCAPEM)
	if err != nil {
		return domain.NodeRecord{}, mapDatabaseError(err, "node")
	}
	return record, nil
}

func (s *Store) PollableNodes(ctx context.Context) ([]domain.NodeRecord, error) {
	rows, err := s.pool.Query(ctx, nodeSecretSelect+" WHERE enabled AND deleted_at IS NULL ORDER BY id")
	if err != nil {
		return nil, fmt.Errorf("list pollable nodes: %w", err)
	}
	defer rows.Close()
	records := make([]domain.NodeRecord, 0)
	for rows.Next() {
		var record domain.NodeRecord
		if err := rows.Scan(
			&record.Node.ID, &record.Node.ClusterID, &record.Node.Name, &record.Node.BaseURL,
			&record.Node.CertificatePolicy, &record.Node.Enabled, &record.Node.HealthStatus,
			&record.Node.CompatibilityStatus, &record.Node.Version, &record.Node.LastSeenAt,
			&record.Node.LastPolledAt, &record.Node.LatencyMS, &record.Node.LastErrorCode,
			&record.Node.MaintenanceMode, &record.Node.AppliedRevisionID, &record.Node.AppliedHash,
			&record.Node.ConvergenceStatus, &record.Node.LastReconciledAt,
			&record.Node.RecordVersion, &record.Node.CreatedAt, &record.Node.UpdatedAt,
			&record.Secrets.Credentials.Ciphertext, &record.Secrets.Credentials.Nonce,
			&record.Secrets.Credentials.KeyVersion, &record.Secrets.Credentials.Algorithm,
			&record.Secrets.CustomCAPEM); err != nil {
			return nil, fmt.Errorf("scan pollable node: %w", err)
		}
		records = append(records, record)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate pollable nodes: %w", err)
	}
	return records, nil
}

func (s *Store) UpdateNode(ctx context.Context, record domain.NodeRecord, expectedVersion int, event domain.AuditEvent) error {
	tx, err := s.pool.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return fmt.Errorf("begin node update: %w", err)
	}
	defer func() { _ = tx.Rollback(context.Background()) }()
	node := record.Node
	credentials := record.Secrets.Credentials
	tag, err := tx.Exec(ctx, `
		UPDATE nodes SET
			name = $2, base_url = $3, encrypted_credentials = $4, credential_nonce = $5,
			credential_key_version = $6, credential_algorithm = $7, certificate_policy = $8,
			custom_ca_pem = $9, enabled = $10, health_status = $11,
			compatibility_status = $12, version = $13, last_seen_at = $14,
			last_polled_at = $15, latency_ms = $16, last_error_code = $17,
			convergence_status = CASE WHEN maintenance_mode THEN 'maintenance' ELSE 'pending' END,
			record_version = record_version + 1, updated_at = $18
		WHERE id = $1 AND record_version = $19 AND deleted_at IS NULL`,
		node.ID, node.Name, node.BaseURL, credentials.Ciphertext, credentials.Nonce,
		credentials.KeyVersion, credentials.Algorithm, node.CertificatePolicy,
		record.Secrets.CustomCAPEM, node.Enabled, node.HealthStatus, node.CompatibilityStatus,
		node.Version, node.LastSeenAt, node.LastPolledAt, node.LatencyMS, node.LastErrorCode,
		node.UpdatedAt, expectedVersion)
	if err != nil {
		if isUniqueViolation(err) {
			return domain.NewError(domain.ErrorConflict, "a node with this name or URL already exists in the cluster")
		}
		return fmt.Errorf("update node: %w", err)
	}
	if tag.RowsAffected() == 0 {
		if err := nodeWriteFailure(ctx, tx, node.ID); err != nil {
			return err
		}
	}
	if err := audit(ctx, tx, event); err != nil {
		return err
	}
	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit node update: %w", err)
	}
	return nil
}

func (s *Store) SoftDeleteNode(ctx context.Context, id string, expectedVersion int, at time.Time, event domain.AuditEvent) error {
	tx, err := s.pool.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return fmt.Errorf("begin node removal: %w", err)
	}
	defer func() { _ = tx.Rollback(context.Background()) }()
	tag, err := tx.Exec(ctx, `
		UPDATE nodes SET enabled = false, health_status = 'disabled',
			encrypted_credentials = ''::bytea, credential_nonce = ''::bytea,
			custom_ca_pem = '', deleted_at = $3, updated_at = $3, record_version = record_version + 1
		WHERE id = $1 AND record_version = $2 AND deleted_at IS NULL`, id, expectedVersion, at)
	if err != nil {
		return fmt.Errorf("remove node: %w", err)
	}
	if tag.RowsAffected() == 0 {
		if err := nodeWriteFailure(ctx, tx, id); err != nil {
			return err
		}
	}
	if _, err := tx.Exec(ctx, `UPDATE drift_events SET status='resolved',reconciliation_status='resolved',resolved_at=$2,resolution='node_removed' WHERE node_id=$1 AND status='open'`, id, at); err != nil {
		return fmt.Errorf("resolve removed node drift: %w", err)
	}
	if err := audit(ctx, tx, event); err != nil {
		return err
	}
	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit node removal: %w", err)
	}
	return nil
}

func (s *Store) UpdateNodeHealth(ctx context.Context, id string, health domain.NodeHealth, compatibility domain.Compatibility, version string, latencyMS *int, errorCode string, polledAt time.Time, seen bool) error {
	_, err := s.pool.Exec(ctx, `
		UPDATE nodes SET health_status = $2, compatibility_status = $3, version = $4,
			latency_ms = $5, last_error_code = $6, last_polled_at = $7,
			last_seen_at = CASE WHEN $8 THEN $7 ELSE last_seen_at END,
			updated_at = $7
		WHERE id = $1 AND enabled AND deleted_at IS NULL`,
		id, health, compatibility, version, latencyMS, errorCode, polledAt, seen)
	if err != nil {
		return fmt.Errorf("update node health: %w", err)
	}
	return nil
}

func (s *Store) RecordNodeTestResult(ctx context.Context, id string, health domain.NodeHealth, compatibility domain.Compatibility, version string, latencyMS *int, errorCode string, polledAt time.Time, seen bool, event domain.AuditEvent) error {
	tx, err := s.pool.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return fmt.Errorf("begin node connection test result: %w", err)
	}
	defer func() { _ = tx.Rollback(context.Background()) }()
	tag, err := tx.Exec(ctx, `
		UPDATE nodes SET
			health_status = CASE WHEN enabled THEN $2 ELSE 'disabled' END,
			compatibility_status = $3, version = $4, latency_ms = $5,
			last_error_code = $6, last_polled_at = $7,
			last_seen_at = CASE WHEN $8 THEN $7 ELSE last_seen_at END,
			updated_at = $7
		WHERE id = $1 AND deleted_at IS NULL`,
		id, health, compatibility, version, latencyMS, errorCode, polledAt, seen)
	if err != nil {
		return fmt.Errorf("record node connection test result: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return domain.NewError(domain.ErrorNotFound, "node was not found")
	}
	if err := audit(ctx, tx, event); err != nil {
		return err
	}
	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit node connection test result: %w", err)
	}
	return nil
}

func (s *Store) SetNodeMaintenance(ctx context.Context, id string, enabled bool, expectedVersion int, at time.Time, event domain.AuditEvent) error {
	tx, err := s.pool.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return fmt.Errorf("begin maintenance update: %w", err)
	}
	defer func() { _ = tx.Rollback(context.Background()) }()
	tag, err := tx.Exec(ctx, `UPDATE nodes SET maintenance_mode=$2,
		convergence_status=CASE WHEN $2 THEN 'maintenance' ELSE 'pending' END,
		record_version=record_version+1, updated_at=$3
		WHERE id=$1 AND record_version=$4 AND deleted_at IS NULL`, id, enabled, at, expectedVersion)
	if err != nil {
		return fmt.Errorf("set node maintenance: %w", err)
	}
	if tag.RowsAffected() == 0 {
		if err := nodeWriteFailure(ctx, tx, id); err != nil {
			return err
		}
	}
	if _, err := tx.Exec(ctx, `UPDATE drift_events SET reconciliation_status=CASE WHEN $2 THEN 'maintenance' ELSE 'pending' END WHERE node_id=$1 AND status='open'`, id, enabled); err != nil {
		return fmt.Errorf("update drift maintenance state: %w", err)
	}
	if err := audit(ctx, tx, event); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func nodeWriteFailure(ctx context.Context, tx pgx.Tx, id string) error {
	var exists bool
	if err := tx.QueryRow(ctx, "SELECT EXISTS (SELECT 1 FROM nodes WHERE id = $1 AND deleted_at IS NULL)", id).Scan(&exists); err != nil {
		return fmt.Errorf("check node update conflict: %w", err)
	}
	if !exists {
		return domain.NewError(domain.ErrorNotFound, "node was not found")
	}
	return domain.NewError(domain.ErrorConflict, "node was changed by another request")
}

const nodeSelect = `
	SELECT id, cluster_id, name, base_url, certificate_policy, enabled, health_status,
	       compatibility_status, version, last_seen_at, last_polled_at, latency_ms,
	       last_error_code, maintenance_mode, applied_revision_id, applied_hash,
	       convergence_status, last_reconciled_at, record_version, created_at, updated_at
	FROM nodes`

const nodeSecretSelect = `
	SELECT id, cluster_id, name, base_url, certificate_policy, enabled, health_status,
	       compatibility_status, version, last_seen_at, last_polled_at, latency_ms,
	       last_error_code, maintenance_mode, applied_revision_id, applied_hash,
	       convergence_status, last_reconciled_at, record_version, created_at, updated_at,
	       encrypted_credentials, credential_nonce, credential_key_version,
	       credential_algorithm, custom_ca_pem
	FROM nodes`

type rowScanner interface {
	Scan(...any) error
}

func scanNode(row rowScanner) (domain.Node, error) {
	var node domain.Node
	err := row.Scan(
		&node.ID, &node.ClusterID, &node.Name, &node.BaseURL, &node.CertificatePolicy,
		&node.Enabled, &node.HealthStatus, &node.CompatibilityStatus, &node.Version,
		&node.LastSeenAt, &node.LastPolledAt, &node.LatencyMS, &node.LastErrorCode,
		&node.MaintenanceMode, &node.AppliedRevisionID, &node.AppliedHash, &node.ConvergenceStatus,
		&node.LastReconciledAt, &node.RecordVersion, &node.CreatedAt, &node.UpdatedAt)
	return node, err
}
