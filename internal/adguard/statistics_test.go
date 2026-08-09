package adguard

import (
	"testing"
)

func TestSupportsRecentStatisticsBoundaries(t *testing.T) {
	for version, want := range map[string]bool{
		"v0.107.71": false,
		"v0.107.72": true,
		"v0.107.78": true,
		"v0.107.79": false,
		"invalid":   false,
	} {
		if got := SupportsRecentStatistics(version); got != want {
			t.Errorf("SupportsRecentStatistics(%q) = %v, want %v", version, got, want)
		}
	}
}

func TestValidateStatisticsResponseRejectsMismatchedSeries(t *testing.T) {
	response := statisticsResponse{TimeUnits: "hours", DNSQueriesSeries: []int64{1, 2}, BlockedFilteringSeries: []int64{1}, ReplacedSafeBrowsingSeries: []int64{0, 0}, ReplacedParentalSeries: []int64{0, 0}}
	if err := validateStatisticsResponse(response); err == nil {
		t.Fatal("validateStatisticsResponse accepted mismatched series")
	}
}
