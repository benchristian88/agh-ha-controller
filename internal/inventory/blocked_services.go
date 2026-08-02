package inventory

import (
	"context"
	"fmt"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/benchristian88/agh-ha-controller/internal/configuration"
	"github.com/benchristian88/agh-ha-controller/internal/domain"
)

type BlockedServiceMetadata struct {
	ID      string `json:"id"`
	Name    string `json:"name"`
	GroupID string `json:"groupId,omitempty"`
}

type BlockedServiceGroup struct {
	ID string `json:"id"`
}

// NodeBlockedServicesCatalogue is sanitised observed metadata from one node.
// Filtering rules and upstream icon data are deliberately excluded.
type NodeBlockedServicesCatalogue struct {
	Services []BlockedServiceMetadata
	Groups   []BlockedServiceGroup
}

type MergedBlockedService struct {
	ID                 string   `json:"id"`
	Name               string   `json:"name"`
	GroupID            string   `json:"groupId,omitempty"`
	SupportedNodeIDs   []string `json:"supportedNodeIds"`
	UnsupportedNodeIDs []string `json:"unsupportedNodeIds"`
}

type BlockedServicesCatalogueNode struct {
	NodeID       string     `json:"nodeId"`
	NodeName     string     `json:"nodeName"`
	Version      string     `json:"version,omitempty"`
	Status       string     `json:"status"`
	ServiceCount int        `json:"serviceCount"`
	FetchedAt    *time.Time `json:"fetchedAt,omitempty"`
	ErrorCode    string     `json:"errorCode,omitempty"`
	catalogue    NodeBlockedServicesCatalogue
}

type BlockedServicesCatalogue struct {
	Services    []MergedBlockedService         `json:"services"`
	Groups      []BlockedServiceGroup          `json:"groups"`
	Nodes       []BlockedServicesCatalogueNode `json:"nodes"`
	GeneratedAt time.Time                      `json:"generatedAt"`
	Stale       bool                           `json:"stale"`
	Partial     bool                           `json:"partial"`
}

type catalogueCacheEntry struct {
	key       string
	catalogue NodeBlockedServicesCatalogue
	fetchedAt time.Time
}

func (s *Service) BlockedServicesCatalogue(ctx context.Context, clusterID string) (BlockedServicesCatalogue, error) {
	if !domain.ValidID(clusterID) {
		return BlockedServicesCatalogue{}, domain.Validation("clusterId", "must be a valid UUID")
	}
	if _, err := s.repository.ClusterByID(ctx, clusterID); err != nil {
		return BlockedServicesCatalogue{}, err
	}
	nodes, err := s.repository.ListNodes(ctx, clusterID)
	if err != nil {
		return BlockedServicesCatalogue{}, err
	}
	profiles, err := s.repository.CapabilityProfiles(ctx, clusterID)
	if err != nil {
		return BlockedServicesCatalogue{}, err
	}
	profilesByNode := make(map[string]CapabilityProfile, len(profiles))
	for _, profile := range profiles {
		profilesByNode[profile.NodeID] = profile
	}

	result := BlockedServicesCatalogue{
		Services: []MergedBlockedService{}, Groups: []BlockedServiceGroup{},
		Nodes: []BlockedServicesCatalogueNode{}, GeneratedAt: s.now().UTC(),
	}
	enabled := make([]domain.Node, 0, len(nodes))
	for _, node := range nodes {
		if !node.Enabled {
			continue
		}
		enabled = append(enabled, node)
	}
	items := make([]BlockedServicesCatalogueNode, len(enabled))
	var wait sync.WaitGroup
	for index, node := range enabled {
		wait.Add(1)
		go func() {
			defer wait.Done()
			items[index] = s.blockedServicesCatalogueForNode(ctx, node, profilesByNode[node.ID])
		}()
	}
	wait.Wait()
	for _, item := range items {
		if item.Status == "stale" {
			result.Stale = true
		}
		if item.Status != "available" {
			result.Partial = true
		}
		result.Nodes = append(result.Nodes, item)
	}
	mergeBlockedServicesCatalogue(&result)
	return result, nil
}

func (s *Service) blockedServicesCatalogueForNode(ctx context.Context, node domain.Node, profile CapabilityProfile) BlockedServicesCatalogueNode {
	result := BlockedServicesCatalogueNode{NodeID: node.ID, NodeName: node.Name, Version: node.Version, Status: "error"}
	reader, ok := s.reader.(BlockedServicesCatalogueReader)
	if !ok {
		result.Status, result.ErrorCode = "unsupported", "CAPABILITY_UNAVAILABLE"
		return result
	}
	key := catalogueCacheKey(node.Version, profile)
	now := s.now().UTC()
	s.catalogueMu.Lock()
	cached, cachedOK := s.catalogues[node.ID]
	if cachedOK && cached.key == key && now.Sub(cached.fetchedAt) < s.catalogueTTL {
		s.catalogueMu.Unlock()
		result.Status, result.FetchedAt, result.catalogue = "available", timePointer(cached.fetchedAt), cached.catalogue
		result.ServiceCount = len(cached.catalogue.Services)
		return result
	}
	s.catalogueMu.Unlock()

	record, err := s.repository.NodeRecordByID(ctx, node.ID)
	if err != nil {
		result.ErrorCode = errorCode(err)
		return staleCatalogueResult(result, cached, cachedOK && cached.key == key)
	}
	credentials, err := s.credentials.Decrypt(node.ID, record.Secrets.Credentials)
	if err != nil {
		result.ErrorCode = string(domain.ErrorInternal)
		return staleCatalogueResult(result, cached, cachedOK && cached.key == key)
	}
	request := domain.NodeProbeRequest{
		BaseURL: record.Node.BaseURL, CertificatePolicy: record.Node.CertificatePolicy,
		CustomCAPEM: record.Secrets.CustomCAPEM, Credentials: credentials,
	}
	catalogue, err := reader.ReadBlockedServicesCatalogue(ctx, request, node.Version)
	if err != nil {
		result.ErrorCode = errorCode(err)
		if result.ErrorCode == string(domain.ErrorCapability) {
			result.Status = "unsupported"
		}
		return staleCatalogueResult(result, cached, cachedOK && cached.key == key)
	}
	catalogue = canonicalNodeCatalogue(catalogue)
	entry := catalogueCacheEntry{key: key, catalogue: catalogue, fetchedAt: now}
	s.catalogueMu.Lock()
	s.catalogues[node.ID] = entry
	s.catalogueMu.Unlock()
	result.Status, result.FetchedAt, result.catalogue = "available", timePointer(now), catalogue
	result.ServiceCount = len(catalogue.Services)
	return result
}

func staleCatalogueResult(result BlockedServicesCatalogueNode, cached catalogueCacheEntry, usable bool) BlockedServicesCatalogueNode {
	if !usable {
		return result
	}
	result.Status, result.FetchedAt, result.catalogue = "stale", timePointer(cached.fetchedAt), cached.catalogue
	result.ServiceCount = len(cached.catalogue.Services)
	return result
}

func timePointer(value time.Time) *time.Time { return &value }

func catalogueCacheKey(version string, profile CapabilityProfile) string {
	return fmt.Sprintf("%s|%s|%s|%d|%t", version, profile.ProductVersion, profile.Compatibility, profile.SchemaVersion, profile.Features["blocked_services"])
}

func canonicalNodeCatalogue(value NodeBlockedServicesCatalogue) NodeBlockedServicesCatalogue {
	services := make(map[string]BlockedServiceMetadata, len(value.Services))
	groups := make(map[string]bool, len(value.Groups))
	for _, group := range value.Groups {
		if id := strings.TrimSpace(group.ID); id != "" {
			groups[id] = true
		}
	}
	for _, service := range value.Services {
		service.ID = strings.TrimSpace(service.ID)
		service.Name = strings.TrimSpace(service.Name)
		service.GroupID = strings.TrimSpace(service.GroupID)
		if service.ID == "" || service.Name == "" {
			continue
		}
		services[service.ID] = service
		if service.GroupID != "" {
			groups[service.GroupID] = true
		}
	}
	value.Services = value.Services[:0]
	for _, service := range services {
		value.Services = append(value.Services, service)
	}
	sort.Slice(value.Services, func(i, j int) bool { return value.Services[i].ID < value.Services[j].ID })
	value.Groups = value.Groups[:0]
	for id := range groups {
		value.Groups = append(value.Groups, BlockedServiceGroup{ID: id})
	}
	sort.Slice(value.Groups, func(i, j int) bool { return value.Groups[i].ID < value.Groups[j].ID })
	return value
}

type serviceMerge struct {
	names  map[string]int
	groups map[string]int
	nodes  map[string]bool
}

func mergeBlockedServicesCatalogue(result *BlockedServicesCatalogue) {
	merged := map[string]*serviceMerge{}
	groupIDs := map[string]bool{}
	availableNodeIDs := []string{}
	for index := range result.Nodes {
		node := &result.Nodes[index]
		if node.Status != "available" && node.Status != "stale" {
			continue
		}
		availableNodeIDs = append(availableNodeIDs, node.NodeID)
		for _, group := range node.catalogue.Groups {
			groupIDs[group.ID] = true
		}
		for _, service := range node.catalogue.Services {
			item := merged[service.ID]
			if item == nil {
				item = &serviceMerge{names: map[string]int{}, groups: map[string]int{}, nodes: map[string]bool{}}
				merged[service.ID] = item
			}
			item.names[service.Name]++
			if service.GroupID != "" {
				item.groups[service.GroupID]++
				groupIDs[service.GroupID] = true
			}
			item.nodes[node.NodeID] = true
		}
	}
	for id, item := range merged {
		service := MergedBlockedService{ID: id, Name: mostCommon(item.names), GroupID: mostCommon(item.groups), SupportedNodeIDs: []string{}, UnsupportedNodeIDs: []string{}}
		for _, nodeID := range availableNodeIDs {
			if item.nodes[nodeID] {
				service.SupportedNodeIDs = append(service.SupportedNodeIDs, nodeID)
			} else {
				service.UnsupportedNodeIDs = append(service.UnsupportedNodeIDs, nodeID)
			}
		}
		sort.Strings(service.SupportedNodeIDs)
		sort.Strings(service.UnsupportedNodeIDs)
		result.Services = append(result.Services, service)
	}
	sort.Slice(result.Services, func(i, j int) bool {
		return strings.ToLower(result.Services[i].Name) < strings.ToLower(result.Services[j].Name)
	})
	for id := range groupIDs {
		result.Groups = append(result.Groups, BlockedServiceGroup{ID: id})
	}
	sort.Slice(result.Groups, func(i, j int) bool { return result.Groups[i].ID < result.Groups[j].ID })
}

func mostCommon(values map[string]int) string {
	best, count := "", 0
	for value, valueCount := range values {
		if valueCount > count || (valueCount == count && value < best) {
			best, count = value, valueCount
		}
	}
	return best
}

func (s *Service) ValidateBlockedServiceIDs(ctx context.Context, clusterID string, ids []string) ([]configuration.ValidationIssue, error) {
	if len(ids) == 0 {
		return nil, nil
	}
	catalogue, err := s.BlockedServicesCatalogue(ctx, clusterID)
	if err != nil {
		return nil, err
	}
	support := map[string]map[string]bool{}
	for _, service := range catalogue.Services {
		support[service.ID] = map[string]bool{}
		for _, nodeID := range service.SupportedNodeIDs {
			support[service.ID][nodeID] = true
		}
	}
	issues := []configuration.ValidationIssue{}
	seen := map[string]bool{}
	for _, node := range catalogue.Nodes {
		if node.Status != "available" {
			issues = append(issues, configuration.ValidationIssue{Field: "nodes." + node.NodeID + ".blockedServices", Message: fmt.Sprintf("A current blocked-services catalogue is required for node %q.", node.NodeName)})
			continue
		}
		for _, id := range ids {
			id = strings.TrimSpace(id)
			key := node.NodeID + "\x00" + id
			if id == "" || seen[key] {
				continue
			}
			seen[key] = true
			if !support[id][node.NodeID] {
				issues = append(issues, configuration.ValidationIssue{Field: "nodes." + node.NodeID + ".blockedServices", Message: fmt.Sprintf("Blocked service %q is not supported by node %q.", id, node.NodeName)})
			}
		}
	}
	return issues, nil
}
