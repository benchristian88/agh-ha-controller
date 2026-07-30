package jobs

import (
	"context"
	"log/slog"
	"time"
)

type DeploymentExecutor interface {
	RunOnce(context.Context) (bool, error)
}

type DriftReconciler interface {
	RunOnce(context.Context) error
}

func RunDeploymentExecutor(ctx context.Context, executor DeploymentExecutor, logger *slog.Logger) {
	for {
		worked, err := executor.RunOnce(ctx)
		if err != nil && ctx.Err() == nil {
			logger.Error("deployment execution failed", "error", err)
		}
		delay := time.Second
		if worked {
			delay = 10 * time.Millisecond
		}
		timer := time.NewTimer(delay)
		select {
		case <-ctx.Done():
			timer.Stop()
			return
		case <-timer.C:
		}
	}
}

func RunReconciler(ctx context.Context, reconciler DriftReconciler, interval time.Duration, logger *slog.Logger) {
	if interval < 10*time.Second {
		interval = 10 * time.Second
	}
	run := func() {
		if err := reconciler.RunOnce(ctx); err != nil && ctx.Err() == nil {
			logger.Error("drift reconciliation pass failed", "error", err)
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
