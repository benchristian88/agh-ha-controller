package systemsettings

import (
	"context"
	"testing"
	"time"

	"github.com/benchristian88/atlas-dns/internal/domain"
)

type repositoryStub struct {
	enabled bool
	version int
	event   domain.AuditEvent
}

func (r *repositoryStub) SystemSettings(context.Context) (bool, int, error) {
	return r.enabled, r.version, nil
}
func (r *repositoryStub) UpdateSystemSettings(_ context.Context, enabled bool, expectedVersion int, _ time.Time, event domain.AuditEvent) (bool, int, error) {
	r.enabled = enabled
	r.version = expectedVersion + 1
	r.event = event
	return r.enabled, r.version, nil
}

func TestGetReturnsPersistedSettingAndReadOnlyRuntimeFacts(t *testing.T) {
	repository := &repositoryStub{enabled: true, version: 3}
	service := NewService(repository, "168h0m0s", "docker")
	settings, err := service.Get(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if !settings.UpdateChecksEnabled || settings.RecordVersion != 3 || settings.QueryLogRetention != "168h0m0s" || settings.InstallationType != "docker" {
		t.Fatalf("unexpected settings: %#v", settings)
	}
}

func TestUpdateUsesExpectedVersionAndAuditsSafeState(t *testing.T) {
	repository := &repositoryStub{enabled: true, version: 3}
	service := NewService(repository, "168h0m0s", "native_systemd")
	service.now = func() time.Time { return time.Unix(1, 0).UTC() }
	settings, err := service.Update(context.Background(), domain.Actor{UserID: "11111111-1111-4111-8111-111111111111", RequestID: "request"}, false, 3)
	if err != nil {
		t.Fatal(err)
	}
	if settings.UpdateChecksEnabled || settings.RecordVersion != 4 || repository.event.Action != "system_settings.updated" || repository.event.Metadata["updateChecksEnabled"] != false {
		t.Fatalf("unexpected update/audit: settings=%#v event=%#v", settings, repository.event)
	}
}
