package operationalhealth

import (
	"testing"
	"time"
)

func TestTrackerFailureAndRecovery(t *testing.T) {
	now := time.Date(2026, 8, 9, 1, 0, 0, 0, time.UTC)
	tracker := NewTracker()
	tracker.now = func() time.Time { return now }
	tracker.Register("statistics", false)
	for range 3 {
		tracker.Start("statistics", now.Add(time.Minute))
		tracker.Failure("statistics", "STATISTICS_COLLECTION_FAILED", now.Add(time.Minute))
	}
	failed := tracker.Snapshot()[0]
	if failed.State != Failed || failed.ConsecutiveFailures != 3 || failed.ErrorCode == "" {
		t.Fatalf("unexpected failed state: %#v", failed)
	}
	tracker.Start("statistics", now.Add(time.Minute))
	tracker.Success("statistics", now.Add(time.Minute))
	recovered := tracker.Snapshot()[0]
	if recovered.State != Healthy || recovered.ConsecutiveFailures != 0 || recovered.ErrorCode != "" {
		t.Fatalf("unexpected recovery state: %#v", recovered)
	}
}
