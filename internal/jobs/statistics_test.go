package jobs

import (
	"context"
	"errors"
	"io"
	"log/slog"
	"testing"
	"time"

	"github.com/benchristian88/agh-ha-controller/internal/domain"
	"github.com/benchristian88/agh-ha-controller/internal/telemetry"
)

type statisticsStoreFake struct {
	attempt   telemetry.PollAttempt
	snapshots []telemetry.Snapshot
}

func (s *statisticsStoreFake) PollableNodes(context.Context) ([]domain.NodeRecord, error) {
	return nil, nil
}
func (s *statisticsStoreFake) RecordStatisticsPoll(_ context.Context, attempt telemetry.PollAttempt, snapshots []telemetry.Snapshot) error {
	s.attempt, s.snapshots = attempt, snapshots
	return nil
}
func (s *statisticsStoreFake) CleanupStatistics(context.Context, time.Time) error { return nil }

type statisticsReaderFake struct{}

func (statisticsReaderFake) ReadStatistics(_ context.Context, _ domain.NodeProbeRequest, recent time.Duration) (telemetry.SourceSnapshot, error) {
	if recent != telemetry.Range24Hours.Duration() {
		return telemetry.SourceSnapshot{}, &domain.Error{Kind: domain.ErrorCapability, Message: "range unavailable", Cause: errors.New("retention too short")}
	}
	return telemetry.SourceSnapshot{TimeUnit: "hours", DNSQueries: 10, DNSQueriesSeries: []int64{10}, BlockedFilteringSeries: []int64{0}, ReplacedSafeBrowsingSeries: []int64{0}, ReplacedParentalSeries: []int64{0}}, nil
}

func TestStatisticsPollerRecordsPartialRangeFailures(t *testing.T) {
	store := &statisticsStoreFake{}
	poller := NewStatisticsPoller(store, decrypterFake{}, statisticsReaderFake{}, time.Hour, time.Second, slog.New(slog.NewTextHandler(io.Discard, nil)))
	now := time.Date(2026, 8, 9, 12, 30, 0, 0, time.UTC)
	poller.now = func() time.Time { return now }
	poller.pollNode(context.Background(), domain.NodeRecord{Node: domain.Node{
		ID: "22222222-2222-4222-8222-222222222222", ClusterID: "11111111-1111-4111-8111-111111111111", Name: "Primary", Version: "v0.107.78",
	}})
	if store.attempt.Status != "partial" || store.attempt.CollectedRanges != 1 || len(store.snapshots) != 1 {
		t.Fatalf("attempt=%+v snapshots=%d", store.attempt, len(store.snapshots))
	}
	if store.attempt.RangeErrors[telemetry.Range7Days] != string(domain.ErrorCapability) || store.attempt.RangeErrors[telemetry.Range30Days] != string(domain.ErrorCapability) {
		t.Fatalf("range errors = %+v", store.attempt.RangeErrors)
	}
	if store.snapshots[0].SourceEndedAt != time.Date(2026, 8, 9, 13, 0, 0, 0, time.UTC) {
		t.Fatalf("SourceEndedAt = %v", store.snapshots[0].SourceEndedAt)
	}
}

func TestStatisticsPollerDoesNotCallUnsupportedNode(t *testing.T) {
	store := &statisticsStoreFake{}
	poller := NewStatisticsPoller(store, decrypterFake{}, statisticsReaderFake{}, time.Hour, time.Second, slog.New(slog.NewTextHandler(io.Discard, nil)))
	poller.pollNode(context.Background(), domain.NodeRecord{Node: domain.Node{ID: "22222222-2222-4222-8222-222222222222", ClusterID: "11111111-1111-4111-8111-111111111111", Version: "v0.107.71"}})
	if store.attempt.Status != "unsupported" || store.attempt.RangeErrors[telemetry.Range24Hours] != "STATISTICS_EXACT_RANGE_UNSUPPORTED" {
		t.Fatalf("attempt = %+v", store.attempt)
	}
}
