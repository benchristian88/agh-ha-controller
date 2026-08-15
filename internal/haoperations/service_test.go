package haoperations

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/benchristian88/atlas-dns/internal/configuration"
	"github.com/benchristian88/atlas-dns/internal/domain"
	"github.com/benchristian88/atlas-dns/internal/inventory"
)

const (
	serviceClusterID = "11111111-1111-4111-8111-111111111111"
	serviceNodeA     = "22222222-2222-4222-8222-222222222222"
	serviceNodeB     = "33333333-3333-4333-8333-333333333333"
	serviceNodeC     = "44444444-4444-4444-8444-444444444444"
)

type serviceRepositoryFake struct {
	Repository
	nodes            []domain.Node
	probes           []DNSProbeResult
	snapshots        []inventory.Snapshot
	activeDeployment bool
	openDrift        bool
	settings         map[string]NodeSettings
	release          ReleaseCache
	cluster          domain.Cluster
	events           []Event
	audits           []domain.AuditEvent
	collectorChecks  []Check
}

func (r *serviceRepositoryFake) ListNodes(context.Context, string) ([]domain.Node, error) {
	return r.nodes, nil
}
func (r *serviceRepositoryFake) NodeByID(_ context.Context, id string) (domain.Node, error) {
	for _, node := range r.nodes {
		if node.ID == id {
			return node, nil
		}
	}
	return domain.Node{}, domain.NewError(domain.ErrorNotFound, "node was not found")
}
func (r *serviceRepositoryFake) NodeRecordByID(ctx context.Context, id string) (domain.NodeRecord, error) {
	node, err := r.NodeByID(ctx, id)
	return domain.NodeRecord{Node: node}, err
}
func (r *serviceRepositoryFake) ClusterByID(context.Context, string) (domain.Cluster, error) {
	if r.cluster.ID == "" {
		return domain.Cluster{ID: serviceClusterID}, nil
	}
	return r.cluster, nil
}
func (r *serviceRepositoryFake) LatestDNSProbes(context.Context, string) ([]DNSProbeResult, error) {
	return r.probes, nil
}
func (r *serviceRepositoryFake) LatestDNSProbe(_ context.Context, nodeID string) (DNSProbeResult, error) {
	for _, probe := range r.probes {
		if probe.NodeID == nodeID {
			return probe, nil
		}
	}
	return DNSProbeResult{}, domain.NewError(domain.ErrorNotFound, "probe was not found")
}
func (r *serviceRepositoryFake) LatestSuccessfulSnapshots(context.Context, string) ([]inventory.Snapshot, error) {
	return r.snapshots, nil
}
func (r *serviceRepositoryFake) ActiveDeploymentExists(context.Context, string) (bool, error) {
	return r.activeDeployment, nil
}
func (r *serviceRepositoryFake) OpenDriftExists(context.Context, string) (bool, error) {
	return r.openDrift, nil
}
func (r *serviceRepositoryFake) NodeLifecycleSettings(_ context.Context, nodeID string) (NodeSettings, error) {
	if value, ok := r.settings[nodeID]; ok {
		return value, nil
	}
	return NodeSettings{}, domain.NewError(domain.ErrorNotFound, "settings were not found")
}
func (r *serviceRepositoryFake) ReleaseCache(context.Context) (ReleaseCache, error) {
	if r.release.Version == "" {
		return ReleaseCache{}, errors.New("release cache unavailable")
	}
	return r.release, nil
}
func (r *serviceRepositoryFake) SaveDNSProbe(_ context.Context, value DNSProbeResult, event *Event) error {
	r.probes = append(r.probes, value)
	if event != nil {
		r.events = append(r.events, *event)
	}
	return nil
}
func (r *serviceRepositoryFake) RecordHAEvent(_ context.Context, event Event) error {
	r.events = append(r.events, event)
	return nil
}
func (r *serviceRepositoryFake) RecordHAEventAndAudit(_ context.Context, event Event, audit domain.AuditEvent) error {
	r.events = append(r.events, event)
	r.audits = append(r.audits, audit)
	return nil
}
func (r *serviceRepositoryFake) CollectorChecks(context.Context, string) ([]Check, error) {
	return r.collectorChecks, nil
}

type serviceMaintenanceFake struct {
	repository *serviceRepositoryFake
	calls      []bool
}

func (m *serviceMaintenanceFake) SetNodeMaintenance(_ context.Context, _ domain.Actor, nodeID string, enabled bool, expectedVersion int) (domain.Node, error) {
	for index := range m.repository.nodes {
		node := &m.repository.nodes[index]
		if node.ID != nodeID {
			continue
		}
		if node.RecordVersion != expectedVersion {
			return domain.Node{}, domain.NewError(domain.ErrorConflict, "node was changed by another request")
		}
		m.calls = append(m.calls, enabled)
		node.MaintenanceMode = enabled
		node.RecordVersion++
		if enabled {
			node.ConvergenceStatus = "maintenance"
		} else {
			node.ConvergenceStatus = "pending"
		}
		return *node, nil
	}
	return domain.Node{}, domain.NewError(domain.ErrorNotFound, "node was not found")
}

type serviceObserverFake struct {
	snapshot inventory.Snapshot
	err      error
}

func (f serviceObserverFake) Observe(context.Context, string) (inventory.Snapshot, error) {
	return f.snapshot, f.err
}

type serviceStatusProbeFake struct{ err error }

func (f serviceStatusProbeFake) Status(context.Context, domain.NodeProbeRequest) (domain.NodeProbeResult, error) {
	return domain.NodeProbeResult{}, f.err
}

type serviceCredentialFake struct{ err error }

func (f serviceCredentialFake) Decrypt(string, domain.EncryptedCredentials) (domain.NodeCredentials, error) {
	return domain.NodeCredentials{Username: "admin", Password: "secret"}, f.err
}

type serviceDNSProbeFake struct{ err error }

func (f serviceDNSProbeFake) Probe(context.Context, DNSProbeRequest) (DNSProbeResult, error) {
	return DNSProbeResult{Status: "healthy", UDPStatus: "healthy", TCPStatus: "healthy", ProbedAt: time.Date(2026, 8, 16, 0, 0, 0, 0, time.UTC)}, f.err
}

func healthyNode(id string) domain.Node {
	return domain.Node{ID: id, ClusterID: serviceClusterID, Name: id, Enabled: true, HealthStatus: domain.NodeHealthy, CompatibilityStatus: domain.CompatibilitySupported, ConvergenceStatus: "converged", Version: "v0.107.78"}
}

func TestSummarySeparatesNNodeDNSAPIAndMaintenance(t *testing.T) {
	now := time.Date(2026, 8, 9, 0, 0, 0, 0, time.UTC)
	nodeA, nodeB, nodeC := healthyNode(serviceNodeA), healthyNode(serviceNodeB), healthyNode(serviceNodeC)
	nodeB.HealthStatus = domain.NodeUnreachable
	nodeC.MaintenanceMode = true
	repository := &serviceRepositoryFake{
		nodes: []domain.Node{nodeA, nodeB, nodeC},
		probes: []DNSProbeResult{
			{NodeID: serviceNodeA, Status: "healthy", UDPStatus: "healthy", TCPStatus: "healthy", ProbedAt: now},
			{NodeID: serviceNodeB, Status: "healthy", UDPStatus: "healthy", TCPStatus: "healthy", ProbedAt: now},
			{NodeID: serviceNodeC, Status: "failed", UDPStatus: "failed", TCPStatus: "failed", ProbedAt: now},
		},
		settings: map[string]NodeSettings{
			serviceNodeA: {NodeID: serviceNodeA, InstallationType: InstallationDocker},
			serviceNodeB: {NodeID: serviceNodeB, InstallationType: InstallationDocker},
			serviceNodeC: {NodeID: serviceNodeC, InstallationType: InstallationDocker},
		},
	}
	service := NewService(repository, nil, nil, nil, nil, nil)
	service.now = func() time.Time { return now }
	summary, err := service.Summary(context.Background(), serviceClusterID)
	if err != nil {
		t.Fatal(err)
	}
	if summary.State != "degraded" || summary.ServingDNSNodes != 2 || summary.APIReachableNodes != 2 || summary.MaintenanceNodes != 1 || len(summary.Nodes) != 3 {
		t.Fatalf("summary=%#v", summary)
	}
	if summary.Nodes[2].DNSStatus != "maintenance" {
		t.Fatalf("maintenance DNS dimension=%#v", summary.Nodes[2])
	}
}

func TestSummaryReportsAllDNSFailedAtRisk(t *testing.T) {
	now := time.Date(2026, 8, 9, 0, 0, 0, 0, time.UTC)
	repository := &serviceRepositoryFake{nodes: []domain.Node{healthyNode(serviceNodeA), healthyNode(serviceNodeB)}, probes: []DNSProbeResult{{NodeID: serviceNodeA, Status: "failed", ProbedAt: now}, {NodeID: serviceNodeB, Status: "failed", ProbedAt: now}}, settings: map[string]NodeSettings{}}
	service := NewService(repository, nil, nil, nil, nil, nil)
	service.now = func() time.Time { return now }
	summary, err := service.Summary(context.Background(), serviceClusterID)
	if err != nil || summary.State != "at_risk" || summary.ServingDNSNodes != 0 {
		t.Fatalf("summary=%#v err=%v", summary, err)
	}
}

func TestSummaryReturnsEmptyNodeCollectionForNewCluster(t *testing.T) {
	repository := &serviceRepositoryFake{settings: map[string]NodeSettings{}}
	service := NewService(repository, nil, nil, nil, nil, nil)
	summary, err := service.Summary(context.Background(), serviceClusterID)
	if err != nil {
		t.Fatal(err)
	}
	if summary.Nodes == nil || len(summary.Nodes) != 0 {
		t.Fatalf("nodes=%#v, want a non-nil empty collection", summary.Nodes)
	}
	if summary.TotalNodes != 0 || summary.State != "at_risk" {
		t.Fatalf("summary=%#v", summary)
	}
}

func TestMaintenancePreflightBlocksDeploymentAndActiveDHCP(t *testing.T) {
	now := time.Date(2026, 8, 9, 0, 0, 0, 0, time.UTC)
	document := configuration.Document{NodeSpecific: configuration.NodeSpecific{DHCP: &configuration.DHCPConfig{Enabled: true}}}
	repository := &serviceRepositoryFake{
		nodes:            []domain.Node{healthyNode(serviceNodeA), healthyNode(serviceNodeB)},
		probes:           []DNSProbeResult{{NodeID: serviceNodeA, Status: "healthy", ProbedAt: now}, {NodeID: serviceNodeB, Status: "healthy", ProbedAt: now}},
		snapshots:        []inventory.Snapshot{{NodeID: serviceNodeA, Document: &document}},
		activeDeployment: true,
		openDrift:        true,
		settings:         map[string]NodeSettings{},
	}
	service := NewService(repository, nil, nil, nil, nil, nil)
	service.now = func() time.Time { return now }
	preflight, err := service.MaintenancePreflight(context.Background(), serviceNodeA)
	if err != nil {
		t.Fatal(err)
	}
	if preflight.Allowed || !preflight.ActiveDHCP || !preflight.ActiveDeployment || !preflight.OpenDrift || preflight.HealthyDNSNodesRemaining != 1 {
		t.Fatalf("preflight=%#v", preflight)
	}
}

func TestMaintenanceLifecycleEntersReturnsAndHandlesDuplicates(t *testing.T) {
	now := time.Date(2026, 8, 16, 0, 0, 0, 0, time.UTC)
	node := healthyNode(serviceNodeA)
	node.RecordVersion = 4
	repository := &serviceRepositoryFake{
		nodes:     []domain.Node{node, healthyNode(serviceNodeB)},
		probes:    []DNSProbeResult{{NodeID: serviceNodeA, Status: "healthy", ProbedAt: now}, {NodeID: serviceNodeB, Status: "healthy", ProbedAt: now}},
		snapshots: []inventory.Snapshot{{NodeID: serviceNodeA, ObservedAt: now, Document: &configuration.Document{}}},
		settings: map[string]NodeSettings{
			serviceNodeA: {NodeID: serviceNodeA, DNSProbeHost: "192.0.2.10", DNSProbePort: 53, DNSProbeName: ".", DNSProbeType: "NS", ProbeUDP: true, ProbeTCP: true},
		},
	}
	maintenance := &serviceMaintenanceFake{repository: repository}
	service := NewService(repository, maintenance, serviceObserverFake{snapshot: inventory.Snapshot{NodeID: serviceNodeA, CollectionStatus: "succeeded"}}, serviceStatusProbeFake{}, serviceCredentialFake{}, serviceDNSProbeFake{})
	service.now = func() time.Time { return now }

	entered, err := service.EnterMaintenance(context.Background(), domain.Actor{UserID: serviceNodeB, RequestID: "request-enter"}, serviceNodeA, 4, false, "")
	if err != nil || !entered.MaintenanceMode || len(maintenance.calls) != 1 || !maintenance.calls[0] {
		t.Fatalf("enter node=%#v calls=%v err=%v", entered, maintenance.calls, err)
	}
	if len(repository.events) != 1 || repository.events[0].EventType != "maintenance.started" {
		t.Fatalf("enter events=%#v", repository.events)
	}
	if _, err := service.EnterMaintenance(context.Background(), domain.Actor{}, serviceNodeA, 4, false, ""); err != nil || len(maintenance.calls) != 1 || len(repository.events) != 1 {
		t.Fatalf("duplicate enter calls=%v events=%#v err=%v", maintenance.calls, repository.events, err)
	}

	validation, err := service.ReturnToService(context.Background(), domain.Actor{UserID: serviceNodeB, RequestID: "request-return"}, serviceNodeA, 5)
	if err != nil || !validation.Succeeded || len(maintenance.calls) != 2 || maintenance.calls[1] {
		t.Fatalf("return validation=%#v calls=%v err=%v", validation, maintenance.calls, err)
	}
	if repository.nodes[0].MaintenanceMode || repository.nodes[0].RecordVersion != 6 {
		t.Fatalf("persisted node=%#v", repository.nodes[0])
	}
	if repository.events[len(repository.events)-1].EventType != "maintenance.ended" {
		t.Fatalf("return events=%#v", repository.events)
	}
	summary, summaryErr := service.Summary(context.Background(), serviceClusterID)
	if summaryErr != nil || summary.MaintenanceNodes != 0 || summary.Nodes[0].DNSStatus != "healthy" {
		t.Fatalf("post-return summary=%#v err=%v", summary, summaryErr)
	}
	if duplicate, duplicateErr := service.ReturnToService(context.Background(), domain.Actor{}, serviceNodeA, 5); duplicateErr != nil || !duplicate.Succeeded || len(maintenance.calls) != 2 {
		t.Fatalf("duplicate return=%#v calls=%v err=%v", duplicate, maintenance.calls, duplicateErr)
	}
}

func TestReturnToServiceFailureLeavesMaintenanceAndAuditsFailure(t *testing.T) {
	now := time.Date(2026, 8, 16, 0, 0, 0, 0, time.UTC)
	node := healthyNode(serviceNodeA)
	node.MaintenanceMode, node.RecordVersion, node.ConvergenceStatus = true, 2, "maintenance"
	repository := &serviceRepositoryFake{
		nodes:     []domain.Node{node},
		snapshots: []inventory.Snapshot{{NodeID: serviceNodeA, ObservedAt: now, Document: &configuration.Document{}}},
		settings: map[string]NodeSettings{
			serviceNodeA: {NodeID: serviceNodeA, DNSProbeHost: "192.0.2.10", DNSProbePort: 53, DNSProbeName: ".", DNSProbeType: "NS", ProbeUDP: true, ProbeTCP: true},
		},
	}
	maintenance := &serviceMaintenanceFake{repository: repository}
	service := NewService(repository, maintenance, serviceObserverFake{snapshot: inventory.Snapshot{NodeID: serviceNodeA, CollectionStatus: "succeeded"}}, serviceStatusProbeFake{err: errors.New("API unavailable")}, serviceCredentialFake{}, serviceDNSProbeFake{})
	service.now = func() time.Time { return now }

	validation, err := service.ReturnToService(context.Background(), domain.Actor{UserID: serviceNodeB, RequestID: "request-failed"}, serviceNodeA, 2)
	if err == nil || validation.Succeeded || !repository.nodes[0].MaintenanceMode || len(maintenance.calls) != 0 {
		t.Fatalf("validation=%#v node=%#v calls=%v err=%v", validation, repository.nodes[0], maintenance.calls, err)
	}
	if len(repository.events) != 2 || repository.events[1].EventType != "maintenance.return_validation_failed" {
		t.Fatalf("events=%#v", repository.events)
	}
	if len(repository.audits) != 1 || repository.audits[0].Action != "node.maintenance_return_failed" {
		t.Fatalf("audits=%#v", repository.audits)
	}
}

func TestCertificateThresholdsUseRedactedObservation(t *testing.T) {
	now := time.Date(2026, 8, 9, 0, 0, 0, 0, time.UTC)
	document := configuration.Document{ObservedOnly: configuration.ObservedOnly{TLS: configuration.TLSStatus{Enabled: true, Subject: "DNS certificate", Issuer: "Homelab CA", NotAfter: now.Add(6 * 24 * time.Hour).Format(time.RFC3339)}}}
	repository := &serviceRepositoryFake{nodes: []domain.Node{healthyNode(serviceNodeA)}, snapshots: []inventory.Snapshot{{NodeID: serviceNodeA, ObservedAt: now, Document: &document}}}
	service := NewService(repository, nil, nil, nil, nil, nil)
	service.now = func() time.Time { return now }
	certificates, err := service.Certificates(context.Background(), serviceClusterID)
	if err != nil || len(certificates) != 1 || certificates[0].State != CertificateCritical || certificates[0].DaysRemaining == nil || *certificates[0].DaysRemaining != 6 {
		t.Fatalf("certificates=%#v err=%v", certificates, err)
	}
}

func TestUpgradeRejectsUnsupportedInstallation(t *testing.T) {
	repository := &serviceRepositoryFake{nodes: []domain.Node{healthyNode(serviceNodeA)}, settings: map[string]NodeSettings{serviceNodeA: {NodeID: serviceNodeA, InstallationType: InstallationHomeAssistant}}}
	service := NewService(repository, nil, nil, nil, nil, nil)
	_, err := service.StartUpgrade(context.Background(), domain.Actor{}, serviceNodeA, "v0.107.79")
	var domainError *domain.Error
	if !errors.As(err, &domainError) || domainError.Kind != domain.ErrorCapability {
		t.Fatalf("err=%v", err)
	}
}
