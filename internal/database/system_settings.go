package database

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/benchristian88/agh-ha-controller/internal/domain"
)

func (s *Store) SystemSettings(ctx context.Context) (bool, int, error) {
	var enabled bool
	var version int
	if err := s.pool.QueryRow(ctx, `SELECT update_checks_enabled,record_version FROM system_settings WHERE singleton`).Scan(&enabled, &version); err != nil {
		return false, 0, fmt.Errorf("read system settings: %w", err)
	}
	return enabled, version, nil
}

func (s *Store) UpdateChecksEnabled(ctx context.Context) (bool, error) {
	var enabled bool
	if err := s.pool.QueryRow(ctx, `SELECT update_checks_enabled FROM system_settings WHERE singleton`).Scan(&enabled); err != nil {
		return false, fmt.Errorf("read update-check setting: %w", err)
	}
	return enabled, nil
}

func (s *Store) UpdateSystemSettings(ctx context.Context, enabled bool, expectedVersion int, now time.Time, event domain.AuditEvent) (bool, int, error) {
	tx, err := s.pool.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return false, 0, err
	}
	defer func() { _ = tx.Rollback(context.Background()) }()
	var version int
	err = tx.QueryRow(ctx, `UPDATE system_settings SET update_checks_enabled=$1,record_version=record_version+1,updated_at=$2,updated_by=$3 WHERE singleton AND record_version=$4 RETURNING record_version`, enabled, now, event.ActorUserID, expectedVersion).Scan(&version)
	if err == pgx.ErrNoRows {
		return false, 0, domain.NewError(domain.ErrorConflict, "system settings changed; reload and try again")
	}
	if err != nil {
		return false, 0, fmt.Errorf("update system settings: %w", err)
	}
	if err := audit(ctx, tx, event); err != nil {
		return false, 0, err
	}
	if err := tx.Commit(ctx); err != nil {
		return false, 0, err
	}
	return enabled, version, nil
}
