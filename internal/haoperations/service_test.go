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
