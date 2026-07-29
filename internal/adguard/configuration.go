package adguard

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"

	"github.com/benchristian88/agh-ha-controller/internal/configuration"
	"github.com/benchristian88/agh-ha-controller/internal/domain"
	"github.com/benchristian88/agh-ha-controller/internal/inventory"
)

type ConfigurationReader struct{ probe *Probe }

const maxConfigurationBody = 4 << 20

func NewConfigurationReader(timeoutProbe *Probe) *ConfigurationReader {
	return &ConfigurationReader{probe: timeoutProbe}
}

type dnsInfoResponse struct {
	UpstreamDNS       []string `json:"upstream_dns"`
	BootstrapDNS      []string `json:"bootstrap_dns"`
	FallbackDNS       []string `json:"fallback_dns"`
	PrivateReverseDNS []string `json:"local_ptr_upstreams"`
	BindHosts         []string `json:"bind_hosts"`
	Port              int      `json:"port"`
}

type filterStatusResponse struct {
	FilteringEnabled *bool `json:"filtering_enabled"`
	Enabled          *bool `json:"enabled"`
	Interval         int   `json:"interval"`
	Filters          []struct {
		Enabled   bool   `json:"enabled"`
		URL       string `json:"url"`
		Name      string `json:"name"`
		Whitelist bool   `json:"whitelist"`
	} `json:"filters"`
	UserRules []string `json:"user_rules"`
}

func (r *ConfigurationReader) ReadConfiguration(ctx context.Context, request domain.NodeProbeRequest, version string) (configuration.Document, inventory.CapabilityProfile, error) {
	profile := inventory.CapabilityProfile{ProductVersion: version, Compatibility: string(VersionCompatibility(version)), SchemaVersion: configuration.SchemaVersion, Features: map[string]bool{"dns": false, "filtering": false}, Warnings: []string{}}
	if VersionCompatibility(version) != domain.CompatibilitySupported {
		profile.Warnings = append(profile.Warnings, "This AdGuard Home version is outside the tested configuration inventory range.")
		return configuration.Document{}, profile, domain.NewError(domain.ErrorNodeResponse, "the node version is not supported for configuration inventory")
	}
	var dns dnsInfoResponse
	if err := r.get(ctx, request, "/control/dns_info", &dns); err != nil {
		profile.Warnings = append(profile.Warnings, "DNS configuration could not be read.")
		return configuration.Document{}, profile, err
	}
	profile.Features["dns"] = true
	var filtering filterStatusResponse
	if err := r.get(ctx, request, "/control/filtering/status", &filtering); err != nil {
		profile.Warnings = append(profile.Warnings, "Filtering configuration could not be read.")
		return configuration.Document{}, profile, err
	}
	profile.Features["filtering"] = true
	document := configurationDocument(version, dns, filtering)
	return configuration.Canonicalise(document), profile, nil
}

func configurationDocument(version string, dns dnsInfoResponse, filtering filterStatusResponse) configuration.Document {
	filterURLs := make([]string, 0, len(filtering.Filters))
	for _, filter := range filtering.Filters {
		if filter.Enabled && !filter.Whitelist {
			filterURLs = append(filterURLs, filter.URL)
		}
	}
	enabled := false
	if filtering.Enabled != nil {
		enabled = *filtering.Enabled
	} else if filtering.FilteringEnabled != nil {
		enabled = *filtering.FilteringEnabled
	}
	return configuration.Document{
		SchemaVersion: configuration.SchemaVersion,
		Shared:        configuration.Shared{DNS: configuration.DNS{UpstreamDNS: dns.UpstreamDNS, BootstrapDNS: dns.BootstrapDNS, FallbackDNS: dns.FallbackDNS, PrivateReverseDNS: dns.PrivateReverseDNS}, Filtering: configuration.Filtering{Enabled: enabled, UpdateInterval: filtering.Interval, FilterURLs: filterURLs, UserRules: filtering.UserRules}},
		NodeSpecific:  configuration.NodeSpecific{BindHosts: dns.BindHosts, DNSPort: dns.Port},
		ObservedOnly:  configuration.ObservedOnly{ProductVersion: version},
		Unsupported:   []configuration.Unsupported{{Section: "services", Reason: "blocked services and safety services are scheduled for release 0.4"}, {Section: "tls_dhcp", Reason: "TLS and DHCP inventory are scheduled for release 0.4"}},
	}
}

// ApplyConfiguration mutates only schema-v1 fields exposed by AdGuard Home's
// supported HTTP API.  Listener addresses and ports have no supported writer;
// callers must preflight them against observed state before invoking this.
func (r *ConfigurationReader) ApplyConfiguration(ctx context.Context, request domain.NodeProbeRequest, desired configuration.Document) error {
	desired = configuration.Canonicalise(desired)
	var currentFilters filterStatusResponse
	if err := r.get(ctx, request, "/control/filtering/status", &currentFilters); err != nil {
		return err
	}
	if err := r.post(ctx, request, "/control/dns_config", map[string]any{
		"upstream_dns": desired.Shared.DNS.UpstreamDNS, "bootstrap_dns": desired.Shared.DNS.BootstrapDNS,
		"fallback_dns": desired.Shared.DNS.FallbackDNS, "local_ptr_upstreams": desired.Shared.DNS.PrivateReverseDNS,
	}); err != nil {
		return err
	}
	if err := r.post(ctx, request, "/control/filtering/config", map[string]any{
		"enabled": desired.Shared.Filtering.Enabled, "interval": desired.Shared.Filtering.UpdateInterval,
	}); err != nil {
		return err
	}
	targets := make(map[string]struct{}, len(desired.Shared.Filtering.FilterURLs))
	for _, target := range desired.Shared.Filtering.FilterURLs {
		targets[strings.ToLower(target)] = struct{}{}
		found := false
		for _, current := range currentFilters.Filters {
			if !current.Whitelist && strings.EqualFold(current.URL, target) {
				found = true
				if !current.Enabled {
					if err := r.post(ctx, request, "/control/filtering/set_url", map[string]any{"url": current.URL, "whitelist": false, "data": map[string]any{"name": current.Name, "url": current.URL, "enabled": true}}); err != nil {
						return err
					}
				}
				break
			}
		}
		if !found {
			if err := r.post(ctx, request, "/control/filtering/add_url", map[string]any{"name": "Managed by AGH HA Controller", "url": target, "whitelist": false}); err != nil {
				return err
			}
		}
	}
	for _, current := range currentFilters.Filters {
		if _, wanted := targets[strings.ToLower(current.URL)]; !current.Whitelist && current.Enabled && !wanted {
			if err := r.post(ctx, request, "/control/filtering/set_url", map[string]any{"url": current.URL, "whitelist": false, "data": map[string]any{"name": current.Name, "url": current.URL, "enabled": false}}); err != nil {
				return err
			}
		}
	}
	return r.post(ctx, request, "/control/filtering/set_rules", map[string]any{"rules": desired.Shared.Filtering.UserRules})
}

func (r *ConfigurationReader) post(ctx context.Context, request domain.NodeProbeRequest, path string, payload any) error {
	body, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("encode AdGuard Home configuration request: %w", err)
	}
	transport, err := r.probe.transport(request.CertificatePolicy, request.CustomCAPEM)
	if err != nil {
		return err
	}
	defer transport.CloseIdleConnections()
	endpoint, err := configurationEndpoint(request.BaseURL, path)
	if err != nil {
		return domain.NewError(domain.ErrorNodeResponse, "the node URL is invalid")
	}
	httpRequest, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("create AdGuard Home mutation request: %w", err)
	}
	httpRequest.SetBasicAuth(request.Credentials.Username, request.Credentials.Password)
	httpRequest.Header.Set("Accept", "application/json")
	httpRequest.Header.Set("Content-Type", "application/json")
	client := &http.Client{Transport: transport, Timeout: r.probe.timeout, CheckRedirect: func(_ *http.Request, _ []*http.Request) error { return http.ErrUseLastResponse }}
	response, err := client.Do(httpRequest)
	if err != nil {
		return classifyNetworkError(err)
	}
	defer response.Body.Close()
	_, _ = io.Copy(io.Discard, io.LimitReader(response.Body, maxConfigurationBody))
	if response.StatusCode == http.StatusUnauthorized || response.StatusCode == http.StatusForbidden {
		return domain.NewError(domain.ErrorNodeAuth, "the node rejected its stored credentials")
	}
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return domain.NewError(domain.ErrorNodeApply, "the node rejected a configuration change")
	}
	return nil
}

func (r *ConfigurationReader) get(ctx context.Context, request domain.NodeProbeRequest, path string, target any) error {
	transport, err := r.probe.transport(request.CertificatePolicy, request.CustomCAPEM)
	if err != nil {
		return err
	}
	defer transport.CloseIdleConnections()
	endpoint, err := configurationEndpoint(request.BaseURL, path)
	if err != nil {
		return domain.NewError(domain.ErrorNodeResponse, "the node URL is invalid")
	}
	httpRequest, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return fmt.Errorf("create AdGuard Home configuration request: %w", err)
	}
	httpRequest.SetBasicAuth(request.Credentials.Username, request.Credentials.Password)
	httpRequest.Header.Set("Accept", "application/json")
	client := &http.Client{Transport: transport, Timeout: r.probe.timeout, CheckRedirect: func(_ *http.Request, _ []*http.Request) error { return http.ErrUseLastResponse }}
	response, err := client.Do(httpRequest)
	if err != nil {
		return classifyNetworkError(err)
	}
	defer response.Body.Close()
	if response.StatusCode == http.StatusUnauthorized || response.StatusCode == http.StatusForbidden {
		return domain.NewError(domain.ErrorNodeAuth, "the node rejected its stored credentials")
	}
	if response.StatusCode != http.StatusOK {
		return domain.NewError(domain.ErrorNodeResponse, "the node configuration endpoint returned an unexpected status")
	}
	body, err := io.ReadAll(io.LimitReader(response.Body, maxConfigurationBody+1))
	if err != nil {
		return domain.NewError(domain.ErrorNodeResponse, "the node configuration response could not be read")
	}
	if len(body) > maxConfigurationBody {
		return domain.NewError(domain.ErrorNodeResponse, "the node configuration response was too large")
	}
	if err := json.Unmarshal(body, target); err != nil {
		return domain.NewError(domain.ErrorNodeResponse, "the node returned invalid configuration JSON")
	}
	return nil
}

func configurationEndpoint(baseURL, path string) (string, error) {
	parsed, err := url.Parse(baseURL)
	if err != nil || parsed.Host == "" {
		return "", err
	}
	parsed.Path = strings.TrimRight(parsed.Path, "/") + path
	parsed.RawQuery, parsed.Fragment = "", ""
	return parsed.String(), nil
}
