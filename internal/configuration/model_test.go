package configuration

import "testing"

func TestEquivalentDocumentsHaveSameHash(t *testing.T) {
	a := Document{Shared: Shared{DNS: DNS{BootstrapDNS: []string{"1.1.1.1", "9.9.9.9"}}, Filtering: Filtering{FilterURLs: []string{"https://b", "https://a"}}}, NodeSpecific: NodeSpecific{BindHosts: []string{"127.0.0.1", "0.0.0.0"}}}
	b := Document{Shared: Shared{DNS: DNS{BootstrapDNS: []string{"9.9.9.9", "1.1.1.1"}}, Filtering: Filtering{FilterURLs: []string{"https://a", "https://b"}}}, NodeSpecific: NodeSpecific{BindHosts: []string{"0.0.0.0", "127.0.0.1"}}}
	_, ah, err := Marshal(a)
	if err != nil {
		t.Fatal(err)
	}
	_, bh, err := Marshal(b)
	if err != nil {
		t.Fatal(err)
	}
	if ah != bh {
		t.Fatalf("equivalent documents differ: %s != %s", ah, bh)
	}
}

func TestDiffPreservesOrderedUpstreamsAndGroupsScope(t *testing.T) {
	a := Document{Shared: Shared{DNS: DNS{UpstreamDNS: []string{"a", "b"}}}}
	b := Document{Shared: Shared{DNS: DNS{UpstreamDNS: []string{"b", "a"}}}}
	diffs := Diff(a, b)
	if len(diffs) != 1 || diffs[0].Section != "DNS" || diffs[0].Scope != SharedManaged {
		t.Fatalf("unexpected differences: %#v", diffs)
	}
}

func TestDesiredDocumentBuildsNodeEffectiveState(t *testing.T) {
	desired := DesiredDocument{
		SchemaVersion: 1,
		Shared:        Shared{DNS: DNS{UpstreamDNS: []string{"https://dns.example/dns-query"}}, Filtering: Filtering{UpdateInterval: 24}},
		NodeOverrides: map[string]NodeSpecific{
			"node-a": {BindHosts: []string{"192.0.2.10"}, DNSPort: 53},
			"node-b": {BindHosts: []string{"192.0.2.11"}, DNSPort: 53},
		},
	}
	a, err := Effective(desired, "node-a")
	if err != nil {
		t.Fatal(err)
	}
	b, err := Effective(desired, "node-b")
	if err != nil {
		t.Fatal(err)
	}
	if a.NodeSpecific.BindHosts[0] == b.NodeSpecific.BindHosts[0] || a.Shared.DNS.UpstreamDNS[0] != b.Shared.DNS.UpstreamDNS[0] {
		t.Fatalf("effective state did not preserve shared policy and node identity: %#v %#v", a, b)
	}
}

func TestValidateDesiredRequiresEveryNodeOverrideAndValidListener(t *testing.T) {
	desired := DesiredDocument{SchemaVersion: 1, Shared: Shared{Filtering: Filtering{UpdateInterval: 24}}, NodeOverrides: map[string]NodeSpecific{
		"node-a": {BindHosts: []string{"not-an-ip"}, DNSPort: 0},
	}}
	issues := ValidateDesired(desired, []string{"node-a", "node-b"})
	if len(issues) != 3 {
		t.Fatalf("issues = %#v, want listener address, port, and missing override", issues)
	}
}
