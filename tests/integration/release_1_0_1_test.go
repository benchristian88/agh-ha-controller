package integration_test

import (
	"context"
	"testing"

	"github.com/benchristian88/atlas-dns/internal/database"
)

func TestRelease101AcceptsV100SchemaWithoutMigration(t *testing.T) {
	store := integrationStore(t)
	ctx := context.Background()

	var beforeCount, beforeVersion int
	if err := store.Pool().QueryRow(ctx, `SELECT count(*),max(version) FROM schema_migrations`).Scan(&beforeCount, &beforeVersion); err != nil {
		t.Fatal(err)
	}
	if beforeCount != 14 || beforeVersion != 14 {
		t.Fatalf("baseline ledger count/version = %d/%d, want 14/14", beforeCount, beforeVersion)
	}

	if err := database.ApplyMigrations(ctx, store.Pool()); err != nil {
		t.Fatalf("reapply unchanged v1.0.0 baseline: %v", err)
	}
	var afterCount, afterVersion int
	if err := store.Pool().QueryRow(ctx, `SELECT count(*),max(version) FROM schema_migrations`).Scan(&afterCount, &afterVersion); err != nil {
		t.Fatal(err)
	}
	if afterCount != beforeCount || afterVersion != beforeVersion {
		t.Fatalf("ledger changed from %d/%d to %d/%d", beforeCount, beforeVersion, afterCount, afterVersion)
	}
}
