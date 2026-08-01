package inventory

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/benchristian88/agh-ha-controller/internal/domain"
)

type blocklistReaderFake struct {
	unusedReader
	byURL  map[string][]FilterListMetadata
	errors map[string]error
}

func (f *blocklistReaderFake) ReadBlocklists(_ context.Context, request domain.NodeProbeRequest, _ string) ([]FilterListMetadata, error) {
	if err := f.errors[request.BaseURL]; err != nil {
		return nil, err
	}
	return f.byURL[request.BaseURL], nil
}

func TestBlocklistPresentationKeepsNodeMetadataSeparateAndPartial(t *testing.T) {
	nodeA, recordA, profileA := catalogueNode("22222222-2222-4222-8222-222222222222", "Primary", "v0.107.78", "http://primary.test")
	nodeB, recordB, profileB := catalogueNode("33333333-3333-4333-8333-333333333333", "Secondary", "v0.107.61", "http://secondary.test")
	profileA.Features["filtering"], profileB.Features["filtering"] = true, true
	repository := &fakeRepository{
		nodes: []domain.Node{nodeA, nodeB}, profiles: []CapabilityProfile{profileA, profileB},
		nodeRecords: map[string]domain.NodeRecord{nodeA.ID: recordA, nodeB.ID: recordB},
	}
	updated := time.Date(2026, 8, 1, 1, 2, 3, 0, time.FixedZone("node", 12*60*60))
	reader := &blocklistReaderFake{
		byURL: map[string][]FilterListMetadata{
			recordA.Node.BaseURL: {
				{ID: 7, URL: "https://filters.test/list.txt", Name: "Primary name", Enabled: true, RulesCount: 321, LastUpdated: &updated},
				{ID: 8, URL: "/opt/adguard/local.txt", Name: "Local list", Enabled: false, RulesCount: 4},
			},
		},
		errors: map[string]error{recordB.Node.BaseURL: errors.New("node unavailable")},
	}
	service := NewService(repository, unusedCredentials{}, reader)
	presentation, err := service.BlocklistPresentation(context.Background(), catalogueClusterID)
	if err != nil {
		t.Fatal(err)
	}
	if !presentation.Partial || presentation.Stale || len(presentation.Nodes) != 2 || presentation.Nodes[1].Status != "error" {
		t.Fatalf("unexpected partial presentation: %#v", presentation)
	}
	lists := presentation.Nodes[0].Lists
	if len(lists) != 2 || lists[0].Portable || !lists[1].Portable {
		t.Fatalf("portable URL classification or disabled metadata was lost: %#v", lists)
	}
	if lists[1].LastUpdated == nil || lists[1].LastUpdated.Location() != time.UTC {
		t.Fatalf("last-updated metadata was not canonicalised to UTC: %#v", lists[1])
	}
}

func TestBlocklistPresentationFallsBackToStaleNodeMetadata(t *testing.T) {
	node, record, profile := catalogueNode("22222222-2222-4222-8222-222222222222", "Primary", "v0.107.78", "http://primary.test")
	profile.Features["filtering"] = true
	repository := &fakeRepository{nodes: []domain.Node{node}, profiles: []CapabilityProfile{profile}, nodeRecords: map[string]domain.NodeRecord{node.ID: record}}
	reader := &blocklistReaderFake{byURL: map[string][]FilterListMetadata{record.Node.BaseURL: {{URL: "https://filters.test/list.txt", Enabled: true}}}, errors: map[string]error{}}
	service := NewService(repository, unusedCredentials{}, reader)
	service.blocklistTTL = 0

	if _, err := service.BlocklistPresentation(context.Background(), catalogueClusterID); err != nil {
		t.Fatal(err)
	}
	reader.errors[record.Node.BaseURL] = errors.New("node unavailable")
	presentation, err := service.BlocklistPresentation(context.Background(), catalogueClusterID)
	if err != nil {
		t.Fatal(err)
	}
	if !presentation.Partial || !presentation.Stale || presentation.Nodes[0].Status != "stale" || len(presentation.Nodes[0].Lists) != 1 {
		t.Fatalf("cached metadata was not returned as stale: %#v", presentation)
	}
}
