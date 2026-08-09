package haoperations

import (
	"encoding/binary"
	"testing"
)

func TestDNSQueryBuildsBoundedRootNSRequest(t *testing.T) {
	message, id, err := dnsQuery(".", "NS")
	if err != nil {
		t.Fatal(err)
	}
	if len(message) != 17 {
		t.Fatalf("length=%d", len(message))
	}
	if binary.BigEndian.Uint16(message[:2]) != id || binary.BigEndian.Uint16(message[4:6]) != 1 {
		t.Fatalf("invalid header %x", message[:12])
	}
	if binary.BigEndian.Uint16(message[13:15]) != 2 {
		t.Fatalf("type=%d", binary.BigEndian.Uint16(message[13:15]))
	}
}

func TestValidateDNSResponseRequiresMatchingResponse(t *testing.T) {
	response := make([]byte, 12)
	binary.BigEndian.PutUint16(response[:2], 42)
	binary.BigEndian.PutUint16(response[2:4], 0x8003)
	rcode, _, _, err := validateDNSResponse(response, 42, 5, "ipv4")
	if err != nil || rcode != 3 {
		t.Fatalf("rcode=%d err=%v", rcode, err)
	}
	if _, _, _, err := validateDNSResponse(response, 43, 5, "ipv4"); err == nil {
		t.Fatal("mismatched ID accepted")
	}
}

func TestVersionAndInstallationClassification(t *testing.T) {
	if SupportForInstallation(InstallationNativeSystemd) != UpgradeGuided || SupportForInstallation(InstallationDocker) != UpgradeGuided {
		t.Fatal("guided installations misclassified")
	}
	if SupportForInstallation(InstallationHomeAssistant) != UpgradeUnsupported || SupportForInstallation(InstallationUnknown) != UpgradeUnsupported {
		t.Fatal("unsafe installation advertised")
	}
	if compareVersions("v0.107.78", "v0.107.79") >= 0 || compareVersions("v0.107.78", "v0.107.78") != 0 {
		t.Fatal("version comparison failed")
	}
}
