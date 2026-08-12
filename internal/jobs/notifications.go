package jobs

import (
	"context"
	"log/slog"
	"time"

	"github.com/benchristian88/atlas-dns/internal/operationalhealth"
)

type NotificationDeliverer interface {
	DeliverNext(context.Context) (bool, error)
}

func RunNotificationDelivery(ctx context.Context, service NotificationDeliverer, logger *slog.Logger, tracker *operationalhealth.Tracker) {
	const interval = 15 * time.Second
	ticker := time.NewTicker(interval)
	defer ticker.Stop()
	for {
		next := time.Now().UTC().Add(interval)
		if tracker != nil {
			tracker.Start("notification_delivery", next)
		}
		processed, err := service.DeliverNext(ctx)
		if err != nil {
			logger.Warn("notification delivery failed", "subsystem", "notification_delivery", "error_code", "NOTIFICATION_DELIVERY_FAILED")
			if tracker != nil {
				tracker.Failure("notification_delivery", "NOTIFICATION_DELIVERY_FAILED", next)
			}
		} else if tracker != nil {
			tracker.Success("notification_delivery", next)
		}
		if processed {
			continue
		}
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
		}
	}
}
