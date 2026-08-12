package database

import (
	"context"
	"encoding/json"
	"fmt"
)

import "github.com/benchristian88/atlas-dns/internal/domain"

func (s *Store) ListAuditEvents(ctx context.Context, limit, offset int) ([]domain.AuditEvent, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT id, actor_type, actor_user_id, action, resource_type, resource_id,
		       request_id, metadata_json, created_at
		FROM audit_events
		ORDER BY created_at DESC, id DESC
		LIMIT $1 OFFSET $2`, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("list audit events: %w", err)
	}
	defer rows.Close()
	events := make([]domain.AuditEvent, 0)
	for rows.Next() {
		var event domain.AuditEvent
		var metadata []byte
		if err := rows.Scan(
			&event.ID, &event.ActorType, &event.ActorUserID, &event.Action,
			&event.ResourceType, &event.ResourceID, &event.RequestID,
			&metadata, &event.CreatedAt); err != nil {
			return nil, fmt.Errorf("scan audit event: %w", err)
		}
		if err := json.Unmarshal(metadata, &event.Metadata); err != nil {
			return nil, fmt.Errorf("decode audit metadata: %w", err)
		}
		events = append(events, event)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate audit events: %w", err)
	}
	return events, nil
}
