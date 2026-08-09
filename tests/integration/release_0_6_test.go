package integration_test

import (
	"context"
	"strings"
	"testing"
)

func TestRelease06QueryLogMigrationUpgradeAndIndexes(t *testing.T) {
	store := integrationStore(t)
	ctx := context.Background()
	for _, table := range []string{"query_events", "query_ingestion_checkpoints", "query_ingestion_attempts"} {
		var exists bool
		if err := store.Pool().QueryRow(ctx, `SELECT EXISTS (
			SELECT 1 FROM information_schema.tables WHERE table_schema=current_schema() AND table_name=$1
		)`, table).Scan(&exists); err != nil {
			t.Fatal(err)
		}
		if !exists {
			t.Fatalf("migration did not create %s", table)
		}
	}
	rows, err := store.Pool().Query(ctx, `SELECT indexdef FROM pg_indexes WHERE schemaname=current_schema() AND tablename='query_events'`)
	if err != nil {
		t.Fatal(err)
	}
	defer rows.Close()
	definitions := ""
	for rows.Next() {
		var definition string
		if err := rows.Scan(&definition); err != nil {
			t.Fatal(err)
		}
		definitions += definition + "\n"
	}
	for _, required := range []string{"source_fingerprint", "source_occurrence", "source_timestamp", "gin_trgm_ops"} {
		if !strings.Contains(definitions, required) {
			t.Errorf("query_events indexes do not include %q:\n%s", required, definitions)
		}
	}
	var sensitiveColumns int
	if err := store.Pool().QueryRow(ctx, `SELECT count(*) FROM information_schema.columns
		WHERE table_schema=current_schema() AND table_name='query_events'
		AND column_name IN ('password','credentials','base_url','raw_payload')`).Scan(&sensitiveColumns); err != nil {
		t.Fatal(err)
	}
	if sensitiveColumns != 0 {
		t.Fatalf("query_events contains %d prohibited sensitive/raw columns", sensitiveColumns)
	}
}
