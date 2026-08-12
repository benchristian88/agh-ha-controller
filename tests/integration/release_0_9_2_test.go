package integration_test

import (
	"context"
	"testing"
	"time"

	"github.com/benchristian88/atlas-dns/internal/controlplane"
	"github.com/benchristian88/atlas-dns/internal/domain"
)

func TestRelease092LifecycleCleanupAndWebhookHistory(t *testing.T) {
	store := integrationStore(t)
	ctx := context.Background()
	now := time.Date(2026, time.August, 11, 12, 0, 0, 0, time.UTC)
	const (
		userID               = "92000000-0000-4000-8000-000000000001"
		clusterID            = "92000000-0000-4000-8000-000000000002"
		activeRevisionID     = "92000000-0000-4000-8000-000000000003"
		referencedRevisionID = "92000000-0000-4000-8000-000000000004"
		unusedRevisionID     = "92000000-0000-4000-8000-000000000005"
		historicalDeployID   = "92000000-0000-4000-8000-000000000006"
		unstartedDeployID    = "92000000-0000-4000-8000-000000000007"
		startedDeployID      = "92000000-0000-4000-8000-000000000008"
		channelID            = "92000000-0000-4000-8000-000000000009"
		haEventID            = "92000000-0000-4000-8000-000000000010"
		deliveryID           = "92000000-0000-4000-8000-000000000011"
	)
	if _, err := store.Pool().Exec(ctx, `INSERT INTO users(id,email,display_name,password_hash,role,enabled,created_at,updated_at) VALUES($1,'release-092@example.test','Administrator','hash','administrator',true,$2,$2)`, userID, now); err != nil {
		t.Fatal(err)
	}
	if _, err := store.Pool().Exec(ctx, `INSERT INTO clusters(id,name,description,created_at,updated_at) VALUES($1,'Release 0.9.2','',$2,$2)`, clusterID, now); err != nil {
		t.Fatal(err)
	}
	for number, id := range []string{activeRevisionID, referencedRevisionID, unusedRevisionID} {
		if _, err := store.Pool().Exec(ctx, `INSERT INTO configuration_revisions(id,cluster_id,revision_number,schema_version,document_json,canonical_hash,summary,created_by,created_at) VALUES($1,$2,$3,2,'{"schemaVersion":2,"shared":{},"nodeOverrides":{},"unsupported":[]}','hash','Lifecycle test',$4,$5)`, id, clusterID, number+1, userID, now); err != nil {
			t.Fatal(err)
		}
	}
	if _, err := store.Pool().Exec(ctx, `UPDATE clusters SET active_revision_id=$2 WHERE id=$1`, clusterID, activeRevisionID); err != nil {
		t.Fatal(err)
	}

	event := lifecycleEvent092("92000000-0000-4000-8000-000000000012", userID, referencedRevisionID, "configuration.revision_archived", now)
	if err := store.SetRevisionArchived(ctx, activeRevisionID, userID, true, now, event); err == nil {
		t.Fatal("active revision was archived")
	}
	if err := store.SetRevisionArchived(ctx, referencedRevisionID, userID, true, now, event); err != nil {
		t.Fatal(err)
	}
	visible, err := store.ListRevisions(ctx, clusterID, false)
	if err != nil || len(visible) != 2 {
		t.Fatalf("visible revisions=%#v err=%v", visible, err)
	}
	all, err := store.ListRevisions(ctx, clusterID, true)
	if err != nil || len(all) != 3 || !revisionByID092(all, referencedRevisionID).Lifecycle.CanRestore {
		t.Fatalf("all revisions=%#v err=%v", all, err)
	}
	restoreEvent := lifecycleEvent092("92000000-0000-4000-8000-000000000013", userID, referencedRevisionID, "configuration.revision_restored", now)
	if err := store.SetRevisionArchived(ctx, referencedRevisionID, userID, false, now, restoreEvent); err != nil {
		t.Fatal(err)
	}
	deleteEvent := lifecycleEvent092("92000000-0000-4000-8000-000000000014", userID, unusedRevisionID, "configuration.revision_deleted_unused", now)
	if err := store.DeleteUnusedRevision(ctx, activeRevisionID, deleteEvent); err == nil {
		t.Fatal("active revision was deleted")
	}
	if err := store.DeleteUnusedRevision(ctx, unusedRevisionID, deleteEvent); err != nil {
		t.Fatal(err)
	}

	for _, deployment := range []struct {
		id, status string
		startedAt  any
		completed  any
	}{
		{historicalDeployID, "succeeded", now, now},
		{unstartedDeployID, "queued", nil, nil},
		{startedDeployID, "failed", now, now},
	} {
		revisionID := activeRevisionID
		if deployment.id == historicalDeployID {
			revisionID = referencedRevisionID
		}
		if _, err := store.Pool().Exec(ctx, `INSERT INTO deployments(id,cluster_id,revision_id,status,strategy,failure_policy,origin,requested_by,request_id,requested_at,started_at,completed_at) VALUES($1,$2,$3,$4,'sequential','stop','manual',$5,'release-092',$6,$7,$8)`, deployment.id, clusterID, revisionID, deployment.status, userID, now, deployment.startedAt, deployment.completed); err != nil {
			t.Fatal(err)
		}
	}
	referencedDeleteEvent := lifecycleEvent092("92000000-0000-4000-8000-000000000015", userID, referencedRevisionID, "configuration.revision_deleted_unused", now)
	if err := store.DeleteUnusedRevision(ctx, referencedRevisionID, referencedDeleteEvent); err == nil {
		t.Fatal("deployed revision was deleted")
	}
	archiveDeploymentEvent := lifecycleEvent092("92000000-0000-4000-8000-000000000016", userID, historicalDeployID, "deployment.archived", now)
	if err := store.SetDeploymentArchived(ctx, historicalDeployID, userID, true, now, archiveDeploymentEvent); err != nil {
		t.Fatal(err)
	}
	deployments, err := store.ListDeployments(ctx, clusterID, false)
	if err != nil || len(deployments) != 2 {
		t.Fatalf("visible deployments=%#v err=%v", deployments, err)
	}
	restoreDeploymentEvent := lifecycleEvent092("92000000-0000-4000-8000-000000000017", userID, historicalDeployID, "deployment.restored", now)
	if err := store.SetDeploymentArchived(ctx, historicalDeployID, userID, false, now, restoreDeploymentEvent); err != nil {
		t.Fatal(err)
	}
	rearchiveDeploymentEvent := lifecycleEvent092("92000000-0000-4000-8000-000000000020", userID, historicalDeployID, "deployment.archived", now)
	if err := store.SetDeploymentArchived(ctx, historicalDeployID, userID, true, now, rearchiveDeploymentEvent); err != nil {
		t.Fatal(err)
	}
	deleteDeploymentEvent := lifecycleEvent092("92000000-0000-4000-8000-000000000018", userID, unstartedDeployID, "deployment.deleted_unstarted", now)
	if err := store.DeleteUnstartedDeployment(ctx, startedDeployID, deleteDeploymentEvent); err == nil {
		t.Fatal("started deployment was deleted")
	}
	if err := store.DeleteUnstartedDeployment(ctx, unstartedDeployID, deleteDeploymentEvent); err != nil {
		t.Fatal(err)
	}

	if _, err := store.Pool().Exec(ctx, `INSERT INTO notification_channels(id,cluster_id,name,channel_type,enabled,destination_summary,encrypted_destination,destination_nonce,destination_key_version,destination_algorithm,record_version,created_at,updated_at) VALUES($1,$2,'Operations','webhook',true,'https://hooks.example.test',$3,$4,1,'AES-256-GCM',1,$5,$5)`, channelID, clusterID, []byte("ciphertext"), []byte("nonce"), now); err != nil {
		t.Fatal(err)
	}
	if _, err := store.Pool().Exec(ctx, `INSERT INTO ha_operational_events(id,cluster_id,event_type,severity,summary,details_json,occurred_at) VALUES($1,$2,'dns.failed','critical','DNS failed','{}',$3)`, haEventID, clusterID, now); err != nil {
		t.Fatal(err)
	}
	if _, err := store.Pool().Exec(ctx, `INSERT INTO notification_deliveries(id,channel_id,event_id,status,attempt_count,created_at,completed_at,channel_name) VALUES($1,$2,$3,'succeeded',1,$4,$4,'Operations')`, deliveryID, channelID, haEventID, now); err != nil {
		t.Fatal(err)
	}
	deleteChannelEvent := lifecycleEvent092("92000000-0000-4000-8000-000000000019", userID, channelID, "notification.channel_removed", now)
	if err := store.DeleteNotificationChannel(ctx, channelID, 1, deleteChannelEvent); err != nil {
		t.Fatal(err)
	}
	var channelMissing bool
	var channelName string
	if err := store.Pool().QueryRow(ctx, `SELECT channel_id IS NULL,channel_name FROM notification_deliveries WHERE id=$1`, deliveryID).Scan(&channelMissing, &channelName); err != nil || !channelMissing || channelName != "Operations" {
		t.Fatalf("delivery snapshot missing=%v name=%q err=%v", channelMissing, channelName, err)
	}
	var eventExists bool
	if err := store.Pool().QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM ha_operational_events WHERE id=$1)`, haEventID).Scan(&eventExists); err != nil || !eventExists {
		t.Fatalf("HA event retained=%v err=%v", eventExists, err)
	}
}

func revisionByID092(items []controlplane.Revision, id string) controlplane.Revision {
	for _, item := range items {
		if item.ID == id {
			return item
		}
	}
	return controlplane.Revision{}
}

func lifecycleEvent092(id, userID, resourceID, action string, at time.Time) domain.AuditEvent {
	return domain.AuditEvent{ID: id, ActorType: "user", ActorUserID: &userID, Action: action, ResourceType: "lifecycle", ResourceID: &resourceID, RequestID: "release-0.9.2-test", Metadata: map[string]any{}, CreatedAt: at}
}
