package operations

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/benchristian88/atlas-dns/internal/auth"
	"github.com/benchristian88/atlas-dns/internal/configuration"
	"github.com/benchristian88/atlas-dns/internal/domain"
	"github.com/benchristian88/atlas-dns/internal/inventory"
)

const (
	testClusterID = "11111111-1111-4111-8111-111111111111"
	testNodeA     = "22222222-2222-4222-8222-222222222222"
	testNodeB     = "33333333-3333-4333-8333-333333333333"
	testUserID    = "44444444-4444-4444-8444-444444444444"
	testRequestID = "request-9c-1"
	testKey       = "55555555-5555-4555-8555-555555555555"
)

type operationRepositoryFake struct {
	operation Operation
	events    []domain.AuditEvent
	nodes     []domain.Node
	profiles  []inventory.CapabilityProfile
	records   map[string]domain.NodeRecord
}

func (r *operationRepositoryFake) ClusterByID(context.Context, string) (domain.Cluster, error) {
	return domain.Cluster{ID: testClusterID, Name: "Home"}, nil
}
func (r *operationRepositoryFake) ListNodes(context.Context, string) ([]domain.Node, error) {
	return r.nodes, nil
}
func (r *operationRepositoryFake) CapabilityProfiles(context.Context, string) ([]inventory.CapabilityProfile, error) {
	return r.profiles, nil
}
func (r *operationRepositoryFake) CreateOperationalCommand(_ context.Context, operation Operation, event domain.AuditEvent) (Operation, bool, error) {
	if r.operation.ID != "" {
		return r.operation, false, nil
	}
	r.operation = operation
	r.events = append(r.events, event)
	return operation, true, nil
}
func (r *operationRepositoryFake) OperationalCommandByID(context.Context, string) (Operation, error) {
	return r.operation, nil
}
func (r *operationRepositoryFake) ListOperationalCommands(context.Context, string, Command, int) ([]Operation, error) {
	return []Operation{r.operation}, nil
}
func (r *operationRepositoryFake) ClaimOperationalCommand(_ context.Context, at time.Time) (Operation, error) {
	if r.operation.Status != "queued" {
		return Operation{}, domain.ErrNoWork
	}
	r.operation.Status, r.operation.StartedAt = "running", &at
	return r.operation, nil
}
func (r *operationRepositoryFake) RunningOperationalCommands(context.Context) ([]Operation, error) {
	if r.operation.Status == "running" {
		return []Operation{r.operation}, nil
	}
	return nil, nil
}
func (r *operationRepositoryFake) NodeRecordByID(_ context.Context, id string) (domain.NodeRecord, error) {
	return r.records[id], nil
}
func (r *operationRepositoryFake) UpdateOperationalCommandNode(_ context.Context, _ string, node NodeResult) error {
	for index := range r.operation.NodeResults {
		if r.operation.NodeResults[index].ID == node.ID {
			r.operation.NodeResults[index] = node
		}
	}
	return nil
}
func (r *operationRepositoryFake) FinishOperationalCommand(_ context.Context, operation Operation, event domain.AuditEvent) error {
	r.operation = operation
	r.events = append(r.events, event)
	return nil
}

type credentialFake struct{}

func (credentialFake) Decrypt(string, domain.EncryptedCredentials) (domain.NodeCredentials, error) {
	return domain.NodeCredentials{Username: "operator", Password: "secret"}, nil
}

type dnsExecutorFake struct{}

func (dnsExecutorFake) TestUpstreamDNS(_ context.Context, request domain.NodeProbeRequest, _ UpstreamInput) ([]ResolverResult, error) {
	if strings.Contains(request.BaseURL, "secondary") {
		return nil, domain.NewError(domain.ErrorNodeUnreachable, "private network detail")
	}
	return []ResolverResult{{ResolverID: "upstream-1", Status: "succeeded"}}, nil
}
func (dnsExecutorFake) TestHostFiltering(_ context.Context, request domain.NodeProbeRequest, _ HostFilterInput) (HostFilterResult, error) {
	if strings.Contains(request.BaseURL, "secondary") {
		return HostFilterResult{}, domain.NewError(domain.ErrorNodeUnreachable, "private network detail")
	}
	return HostFilterResult{Matched: true, Reason: "FilteredBlackList", Rules: []MatchedRule{{Text: "||ads.test^", FilterListID: 1}}}, nil
}
func (dnsExecutorFake) ClearDNSCache(context.Context, domain.NodeProbeRequest) error { return nil }
func (dnsExecutorFake) ClearQueryLog(_ context.Context, request domain.NodeProbeRequest) error {
	if strings.Contains(request.BaseURL, "secondary") {
		return domain.NewError(domain.ErrorNodeUnreachable, "private query-log error")
	}
	return nil
}
func (dnsExecutorFake) ResetStatistics(_ context.Context, request domain.NodeProbeRequest) error {
	if strings.Contains(request.BaseURL, "secondary") {
		return domain.NewError(domain.ErrorNodeResponse, "private statistics response")
	}
	return nil
}

type observerFake struct{}

func (observerFake) Observe(context.Context, string) (inventory.Snapshot, error) {
	return inventory.Snapshot{ID: "66666666-6666-4666-8666-666666666666"}, nil
}

func operationFixture(t *testing.T) (*Service, *operationRepositoryFake, *auth.CredentialCipher) {
	t.Helper()
	nodes := []domain.Node{
		{ID: testNodeA, ClusterID: testClusterID, Name: "Primary", BaseURL: "http://primary.test", Enabled: true},
		{ID: testNodeB, ClusterID: testClusterID, Name: "Secondary", BaseURL: "http://secondary.test", Enabled: true},
	}
	profiles := []inventory.CapabilityProfile{
		{NodeID: testNodeA, Compatibility: string(domain.CompatibilitySupported), SchemaVersion: configuration.SchemaVersion, Features: map[string]bool{"test_upstream_dns": true, "test_host_filtering": true, "test_host_filtering_context": true, "cache_clear": true, "querylog_clear": true, "stats_reset": true}},
		{NodeID: testNodeB, Compatibility: string(domain.CompatibilitySupported), SchemaVersion: configuration.SchemaVersion, Features: map[string]bool{"test_upstream_dns": true, "test_host_filtering": true, "test_host_filtering_context": true, "cache_clear": true, "querylog_clear": true, "stats_reset": true}},
	}
	repository := &operationRepositoryFake{nodes: nodes, profiles: profiles, records: map[string]domain.NodeRecord{
		testNodeA: {Node: nodes[0]}, testNodeB: {Node: nodes[1]},
	}}
	cipher, err := auth.NewCredentialCipher([]byte("01234567890123456789012345678901"))
	if err != nil {
		t.Fatal(err)
	}
	return NewService(repository, cipher), repository, cipher
}

func TestStartUpstreamTestEncryptsInputAuditsSafelyAndDeduplicates(t *testing.T) {
	service, repository, cipher := operationFixture(t)
	input := UpstreamInput{DraftVersion: 4, UpstreamDNS: []string{"https://user:private@dns.example/dns-query"}, UpstreamMode: "parallel"}
	actor := domain.Actor{UserID: testUserID, RequestID: testRequestID}
	operation, err := service.StartUpstreamTest(context.Background(), actor, testClusterID, Target{Scope: "all_compatible_enabled_nodes"}, input, testKey)
	if err != nil {
		t.Fatal(err)
	}
	if operation.Status != "queued" || len(operation.NodeResults) != 2 || len(operation.Payload.Ciphertext) == 0 {
		t.Fatalf("operation=%#v", operation)
	}
	plaintext, err := cipher.DecryptPayload(operation.ID, operation.Payload)
	if err != nil || !strings.Contains(string(plaintext), "private") {
		t.Fatalf("decrypted=%q err=%v", plaintext, err)
	}
	audit, _ := json.Marshal(repository.events)
	if strings.Contains(string(audit), "private") || strings.Contains(string(audit), "dns.example") {
		t.Fatalf("audit leaked upstream input: %s", audit)
	}
	duplicate, err := service.StartUpstreamTest(context.Background(), actor, testClusterID, Target{Scope: "all_compatible_enabled_nodes"}, input, testKey)
	if err != nil || !duplicate.Duplicate || duplicate.ID != operation.ID {
		t.Fatalf("duplicate=%#v err=%v", duplicate, err)
	}
}

func TestExecutorReturnsNodeAttributedPartialSuccessWithoutUnsafeErrors(t *testing.T) {
	service, repository, cipher := operationFixture(t)
	_, err := service.StartUpstreamTest(context.Background(), domain.Actor{UserID: testUserID, RequestID: testRequestID}, testClusterID, Target{Scope: "all_compatible_enabled_nodes"}, UpstreamInput{DraftVersion: 4, UpstreamDNS: []string{"1.1.1.1"}, UpstreamMode: "load_balance"}, testKey)
	if err != nil {
		t.Fatal(err)
	}
	executor := NewExecutor(repository, credentialFake{}, cipher, dnsExecutorFake{}, observerFake{})
	worked, err := executor.RunOnce(context.Background())
	if err != nil || !worked {
		t.Fatalf("worked=%t err=%v", worked, err)
	}
	if repository.operation.Status != "partial_success" || repository.operation.NodeResults[0].Status != "succeeded" || repository.operation.NodeResults[1].ErrorCode != string(domain.ErrorNodeUnreachable) {
		t.Fatalf("operation=%#v", repository.operation)
	}
	events, _ := json.Marshal(repository.events)
	if strings.Contains(string(events), "private network detail") || !strings.Contains(string(events), "dns.test_upstream_partially_succeeded") {
		t.Fatalf("events=%s", events)
	}
}

func TestScopeCapabilityConfirmationAndValidation(t *testing.T) {
	service, repository, _ := operationFixture(t)
	repository.profiles[1].Features["cache_clear"] = false
	actor := domain.Actor{UserID: testUserID, RequestID: testRequestID}
	operation, err := service.StartCacheClear(context.Background(), actor, testClusterID, Target{Scope: "all_compatible_enabled_nodes"}, ClearDNSCacheConfirmation, testKey)
	if err != nil || len(operation.NodeResults) != 1 || len(operation.ExcludedNodes) != 1 {
		t.Fatalf("operation=%#v err=%v", operation, err)
	}
	other, otherRepository, _ := operationFixture(t)
	otherRepository.profiles[0].Features["cache_clear"] = false
	_, err = other.StartCacheClear(context.Background(), actor, testClusterID, Target{Scope: "node", NodeID: testNodeA}, ClearDNSCacheConfirmation, "77777777-7777-4777-8777-777777777777")
	var domainError *domain.Error
	if !errors.As(err, &domainError) || domainError.Kind != domain.ErrorCapability {
		t.Fatalf("capability error=%v", err)
	}
	if _, err := service.StartCacheClear(context.Background(), actor, testClusterID, Target{Scope: "node", NodeID: testNodeA}, "wrong", "88888888-8888-4888-8888-888888888888"); err == nil {
		t.Fatal("cache clear accepted an inaccurate confirmation")
	}
}

func TestRecoverInterruptedDoesNotReplayAnUncertainNodeCommand(t *testing.T) {
	service, repository, cipher := operationFixture(t)
	_, err := service.StartCacheClear(context.Background(), domain.Actor{UserID: testUserID, RequestID: testRequestID}, testClusterID, Target{Scope: "node", NodeID: testNodeA}, ClearDNSCacheConfirmation, testKey)
	if err != nil {
		t.Fatal(err)
	}
	now := time.Now().UTC()
	repository.operation.Status = "running"
	repository.operation.StartedAt = &now
	repository.operation.NodeResults[0].Status = "running"
	repository.operation.NodeResults[0].StartedAt = &now
	executor := NewExecutor(repository, credentialFake{}, cipher, dnsExecutorFake{}, observerFake{})
	if err := executor.RecoverInterrupted(context.Background()); err != nil {
		t.Fatal(err)
	}
	if repository.operation.Status != "interrupted" || repository.operation.NodeResults[0].ErrorCode != "OPERATION_INTERRUPTED" {
		t.Fatalf("operation=%#v", repository.operation)
	}
	events, _ := json.Marshal(repository.events)
	if !strings.Contains(string(events), `"automaticReplay":false`) {
		t.Fatalf("recovery audit=%s", events)
	}
}

func TestHostFilterTestEncryptsInputAuditsRedactedAndReturnsNodeResults(t *testing.T) {
	service, repository, cipher := operationFixture(t)
	input := HostFilterInput{Hostname: "private.internal", Client: "secret-client", QueryType: "aaaa"}
	actor := domain.Actor{UserID: testUserID, RequestID: testRequestID}
	operation, err := service.StartHostFilterTest(context.Background(), actor, testClusterID, Target{Scope: "all_compatible_enabled_nodes"}, input, testKey)
	if err != nil {
		t.Fatal(err)
	}
	plaintext, err := cipher.DecryptPayload(operation.ID, operation.Payload)
	if err != nil || !strings.Contains(string(plaintext), "private.internal") || !strings.Contains(string(plaintext), `"queryType":"AAAA"`) {
		t.Fatalf("plaintext=%q err=%v", plaintext, err)
	}
	audit, _ := json.Marshal(repository.events)
	if strings.Contains(string(audit), "private.internal") || strings.Contains(string(audit), "secret-client") || !strings.Contains(string(audit), "filtering.test_host_requested") {
		t.Fatalf("audit=%s", audit)
	}
	duplicate, err := service.StartHostFilterTest(context.Background(), actor, testClusterID, Target{Scope: "all_compatible_enabled_nodes"}, input, testKey)
	if err != nil || !duplicate.Duplicate || duplicate.ID != operation.ID {
		t.Fatalf("duplicate=%#v err=%v", duplicate, err)
	}
	executor := NewExecutor(repository, credentialFake{}, cipher, dnsExecutorFake{}, observerFake{})
	if worked, err := executor.RunOnce(context.Background()); err != nil || !worked {
		t.Fatalf("worked=%t err=%v", worked, err)
	}
	if repository.operation.Status != "partial_success" || repository.operation.NodeResults[0].HostFilterResult == nil || repository.operation.NodeResults[0].HostFilterResult.Rules[0].Text != "||ads.test^" || repository.operation.NodeResults[1].ErrorCode != string(domain.ErrorNodeUnreachable) {
		t.Fatalf("operation=%#v", repository.operation)
	}
	terminalAudit, _ := json.Marshal(repository.events)
	if strings.Contains(string(terminalAudit), "private network detail") || !strings.Contains(string(terminalAudit), "filtering.test_host_partially_succeeded") {
		t.Fatalf("audit=%s", terminalAudit)
	}
}

func TestHostFilterOptionalContextRequiresPatchCapability(t *testing.T) {
	service, repository, _ := operationFixture(t)
	repository.profiles[1].Features["test_host_filtering_context"] = false
	actor := domain.Actor{UserID: testUserID, RequestID: testRequestID}
	operation, err := service.StartHostFilterTest(context.Background(), actor, testClusterID, Target{Scope: "all_compatible_enabled_nodes"}, HostFilterInput{Hostname: "example.org", QueryType: "A"}, testKey)
	if err != nil || len(operation.NodeResults) != 1 || len(operation.ExcludedNodes) != 1 {
		t.Fatalf("operation=%#v err=%v", operation, err)
	}
	_, err = service.StartHostFilterTest(context.Background(), actor, testClusterID, Target{Scope: "node", NodeID: testNodeB}, HostFilterInput{Hostname: "example.org", Client: "client"}, "99999999-9999-4999-8999-999999999999")
	var domainError *domain.Error
	if !errors.As(err, &domainError) || domainError.Kind != domain.ErrorCapability {
		t.Fatalf("error=%v", err)
	}
	if _, err := service.StartHostFilterTest(context.Background(), actor, testClusterID, Target{Scope: "node", NodeID: testNodeA}, HostFilterInput{Hostname: "https://example.org/path"}, "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"); err == nil {
		t.Fatal("invalid host was accepted")
	}
}

func TestQueryLogClearRequiresConfirmationDeduplicatesAuditsAndReturnsPartialResults(t *testing.T) {
	service, repository, cipher := operationFixture(t)
	actor := domain.Actor{UserID: testUserID, RequestID: testRequestID}
	if _, err := service.StartQueryLogClear(context.Background(), actor, testClusterID, Target{Scope: "node", NodeID: testNodeA}, "wrong", testKey); err == nil {
		t.Fatal("query-log clear accepted an inaccurate confirmation")
	}
	operation, err := service.StartQueryLogClear(context.Background(), actor, testClusterID, Target{Scope: "all_compatible_enabled_nodes"}, ClearQueryLogConfirmation, testKey)
	if err != nil {
		t.Fatal(err)
	}
	duplicate, err := service.StartQueryLogClear(context.Background(), actor, testClusterID, Target{Scope: "all_compatible_enabled_nodes"}, ClearQueryLogConfirmation, testKey)
	if err != nil || !duplicate.Duplicate || duplicate.ID != operation.ID {
		t.Fatalf("duplicate=%#v err=%v", duplicate, err)
	}
	executor := NewExecutor(repository, credentialFake{}, cipher, dnsExecutorFake{}, observerFake{})
	if worked, err := executor.RunOnce(context.Background()); err != nil || !worked {
		t.Fatalf("worked=%t err=%v", worked, err)
	}
	if repository.operation.Status != "partial_success" || repository.operation.NodeResults[0].ObservationStatus != "succeeded" || repository.operation.NodeResults[1].ErrorCode != string(domain.ErrorNodeUnreachable) {
		t.Fatalf("operation=%#v", repository.operation)
	}
	events, _ := json.Marshal(repository.events)
	if strings.Contains(string(events), "private query-log error") || !strings.Contains(string(events), "querylog.clear_requested") || !strings.Contains(string(events), "querylog.clear_partially_succeeded") {
		t.Fatalf("events=%s", events)
	}
}

func TestStatisticsResetConfirmationCapabilityAndSuccess(t *testing.T) {
	service, repository, cipher := operationFixture(t)
	actor := domain.Actor{UserID: testUserID, RequestID: testRequestID}
	if _, err := service.StartStatisticsReset(context.Background(), actor, testClusterID, Target{Scope: "node", NodeID: testNodeA}, "wrong", testKey); err == nil {
		t.Fatal("statistics reset accepted an inaccurate confirmation")
	}
	repository.profiles[1].Features["stats_reset"] = false
	operation, err := service.StartStatisticsReset(context.Background(), actor, testClusterID, Target{Scope: "all_compatible_enabled_nodes"}, ResetStatisticsConfirmation, testKey)
	if err != nil || len(operation.NodeResults) != 1 || len(operation.ExcludedNodes) != 1 {
		t.Fatalf("operation=%#v err=%v", operation, err)
	}
	executor := NewExecutor(repository, credentialFake{}, cipher, dnsExecutorFake{}, observerFake{})
	if worked, err := executor.RunOnce(context.Background()); err != nil || !worked {
		t.Fatalf("worked=%t err=%v", worked, err)
	}
	if repository.operation.Status != "succeeded" || repository.operation.NodeResults[0].ObservationStatus != "succeeded" {
		t.Fatalf("operation=%#v", repository.operation)
	}
	events, _ := json.Marshal(repository.events)
	if !strings.Contains(string(events), "statistics.reset_succeeded") {
		t.Fatalf("events=%s", events)
	}

	other, otherRepository, _ := operationFixture(t)
	otherRepository.profiles[0].Features["stats_reset"] = false
	_, err = other.StartStatisticsReset(context.Background(), actor, testClusterID, Target{Scope: "node", NodeID: testNodeA}, ResetStatisticsConfirmation, "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb")
	var domainError *domain.Error
	if !errors.As(err, &domainError) || domainError.Kind != domain.ErrorCapability {
		t.Fatalf("error=%v", err)
	}
}
