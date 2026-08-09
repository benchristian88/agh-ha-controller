package jobs

import (
	"context"
	"errors"
	"log/slog"
	"sync"
	"time"

	"github.com/benchristian88/agh-ha-controller/internal/adguard"
	"github.com/benchristian88/agh-ha-controller/internal/domain"
	"github.com/benchristian88/agh-ha-controller/internal/telemetry"
)

type StatisticsStore interface {
	PollableNodes(context.Context) ([]domain.NodeRecord, error)
	RecordStatisticsPoll(context.Context, telemetry.PollAttempt, []telemetry.Snapshot) error
	CleanupStatistics(context.Context, time.Time) error
}

type StatisticsReader interface {
	ReadStatistics(context.Context, domain.NodeProbeRequest, time.Duration) (telemetry.SourceSnapshot, error)
}

type StatisticsPoller struct {
	store       StatisticsStore
	decrypter   CredentialDecrypter
	reader      StatisticsReader
	interval    time.Duration
	timeout     time.Duration
	concurrency int
	logger      *slog.Logger
	now         func() time.Time
}

func NewStatisticsPoller(store StatisticsStore, decrypter CredentialDecrypter, reader StatisticsReader, interval, timeout time.Duration, logger *slog.Logger) *StatisticsPoller {
	return &StatisticsPoller{store: store, decrypter: decrypter, reader: reader, interval: interval, timeout: timeout, concurrency: 4, logger: logger, now: time.Now}
}

func (p *StatisticsPoller) Run(ctx context.Context) {
	p.poll(ctx)
	ticker := time.NewTicker(p.interval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			p.poll(ctx)
		}
	}
}

func (p *StatisticsPoller) poll(ctx context.Context) {
	records, err := p.store.PollableNodes(ctx)
	if err != nil {
		p.logger.Error("statistics polling could not load nodes", "error", err)
		return
	}
	semaphore := make(chan struct{}, p.concurrency)
	var group sync.WaitGroup
	for _, record := range records {
		record := record
		group.Add(1)
		go func() {
			defer group.Done()
			select {
			case semaphore <- struct{}{}:
				defer func() { <-semaphore }()
			case <-ctx.Done():
				return
			}
			p.pollNode(ctx, record)
		}()
	}
	group.Wait()
	if err := p.store.CleanupStatistics(ctx, p.now().UTC()); err != nil {
		p.logger.Error("statistics retention cleanup failed", "error", err)
	}
}

func (p *StatisticsPoller) pollNode(ctx context.Context, record domain.NodeRecord) {
	started := p.now().UTC()
	attempt := telemetry.PollAttempt{ClusterID: record.Node.ClusterID, NodeID: record.Node.ID, StartedAt: started, ExpectedRanges: len(telemetry.SupportedRanges()), RangeErrors: map[telemetry.Range]string{}}
	var err error
	attempt.ID, err = domain.NewID()
	if err != nil {
		p.logger.Error("statistics poll identifier could not be created", "node_id", record.Node.ID, "error", err)
		return
	}
	recordAttempt := func(snapshots []telemetry.Snapshot) {
		attempt.CompletedAt = p.now().UTC()
		if err := p.store.RecordStatisticsPoll(ctx, attempt, snapshots); err != nil {
			p.logger.Error("statistics poll result could not be recorded", "node_id", record.Node.ID, "error", err)
		}
	}
	if record.Node.MaintenanceMode {
		attempt.Status, attempt.ErrorCode = "maintenance", "NODE_MAINTENANCE"
		setAllRangeErrors(&attempt, attempt.ErrorCode)
		recordAttempt(nil)
		return
	}
	if !adguard.SupportsRecentStatistics(record.Node.Version) {
		attempt.Status, attempt.ErrorCode = "unsupported", "STATISTICS_EXACT_RANGE_UNSUPPORTED"
		setAllRangeErrors(&attempt, attempt.ErrorCode)
		recordAttempt(nil)
		return
	}
	credentials, err := p.decrypter.Decrypt(record.Node.ID, record.Secrets.Credentials)
	if err != nil {
		attempt.Status, attempt.ErrorCode = "failed", "CREDENTIAL_DECRYPTION_FAILED"
		setAllRangeErrors(&attempt, attempt.ErrorCode)
		recordAttempt(nil)
		return
	}
	request := domain.NodeProbeRequest{BaseURL: record.Node.BaseURL, CertificatePolicy: record.Node.CertificatePolicy, CustomCAPEM: record.Secrets.CustomCAPEM, Credentials: credentials}
	snapshots := make([]telemetry.Snapshot, 0, attempt.ExpectedRanges)
	for _, window := range telemetry.SupportedRanges() {
		requestContext, cancel := context.WithTimeout(ctx, p.timeout)
		source, readErr := p.reader.ReadStatistics(requestContext, request, window.Duration())
		cancel()
		if readErr != nil {
			attempt.ErrorCode = statisticsErrorCode(readErr)
			attempt.RangeErrors[window] = attempt.ErrorCode
			continue
		}
		collectedAt := p.now().UTC()
		end := collectedAt.Truncate(time.Hour).Add(time.Hour)
		if source.TimeUnit == "days" {
			end = collectedAt.Truncate(24 * time.Hour).Add(24 * time.Hour)
		}
		id, idErr := domain.NewID()
		if idErr != nil {
			attempt.ErrorCode = "STATISTICS_ID_FAILED"
			continue
		}
		snapshots = append(snapshots, telemetry.Snapshot{ID: id, ClusterID: record.Node.ClusterID, NodeID: record.Node.ID,
			NodeName: record.Node.Name, NodeVersion: record.Node.Version, Range: window, SourceStartedAt: end.Add(-window.Duration()),
			SourceEndedAt: end, CollectedAt: collectedAt, SourceSnapshot: source})
	}
	attempt.CollectedRanges = len(snapshots)
	switch {
	case len(snapshots) == attempt.ExpectedRanges:
		attempt.Status, attempt.ErrorCode = "succeeded", ""
	case len(snapshots) > 0:
		attempt.Status = "partial"
	default:
		attempt.Status = "failed"
	}
	recordAttempt(snapshots)
}

func setAllRangeErrors(attempt *telemetry.PollAttempt, code string) {
	for _, window := range telemetry.SupportedRanges() {
		attempt.RangeErrors[window] = code
	}
}

func statisticsErrorCode(err error) string {
	if errors.Is(err, context.DeadlineExceeded) {
		return "STATISTICS_TIMEOUT"
	}
	var domainError *domain.Error
	if errors.As(err, &domainError) {
		return string(domainError.Kind)
	}
	return "STATISTICS_COLLECTION_FAILED"
}
