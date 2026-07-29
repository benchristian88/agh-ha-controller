package configuration

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/netip"
	"net/url"
	"sort"
	"strings"
)

const SchemaVersion = 1

type Document struct {
	SchemaVersion int           `json:"schemaVersion"`
	Shared        Shared        `json:"shared"`
	NodeSpecific  NodeSpecific  `json:"nodeSpecific"`
	ObservedOnly  ObservedOnly  `json:"observedOnly"`
	Unsupported   []Unsupported `json:"unsupported"`
}

// DesiredDocument is authoritative cluster intent.  Observed Document remains
// the frozen Release 0.2 per-node shape; keeping the two types distinct stops
// node-generated and observed-only values from becoming desired state.
type DesiredDocument struct {
	SchemaVersion int                     `json:"schemaVersion"`
	Shared        Shared                  `json:"shared"`
	NodeOverrides map[string]NodeSpecific `json:"nodeOverrides"`
	Unsupported   []Unsupported           `json:"unsupported"`
}

type Shared struct {
	DNS       DNS       `json:"dns"`
	Filtering Filtering `json:"filtering"`
}

type DNS struct {
	UpstreamDNS       []string `json:"upstreamDns"`
	BootstrapDNS      []string `json:"bootstrapDns"`
	FallbackDNS       []string `json:"fallbackDns"`
	PrivateReverseDNS []string `json:"privateReverseDns"`
}

type Filtering struct {
	Enabled        bool     `json:"enabled"`
	UpdateInterval int      `json:"updateIntervalHours"`
	FilterURLs     []string `json:"filterUrls"`
	UserRules      []string `json:"userRules"`
}

type NodeSpecific struct {
	BindHosts []string `json:"bindHosts"`
	DNSPort   int      `json:"dnsPort"`
}

type ObservedOnly struct {
	ProductVersion string `json:"productVersion"`
}

type Unsupported struct {
	Section string `json:"section"`
	Reason  string `json:"reason"`
}

type Ownership string

const (
	SharedManaged    Ownership = "shared_managed"
	NodeManaged      Ownership = "node_specific_managed"
	Observed         Ownership = "observed_only"
	UnsupportedField Ownership = "unsupported"
)

type Difference struct {
	Section string    `json:"section"`
	Field   string    `json:"field"`
	Scope   Ownership `json:"scope"`
	Left    any       `json:"left"`
	Right   any       `json:"right"`
	Summary string    `json:"summary"`
}

func Canonicalise(document Document) Document {
	document.SchemaVersion = SchemaVersion
	document.Shared.DNS.UpstreamDNS = cleanOrdered(document.Shared.DNS.UpstreamDNS)
	document.Shared.DNS.BootstrapDNS = cleanSet(document.Shared.DNS.BootstrapDNS)
	document.Shared.DNS.FallbackDNS = cleanOrdered(document.Shared.DNS.FallbackDNS)
	document.Shared.DNS.PrivateReverseDNS = cleanSet(document.Shared.DNS.PrivateReverseDNS)
	document.Shared.Filtering.FilterURLs = cleanSet(document.Shared.Filtering.FilterURLs)
	document.Shared.Filtering.UserRules = cleanOrdered(document.Shared.Filtering.UserRules)
	document.NodeSpecific.BindHosts = cleanSet(document.NodeSpecific.BindHosts)
	sort.Slice(document.Unsupported, func(i, j int) bool {
		if document.Unsupported[i].Section == document.Unsupported[j].Section {
			return document.Unsupported[i].Reason < document.Unsupported[j].Reason
		}
		return document.Unsupported[i].Section < document.Unsupported[j].Section
	})
	return document
}

func CanonicaliseDesired(document DesiredDocument) DesiredDocument {
	document.SchemaVersion = SchemaVersion
	observed := Canonicalise(Document{Shared: document.Shared, Unsupported: document.Unsupported})
	document.Shared, document.Unsupported = observed.Shared, observed.Unsupported
	if document.NodeOverrides == nil {
		document.NodeOverrides = map[string]NodeSpecific{}
	}
	for nodeID, override := range document.NodeOverrides {
		override.BindHosts = cleanSet(override.BindHosts)
		document.NodeOverrides[nodeID] = override
	}
	return document
}

func DesiredFromObservation(nodeID string, document Document) DesiredDocument {
	desired := DesiredDocument{
		SchemaVersion: SchemaVersion,
		Shared:        document.Shared,
		NodeOverrides: map[string]NodeSpecific{nodeID: document.NodeSpecific},
		Unsupported:   document.Unsupported,
	}
	return CanonicaliseDesired(desired)
}

func Effective(document DesiredDocument, nodeID string) (Document, error) {
	document = CanonicaliseDesired(document)
	override, ok := document.NodeOverrides[nodeID]
	if !ok {
		return Document{}, fmt.Errorf("node %s has no desired override", nodeID)
	}
	return Canonicalise(Document{
		SchemaVersion: SchemaVersion,
		Shared:        document.Shared,
		NodeSpecific:  override,
		Unsupported:   document.Unsupported,
	}), nil
}

func Marshal(document Document) ([]byte, string, error) {
	body, err := json.Marshal(Canonicalise(document))
	if err != nil {
		return nil, "", err
	}
	digest := sha256.Sum256(body)
	return body, hex.EncodeToString(digest[:]), nil
}

func MarshalDesired(document DesiredDocument) ([]byte, string, error) {
	body, err := json.Marshal(CanonicaliseDesired(document))
	if err != nil {
		return nil, "", err
	}
	digest := sha256.Sum256(body)
	return body, hex.EncodeToString(digest[:]), nil
}

func Diff(left, right Document) []Difference {
	left, right = Canonicalise(left), Canonicalise(right)
	diffs := make([]Difference, 0)
	add := func(section, field string, scope Ownership, a, b any) {
		ab, _ := json.Marshal(a)
		bb, _ := json.Marshal(b)
		if string(ab) != string(bb) {
			diffs = append(diffs, Difference{Section: section, Field: field, Scope: scope, Left: a, Right: b, Summary: field + " differs"})
		}
	}
	add("DNS", "Upstream DNS", SharedManaged, left.Shared.DNS.UpstreamDNS, right.Shared.DNS.UpstreamDNS)
	add("DNS", "Bootstrap DNS", SharedManaged, left.Shared.DNS.BootstrapDNS, right.Shared.DNS.BootstrapDNS)
	add("DNS", "Fallback DNS", SharedManaged, left.Shared.DNS.FallbackDNS, right.Shared.DNS.FallbackDNS)
	add("DNS", "Private reverse DNS", SharedManaged, left.Shared.DNS.PrivateReverseDNS, right.Shared.DNS.PrivateReverseDNS)
	add("Filtering", "Enabled", SharedManaged, left.Shared.Filtering.Enabled, right.Shared.Filtering.Enabled)
	add("Filtering", "Update interval", SharedManaged, left.Shared.Filtering.UpdateInterval, right.Shared.Filtering.UpdateInterval)
	add("Filtering", "Filter subscriptions", SharedManaged, left.Shared.Filtering.FilterURLs, right.Shared.Filtering.FilterURLs)
	add("Filtering", "Custom rules", SharedManaged, left.Shared.Filtering.UserRules, right.Shared.Filtering.UserRules)
	add("DNS", "Bind hosts", NodeManaged, left.NodeSpecific.BindHosts, right.NodeSpecific.BindHosts)
	add("DNS", "DNS port", NodeManaged, left.NodeSpecific.DNSPort, right.NodeSpecific.DNSPort)
	add("Compatibility", "Unsupported areas", UnsupportedField, left.Unsupported, right.Unsupported)
	return diffs
}

func DiffDesired(left, right DesiredDocument) []Difference {
	left, right = CanonicaliseDesired(left), CanonicaliseDesired(right)
	diffs := Diff(Document{Shared: left.Shared, Unsupported: left.Unsupported}, Document{Shared: right.Shared, Unsupported: right.Unsupported})
	nodeIDs := make(map[string]struct{}, len(left.NodeOverrides)+len(right.NodeOverrides))
	for id := range left.NodeOverrides {
		nodeIDs[id] = struct{}{}
	}
	for id := range right.NodeOverrides {
		nodeIDs[id] = struct{}{}
	}
	ordered := make([]string, 0, len(nodeIDs))
	for id := range nodeIDs {
		ordered = append(ordered, id)
	}
	sort.Strings(ordered)
	for _, id := range ordered {
		a, aOK := left.NodeOverrides[id]
		b, bOK := right.NodeOverrides[id]
		if !aOK || !bOK {
			diffs = append(diffs, Difference{Section: "DNS", Field: "Node override", Scope: NodeManaged, Left: valueOrNil(a, aOK), Right: valueOrNil(b, bOK), Summary: "node override differs for " + id})
			continue
		}
		for _, difference := range Diff(Document{NodeSpecific: a}, Document{NodeSpecific: b}) {
			if difference.Scope == NodeManaged {
				difference.Summary += " for " + id
				diffs = append(diffs, difference)
			}
		}
	}
	return diffs
}

func valueOrNil(value NodeSpecific, ok bool) any {
	if !ok {
		return nil
	}
	return value
}

type ValidationIssue struct {
	Field   string `json:"field"`
	Message string `json:"message"`
}

func ValidateDesired(document DesiredDocument, nodeIDs []string) []ValidationIssue {
	providedSchemaVersion := document.SchemaVersion
	document = CanonicaliseDesired(document)
	issues := make([]ValidationIssue, 0)
	if providedSchemaVersion != SchemaVersion {
		issues = append(issues, ValidationIssue{Field: "schemaVersion", Message: "must be 1"})
	}
	allowedIntervals := map[int]bool{0: true, 1: true, 12: true, 24: true, 72: true, 168: true}
	if !allowedIntervals[document.Shared.Filtering.UpdateInterval] {
		issues = append(issues, ValidationIssue{Field: "shared.filtering.updateIntervalHours", Message: "must be 0, 1, 12, 24, 72, or 168"})
	}
	for index, rawURL := range document.Shared.Filtering.FilterURLs {
		parsed, err := url.Parse(rawURL)
		if err != nil || parsed.Host == "" || (parsed.Scheme != "http" && parsed.Scheme != "https") {
			issues = append(issues, ValidationIssue{Field: fmt.Sprintf("shared.filtering.filterUrls[%d]", index), Message: "must be an absolute HTTP or HTTPS URL"})
		}
	}
	for _, nodeID := range nodeIDs {
		override, ok := document.NodeOverrides[nodeID]
		if !ok {
			issues = append(issues, ValidationIssue{Field: "nodeOverrides." + nodeID, Message: "is required for every enabled node"})
			continue
		}
		if override.DNSPort < 1 || override.DNSPort > 65535 {
			issues = append(issues, ValidationIssue{Field: "nodeOverrides." + nodeID + ".dnsPort", Message: "must be between 1 and 65535"})
		}
		if len(override.BindHosts) == 0 {
			issues = append(issues, ValidationIssue{Field: "nodeOverrides." + nodeID + ".bindHosts", Message: "must include at least one address"})
		}
		for index, host := range override.BindHosts {
			if _, err := netip.ParseAddr(host); err != nil {
				issues = append(issues, ValidationIssue{Field: fmt.Sprintf("nodeOverrides.%s.bindHosts[%d]", nodeID, index), Message: "must be an IP address"})
			}
		}
	}
	return issues
}

func cleanOrdered(values []string) []string {
	result := make([]string, 0, len(values))
	for _, value := range values {
		if value = strings.TrimSpace(value); value != "" {
			result = append(result, value)
		}
	}
	if result == nil {
		return []string{}
	}
	return result
}

func cleanSet(values []string) []string {
	seen := map[string]struct{}{}
	result := make([]string, 0, len(values))
	for _, value := range values {
		value = strings.TrimSpace(value)
		if value == "" {
			continue
		}
		key := strings.ToLower(value)
		if _, ok := seen[key]; !ok {
			seen[key] = struct{}{}
			result = append(result, value)
		}
	}
	sort.Slice(result, func(i, j int) bool { return strings.ToLower(result[i]) < strings.ToLower(result[j]) })
	if result == nil {
		return []string{}
	}
	return result
}
