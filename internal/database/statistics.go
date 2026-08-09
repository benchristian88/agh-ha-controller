package database

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/benchristian88/agh-ha-controller/internal/telemetry"
)

func (s *Store) RecordStatisticsPoll(ctx context.Context, attempt telemetry.PollAttempt, snapshots []telemetry.Snapshot) error {
	tx, err := s.pool.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return fmt.Errorf("begin statistics poll record: %w", err)
	}
	defer func() { _ = tx.Rollback(context.Background()) }()
	if attempt.RangeErrors == nil {
		attempt.RangeErrors = map[telemetry.Range]string{}
	}
	rangeErrors, err := json.Marshal(attempt.RangeErrors)
	if err != nil {
		return fmt.Errorf("encode statistics range errors: %w", err)
	}
	if _, err := tx.Exec(ctx, `INSERT INTO statistics_poll_attempts
		(id,cluster_id,node_id,started_at,completed_at,status,error_code,range_errors,expected_ranges,collected_ranges)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`, attempt.ID, attempt.ClusterID, attempt.NodeID,
		attempt.StartedAt, attempt.CompletedAt, attempt.Status, attempt.ErrorCode, rangeErrors, attempt.ExpectedRanges, attempt.CollectedRanges); err != nil {
		return fmt.Errorf("insert statistics poll attempt: %w", err)
	}
	for _, snapshot := range snapshots {
		if err := insertStatisticsSnapshot(ctx, tx, snapshot); err != nil {
			return err
		}
		if err := upsertStatisticsBuckets(ctx, tx, snapshot); err != nil {
			return err
		}
	}
	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit statistics poll record: %w", err)
	}
	return nil
}

func insertStatisticsSnapshot(ctx context.Context, tx pgx.Tx, snapshot telemetry.Snapshot) error {
	encoded := make([][]byte, 9)
	values := []any{snapshot.TopQueriedDomains, snapshot.TopBlockedDomains, snapshot.TopClients,
		snapshot.TopUpstreamResponses, snapshot.TopUpstreamAverageSeconds, snapshot.DNSQueriesSeries,
		snapshot.BlockedFilteringSeries, snapshot.ReplacedSafeBrowsingSeries, snapshot.ReplacedParentalSeries}
	for index, value := range values {
		body, err := json.Marshal(value)
		if err != nil {
			return fmt.Errorf("encode statistics snapshot: %w", err)
		}
		encoded[index] = body
	}
	_, err := tx.Exec(ctx, `INSERT INTO statistics_snapshots (
		id,cluster_id,node_id,range_key,source_started_at,source_ended_at,collected_at,node_version,time_unit,
		dns_queries,blocked_filtering,replaced_safebrowsing,replaced_safesearch,replaced_parental,average_processing_seconds,
		top_queried_domains,top_blocked_domains,top_clients,top_upstream_responses,top_upstream_average_seconds,
		dns_queries_series,blocked_filtering_series,replaced_safebrowsing_series,replaced_parental_series)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24)`,
		snapshot.ID, snapshot.ClusterID, snapshot.NodeID, snapshot.Range, snapshot.SourceStartedAt, snapshot.SourceEndedAt,
		snapshot.CollectedAt, snapshot.NodeVersion, snapshot.TimeUnit, snapshot.DNSQueries, snapshot.BlockedFiltering,
		snapshot.ReplacedSafeBrowsing, snapshot.ReplacedSafeSearch, snapshot.ReplacedParental, snapshot.AverageProcessingSeconds,
		encoded[0], encoded[1], encoded[2], encoded[3], encoded[4], encoded[5], encoded[6], encoded[7], encoded[8])
	if err != nil {
		return fmt.Errorf("insert statistics snapshot: %w", err)
	}
	return nil
}

func upsertStatisticsBuckets(ctx context.Context, tx pgx.Tx, snapshot telemetry.Snapshot) error {
	step := time.Hour
	resolution := "hour"
	if snapshot.TimeUnit == "days" {
		step = 24 * time.Hour
		resolution = "day"
	}
	count := len(snapshot.DNSQueriesSeries)
	for index := 0; index < count; index++ {
		bucketStart := snapshot.SourceEndedAt.Add(-time.Duration(count-index) * step)
		_, err := tx.Exec(ctx, `INSERT INTO statistics_buckets
			(cluster_id,node_id,resolution,bucket_start,dns_queries,blocked_filtering,replaced_safebrowsing,replaced_parental,collected_at)
			VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
			ON CONFLICT (node_id,resolution,bucket_start) DO UPDATE SET
				dns_queries=EXCLUDED.dns_queries,blocked_filtering=EXCLUDED.blocked_filtering,
				replaced_safebrowsing=EXCLUDED.replaced_safebrowsing,replaced_parental=EXCLUDED.replaced_parental,
				collected_at=EXCLUDED.collected_at
			WHERE statistics_buckets.collected_at <= EXCLUDED.collected_at`, snapshot.ClusterID, snapshot.NodeID,
			resolution, bucketStart, snapshot.DNSQueriesSeries[index], snapshot.BlockedFilteringSeries[index],
			snapshot.ReplacedSafeBrowsingSeries[index], snapshot.ReplacedParentalSeries[index], snapshot.CollectedAt)
		if err != nil {
			return fmt.Errorf("upsert statistics bucket: %w", err)
		}
	}
	return nil
}

func (s *Store) LatestStatisticsSnapshots(ctx context.Context, clusterID string, window telemetry.Range, nodeID string) ([]telemetry.Snapshot, error) {
	var nodeFilter any
	if nodeID != "" {
		nodeFilter = nodeID
	}
	rows, err := s.pool.Query(ctx, `SELECT DISTINCT ON (s.node_id)
		s.id,s.cluster_id,s.node_id,n.name,s.node_version,s.range_key,s.source_started_at,s.source_ended_at,s.collected_at,s.time_unit,
		s.dns_queries,s.blocked_filtering,s.replaced_safebrowsing,s.replaced_safesearch,s.replaced_parental,s.average_processing_seconds,
		s.top_queried_domains,s.top_blocked_domains,s.top_clients,s.top_upstream_responses,s.top_upstream_average_seconds,
		s.dns_queries_series,s.blocked_filtering_series,s.replaced_safebrowsing_series,s.replaced_parental_series
		FROM statistics_snapshots s JOIN nodes n ON n.id=s.node_id
		WHERE s.cluster_id=$1 AND s.range_key=$2 AND ($3::uuid IS NULL OR s.node_id=$3::uuid) AND n.deleted_at IS NULL
		ORDER BY s.node_id,s.collected_at DESC`, clusterID, window, nodeFilter)
	if err != nil {
		return nil, fmt.Errorf("query latest statistics snapshots: %w", err)
	}
	defer rows.Close()
	result := make([]telemetry.Snapshot, 0)
	for rows.Next() {
		var snapshot telemetry.Snapshot
		var ranked [5][]byte
		var series [4][]byte
		if err := rows.Scan(&snapshot.ID, &snapshot.ClusterID, &snapshot.NodeID, &snapshot.NodeName, &snapshot.NodeVersion,
			&snapshot.Range, &snapshot.SourceStartedAt, &snapshot.SourceEndedAt, &snapshot.CollectedAt, &snapshot.TimeUnit,
			&snapshot.DNSQueries, &snapshot.BlockedFiltering, &snapshot.ReplacedSafeBrowsing, &snapshot.ReplacedSafeSearch,
			&snapshot.ReplacedParental, &snapshot.AverageProcessingSeconds, &ranked[0], &ranked[1], &ranked[2], &ranked[3],
			&ranked[4], &series[0], &series[1], &series[2], &series[3]); err != nil {
			return nil, fmt.Errorf("scan statistics snapshot: %w", err)
		}
		for index, target := range []*[]telemetry.RankedValue{&snapshot.TopQueriedDomains, &snapshot.TopBlockedDomains, &snapshot.TopClients, &snapshot.TopUpstreamResponses, &snapshot.TopUpstreamAverageSeconds} {
			if err := json.Unmarshal(ranked[index], target); err != nil {
				return nil, fmt.Errorf("decode statistics ranked values: %w", err)
			}
		}
		for index, target := range []*[]int64{&snapshot.DNSQueriesSeries, &snapshot.BlockedFilteringSeries, &snapshot.ReplacedSafeBrowsingSeries, &snapshot.ReplacedParentalSeries} {
			if err := json.Unmarshal(series[index], target); err != nil {
				return nil, fmt.Errorf("decode statistics series: %w", err)
			}
		}
		result = append(result, snapshot)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate statistics snapshots: %w", err)
	}
	return result, nil
}

func (s *Store) LatestStatisticsAttempts(ctx context.Context, clusterID, nodeID string) ([]telemetry.NodeAttempt, error) {
	var nodeFilter any
	if nodeID != "" {
		nodeFilter = nodeID
	}
	rows, err := s.pool.Query(ctx, `WITH latest AS (
		SELECT DISTINCT ON (a.node_id) a.node_id,a.status,a.error_code,a.range_errors,a.started_at,
			a.completed_at,a.collected_ranges
		FROM statistics_poll_attempts a JOIN nodes n ON n.id=a.node_id
		WHERE a.cluster_id=$1 AND ($2::uuid IS NULL OR a.node_id=$2::uuid) AND n.deleted_at IS NULL
		ORDER BY a.node_id,a.completed_at DESC
	) SELECT l.node_id,l.status,l.error_code,l.range_errors,l.started_at,l.completed_at,l.collected_ranges,
		(SELECT max(s.completed_at) FROM statistics_poll_attempts s WHERE s.node_id=l.node_id AND s.status='succeeded'),
		(SELECT count(*) FROM statistics_poll_attempts f WHERE f.node_id=l.node_id AND f.status IN ('failed','partial')
		 AND f.completed_at > COALESCE((SELECT max(s.completed_at) FROM statistics_poll_attempts s
		 WHERE s.node_id=l.node_id AND s.status='succeeded'), '-infinity'::timestamptz))
	FROM latest l ORDER BY l.node_id`, clusterID, nodeFilter)
	if err != nil {
		return nil, fmt.Errorf("query latest statistics attempts: %w", err)
	}
	defer rows.Close()
	result := make([]telemetry.NodeAttempt, 0)
	for rows.Next() {
		var attempt telemetry.NodeAttempt
		var rangeErrors []byte
		if err := rows.Scan(&attempt.NodeID, &attempt.Status, &attempt.ErrorCode, &rangeErrors, &attempt.StartedAt,
			&attempt.CompletedAt, &attempt.CollectedRanges, &attempt.LastSuccessAt, &attempt.ConsecutiveFailures); err != nil {
			return nil, fmt.Errorf("scan statistics attempt: %w", err)
		}
		if err := json.Unmarshal(rangeErrors, &attempt.RangeErrors); err != nil {
			return nil, fmt.Errorf("decode statistics range errors: %w", err)
		}
		result = append(result, attempt)
	}
	return result, rows.Err()
}

func (s *Store) CleanupStatistics(ctx context.Context, now time.Time) error {
	tx, err := s.pool.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return fmt.Errorf("begin statistics cleanup: %w", err)
	}
	defer func() { _ = tx.Rollback(context.Background()) }()
	if _, err := tx.Exec(ctx, `INSERT INTO statistics_buckets
		(cluster_id,node_id,resolution,bucket_start,dns_queries,blocked_filtering,replaced_safebrowsing,replaced_parental,collected_at)
		SELECT cluster_id,node_id,'day',date_trunc('day',bucket_start),sum(dns_queries),sum(blocked_filtering),
			sum(replaced_safebrowsing),sum(replaced_parental),max(collected_at)
		FROM statistics_buckets WHERE resolution='hour' AND bucket_start < date_trunc('day',$1::timestamptz)
		GROUP BY cluster_id,node_id,date_trunc('day',bucket_start)
		HAVING count(*) = 24
		ON CONFLICT (node_id,resolution,bucket_start) DO UPDATE SET
			dns_queries=EXCLUDED.dns_queries,blocked_filtering=EXCLUDED.blocked_filtering,
			replaced_safebrowsing=EXCLUDED.replaced_safebrowsing,replaced_parental=EXCLUDED.replaced_parental,
			collected_at=EXCLUDED.collected_at`, now); err != nil {
		return fmt.Errorf("roll up daily statistics: %w", err)
	}
	for _, statement := range []string{
		`WITH expired AS (SELECT id FROM statistics_snapshots WHERE collected_at < $1::timestamptz - interval '32 days' ORDER BY collected_at,id LIMIT 10000) DELETE FROM statistics_snapshots s USING expired e WHERE s.id=e.id`,
		`WITH expired AS (SELECT id FROM statistics_poll_attempts WHERE completed_at < $1::timestamptz - interval '32 days' ORDER BY completed_at,id LIMIT 10000) DELETE FROM statistics_poll_attempts a USING expired e WHERE a.id=e.id`,
		`WITH expired AS (SELECT node_id,resolution,bucket_start FROM statistics_buckets WHERE resolution='hour' AND bucket_start < $1::timestamptz - interval '32 days' ORDER BY bucket_start,node_id LIMIT 10000) DELETE FROM statistics_buckets b USING expired e WHERE b.node_id=e.node_id AND b.resolution=e.resolution AND b.bucket_start=e.bucket_start`,
		`WITH expired AS (SELECT node_id,resolution,bucket_start FROM statistics_buckets WHERE resolution='day' AND bucket_start < $1::timestamptz - interval '400 days' ORDER BY bucket_start,node_id LIMIT 10000) DELETE FROM statistics_buckets b USING expired e WHERE b.node_id=e.node_id AND b.resolution=e.resolution AND b.bucket_start=e.bucket_start`,
	} {
		if _, err := tx.Exec(ctx, statement, now); err != nil {
			return fmt.Errorf("apply statistics retention: %w", err)
		}
	}
	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit statistics cleanup: %w", err)
	}
	return nil
}
