package inventory

import (
	"context"
	"errors"
	"testing"

	"github.com/benchristian88/atlas-dns/internal/domain"
)

const dhcpNodeID = "22222222-2222-4222-8222-222222222222"

type dhcpReaderFake struct {
	unusedReader
	interfaces    []DHCPInterface
	check         DHCPActiveCheck
	err           error
	interfaceName string
}

func (f *dhcpReaderFake) ReadDHCPInterfaces(context.Context, domain.NodeProbeRequest) ([]DHCPInterface, error) {
	return f.interfaces, f.err
}

func (f *dhcpReaderFake) FindActiveDHCP(_ context.Context, _ domain.NodeProbeRequest, interfaceName string) (DHCPActiveCheck, error) {
	f.interfaceName = interfaceName
	return f.check, f.err
}

func dhcpServiceFixture(reader *dhcpReaderFake) (*Service, *fakeRepository) {
	repository := &fakeRepository{nodeRecord: domain.NodeRecord{Node: domain.Node{
		ID: dhcpNodeID, Name: "Primary", Enabled: true, BaseURL: "http://node.test",
		CertificatePolicy: domain.CertificateInsecureHTTP,
	}}}
	return NewService(repository, unusedCredentials{}, reader), repository
}

func TestDHCPInterfacesSortsAndMarksSafeAvailability(t *testing.T) {
	reader := &dhcpReaderFake{interfaces: []DHCPInterface{
		{Name: "lo", IPv4Addresses: []string{"127.0.0.1"}, Flags: []string{"loopback", "up"}},
		{Name: "eth0", IPv4Addresses: []string{" 192.0.2.2 ", "192.0.2.2"}, Flags: []string{"multicast", "up"}},
	}}
	service, _ := dhcpServiceFixture(reader)
	result, err := service.DHCPInterfaces(context.Background(), dhcpNodeID)
	if err != nil {
		t.Fatal(err)
	}
	if result.NodeName != "Primary" || len(result.Interfaces) != 2 || result.Interfaces[0].Name != "eth0" || !result.Interfaces[0].Available || result.Interfaces[1].Available || len(result.Interfaces[0].IPv4Addresses) != 1 {
		t.Fatalf("result = %#v", result)
	}
}

func TestFindActiveDHCPAggregatesResultsAndAudits(t *testing.T) {
	tests := []struct {
		name, want string
		check      DHCPActiveCheck
	}{
		{name: "none found", want: "none", check: DHCPActiveCheck{IPv4OtherServer: DHCPCheckValue{Status: "no"}, IPv6OtherServer: DHCPCheckValue{Status: "no"}}},
		{name: "one found", want: "found", check: DHCPActiveCheck{IPv4OtherServer: DHCPCheckValue{Status: "yes"}, IPv6OtherServer: DHCPCheckValue{Status: "no"}}},
		{name: "multiple found", want: "multiple", check: DHCPActiveCheck{IPv4OtherServer: DHCPCheckValue{Status: "yes"}, IPv6OtherServer: DHCPCheckValue{Status: "yes"}}},
		{name: "partial failure", want: "partial", check: DHCPActiveCheck{IPv4OtherServer: DHCPCheckValue{Status: "no"}, IPv6OtherServer: DHCPCheckValue{Status: "error"}}},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			reader := &dhcpReaderFake{check: test.check}
			service, repository := dhcpServiceFixture(reader)
			result, err := service.FindActiveDHCP(context.Background(), domain.Actor{UserID: "44444444-4444-4444-8444-444444444444", RequestID: "55555555-5555-4555-8555-555555555555"}, dhcpNodeID, " eth0 ")
			if err != nil {
				t.Fatal(err)
			}
			if result.Status != test.want || result.InterfaceName != "eth0" || reader.interfaceName != "eth0" {
				t.Fatalf("result = %#v interface=%q", result, reader.interfaceName)
			}
			if len(repository.audits) != 2 || repository.audits[0].Action != "dhcp.active_check_requested" || repository.audits[1].Action != "dhcp.active_check_succeeded" || repository.audits[1].Metadata["status"] != test.want {
				t.Fatalf("audits = %#v", repository.audits)
			}
		})
	}
}

func TestFindActiveDHCPAuditsTimeoutFailure(t *testing.T) {
	reader := &dhcpReaderFake{err: domain.NewError(domain.ErrorNodeUnreachable, "the AdGuard Home node could not be reached")}
	service, repository := dhcpServiceFixture(reader)
	_, err := service.FindActiveDHCP(context.Background(), domain.Actor{UserID: "44444444-4444-4444-8444-444444444444", RequestID: "55555555-5555-4555-8555-555555555555"}, dhcpNodeID, "eth0")
	var domainError *domain.Error
	if !errors.As(err, &domainError) || domainError.Kind != domain.ErrorNodeUnreachable {
		t.Fatalf("error = %#v", err)
	}
	if len(repository.audits) != 2 || repository.audits[1].Action != "dhcp.active_check_failed" || repository.audits[1].Metadata["errorCode"] != string(domain.ErrorNodeUnreachable) {
		t.Fatalf("audits = %#v", repository.audits)
	}
}

func TestFindActiveDHCPRejectsMaintenanceBeforeAuditOrNodeCall(t *testing.T) {
	reader := &dhcpReaderFake{}
	service, repository := dhcpServiceFixture(reader)
	repository.nodeRecord.Node.MaintenanceMode = true
	_, err := service.FindActiveDHCP(context.Background(), domain.Actor{}, dhcpNodeID, "eth0")
	if err == nil || len(repository.audits) != 0 {
		t.Fatalf("error=%v audits=%#v", err, repository.audits)
	}
}
