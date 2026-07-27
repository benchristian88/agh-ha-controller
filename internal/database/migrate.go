package database

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io/fs"
	"sort"
	"strconv"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	projectmigrations "github.com/benchristian88/agh-ha-controller/migrations"
)

const migrationAdvisoryLock int64 = 64012001

type migration struct {
	version  int64
	name     string
	up       string
	down     string
	checksum string
}

func ApplyMigrations(ctx context.Context, pool *pgxpool.Pool) error {
	items, err := loadMigrations()
	if err != nil {
		return err
	}
	connection, err := pool.Acquire(ctx)
	if err != nil {
		return fmt.Errorf("acquire migration connection: %w", err)
	}
	defer connection.Release()
	if _, err := connection.Exec(ctx, "SELECT pg_advisory_lock($1)", migrationAdvisoryLock); err != nil {
		return fmt.Errorf("acquire migration lock: %w", err)
	}
	defer func() {
		_, _ = connection.Exec(context.Background(), "SELECT pg_advisory_unlock($1)", migrationAdvisoryLock)
	}()
	if _, err := connection.Exec(ctx, `
		CREATE TABLE IF NOT EXISTS schema_migrations (
			version bigint PRIMARY KEY,
			name text NOT NULL,
			checksum text NOT NULL,
			applied_at timestamptz NOT NULL DEFAULT now()
		)`); err != nil {
		return fmt.Errorf("create migration ledger: %w", err)
	}
	applied := make(map[int64]string)
	rows, err := connection.Query(ctx, "SELECT version, checksum FROM schema_migrations")
	if err != nil {
		return fmt.Errorf("read migration ledger: %w", err)
	}
	for rows.Next() {
		var version int64
		var checksum string
		if err := rows.Scan(&version, &checksum); err != nil {
			rows.Close()
			return fmt.Errorf("scan migration ledger: %w", err)
		}
		applied[version] = checksum
	}
	if err := rows.Err(); err != nil {
		rows.Close()
		return fmt.Errorf("iterate migration ledger: %w", err)
	}
	rows.Close()
	for _, item := range items {
		if checksum, ok := applied[item.version]; ok {
			if checksum != item.checksum {
				return fmt.Errorf("migration %06d checksum differs from the applied migration", item.version)
			}
			continue
		}
		tx, err := connection.BeginTx(ctx, pgx.TxOptions{})
		if err != nil {
			return fmt.Errorf("begin migration %06d: %w", item.version, err)
		}
		if _, err := tx.Exec(ctx, item.up); err != nil {
			_ = tx.Rollback(ctx)
			return fmt.Errorf("apply migration %06d: %w", item.version, err)
		}
		if _, err := tx.Exec(ctx,
			"INSERT INTO schema_migrations (version, name, checksum) VALUES ($1, $2, $3)",
			item.version, item.name, item.checksum); err != nil {
			_ = tx.Rollback(ctx)
			return fmt.Errorf("record migration %06d: %w", item.version, err)
		}
		if err := tx.Commit(ctx); err != nil {
			return fmt.Errorf("commit migration %06d: %w", item.version, err)
		}
	}
	return nil
}

func RollbackLastMigration(ctx context.Context, pool *pgxpool.Pool) error {
	items, err := loadMigrations()
	if err != nil {
		return err
	}
	byVersion := make(map[int64]migration, len(items))
	for _, item := range items {
		byVersion[item.version] = item
	}
	tx, err := pool.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return fmt.Errorf("begin migration rollback: %w", err)
	}
	defer func() { _ = tx.Rollback(context.Background()) }()
	if _, err := tx.Exec(ctx, "SELECT pg_advisory_xact_lock($1)", migrationAdvisoryLock); err != nil {
		return fmt.Errorf("acquire migration rollback lock: %w", err)
	}
	var version int64
	if err := tx.QueryRow(ctx, "SELECT version FROM schema_migrations ORDER BY version DESC LIMIT 1").Scan(&version); err != nil {
		if err == pgx.ErrNoRows {
			return nil
		}
		return fmt.Errorf("find last migration: %w", err)
	}
	item, ok := byVersion[version]
	if !ok || strings.TrimSpace(item.down) == "" {
		return fmt.Errorf("no rollback is available for migration %06d", version)
	}
	if _, err := tx.Exec(ctx, item.down); err != nil {
		return fmt.Errorf("roll back migration %06d: %w", version, err)
	}
	if _, err := tx.Exec(ctx, "DELETE FROM schema_migrations WHERE version = $1", version); err != nil {
		return fmt.Errorf("remove migration %06d from ledger: %w", version, err)
	}
	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit migration rollback: %w", err)
	}
	return nil
}

func loadMigrations() ([]migration, error) {
	entries, err := fs.ReadDir(projectmigrations.Files, ".")
	if err != nil {
		return nil, fmt.Errorf("read embedded migrations: %w", err)
	}
	items := make(map[int64]*migration)
	for _, entry := range entries {
		name := entry.Name()
		if entry.IsDir() || (!strings.HasSuffix(name, ".up.sql") && !strings.HasSuffix(name, ".down.sql")) {
			continue
		}
		parts := strings.SplitN(name, "_", 2)
		if len(parts) != 2 {
			return nil, fmt.Errorf("invalid migration filename %q", name)
		}
		version, err := strconv.ParseInt(parts[0], 10, 64)
		if err != nil {
			return nil, fmt.Errorf("parse migration version %q: %w", name, err)
		}
		body, err := fs.ReadFile(projectmigrations.Files, name)
		if err != nil {
			return nil, fmt.Errorf("read migration %q: %w", name, err)
		}
		item := items[version]
		if item == nil {
			item = &migration{version: version, name: strings.TrimSuffix(strings.TrimSuffix(parts[1], ".up.sql"), ".down.sql")}
			items[version] = item
		}
		if strings.HasSuffix(name, ".up.sql") {
			item.up = string(body)
			digest := sha256.Sum256(body)
			item.checksum = hex.EncodeToString(digest[:])
		} else {
			item.down = string(body)
		}
	}
	ordered := make([]migration, 0, len(items))
	for _, item := range items {
		if strings.TrimSpace(item.up) == "" {
			return nil, fmt.Errorf("migration %06d has no up file", item.version)
		}
		ordered = append(ordered, *item)
	}
	sort.Slice(ordered, func(i, j int) bool { return ordered[i].version < ordered[j].version })
	return ordered, nil
}
