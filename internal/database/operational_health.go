package database

import (
	"context"
	"fmt"
	"time"

	"github.com/benchristian88/agh-ha-controller/internal/operationalhealth"
)

func (s *Store) OperationalDatabase(ctx context.Context, statisticsRetention, queryLogRetention time.Duration) (operationalhealth.Database, error) {
	started := time.Now()
	if err := s.pool.Ping(ctx); err != nil {
		return operationalhealth.Database{State: operationalhealth.Failed, ErrorCode: "DATABASE_UNAVAILABLE"}, err
	}
	result := operationalhealth.Database{State: operationalhealth.Healthy, PingLatencyMS: time.Since(started).Milliseconds()}
	if err := s.pool.QueryRow(ctx, `SELECT COALESCE((SELECT max(version) FROM schema_migrations),0), pg_database_size(current_database())`).Scan(&result.SchemaVersion, &result.DatabaseBytes); err != nil {
		return result, fmt.Errorf("read database metadata: %w", err)
	}
	stats := s.pool.Stat()
	result.PoolTotal, result.PoolAcquired, result.PoolMax = stats.TotalConns(), stats.AcquiredConns(), stats.MaxConns()
	queries := []struct {
		name      string
		tables    string
		retention time.Duration
		bounds    string
	}{
		{"statistics", "statistics_snapshots,statistics_buckets,statistics_poll_attempts", statisticsRetention, "statistics_snapshots"},
		{"query_log", "query_events,query_ingestion_attempts,query_ingestion_checkpoints", queryLogRetention, "query_events"},
	}
	for _, item := range queries {
		var dataset operationalhealth.StorageDataset
		dataset.Name, dataset.RetentionSeconds = item.name, int64(item.retention.Seconds())
		if err := s.pool.QueryRow(ctx, `SELECT COALESCE(sum(GREATEST(c.reltuples,0))::bigint,0),
			COALESCE(sum(pg_total_relation_size(c.oid)),0)::bigint FROM pg_class c
			WHERE c.oid = ANY(string_to_array($1, ',')::regclass[])`, item.tables).Scan(&dataset.EstimatedRows, &dataset.ApproximateBytes); err != nil {
			return result, fmt.Errorf("read %s storage metadata: %w", item.name, err)
		}
		var boundsQuery string
		if item.bounds == "query_events" {
			boundsQuery = `SELECT min(source_timestamp),max(source_timestamp) FROM query_events`
		} else {
			boundsQuery = `SELECT min(collected_at),max(collected_at) FROM statistics_snapshots`
		}
		if err := s.pool.QueryRow(ctx, boundsQuery).Scan(&dataset.OldestRetainedAt, &dataset.NewestRetainedAt); err != nil {
			return result, fmt.Errorf("read %s retention bounds: %w", item.name, err)
		}
		result.Datasets = append(result.Datasets, dataset)
	}
	if result.PoolMax > 0 && result.PoolAcquired*100/result.PoolMax >= 90 {
		result.State = operationalhealth.Degraded
		result.ErrorCode = "DATABASE_POOL_SATURATED"
	}
	return result, nil
}
