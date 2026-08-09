package integration_test

import (
	"context"
	"testing"
	"time"

	"github.com/benchristian88/agh-ha-controller/internal/haoperations"
)

func TestRelease08LifecycleSchemaPersistsSafeOperationalEvidence(t *testing.T) {
	store := integrationStore(t)
	ctx := context.Background()
	now := time.Date(2026, time.August, 9, 4, 0, 0, 0, time.UTC)
	const clusterID = "80000000-0000-4000-8000-000000000001"
	const nodeID = "80000000-0000-4000-8000-000000000002"
	const probeID = "80000000-0000-4000-8000-000000000003"
	if _, err := store.Pool().Exec(ctx, `INSERT INTO clusters(id,name,description,created_at,updated_at)VALUES($1,'Release 0.8','','2026-08-09T04:00:00Z','2026-08-09T04:00:00Z')`, clusterID); err != nil {
		t.Fatal(err)
	}
	if _, err := store.Pool().Exec(ctx, `INSERT INTO nodes(id,cluster_id,name,base_url,encrypted_credentials,credential_nonce,credential_key_version,credential_algorithm,certificate_policy,enabled,created_at,updated_at)VALUES($1,$2,'Primary','https://node.test',$3,$4,1,'AES-256-GCM','system',true,$5,$5)`, nodeID, clusterID, []byte("ciphertext"), []byte("nonce"), now); err != nil {
		t.Fatal(err)
	}
	result := haoperations.DNSProbeResult{ID: probeID, ClusterID: clusterID, NodeID: nodeID, Status: "healthy", UDPStatus: "healthy", TCPStatus: "healthy", ResponseCode: intPointer08(0), LatencyMS: intPointer08(4), AddressFamily: "ipv4", ProbedAt: now}
	if err := store.SaveDNSProbe(ctx, result, nil); err != nil {
		t.Fatal(err)
	}
	latest, err := store.LatestDNSProbe(ctx, nodeID)
	if err != nil || latest.Status != "healthy" || latest.LatencyMS == nil || *latest.LatencyMS != 4 {
		t.Fatalf("latest=%#v err=%v", latest, err)
	}
	cache := haoperations.ReleaseCache{Version: "v0.107.79", Compatibility: "unknown", CheckedAt: now, ExpiresAt: now.Add(6 * time.Hour)}
	if err := store.SaveReleaseCache(ctx, cache); err != nil {
		t.Fatal(err)
	}
	stored, err := store.ReleaseCache(ctx)
	if err != nil || stored.Version != cache.Version {
		t.Fatalf("cache=%#v err=%v", stored, err)
	}
	for _, column := range []string{"password", "credentials", "query_name", "private_key", "certificate_chain"} {
		var exists bool
		if err := store.Pool().QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=current_schema() AND table_name IN('dns_probe_results','ha_operational_events','upgrade_operations') AND column_name=$1)`, column).Scan(&exists); err != nil {
			t.Fatal(err)
		}
		if exists {
			t.Fatalf("prohibited lifecycle column %q exists", column)
		}
	}
}

func intPointer08(value int) *int { return &value }
