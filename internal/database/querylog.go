package database

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/benchristian88/agh-ha-controller/internal/querylog"
)

func (s *Store) QueryLogCheckpoint(ctx context.Context, nodeID string) (querylog.Checkpoint, bool, error) {
	var checkpoint querylog.Checkpoint
	err := s.pool.QueryRow(ctx, `SELECT cluster_id,node_id,high_watermark_at,source_newest_at,source_oldest_at,
		last_attempt_at,last_success_at,last_status,error_code,gap_detected,gap_reason,logging_enabled,node_version,updated_at,
		(SELECT count(*) FROM query_ingestion_attempts a WHERE a.node_id=query_ingestion_checkpoints.node_id
		 AND a.status='failed' AND a.completed_at > COALESCE(query_ingestion_checkpoints.last_success_at,'-infinity'::timestamptz))
		FROM query_ingestion_checkpoints WHERE node_id=$1`, nodeID).Scan(
		&checkpoint.ClusterID, &checkpoint.NodeID, &checkpoint.HighWatermarkAt, &checkpoint.SourceNewestAt,
		&checkpoint.SourceOldestAt, &checkpoint.LastAttemptAt, &checkpoint.LastSuccessAt, &checkpoint.LastStatus,
		&checkpoint.ErrorCode, &checkpoint.GapDetected, &checkpoint.GapReason, &checkpoint.LoggingEnabled,
		&checkpoint.NodeVersion, &checkpoint.UpdatedAt)
	if err == pgx.ErrNoRows {
		return querylog.Checkpoint{}, false, nil
	}
	if err != nil {
		return querylog.Checkpoint{}, false, fmt.Errorf("query query-log checkpoint: %w", err)
	}
	return checkpoint, true, nil
}

func (s *Store) ListQueryEvents(ctx context.Context, query querylog.EventQuery) ([]querylog.Event, error) {
	arguments := []any{query.ClusterID}
	conditions := []string{"q.cluster_id=$1"}
	add := func(condition string, value any) {
		arguments = append(arguments, value)
		conditions = append(conditions, fmt.Sprintf(condition, len(arguments)))
	}
	if query.NodeID != "" {
		add("q.node_id=$%d", query.NodeID)
	}
	if query.Search != "" {
		arguments = append(arguments, escapeLike(query.Search))
		index := len(arguments)
		conditions = append(conditions, fmt.Sprintf("(lower(q.query_name) LIKE '%%' || lower($%d) || '%%' ESCAPE '\\' OR lower(q.client_identifier) LIKE '%%' || lower($%d) || '%%' ESCAPE '\\' OR lower(q.client_display_name) LIKE '%%' || lower($%d) || '%%' ESCAPE '\\')", index, index, index))
	}
	if query.Status != "" {
		add("q.response_status=$%d", query.Status)
	}
	if query.QueryType != "" {
		add("q.query_type=$%d", query.QueryType)
	}
	if query.Client != "" {
		arguments = append(arguments, query.Client)
		index := len(arguments)
		conditions = append(conditions, fmt.Sprintf("(lower(q.client_identifier)=lower($%d) OR lower(q.client_display_name)=lower($%d))", index, index))
	}
	if query.BeforeAt != nil {
		arguments = append(arguments, *query.BeforeAt, query.BeforeID)
		conditions = append(conditions, fmt.Sprintf("(q.source_timestamp,q.id) < ($%d,$%d::uuid)", len(arguments)-1, len(arguments)))
	}
	arguments = append(arguments, query.Limit)
	statement := `SELECT q.id,q.cluster_id,q.node_id,n.name,q.source_timestamp,q.ingested_at,q.source_fingerprint,
		q.source_occurrence,q.query_name,q.query_type,q.client_identifier,q.client_display_name,q.client_protocol,
		q.response_status,q.response_code,q.elapsed_ms,q.upstream,q.filtering_reason,q.service_name,q.rules,q.answers,
		q.cached,q.answer_dnssec FROM query_events q JOIN nodes n ON n.id=q.node_id
		WHERE ` + strings.Join(conditions, " AND ") + fmt.Sprintf(" ORDER BY q.source_timestamp DESC,q.id DESC LIMIT $%d", len(arguments))
	rows, err := s.pool.Query(ctx, statement, arguments...)
	if err != nil {
		return nil, fmt.Errorf("list query events: %w", err)
	}
	defer rows.Close()
	result := []querylog.Event{}
	for rows.Next() {
		event, scanErr := scanQueryEvent(rows)
		if scanErr != nil {
			return nil, scanErr
		}
		result = append(result, event)
	}
	return result, rows.Err()
}

func escapeLike(value string) string {
	return strings.NewReplacer(`\`, `\\`, `%`, `\%`, `_`, `\_`).Replace(value)
}

func (s *Store) QueryEventByID(ctx context.Context, clusterID, eventID string) (querylog.Event, error) {
	event, err := scanQueryEvent(s.pool.QueryRow(ctx, `SELECT q.id,q.cluster_id,q.node_id,n.name,q.source_timestamp,
		q.ingested_at,q.source_fingerprint,q.source_occurrence,q.query_name,q.query_type,q.client_identifier,
		q.client_display_name,q.client_protocol,q.response_status,q.response_code,q.elapsed_ms,q.upstream,
		q.filtering_reason,q.service_name,q.rules,q.answers,q.cached,q.answer_dnssec
		FROM query_events q JOIN nodes n ON n.id=q.node_id WHERE q.cluster_id=$1 AND q.id=$2`, clusterID, eventID))
	if err != nil {
		return querylog.Event{}, mapDatabaseError(err, "query event")
	}
	return event, nil
}

type queryEventScanner interface{ Scan(...any) error }

func scanQueryEvent(row queryEventScanner) (querylog.Event, error) {
	var event querylog.Event
	var rules, answers []byte
	err := row.Scan(&event.ID, &event.ClusterID, &event.NodeID, &event.NodeName, &event.SourceTimestamp,
		&event.IngestedAt, &event.SourceFingerprint, &event.SourceOccurrence, &event.QueryName, &event.QueryType,
		&event.ClientIdentifier, &event.ClientDisplayName, &event.ClientProtocol, &event.ResponseStatus,
		&event.ResponseCode, &event.ElapsedMS, &event.Upstream, &event.FilteringReason, &event.ServiceName,
		&rules, &answers, &event.Cached, &event.AnswerDNSSEC)
	if err != nil {
		return querylog.Event{}, err
	}
	if json.Unmarshal(rules, &event.Rules) != nil || json.Unmarshal(answers, &event.Answers) != nil {
		return querylog.Event{}, fmt.Errorf("decode query event detail")
	}
	return event, nil
}

func (s *Store) QueryLogCheckpoints(ctx context.Context, clusterID, nodeID string) ([]querylog.Checkpoint, error) {
	var nodeFilter any
	if nodeID != "" {
		nodeFilter = nodeID
	}
	rows, err := s.pool.Query(ctx, `SELECT cluster_id,node_id,high_watermark_at,source_newest_at,source_oldest_at,
		last_attempt_at,last_success_at,last_status,error_code,gap_detected,gap_reason,logging_enabled,node_version,updated_at
		FROM query_ingestion_checkpoints WHERE cluster_id=$1 AND ($2::uuid IS NULL OR node_id=$2::uuid)`, clusterID, nodeFilter)
	if err != nil {
		return nil, fmt.Errorf("list query-log checkpoints: %w", err)
	}
	defer rows.Close()
	result := []querylog.Checkpoint{}
	for rows.Next() {
		var checkpoint querylog.Checkpoint
		if err := rows.Scan(&checkpoint.ClusterID, &checkpoint.NodeID, &checkpoint.HighWatermarkAt, &checkpoint.SourceNewestAt,
			&checkpoint.SourceOldestAt, &checkpoint.LastAttemptAt, &checkpoint.LastSuccessAt, &checkpoint.LastStatus,
			&checkpoint.ErrorCode, &checkpoint.GapDetected, &checkpoint.GapReason, &checkpoint.LoggingEnabled,
			&checkpoint.NodeVersion, &checkpoint.UpdatedAt, &checkpoint.ConsecutiveFailures); err != nil {
			return nil, fmt.Errorf("scan query-log checkpoint: %w", err)
		}
		result = append(result, checkpoint)
	}
	return result, rows.Err()
}

func (s *Store) QueryLogTypes(ctx context.Context, clusterID, nodeID string) ([]string, error) {
	var nodeFilter any
	if nodeID != "" {
		nodeFilter = nodeID
	}
	rows, err := s.pool.Query(ctx, `SELECT DISTINCT query_type FROM query_events
		WHERE cluster_id=$1 AND ($2::uuid IS NULL OR node_id=$2::uuid) ORDER BY query_type LIMIT 100`, clusterID, nodeFilter)
	if err != nil {
		return nil, fmt.Errorf("list query-log types: %w", err)
	}
	defer rows.Close()
	result := []string{}
	for rows.Next() {
		var value string
		if err := rows.Scan(&value); err != nil {
			return nil, err
		}
		result = append(result, value)
	}
	return result, rows.Err()
}

func (s *Store) RecordQueryLogPoll(ctx context.Context, attempt querylog.Attempt, checkpoint querylog.Checkpoint, events []querylog.Event) (int, error) {
	tx, err := s.pool.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return 0, fmt.Errorf("begin query-log poll record: %w", err)
	}
	defer func() { _ = tx.Rollback(context.Background()) }()
	batch := &pgx.Batch{}
	for _, event := range events {
		rules, marshalErr := json.Marshal(event.Rules)
		if marshalErr != nil {
			return 0, fmt.Errorf("encode query-log rules: %w", marshalErr)
		}
		answers, marshalErr := json.Marshal(event.Answers)
		if marshalErr != nil {
			return 0, fmt.Errorf("encode query-log answers: %w", marshalErr)
		}
		batch.Queue(`INSERT INTO query_events
			(id,cluster_id,node_id,source_timestamp,ingested_at,source_fingerprint,source_occurrence,
			query_name,query_type,client_identifier,client_display_name,client_protocol,response_status,
			response_code,elapsed_ms,upstream,filtering_reason,service_name,rules,answers,cached,answer_dnssec)
			VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)
			ON CONFLICT (node_id,source_fingerprint,source_occurrence) DO NOTHING`, event.ID, event.ClusterID,
			event.NodeID, event.SourceTimestamp, event.IngestedAt, event.SourceFingerprint, event.SourceOccurrence,
			event.QueryName, event.QueryType, event.ClientIdentifier, event.ClientDisplayName, event.ClientProtocol,
			event.ResponseStatus, event.ResponseCode, event.ElapsedMS, event.Upstream, event.FilteringReason,
			event.ServiceName, rules, answers, event.Cached, event.AnswerDNSSEC)
	}
	inserted := 0
	results := tx.SendBatch(ctx, batch)
	for range events {
		tag, execErr := results.Exec()
		if execErr != nil {
			_ = results.Close()
			return 0, fmt.Errorf("insert query event: %w", execErr)
		}
		inserted += int(tag.RowsAffected())
	}
	if err := results.Close(); err != nil {
		return 0, fmt.Errorf("finish query event batch: %w", err)
	}
	attempt.InsertedRecords = inserted
	if _, err := tx.Exec(ctx, `INSERT INTO query_ingestion_attempts
		(id,cluster_id,node_id,started_at,completed_at,status,error_code,fetched_records,inserted_records,page_count,gap_detected,gap_reason)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`, attempt.ID, attempt.ClusterID, attempt.NodeID,
		attempt.StartedAt, attempt.CompletedAt, attempt.Status, attempt.ErrorCode, attempt.FetchedRecords,
		attempt.InsertedRecords, attempt.PageCount, attempt.GapDetected, attempt.GapReason); err != nil {
		return 0, fmt.Errorf("insert query-log attempt: %w", err)
	}
	if _, err := tx.Exec(ctx, `INSERT INTO query_ingestion_checkpoints
		(node_id,cluster_id,high_watermark_at,source_newest_at,source_oldest_at,last_attempt_at,last_success_at,
		last_status,error_code,gap_detected,gap_reason,logging_enabled,node_version,updated_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
		ON CONFLICT (node_id) DO UPDATE SET cluster_id=EXCLUDED.cluster_id,
		high_watermark_at=EXCLUDED.high_watermark_at,source_newest_at=EXCLUDED.source_newest_at,
		source_oldest_at=EXCLUDED.source_oldest_at,last_attempt_at=EXCLUDED.last_attempt_at,
		last_success_at=EXCLUDED.last_success_at,last_status=EXCLUDED.last_status,error_code=EXCLUDED.error_code,
		gap_detected=EXCLUDED.gap_detected,gap_reason=EXCLUDED.gap_reason,logging_enabled=EXCLUDED.logging_enabled,
		node_version=EXCLUDED.node_version,updated_at=EXCLUDED.updated_at`, checkpoint.NodeID, checkpoint.ClusterID,
		checkpoint.HighWatermarkAt, checkpoint.SourceNewestAt, checkpoint.SourceOldestAt, checkpoint.LastAttemptAt,
		checkpoint.LastSuccessAt, checkpoint.LastStatus, checkpoint.ErrorCode, checkpoint.GapDetected,
		checkpoint.GapReason, checkpoint.LoggingEnabled, checkpoint.NodeVersion, checkpoint.UpdatedAt); err != nil {
		return 0, fmt.Errorf("upsert query-log checkpoint: %w", err)
	}
	if err := tx.Commit(ctx); err != nil {
		return 0, fmt.Errorf("commit query-log poll record: %w", err)
	}
	return inserted, nil
}

func (s *Store) CleanupQueryLog(ctx context.Context, now time.Time, retention time.Duration, limit int) (int64, error) {
	if retention <= 0 || limit < 1 || limit > 100_000 {
		return 0, fmt.Errorf("invalid query-log cleanup bounds")
	}
	cutoff := now.UTC().Add(-retention)
	tag, err := s.pool.Exec(ctx, `WITH expired AS (
		SELECT id FROM query_events WHERE source_timestamp < $1 ORDER BY source_timestamp,id LIMIT $2
	) DELETE FROM query_events q USING expired e WHERE q.id=e.id`, cutoff, limit)
	if err != nil {
		return 0, fmt.Errorf("delete expired query events: %w", err)
	}
	if _, err := s.pool.Exec(ctx, `WITH expired AS (
		SELECT id FROM query_ingestion_attempts WHERE completed_at < $1 ORDER BY completed_at,id LIMIT $2
	) DELETE FROM query_ingestion_attempts a USING expired e WHERE a.id=e.id`, now.UTC().Add(-32*24*time.Hour), limit); err != nil {
		return tag.RowsAffected(), fmt.Errorf("delete expired query-log attempts: %w", err)
	}
	return tag.RowsAffected(), nil
}
