package adguard

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/benchristian88/agh-ha-controller/internal/domain"
)

const maxResponseBytes = 1 << 20

type Probe struct {
	timeout time.Duration
}

func NewProbe(timeout time.Duration) *Probe {
	return &Probe{timeout: timeout}
}

type statusResponse struct {
	Version string `json:"version"`
	Running *bool  `json:"running"`
}

func (p *Probe) Status(ctx context.Context, request domain.NodeProbeRequest) (domain.NodeProbeResult, error) {
	endpoint, err := statusEndpoint(request.BaseURL)
	if err != nil {
		return domain.NodeProbeResult{}, domain.Validation("baseUrl", "is not a valid node URL")
	}
	transport, err := p.transport(request.CertificatePolicy, request.CustomCAPEM)
	if err != nil {
		return domain.NodeProbeResult{}, err
	}
	defer transport.CloseIdleConnections()
	client := &http.Client{
		Transport: transport,
		Timeout:   p.timeout,
		CheckRedirect: func(_ *http.Request, _ []*http.Request) error {
			return errors.New("node status redirects are not allowed")
		},
	}
	httpRequest, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return domain.NodeProbeResult{}, fmt.Errorf("create node status request: %w", err)
	}
	httpRequest.SetBasicAuth(request.Credentials.Username, request.Credentials.Password)
	httpRequest.Header.Set("Accept", "application/json")
	started := time.Now()
	response, err := client.Do(httpRequest)
	latency := int(time.Since(started).Milliseconds())
	if err != nil {
		return domain.NodeProbeResult{}, classifyNetworkError(err)
	}
	defer response.Body.Close()
	switch response.StatusCode {
	case http.StatusOK:
	case http.StatusUnauthorized, http.StatusForbidden:
		return domain.NodeProbeResult{}, domain.NewError(domain.ErrorNodeAuth, "the node rejected the supplied credentials")
	default:
		return domain.NodeProbeResult{}, domain.NewError(domain.ErrorNodeResponse, "the node returned an unexpected status response")
	}
	body, err := io.ReadAll(io.LimitReader(response.Body, maxResponseBytes+1))
	if err != nil {
		return domain.NodeProbeResult{}, domain.NewError(domain.ErrorNodeResponse, "the node status response could not be read")
	}
	if len(body) > maxResponseBytes {
		return domain.NodeProbeResult{}, domain.NewError(domain.ErrorNodeResponse, "the node status response was too large")
	}
	var status statusResponse
	if err := json.Unmarshal(body, &status); err != nil {
		return domain.NodeProbeResult{}, domain.NewError(domain.ErrorNodeResponse, "the node returned an invalid status document")
	}
	status.Version = strings.TrimSpace(status.Version)
	if status.Version == "" || len(status.Version) > 128 || status.Running == nil {
		return domain.NodeProbeResult{}, domain.NewError(domain.ErrorNodeResponse, "the node returned an invalid status document")
	}
	return domain.NodeProbeResult{
		Version:       status.Version,
		Compatibility: VersionCompatibility(status.Version),
		Running:       *status.Running,
		LatencyMS:     latency,
	}, nil
}

func (p *Probe) transport(policy domain.CertificatePolicy, customCAPEM string) (*http.Transport, error) {
	tlsConfig := &tls.Config{MinVersion: tls.VersionTLS12}
	if policy == domain.CertificateCustomCA {
		roots, err := x509.SystemCertPool()
		if err != nil || roots == nil {
			roots = x509.NewCertPool()
		}
		if !roots.AppendCertsFromPEM([]byte(customCAPEM)) {
			return nil, domain.Validation("customCaPem", "does not contain a valid CA certificate")
		}
		tlsConfig.RootCAs = roots
	}
	return &http.Transport{
		DialContext: (&net.Dialer{
			Timeout:   p.timeout,
			KeepAlive: 30 * time.Second,
		}).DialContext,
		ForceAttemptHTTP2:     true,
		TLSClientConfig:       tlsConfig,
		TLSHandshakeTimeout:   p.timeout,
		ResponseHeaderTimeout: p.timeout,
		IdleConnTimeout:       30 * time.Second,
	}, nil
}

func statusEndpoint(baseURL string) (string, error) {
	parsed, err := url.Parse(baseURL)
	if err != nil || parsed.Host == "" {
		return "", errors.New("invalid base URL")
	}
	parsed.Path = strings.TrimRight(parsed.Path, "/") + "/control/status"
	parsed.RawPath = ""
	parsed.RawQuery = ""
	parsed.Fragment = ""
	return parsed.String(), nil
}

func classifyNetworkError(err error) error {
	var certificateUnknown x509.UnknownAuthorityError
	var certificateHost x509.HostnameError
	var certificateInvalid x509.CertificateInvalidError
	if errors.As(err, &certificateUnknown) || errors.As(err, &certificateHost) || errors.As(err, &certificateInvalid) {
		return &domain.Error{Kind: domain.ErrorNodeTLS, Message: "the node TLS certificate could not be verified", Cause: err}
	}
	var urlError *url.Error
	if errors.As(err, &urlError) {
		var recordHeaderError tls.RecordHeaderError
		if errors.As(urlError.Err, &recordHeaderError) {
			return &domain.Error{Kind: domain.ErrorNodeTLS, Message: "the node did not complete a valid TLS connection", Cause: err}
		}
	}
	return &domain.Error{Kind: domain.ErrorNodeUnreachable, Message: "the AdGuard Home node could not be reached", Cause: err}
}

func VersionCompatibility(version string) domain.Compatibility {
	value := strings.TrimPrefix(strings.TrimSpace(version), "v")
	parts := strings.Split(value, ".")
	if len(parts) < 2 {
		return domain.CompatibilityUnknown
	}
	major, errMajor := strconv.Atoi(parts[0])
	minor, errMinor := strconv.Atoi(parts[1])
	if errMajor != nil || errMinor != nil || major < 0 || minor < 0 {
		return domain.CompatibilityUnknown
	}
	if major > 0 || minor >= 107 {
		return domain.CompatibilitySupported
	}
	return domain.CompatibilityUnsupported
}
