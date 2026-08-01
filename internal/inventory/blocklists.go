package inventory

import (
	"context"
	"fmt"
	"net/url"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/benchristian88/agh-ha-controller/internal/domain"
)

// FilterListMetadata is volatile node-reported presentation data. It is kept
// outside configuration documents so names, counters, IDs, and timestamps can
// never affect desired hashes, immutable revisions, or drift comparison.
type FilterListMetadata struct {
	ID          int64      `json:"id"`
	URL         string     `json:"url"`
	Name        string     `json:"name"`
	Enabled     bool       `json:"enabled"`
	RulesCount  int64      `json:"ruleCount"`
	LastUpdated *time.Time `json:"lastUpdated,omitempty"`
	Portable    bool       `json:"portable"`
}

type BlocklistNodePresentation struct {
	NodeID    string               `json:"nodeId"`
	NodeName  string               `json:"nodeName"`
	Version   string               `json:"version,omitempty"`
	Status    string               `json:"status"`
	FetchedAt *time.Time           `json:"fetchedAt,omitempty"`
	ErrorCode string               `json:"errorCode,omitempty"`
	Lists     []FilterListMetadata `json:"lists"`
}

type BlocklistPresentation struct {
	Nodes       []BlocklistNodePresentation `json:"nodes"`
	GeneratedAt time.Time                   `json:"generatedAt"`
	Stale       bool                        `json:"stale"`
	Partial     bool                        `json:"partial"`
}

type blocklistCacheEntry struct {
	key       string
	lists     []FilterListMetadata
	fetchedAt time.Time
}

func (s *Service) BlocklistPresentation(ctx context.Context, clusterID string) (BlocklistPresentation, error) {
	if !domain.ValidID(clusterID) {
		return BlocklistPresentation{}, domain.Validation("clusterId", "must be a valid UUID")
	}
	if _, err := s.repository.ClusterByID(ctx, clusterID); err != nil {
		return BlocklistPresentation{}, err
	}
	nodes, err := s.repository.ListNodes(ctx, clusterID)
	if err != nil {
		return BlocklistPresentation{}, err
	}
	profiles, err := s.repository.CapabilityProfiles(ctx, clusterID)
	if err != nil {
		return BlocklistPresentation{}, err
	}
	profilesByNode := make(map[string]CapabilityProfile, len(profiles))
	for _, profile := range profiles {
		profilesByNode[profile.NodeID] = profile
	}

	enabled := make([]domain.Node, 0, len(nodes))
	for _, node := range nodes {
		if node.Enabled {
			enabled = append(enabled, node)
		}
	}
	result := BlocklistPresentation{Nodes: make([]BlocklistNodePresentation, len(enabled)), GeneratedAt: s.now().UTC()}
	var wait sync.WaitGroup
	for index, node := range enabled {
		wait.Add(1)
		go func() {
			defer wait.Done()
			result.Nodes[index] = s.blocklistPresentationForNode(ctx, node, profilesByNode[node.ID])
		}()
	}
	wait.Wait()
	for _, node := range result.Nodes {
		if node.Status == "stale" {
			result.Stale = true
		}
		if node.Status != "available" {
			result.Partial = true
		}
	}
	return result, nil
}

func (s *Service) blocklistPresentationForNode(ctx context.Context, node domain.Node, profile CapabilityProfile) BlocklistNodePresentation {
	result := BlocklistNodePresentation{NodeID: node.ID, NodeName: node.Name, Version: node.Version, Status: "error", Lists: []FilterListMetadata{}}
	reader, ok := s.reader.(BlocklistReader)
	if !ok {
		result.Status, result.ErrorCode = "unsupported", "CAPABILITY_UNAVAILABLE"
		return result
	}
	key := fmt.Sprintf("%s|%s|%s|%d|%t", node.Version, profile.ProductVersion, profile.Compatibility, profile.SchemaVersion, profile.Features["filtering"])
	now := s.now().UTC()
	s.blocklistMu.Lock()
	cached, cachedOK := s.blocklists[node.ID]
	if cachedOK && cached.key == key && now.Sub(cached.fetchedAt) < s.blocklistTTL {
		s.blocklistMu.Unlock()
		result.Status, result.FetchedAt = "available", timePointer(cached.fetchedAt)
		result.Lists = cloneFilterLists(cached.lists)
		return result
	}
	s.blocklistMu.Unlock()

	record, err := s.repository.NodeRecordByID(ctx, node.ID)
	if err != nil {
		result.ErrorCode = errorCode(err)
		return staleBlocklistResult(result, cached, cachedOK && cached.key == key)
	}
	credentials, err := s.credentials.Decrypt(node.ID, record.Secrets.Credentials)
	if err != nil {
		result.ErrorCode = string(domain.ErrorInternal)
		return staleBlocklistResult(result, cached, cachedOK && cached.key == key)
	}
	request := domain.NodeProbeRequest{BaseURL: record.Node.BaseURL, CertificatePolicy: record.Node.CertificatePolicy, CustomCAPEM: record.Secrets.CustomCAPEM, Credentials: credentials}
	lists, err := reader.ReadBlocklists(ctx, request, node.Version)
	if err != nil {
		result.ErrorCode = errorCode(err)
		if result.ErrorCode == string(domain.ErrorCapability) {
			result.Status = "unsupported"
		}
		return staleBlocklistResult(result, cached, cachedOK && cached.key == key)
	}
	lists = canonicalFilterLists(lists)
	entry := blocklistCacheEntry{key: key, lists: cloneFilterLists(lists), fetchedAt: now}
	s.blocklistMu.Lock()
	s.blocklists[node.ID] = entry
	s.blocklistMu.Unlock()
	result.Status, result.FetchedAt, result.Lists = "available", timePointer(now), lists
	return result
}

func staleBlocklistResult(result BlocklistNodePresentation, cached blocklistCacheEntry, usable bool) BlocklistNodePresentation {
	if !usable {
		return result
	}
	result.Status, result.FetchedAt, result.Lists = "stale", timePointer(cached.fetchedAt), cloneFilterLists(cached.lists)
	return result
}

func canonicalFilterLists(lists []FilterListMetadata) []FilterListMetadata {
	result := make([]FilterListMetadata, 0, len(lists))
	seen := map[string]bool{}
	for _, list := range lists {
		list.URL, list.Name = strings.TrimSpace(list.URL), strings.TrimSpace(list.Name)
		if list.URL == "" || len(list.URL) > 4096 || len(list.Name) > 500 || list.RulesCount < 0 {
			continue
		}
		key := strings.ToLower(list.URL)
		if seen[key] {
			continue
		}
		seen[key] = true
		parsed, err := url.Parse(list.URL)
		list.Portable = err == nil && parsed.Host != "" && (parsed.Scheme == "http" || parsed.Scheme == "https")
		if list.LastUpdated != nil {
			value := list.LastUpdated.UTC()
			list.LastUpdated = &value
		}
		result = append(result, list)
	}
	sort.Slice(result, func(i, j int) bool { return strings.ToLower(result[i].URL) < strings.ToLower(result[j].URL) })
	return result
}

func cloneFilterLists(lists []FilterListMetadata) []FilterListMetadata {
	return append([]FilterListMetadata(nil), lists...)
}
