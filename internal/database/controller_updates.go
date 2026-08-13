package database

import (
	"context"
	"fmt"

	"github.com/benchristian88/atlas-dns/internal/updates"
)

func (s *Store) ControllerReleaseCache(ctx context.Context) (updates.Cache, error) {
	var value updates.Cache
	err := s.pool.QueryRow(ctx, `SELECT version,release_url,release_notes,COALESCE(checked_at,'epoch'::timestamptz),COALESCE(expires_at,'epoch'::timestamptz),error_code FROM controller_release_cache WHERE singleton`).Scan(&value.Version, &value.ReleaseURL, &value.ReleaseNotes, &value.CheckedAt, &value.ExpiresAt, &value.ErrorCode)
	if err != nil {
		return updates.Cache{}, fmt.Errorf("read controller release cache: %w", err)
	}
	return value, nil
}

func (s *Store) SaveControllerReleaseCache(ctx context.Context, value updates.Cache) error {
	_, err := s.pool.Exec(ctx, `UPDATE controller_release_cache SET version=$1,release_url=$2,release_notes=$3,checked_at=$4,expires_at=$5,error_code=$6 WHERE singleton`, value.Version, value.ReleaseURL, value.ReleaseNotes, value.CheckedAt, value.ExpiresAt, value.ErrorCode)
	if err != nil {
		return fmt.Errorf("save controller release cache: %w", err)
	}
	return nil
}
