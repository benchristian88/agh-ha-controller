package haoperations

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/benchristian88/agh-ha-controller/internal/domain"
)

type PayloadProtector interface {
	EncryptPayload(string, []byte) (domain.EncryptedPayload, error)
	DecryptPayload(string, domain.EncryptedPayload) ([]byte, error)
}

type NotificationRepository interface {
	ClusterByID(context.Context, string) (domain.Cluster, error)
	ListNotificationChannels(context.Context, string) ([]NotificationChannel, error)
	NotificationChannelRecord(context.Context, string) (NotificationChannelRecord, error)
	SaveNotificationChannel(context.Context, NotificationChannelRecord, int, domain.AuditEvent) error
	DeleteNotificationChannel(context.Context, string, int, domain.AuditEvent) error
	ClaimNotificationDelivery(context.Context, time.Time) (NotificationDelivery, NotificationChannelRecord, error)
	FinishNotificationDelivery(context.Context, NotificationDelivery) error
}

type NotificationService struct {
	repository NotificationRepository
	protector  PayloadProtector
	client     *http.Client
	now        func() time.Time
}

func NewNotificationService(repository NotificationRepository, protector PayloadProtector) *NotificationService {
	return &NotificationService{repository: repository, protector: protector, client: &http.Client{Timeout: 10 * time.Second}, now: time.Now}
}

func (s *NotificationService) List(ctx context.Context, clusterID string) ([]NotificationChannel, error) {
	if _, err := s.repository.ClusterByID(ctx, clusterID); err != nil {
		return nil, err
	}
	return s.repository.ListNotificationChannels(ctx, clusterID)
}

func (s *NotificationService) Save(ctx context.Context, actor domain.Actor, clusterID, channelID, name, destination string, enabled bool, expectedVersion int) (NotificationChannel, error) {
	if _, err := s.repository.ClusterByID(ctx, clusterID); err != nil {
		return NotificationChannel{}, err
	}
	name = strings.TrimSpace(name)
	if name == "" || len(name) > 120 {
		return NotificationChannel{}, domain.Validation("name", "must contain between 1 and 120 characters")
	}
	parsed, err := url.Parse(strings.TrimSpace(destination))
	if err != nil || parsed.Scheme != "https" || parsed.Host == "" || parsed.User != nil || parsed.Fragment != "" {
		return NotificationChannel{}, domain.Validation("destination", "must be an HTTPS webhook URL without credentials or a fragment")
	}
	if !domain.ValidID(channelID) {
		if expectedVersion != 0 {
			return NotificationChannel{}, domain.Validation("channelId", "must be a valid UUID")
		}
		channelID, err = domain.NewID()
		if err != nil {
			return NotificationChannel{}, err
		}
	}
	envelope, err := s.protector.EncryptPayload("notification:"+channelID, []byte(parsed.String()))
	if err != nil {
		return NotificationChannel{}, err
	}
	now := s.now().UTC()
	channel := NotificationChannel{ID: channelID, ClusterID: clusterID, Name: name, ChannelType: "webhook", Enabled: enabled, DestinationSet: true, RecordVersion: expectedVersion + 1, CreatedAt: now, UpdatedAt: now}
	auditEvent, err := audit(actor, "notification.channel_saved", "notification_channel", channelID, map[string]any{"clusterId": clusterID, "enabled": enabled, "channelType": "webhook"}, now)
	if err != nil {
		return NotificationChannel{}, err
	}
	if err := s.repository.SaveNotificationChannel(ctx, NotificationChannelRecord{Channel: channel, Destination: envelope}, expectedVersion, auditEvent); err != nil {
		return NotificationChannel{}, err
	}
	return channel, nil
}

func (s *NotificationService) Delete(ctx context.Context, actor domain.Actor, channelID string, expectedVersion int) error {
	record, err := s.repository.NotificationChannelRecord(ctx, channelID)
	if err != nil {
		return err
	}
	auditEvent, err := audit(actor, "notification.channel_removed", "notification_channel", channelID, map[string]any{"clusterId": record.Channel.ClusterID}, s.now().UTC())
	if err != nil {
		return err
	}
	return s.repository.DeleteNotificationChannel(ctx, channelID, expectedVersion, auditEvent)
}

func (s *NotificationService) DeliverNext(ctx context.Context) (bool, error) {
	delivery, channel, err := s.repository.ClaimNotificationDelivery(ctx, s.now().UTC())
	if err != nil {
		var de *domain.Error
		if errors.As(err, &de) && de.Kind == domain.ErrorNotFound {
			return false, nil
		}
		return false, err
	}
	destination, err := s.protector.DecryptPayload("notification:"+channel.Channel.ID, channel.Destination)
	if err != nil {
		return true, s.failDelivery(ctx, delivery, "NOTIFICATION_SECRET_UNAVAILABLE")
	}
	payload := map[string]any{"id": delivery.Event.ID, "clusterId": delivery.Event.ClusterID, "nodeId": delivery.Event.NodeID, "type": delivery.Event.EventType, "severity": delivery.Event.Severity, "summary": delivery.Event.Summary, "occurredAt": delivery.Event.OccurredAt}
	body, err := json.Marshal(payload)
	if err != nil {
		return true, s.failDelivery(ctx, delivery, "NOTIFICATION_PAYLOAD_FAILED")
	}
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, string(destination), bytes.NewReader(body))
	if err != nil {
		return true, s.failDelivery(ctx, delivery, "NOTIFICATION_DESTINATION_INVALID")
	}
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("User-Agent", "AGH-HA-Controller")
	response, err := s.client.Do(request)
	if err != nil {
		return true, s.failDelivery(ctx, delivery, "NOTIFICATION_DELIVERY_FAILED")
	}
	defer response.Body.Close()
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return true, s.failDelivery(ctx, delivery, "NOTIFICATION_DELIVERY_REJECTED")
	}
	now := s.now().UTC()
	delivery.Status, delivery.CompletedAt, delivery.ErrorCode, delivery.NextAttemptAt = "succeeded", &now, "", nil
	return true, s.repository.FinishNotificationDelivery(ctx, delivery)
}

func (s *NotificationService) failDelivery(ctx context.Context, delivery NotificationDelivery, code string) error {
	delivery.ErrorCode = code
	if delivery.AttemptCount >= 5 {
		now := s.now().UTC()
		delivery.Status, delivery.CompletedAt, delivery.NextAttemptAt = "failed", &now, nil
	} else {
		next := s.now().UTC().Add(time.Duration(1<<min(delivery.AttemptCount, 5)) * time.Minute)
		delivery.Status, delivery.NextAttemptAt = "failed", &next
	}
	return s.repository.FinishNotificationDelivery(ctx, delivery)
}

func min(left, right int) int {
	if left < right {
		return left
	}
	return right
}
