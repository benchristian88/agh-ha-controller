package database

import (
	"context"
	"fmt"
)

func (s *Store) CurrentSchemaVersion(ctx context.Context) (int64, error) {
	var version int64
	if err := s.pool.QueryRow(ctx, `SELECT COALESCE(max(version),0) FROM schema_migrations`).Scan(&version); err != nil {
		return 0, fmt.Errorf("read database schema version: %w", err)
	}
	return version, nil
}
