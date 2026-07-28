package configuration

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
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

func Marshal(document Document) ([]byte, string, error) {
	body, err := json.Marshal(Canonicalise(document))
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
