package jobs

import (
	"context"
	"log/slog"
	"time"
)

type SessionStore interface {
	DeleteExpiredSessions(context.Context, time.Time) (int64, error)
}

func RunSessionCleanup(ctx context.Context, store SessionStore, logger *slog.Logger) {
	cleanup := func() {
		deleted, err := store.DeleteExpiredSessions(ctx, time.Now().UTC())
		if err != nil {
			logger.Error("expired session cleanup failed", "error", err)
			return
		}
		if deleted > 0 {
			logger.Info("expired sessions removed", "count", deleted)
		}
	}
	cleanup()
	ticker := time.NewTicker(time.Hour)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			cleanup()
		}
	}
}
