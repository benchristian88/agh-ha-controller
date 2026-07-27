package database

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5"

	"github.com/benchristian88/agh-ha-controller/internal/domain"
)

func (s *Store) CreateCluster(ctx context.Context, cluster domain.Cluster, event domain.AuditEvent) error {
	tx, err := s.pool.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return fmt.Errorf("begin cluster creation: %w", err)
	}
	defer func() { _ = tx.Rollback(context.Background()) }()
	_, err = tx.Exec(ctx, `
		INSERT INTO clusters (id, name, description, version, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $5)`,
		cluster.ID, cluster.Name, cluster.Description, cluster.Version, cluster.CreatedAt)
	if err != nil {
		if isUniqueViolation(err) {
			return domain.NewError(domain.ErrorConflict, "a cluster with this name already exists")
		}
		return fmt.Errorf("create cluster: %w", err)
	}
	if err := audit(ctx, tx, event); err != nil {
		return err
	}
	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit cluster creation: %w", err)
	}
	return nil
}

func (s *Store) ListClusters(ctx context.Context) ([]domain.Cluster, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT id, name, description, version, created_at, updated_at
		FROM clusters ORDER BY lower(name), id`)
	if err != nil {
		return nil, fmt.Errorf("list clusters: %w", err)
	}
	defer rows.Close()
	clusters := make([]domain.Cluster, 0)
	for rows.Next() {
		var cluster domain.Cluster
		if err := rows.Scan(&cluster.ID, &cluster.Name, &cluster.Description, &cluster.Version, &cluster.CreatedAt, &cluster.UpdatedAt); err != nil {
			return nil, fmt.Errorf("scan cluster: %w", err)
		}
		clusters = append(clusters, cluster)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate clusters: %w", err)
	}
	return clusters, nil
}

func (s *Store) ClusterByID(ctx context.Context, id string) (domain.Cluster, error) {
	var cluster domain.Cluster
	err := s.pool.QueryRow(ctx, `
		SELECT id, name, description, version, created_at, updated_at
		FROM clusters WHERE id = $1`, id).Scan(
		&cluster.ID, &cluster.Name, &cluster.Description, &cluster.Version, &cluster.CreatedAt, &cluster.UpdatedAt)
	if err != nil {
		return domain.Cluster{}, mapDatabaseError(err, "cluster")
	}
	return cluster, nil
}

func (s *Store) UpdateCluster(ctx context.Context, cluster domain.Cluster, expectedVersion int, event domain.AuditEvent) error {
	tx, err := s.pool.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return fmt.Errorf("begin cluster update: %w", err)
	}
	defer func() { _ = tx.Rollback(context.Background()) }()
	tag, err := tx.Exec(ctx, `
		UPDATE clusters
		SET name = $2, description = $3, version = version + 1, updated_at = $4
		WHERE id = $1 AND version = $5`,
		cluster.ID, cluster.Name, cluster.Description, cluster.UpdatedAt, expectedVersion)
	if err != nil {
		if isUniqueViolation(err) {
			return domain.NewError(domain.ErrorConflict, "a cluster with this name already exists")
		}
		return fmt.Errorf("update cluster: %w", err)
	}
	if tag.RowsAffected() == 0 {
		var exists bool
		if err := tx.QueryRow(ctx, "SELECT EXISTS (SELECT 1 FROM clusters WHERE id = $1)", cluster.ID).Scan(&exists); err != nil {
			return fmt.Errorf("check cluster update conflict: %w", err)
		}
		if !exists {
			return domain.NewError(domain.ErrorNotFound, "cluster was not found")
		}
		return domain.NewError(domain.ErrorConflict, "cluster was changed by another request")
	}
	if err := audit(ctx, tx, event); err != nil {
		return err
	}
	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit cluster update: %w", err)
	}
	return nil
}
