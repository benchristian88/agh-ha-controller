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
