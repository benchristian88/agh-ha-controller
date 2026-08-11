package systemsettings

import (
	"context"
	"fmt"
	"time"

	"github.com/benchristian88/agh-ha-controller/internal/domain"
)

type Settings struct {
	UpdateChecksEnabled bool   `json:"updateChecksEnabled"`
	RecordVersion       int    `json:"recordVersion"`
	QueryLogRetention   string `json:"queryLogRetention"`
	StatisticsRetention string `json:"statisticsRetention"`
	InstallationType    string `json:"installationType"`
}

type Repository interface {
	SystemSettings(context.Context) (bool, int, error)
	UpdateSystemSettings(context.Context, bool, int, time.Time, domain.AuditEvent) (bool, int, error)
}

type Service struct {
	repository        Repository
	queryLogRetention string
	installationType  string
	now               func() time.Time
}

func NewService(repository Repository, queryLogRetention, installationType string) *Service {
	return &Service{repository: repository, queryLogRetention: queryLogRetention, installationType: installationType, now: time.Now}
}

func (s *Service) Get(ctx context.Context) (Settings, error) {
	enabled, recordVersion, err := s.repository.SystemSettings(ctx)
	if err != nil {
		return Settings{}, err
	}
	return Settings{UpdateChecksEnabled: enabled, RecordVersion: recordVersion, QueryLogRetention: s.queryLogRetention, StatisticsRetention: "32 days detailed; 400 days daily", InstallationType: s.installationType}, nil
}

func (s *Service) Update(ctx context.Context, actor domain.Actor, enabled bool, expectedVersion int) (Settings, error) {
	now := s.now().UTC()
	id, err := domain.NewID()
	if err != nil {
		return Settings{}, err
	}
	actorID := actor.UserID
	event := domain.AuditEvent{ID: id, ActorType: "user", ActorUserID: &actorID, Action: "system_settings.updated", ResourceType: "system_settings", RequestID: actor.RequestID, Metadata: map[string]any{"updateChecksEnabled": enabled}, CreatedAt: now}
	value, recordVersion, err := s.repository.UpdateSystemSettings(ctx, enabled, expectedVersion, now, event)
	if err != nil {
		return Settings{}, fmt.Errorf("update system settings: %w", err)
	}
	return Settings{UpdateChecksEnabled: value, RecordVersion: recordVersion, QueryLogRetention: s.queryLogRetention, StatisticsRetention: "32 days detailed; 400 days daily", InstallationType: s.installationType}, nil
}
