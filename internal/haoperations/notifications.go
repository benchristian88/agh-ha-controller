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
	RecordAuditEvent(context.Context, domain.AuditEvent) error
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
	return &NotificationService{repository: repository, protector: protector, client: &http.Client{
		Timeout: 10 * time.Second,
		CheckRedirect: func(*http.Request, []*http.Request) error {
			return http.ErrUseLastResponse
		},
	}, now: time.Now}
}

func (s *NotificationService) List(ctx context.Context, clusterID string) ([]NotificationChannel, error) {
	if _, err := s.repository.ClusterByID(ctx, clusterID); err != nil {
		return nil, err
	}
	channels, err := s.repository.ListNotificationChannels(ctx, clusterID)
	if err != nil {
		return nil, err
	}
	for index := range channels {
		channels[index].SubscribedEvents = []string{"all_ha_transitions"}
		if channels[index].DestinationSummary == "" {
			record, recordErr := s.repository.NotificationChannelRecord(ctx, channels[index].ID)
			if recordErr != nil {
				continue
			}
			plaintext, decryptErr := s.protector.DecryptPayload("notification:"+channels[index].ID, record.Destination)
			if decryptErr != nil {
				continue
			}
			parsed, validationErr := validateDestination(string(plaintext))
			if validationErr == nil {
				channels[index].DestinationSummary = destinationSummary(parsed)
			}
		}
	}
	return channels, nil
}

func (s *NotificationService) Create(ctx context.Context, actor domain.Actor, clusterID, name, destination string, enabled bool) (NotificationChannel, error) {
	if _, err := s.repository.ClusterByID(ctx, clusterID); err != nil {
		return NotificationChannel{}, err
	}
	name, err := validateChannelName(name)
	if err != nil {
		return NotificationChannel{}, err
	}
	parsed, err := validateDestination(destination)
	if err != nil {
		return NotificationChannel{}, err
	}
	channelID, err := domain.NewID()
	if err != nil {
		return NotificationChannel{}, err
	}
	envelope, err := s.protector.EncryptPayload("notification:"+channelID, []byte(parsed.String()))
	if err != nil {
		return NotificationChannel{}, err
	}
	now := s.now().UTC()
	channel := NotificationChannel{ID: channelID, ClusterID: clusterID, Name: name, ChannelType: "webhook", Enabled: enabled, DestinationSet: true, DestinationSummary: destinationSummary(parsed), SubscribedEvents: []string{"all_ha_transitions"}, RecordVersion: 1, CreatedAt: now, UpdatedAt: now}
	auditEvent, err := audit(actor, "notification.channel_created", "notification_channel", channelID, map[string]any{"clusterId": clusterID, "enabled": enabled, "channelType": "webhook", "destinationSummary": channel.DestinationSummary}, now)
	if err != nil {
		return NotificationChannel{}, err
	}
	if err := s.repository.SaveNotificationChannel(ctx, NotificationChannelRecord{Channel: channel, Destination: envelope}, 0, auditEvent); err != nil {
		return NotificationChannel{}, err
	}
	return channel, nil
}

func (s *NotificationService) Update(ctx context.Context, actor domain.Actor, channelID, name string, destination *string, enabled bool, expectedVersion int) (NotificationChannel, error) {
	if !domain.ValidID(channelID) {
		return NotificationChannel{}, domain.Validation("channelId", "must be a valid UUID")
	}
	record, err := s.repository.NotificationChannelRecord(ctx, channelID)
	if err != nil {
		return NotificationChannel{}, err
	}
	if expectedVersion != record.Channel.RecordVersion {
		return NotificationChannel{}, domain.NewError(domain.ErrorConflict, "notification channel was changed by another request")
	}
	name, err = validateChannelName(name)
	if err != nil {
		return NotificationChannel{}, err
	}
	replaced := destination != nil
	if destination != nil {
		parsed, validationErr := validateDestination(*destination)
		if validationErr != nil {
			return NotificationChannel{}, validationErr
		}
		record.Destination, err = s.protector.EncryptPayload("notification:"+channelID, []byte(parsed.String()))
		if err != nil {
			return NotificationChannel{}, err
		}
		record.Channel.DestinationSummary = destinationSummary(parsed)
	}
	previousName, previousEnabled := record.Channel.Name, record.Channel.Enabled
	now := s.now().UTC()
	record.Channel.Name = name
	record.Channel.Enabled = enabled
	record.Channel.DestinationSet = true
	record.Channel.SubscribedEvents = []string{"all_ha_transitions"}
	record.Channel.RecordVersion = expectedVersion + 1
	record.Channel.UpdatedAt = now
	action := "notification.channel_updated"
	if name == previousName && !replaced && enabled != previousEnabled {
		if enabled {
			action = "notification.channel_enabled"
		} else {
			action = "notification.channel_disabled"
		}
	}
	auditEvent, err := audit(actor, action, "notification_channel", channelID, map[string]any{"clusterId": record.Channel.ClusterID, "enabled": enabled, "destinationReplaced": replaced}, now)
	if err != nil {
		return NotificationChannel{}, err
	}
	if err := s.repository.SaveNotificationChannel(ctx, record, expectedVersion, auditEvent); err != nil {
		return NotificationChannel{}, err
	}
	return record.Channel, nil
}

func (s *NotificationService) Delete(ctx context.Context, actor domain.Actor, channelID, confirmation string, expectedVersion int) error {
	if !domain.ValidID(channelID) {
		return domain.Validation("channelId", "must be a valid UUID")
	}
	record, err := s.repository.NotificationChannelRecord(ctx, channelID)
	if err != nil {
		return err
	}
	if confirmation != record.Channel.Name {
		return domain.Validation("confirmation", "must exactly match the channel name")
	}
	auditEvent, err := audit(actor, "notification.channel_removed", "notification_channel", channelID, map[string]any{"clusterId": record.Channel.ClusterID}, s.now().UTC())
	if err != nil {
		return err
	}
	return s.repository.DeleteNotificationChannel(ctx, channelID, expectedVersion, auditEvent)
}

func (s *NotificationService) Test(ctx context.Context, actor domain.Actor, channelID string) (NotificationTestResult, error) {
	if !domain.ValidID(channelID) {
		return NotificationTestResult{}, domain.Validation("channelId", "must be a valid UUID")
	}
	record, err := s.repository.NotificationChannelRecord(ctx, channelID)
	if err != nil {
		return NotificationTestResult{}, err
	}
	now := s.now().UTC()
	requested, err := audit(actor, "notification.channel_test_requested", "notification_channel", channelID, map[string]any{"clusterId": record.Channel.ClusterID}, now)
	if err != nil {
		return NotificationTestResult{}, err
	}
	if err := s.repository.RecordAuditEvent(ctx, requested); err != nil {
		return NotificationTestResult{}, err
	}
	result := NotificationTestResult{ChannelID: channelID, TestedAt: now}
	destination, err := s.protector.DecryptPayload("notification:"+channelID, record.Destination)
	if err != nil {
		result.ErrorCode = "NOTIFICATION_SECRET_UNAVAILABLE"
	} else {
		body, marshalErr := json.Marshal(map[string]any{"type": "notification.test", "summary": "AGH HA Controller webhook test", "occurredAt": now})
		if marshalErr != nil {
			return NotificationTestResult{}, marshalErr
		}
		testContext, cancel := context.WithTimeout(ctx, 10*time.Second)
		defer cancel()
		request, requestErr := http.NewRequestWithContext(testContext, http.MethodPost, string(destination), bytes.NewReader(body))
		if requestErr != nil {
			result.ErrorCode = "NOTIFICATION_DESTINATION_INVALID"
		} else {
			request.Header.Set("Content-Type", "application/json")
			request.Header.Set("User-Agent", "AGH-HA-Controller")
			client := &http.Client{Transport: s.client.Transport, Timeout: 10 * time.Second, CheckRedirect: func(*http.Request, []*http.Request) error {
				return http.ErrUseLastResponse
			}}
			response, requestErr := client.Do(request)
			if requestErr != nil {
				result.ErrorCode = "NOTIFICATION_TEST_FAILED"
			} else {
				_ = response.Body.Close()
				if response.StatusCode >= 200 && response.StatusCode < 300 {
					result.Success = true
				} else {
					result.ErrorCode = "NOTIFICATION_TEST_REJECTED"
				}
			}
		}
	}
	completed, err := audit(actor, "notification.channel_test_completed", "notification_channel", channelID, map[string]any{"clusterId": record.Channel.ClusterID, "success": result.Success, "errorCode": result.ErrorCode}, s.now().UTC())
	if err != nil {
		return NotificationTestResult{}, err
	}
	if err := s.repository.RecordAuditEvent(ctx, completed); err != nil {
		return NotificationTestResult{}, err
	}
	return result, nil
}

func validateChannelName(value string) (string, error) {
	value = strings.TrimSpace(value)
	if value == "" || len(value) > 120 {
		return "", domain.Validation("name", "must contain between 1 and 120 characters")
	}
	return value, nil
}

func validateDestination(value string) (*url.URL, error) {
	parsed, err := url.Parse(strings.TrimSpace(value))
	if err != nil || parsed.Scheme != "https" || parsed.Host == "" || parsed.User != nil || parsed.Fragment != "" {
		return nil, domain.Validation("destination", "must be an HTTPS webhook URL without credentials or a fragment")
	}
	return parsed, nil
}

func destinationSummary(value *url.URL) string {
	return value.Scheme + "://" + value.Host
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
