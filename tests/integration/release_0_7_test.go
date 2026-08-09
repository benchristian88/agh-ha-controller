package integration_test

import (
	"context"
	"testing"
	"time"
)

func TestRelease07QueryLogCheckpointScansConsecutiveFailures(t *testing.T) {
	store := integrationStore(t)
	ctx := context.Background()
	const (
		clusterID = "70000000-0000-4000-8000-000000000001"
		nodeID    = "70000000-0000-4000-8000-000000000002"
	)
	now := time.Date(2026, time.August, 9, 3, 4, 5, 0, time.UTC)
	lastSuccess := now.Add(-4 * time.Minute)
	if _, err := store.Pool().Exec(ctx, `
		INSERT INTO clusters (id,name,description,created_at,updated_at)
		VALUES ($1,'Release 0.7 checkpoint test','',$2,$2)`, clusterID, now); err != nil {
		t.Fatal(err)
	}
	if _, err := store.Pool().Exec(ctx, `
		INSERT INTO nodes
			(id,cluster_id,name,base_url,encrypted_credentials,credential_nonce,
			 credential_key_version,credential_algorithm,certificate_policy,enabled,
			 created_at,updated_at)
		VALUES ($1,$2,'Primary','http://release-0-7-node.test',$4,$5,1,'AES-256-GCM','insecure_http',true,$3,$3)`,
		nodeID, clusterID, now, []byte("ciphertext"), []byte("nonce")); err != nil {
		t.Fatal(err)
	}
	if _, err := store.Pool().Exec(ctx, `
		INSERT INTO query_ingestion_checkpoints
			(node_id,cluster_id,last_attempt_at,last_success_at,last_status,updated_at)
		VALUES ($1,$2,$3,$4,'failed',$3)`, nodeID, clusterID, now, lastSuccess); err != nil {
		t.Fatal(err)
	}
	for index, completedAt := range []time.Time{
		lastSuccess.Add(-time.Minute),
		lastSuccess.Add(time.Minute),
		lastSuccess.Add(2 * time.Minute),
	} {
		attemptID := []string{
			"70000000-0000-4000-8000-000000000003",
			"70000000-0000-4000-8000-000000000004",
			"70000000-0000-4000-8000-000000000005",
		}[index]
		if _, err := store.Pool().Exec(ctx, `
			INSERT INTO query_ingestion_attempts
				(id,cluster_id,node_id,started_at,completed_at,status)
			VALUES ($1,$2,$3,$4,$5,'failed')`, attemptID, clusterID, nodeID, completedAt.Add(-time.Second), completedAt); err != nil {
			t.Fatal(err)
		}
	}

	checkpoint, exists, err := store.QueryLogCheckpoint(ctx, nodeID)
	if err != nil {
		t.Fatalf("load checkpoint: %v", err)
	}
	if !exists || checkpoint.ConsecutiveFailures != 2 {
		t.Fatalf("checkpoint exists=%t consecutive failures=%d, want true and 2", exists, checkpoint.ConsecutiveFailures)
	}

	checkpoints, err := store.QueryLogCheckpoints(ctx, clusterID, "")
	if err != nil {
		t.Fatalf("list checkpoints: %v", err)
	}
	if len(checkpoints) != 1 || checkpoints[0].ConsecutiveFailures != 2 {
		t.Fatalf("checkpoints=%#v, want one checkpoint with 2 consecutive failures", checkpoints)
	}
}
