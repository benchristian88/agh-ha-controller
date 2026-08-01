package controlplane

import (
	"context"
	"testing"
	"time"

	"github.com/benchristian88/agh-ha-controller/internal/configuration"
	"github.com/benchristian88/agh-ha-controller/internal/domain"
	"github.com/benchristian88/agh-ha-controller/internal/inventory"
)

type draftRepositoryFake struct {
	Repository
	draft           inventory.Draft
	nodes           []domain.Node
	snapshots       []inventory.Snapshot
	profiles        []inventory.CapabilityProfile
	saved           *inventory.Draft
	expectedVersion int
}

func (f *draftRepositoryFake) DraftByCluster(context.Context, string) (inventory.Draft, error) {
	return f.draft, nil
}

func (f *draftRepositoryFake) ListNodes(context.Context, string) ([]domain.Node, error) {
	return f.nodes, nil
}

func (f *draftRepositoryFake) LatestSnapshots(context.Context, string) ([]inventory.Snapshot, error) {
	return f.snapshots, nil
}

func (f *draftRepositoryFake) CapabilityProfiles(context.Context, string) ([]inventory.CapabilityProfile, error) {
	return f.profiles, nil
}

func (f *draftRepositoryFake) UpdateConfigurationDraft(_ context.Context, draft inventory.Draft, expectedVersion int, _ domain.AuditEvent) error {
	f.saved = &draft
	f.expectedVersion = expectedVersion
	return nil
}

func TestUpdateDraftAfterMultiNodeImport(t *testing.T) {
	const (
		clusterID = "11111111-1111-4111-8111-111111111111"
		nodeAID   = "22222222-2222-4222-8222-222222222222"
		nodeBID   = "33333333-3333-4333-8333-333333333333"
	)
	listener := configuration.NodeSpecific{BindHosts: []string{"0.0.0.0"}, DNSPort: 53}
	document := configuration.DesiredDocument{
		SchemaVersion: configuration.SchemaVersion,
		Shared: configuration.Shared{
			DNS:       configuration.DNS{UpstreamDNS: []string{"9.9.9.9"}},
			Filtering: configuration.Filtering{UpdateInterval: 24},
		},
		NodeOverrides: map[string]configuration.NodeSpecific{nodeAID: listener, nodeBID: listener},
	}
	repository := &draftRepositoryFake{
		draft: inventory.Draft{ID: "44444444-4444-4444-8444-444444444444", ClusterID: clusterID, Version: 2, Document: document},
		nodes: []domain.Node{{ID: nodeAID, Enabled: true}, {ID: nodeBID, Enabled: true}},
	}
	service := NewService(repository)
	service.now = func() time.Time { return time.Date(2026, time.July, 30, 0, 0, 0, 0, time.UTC) }
	document.Shared.DNS.UpstreamDNS = []string{"1.1.1.1"}
	document.Shared.Services.BlockedServiceIDs = []string{"legacy-service", "youtube"}

	updated, issues, err := service.UpdateDraft(context.Background(), domain.Actor{UserID: "55555555-5555-4555-8555-555555555555", RequestID: "66666666-6666-4666-8666-666666666666"}, clusterID, 2, document)
	if err != nil {
		t.Fatal(err)
	}
	if len(issues) != 0 {
		t.Fatalf("validation issues = %#v", issues)
	}
	if repository.saved == nil || repository.expectedVersion != 2 || updated.Version != 3 {
		t.Fatalf("save state = %#v, expected version = %d, updated version = %d", repository.saved, repository.expectedVersion, updated.Version)
	}
	if got := updated.Document.Shared.DNS.UpstreamDNS; len(got) != 1 || got[0] != "1.1.1.1" {
		t.Fatalf("saved upstreams = %#v", got)
	}
	if got := updated.Document.Shared.Services.BlockedServiceIDs; len(got) != 2 || got[0] != "legacy-service" || got[1] != "youtube" {
		t.Fatalf("legacy blocked-service IDs were not preserved: %#v", got)
	}
}

func TestManagedDifferencesIgnoreObservedCompatibilityMetadata(t *testing.T) {
	desired := configuration.Document{SchemaVersion: configuration.SchemaVersion, Shared: configuration.Shared{DNS: configuration.DNS{UpstreamDNS: []string{"1.1.1.1"}}}, Unsupported: []configuration.Unsupported{{Section: "tls_mutation", Reason: "inventory only"}}}
	observed := desired
	observed.Unsupported = []configuration.Unsupported{{Section: "dhcp", Reason: "unavailable"}}
	observed.ObservedOnly.TLS = configuration.TLSStatus{Enabled: true, ServerName: "dns.example"}
	if differences := managedDifferences(desired, observed); len(differences) != 0 {
		t.Fatalf("unmanaged metadata caused drift: %#v", differences)
	}
}

type blockedServiceValidatorFake struct {
	issues []configuration.ValidationIssue
	ids    []string
}

func (f *blockedServiceValidatorFake) ValidateBlockedServiceIDs(_ context.Context, _ string, ids []string) ([]configuration.ValidationIssue, error) {
	f.ids = append([]string(nil), ids...)
	return f.issues, nil
}

func TestPublicationPreflightIncludesNodeAttributedBlockedServiceCompatibility(t *testing.T) {
	const (
		clusterID = "11111111-1111-4111-8111-111111111111"
		nodeID    = "22222222-2222-4222-8222-222222222222"
	)
	document := configuration.DesiredDocument{
		SchemaVersion: configuration.SchemaVersion,
		Shared: configuration.Shared{
			DNS: configuration.DNS{UpstreamDNS: []string{"1.1.1.1"}}, Filtering: configuration.Filtering{UpdateInterval: 24},
			Services: configuration.Services{BlockedServiceIDs: []string{"chatgpt"}},
		},
		NodeOverrides: map[string]configuration.NodeSpecific{nodeID: {BindHosts: []string{"0.0.0.0"}, DNSPort: 53}},
	}
	effective, err := configuration.Effective(document, nodeID)
	if err != nil {
		t.Fatal(err)
	}
	repository := &draftRepositoryFake{
		draft:     inventory.Draft{ClusterID: clusterID, SchemaVersion: configuration.SchemaVersion, Document: document, Version: 1},
		nodes:     []domain.Node{{ID: nodeID, Enabled: true}},
		snapshots: []inventory.Snapshot{{NodeID: nodeID, Document: &effective, CollectionStatus: "succeeded"}},
		profiles: []inventory.CapabilityProfile{{NodeID: nodeID, Compatibility: string(domain.CompatibilitySupported), Features: map[string]bool{
			"dns": true, "filtering": true, "clients": true, "rewrites": true, "blocked_services": true, "safety": true, "query_log": true, "statistics": true, "tls": true,
		}}},
	}
	validator := &blockedServiceValidatorFake{issues: []configuration.ValidationIssue{{Field: "nodes." + nodeID + ".blockedServices", Message: "Blocked service chatgpt is unsupported."}}}
	preview, err := NewService(repository, validator).ValidateDraft(context.Background(), clusterID)
	if err != nil {
		t.Fatal(err)
	}
	if preview.Valid || len(validator.ids) != 1 || validator.ids[0] != "chatgpt" {
		t.Fatalf("compatibility validation was not applied: preview=%#v ids=%#v", preview, validator.ids)
	}
	found := false
	for _, issue := range preview.Issues {
		found = found || issue.Field == "nodes."+nodeID+".blockedServices"
	}
	if !found {
		t.Fatalf("node-attributed issue missing: %#v", preview.Issues)
	}
}
