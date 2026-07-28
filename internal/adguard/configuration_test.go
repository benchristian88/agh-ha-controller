package adguard

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"

	"github.com/benchristian88/agh-ha-controller/internal/configuration"
)

func TestVersionFixturesSuppressVolatileFields(t *testing.T) {
	documents := make([]configuration.Document, 0, 2)
	for _, version := range []string{"v0.107.52", "v0.107.61"} {
		var dns dnsInfoResponse
		readFixture(t, filepath.Join("testdata", version, "dns_info.json"), &dns)
		var filtering filterStatusResponse
		readFixture(t, filepath.Join("testdata", version, "filtering_status.json"), &filtering)
		documents = append(documents, configurationDocument(version, dns, filtering))
	}
	if differences := configuration.Diff(documents[0], documents[1]); len(differences) != 0 {
		t.Fatalf("equivalent fixtures differ: %#v", differences)
	}
}

func readFixture(t *testing.T, path string, target any) {
	t.Helper()
	body, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	if err := json.Unmarshal(body, target); err != nil {
		t.Fatal(err)
	}
}
