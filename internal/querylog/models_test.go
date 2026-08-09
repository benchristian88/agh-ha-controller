package querylog

import (
	"testing"
	"time"
)

func TestFingerprintIgnoresMutableClientDisplayName(t *testing.T) {
	event := SourceEvent{Timestamp: time.Date(2026, 8, 9, 1, 2, 3, 0, time.UTC), QueryName: "example.org", QueryType: "A", ClientIdentifier: "192.0.2.1", ResponseStatus: StatusAllowed}
	first := event.Fingerprint()
	event.ClientDisplayName = "Renamed client"
	if first != event.Fingerprint() {
		t.Fatal("client display-name enrichment changed source event identity")
	}
}

func TestNormalizeBoundsAndRejectsUnsafeElapsedValues(t *testing.T) {
	event := SourceEvent{Timestamp: time.Now(), QueryName: "Example.ORG.", QueryType: "a", ResponseStatus: "unknown", ElapsedMS: -1}
	if event.Normalize() {
		t.Fatal("negative processing time was accepted")
	}
	event.ElapsedMS = 1
	if !event.Normalize() || event.QueryName != "example.org" || event.QueryType != "A" || event.ResponseStatus != StatusOther {
		t.Fatalf("unexpected normalization: %+v", event)
	}
}

func TestNormalizePreservesDNSRootQuestion(t *testing.T) {
	event := SourceEvent{Timestamp: time.Now(), QueryName: ".", QueryType: "ns", ResponseStatus: StatusAllowed}
	if !event.Normalize() || event.QueryName != "." || event.QueryType != "NS" {
		t.Fatalf("root question was not preserved: %+v", event)
	}
}
