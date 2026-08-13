package jobs

import (
	"context"
	"log/slog"
	"time"

	"github.com/benchristian88/atlas-dns/internal/operationalhealth"
)

type HAOperationsPoller interface {
	PollAll(context.Context) error
}

func RunHAOperations(ctx context.Context, service HAOperationsPoller, interval time.Duration, logger *slog.Logger, tracker *operationalhealth.Tracker) {
	if interval <= 0 {
		interval = 30 * time.Second
	}
	run := func() {
		next := time.Now().UTC().Add(interval)
		if tracker != nil {
			tracker.Start("dns_service_health", next)
		}
		if err := service.PollAll(ctx); err != nil {
			logger.Error("DNS service health pass failed", "subsystem", "dns_service_health", "error_code", "DNS_HEALTH_PASS_FAILED")
			if tracker != nil {
				tracker.Failure("dns_service_health", "DNS_HEALTH_PASS_FAILED", next)
			}
			return
		}
		if tracker != nil {
			tracker.Success("dns_service_health", next)
		}
	}
	run()
	ticker := time.NewTicker(interval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			run()
		}
	}
}
