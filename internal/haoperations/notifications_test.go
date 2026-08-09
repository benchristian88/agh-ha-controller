package haoperations

import (
	"context"
	"io"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/benchristian88/agh-ha-controller/internal/domain"
)

type notificationRepositoryFake struct {
	record   NotificationChannelRecord
	delivery NotificationDelivery
	finished NotificationDelivery
}

func (r *notificationRepositoryFake) ClusterByID(context.Context, string) (domain.Cluster, error) {
	return domain.Cluster{ID: "11111111-1111-4111-8111-111111111111"}, nil
}
func (r *notificationRepositoryFake) ListNotificationChannels(context.Context, string) ([]NotificationChannel, error) {
	return []NotificationChannel{r.record.Channel}, nil
}
func (r *notificationRepositoryFake) NotificationChannelRecord(context.Context, string) (NotificationChannelRecord, error) {
	return r.record, nil
}
func (r *notificationRepositoryFake) SaveNotificationChannel(_ context.Context, value NotificationChannelRecord, _ int, _ domain.AuditEvent) error {
	r.record = value
	return nil
}
func (r *notificationRepositoryFake) DeleteNotificationChannel(context.Context, string, int, domain.AuditEvent) error {
	return nil
}
func (r *notificationRepositoryFake) ClaimNotificationDelivery(context.Context, time.Time) (NotificationDelivery, NotificationChannelRecord, error) {
	return r.delivery, r.record, nil
}
func (r *notificationRepositoryFake) FinishNotificationDelivery(_ context.Context, value NotificationDelivery) error {
	r.finished = value
	return nil
}

type payloadProtectorFake struct{ plaintext []byte }

func (p *payloadProtectorFake) EncryptPayload(_ string, value []byte) (domain.EncryptedPayload, error) {
	p.plaintext = append([]byte(nil), value...)
	return domain.EncryptedPayload{Ciphertext: []byte("ciphertext"), Nonce: []byte("nonce"), KeyVersion: 1, Algorithm: "AES-256-GCM"}, nil
}
func (p *payloadProtectorFake) DecryptPayload(string, domain.EncryptedPayload) ([]byte, error) {
	return append([]byte(nil), p.plaintext...), nil
}

func TestNotificationDestinationIsHTTPSWriteOnly(t *testing.T) {
	repository, protector := &notificationRepositoryFake{}, &payloadProtectorFake{}
	service := NewNotificationService(repository, protector)
	actor := domain.Actor{UserID: "22222222-2222-4222-8222-222222222222", RequestID: "request"}
	if _, err := service.Save(context.Background(), actor, "11111111-1111-4111-8111-111111111111", "", "Unsafe", "http://receiver.test/hook", true, 0); err == nil {
		t.Fatal("plaintext webhook accepted")
	}
	channel, err := service.Save(context.Background(), actor, "11111111-1111-4111-8111-111111111111", "", "Operations", "https://receiver.test/hook", true, 0)
	if err != nil {
		t.Fatal(err)
	}
	if !channel.DestinationSet || strings.Contains(string(repository.record.Destination.Ciphertext), "receiver") {
		t.Fatalf("destination leaked in channel=%#v envelope=%q", channel, repository.record.Destination.Ciphertext)
	}
}

func TestNotificationPayloadExcludesDetailsAndDestination(t *testing.T) {
	repository := &notificationRepositoryFake{delivery: NotificationDelivery{ID: "delivery", AttemptCount: 1, Event: Event{ID: "event", ClusterID: "cluster", EventType: "dns.failed", Severity: "critical", Summary: "DNS failed", Details: map[string]any{"rawError": "secret"}, OccurredAt: time.Now()}}}
	protector := &payloadProtectorFake{plaintext: []byte("https://receiver.test/hook")}
	repository.record = NotificationChannelRecord{Channel: NotificationChannel{ID: "channel", Enabled: true}, Destination: domain.EncryptedPayload{Ciphertext: []byte("ciphertext")}}
	service := NewNotificationService(repository, protector)
	var sent string
	service.client = &http.Client{Transport: roundTripFunc(func(request *http.Request) (*http.Response, error) {
		body, _ := io.ReadAll(request.Body)
		sent = string(body)
		return &http.Response{StatusCode: http.StatusNoContent, Body: io.NopCloser(strings.NewReader("")), Header: http.Header{}}, nil
	})}
	delivered, err := service.DeliverNext(context.Background())
	if err != nil || !delivered || repository.finished.Status != "succeeded" {
		t.Fatalf("delivered=%v finished=%#v err=%v", delivered, repository.finished, err)
	}
	if strings.Contains(sent, "rawError") || strings.Contains(sent, "secret") || strings.Contains(sent, "receiver.test") {
		t.Fatalf("sensitive notification payload: %s", sent)
	}
}
