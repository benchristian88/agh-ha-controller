package jobs

import (
	"context"
	"log/slog"
	"time"

	"github.com/benchristian88/agh-ha-controller/internal/operationalhealth"
)

type ReleaseRefresher interface{ Refresh(context.Context) error }

func RunReleaseChecks(ctx context.Context, checker ReleaseRefresher, logger *slog.Logger, tracker *operationalhealth.Tracker) {
	const interval = 6 * time.Hour
	run := func() {
		next := time.Now().UTC().Add(interval)
		if tracker != nil {
			tracker.Start("adguard_release_check", next)
		}
		if err := checker.Refresh(ctx); err != nil {
			logger.Warn("AdGuard Home release check failed", "subsystem", "adguard_release_check", "error_code", "RELEASE_CHECK_UNAVAILABLE")
			if tracker != nil {
				tracker.Failure("adguard_release_check", "RELEASE_CHECK_UNAVAILABLE", next)
			}
			return
		}
		if tracker != nil {
			tracker.Success("adguard_release_check", next)
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
