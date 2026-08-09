package adguard

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
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

func TestReadStatisticsConfigReturnsNodeRetention(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
		if request.URL.Path != "/control/stats/config" {
			http.NotFound(response, request)
			return
		}
		_, _ = response.Write([]byte(`{"enabled":true,"interval":86400000,"ignored":[]}`))
	}))
	defer server.Close()
	config, err := NewConfigurationReader(NewProbe(time.Second)).ReadStatisticsConfig(context.Background(), probeRequest(server.URL))
	if err != nil {
		t.Fatal(err)
	}
	if !config.Enabled || config.Retention != 24*time.Hour {
		t.Fatalf("config = %+v", config)
	}
}

func TestReadStatisticsConfigRejectsEnabledZeroRetention(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(response http.ResponseWriter, _ *http.Request) {
		_, _ = response.Write([]byte(`{"enabled":true,"interval":0}`))
	}))
	defer server.Close()
	if _, err := NewConfigurationReader(NewProbe(time.Second)).ReadStatisticsConfig(context.Background(), probeRequest(server.URL)); err == nil {
		t.Fatal("enabled statistics with zero retention was accepted")
	}
}
