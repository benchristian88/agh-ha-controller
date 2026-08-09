package haoperations

import (
	"context"
	"crypto/rand"
	"encoding/binary"
	"errors"
	"fmt"
	"io"
	"net"
	"strings"
	"time"
)

const maxDNSMessage = 4096

type DNSProbeRequest struct {
	Host          string
	Port          int
	Name          string
	Type          string
	ExpectedRCode int
	UDP           bool
	TCP           bool
}

type DNSProber interface {
	Probe(context.Context, DNSProbeRequest) (DNSProbeResult, error)
}

type WireDNSProber struct {
	timeout time.Duration
	now     func() time.Time
}

func NewWireDNSProber(timeout time.Duration) *WireDNSProber {
	if timeout <= 0 || timeout > 10*time.Second {
		timeout = 2 * time.Second
	}
	return &WireDNSProber{timeout: timeout, now: time.Now}
}

func (p *WireDNSProber) Probe(ctx context.Context, request DNSProbeRequest) (DNSProbeResult, error) {
	result := DNSProbeResult{Status: "failed", UDPStatus: "disabled", TCPStatus: "disabled", ProbedAt: p.now().UTC()}
	message, id, err := dnsQuery(request.Name, request.Type)
	if err != nil {
		return result, err
	}
	address := net.JoinHostPort(request.Host, fmt.Sprint(request.Port))
	var successes, latencyTotal int
	if request.UDP {
		rcode, latency, family, probeErr := p.exchange(ctx, "udp", address, message, id)
		if probeErr == nil && rcode == request.ExpectedRCode {
			result.UDPStatus, result.ResponseCode, result.AddressFamily = "healthy", intPointer(rcode), family
			successes++
			latencyTotal += latency
		} else {
			result.UDPStatus = "failed"
			result.ErrorCode = dnsErrorCode(probeErr, rcode, request.ExpectedRCode)
		}
	}
	if request.TCP {
		rcode, latency, family, probeErr := p.exchange(ctx, "tcp", address, message, id)
		if probeErr == nil && rcode == request.ExpectedRCode {
			result.TCPStatus, result.ResponseCode = "healthy", intPointer(rcode)
			if result.AddressFamily == "" {
				result.AddressFamily = family
			}
			successes++
			latencyTotal += latency
		} else {
			result.TCPStatus = "failed"
			if result.ErrorCode == "" {
				result.ErrorCode = dnsErrorCode(probeErr, rcode, request.ExpectedRCode)
			}
		}
	}
	required := 0
	if request.UDP {
		required++
	}
	if request.TCP {
		required++
	}
	if required > 0 && successes == required {
		result.Status, result.ErrorCode = "healthy", ""
		latency := latencyTotal / successes
		result.LatencyMS = &latency
		return result, nil
	}
	return result, errors.New("DNS service probe failed")
}

func (p *WireDNSProber) exchange(ctx context.Context, network, address string, message []byte, id uint16) (int, int, string, error) {
	dialer := net.Dialer{Timeout: p.timeout}
	started := p.now()
	connection, err := dialer.DialContext(ctx, network, address)
	if err != nil {
		return -1, 0, "", err
	}
	defer connection.Close()
	deadline := p.now().Add(p.timeout)
	_ = connection.SetDeadline(deadline)
	family := "ipv4"
	if host, _, splitErr := net.SplitHostPort(connection.RemoteAddr().String()); splitErr == nil && strings.Contains(host, ":") {
		family = "ipv6"
	}
	if network == "tcp" {
		framed := make([]byte, len(message)+2)
		binary.BigEndian.PutUint16(framed[:2], uint16(len(message)))
		copy(framed[2:], message)
		if _, err = connection.Write(framed); err != nil {
			return -1, 0, family, err
		}
		var size [2]byte
		if _, err = io.ReadFull(connection, size[:]); err != nil {
			return -1, 0, family, err
		}
		length := int(binary.BigEndian.Uint16(size[:]))
		if length < 12 || length > maxDNSMessage {
			return -1, 0, family, errors.New("invalid DNS response size")
		}
		response := make([]byte, length)
		if _, err = io.ReadFull(connection, response); err != nil {
			return -1, 0, family, err
		}
		return validateDNSResponse(response, id, int(p.now().Sub(started).Milliseconds()), family)
	}
	if _, err = connection.Write(message); err != nil {
		return -1, 0, family, err
	}
	response := make([]byte, maxDNSMessage)
	read, err := connection.Read(response)
	if err != nil {
		return -1, 0, family, err
	}
	return validateDNSResponse(response[:read], id, int(p.now().Sub(started).Milliseconds()), family)
}

func dnsQuery(name, recordType string) ([]byte, uint16, error) {
	name = strings.TrimSpace(name)
	if name == "" {
		return nil, 0, errors.New("DNS probe name is empty")
	}
	var idBytes [2]byte
	if _, err := rand.Read(idBytes[:]); err != nil {
		return nil, 0, err
	}
	id := binary.BigEndian.Uint16(idBytes[:])
	message := make([]byte, 12, 512)
	binary.BigEndian.PutUint16(message[0:2], id)
	binary.BigEndian.PutUint16(message[2:4], 0x0100)
	binary.BigEndian.PutUint16(message[4:6], 1)
	if name == "." {
		message = append(message, 0)
	} else {
		for _, label := range strings.Split(strings.TrimSuffix(name, "."), ".") {
			if label == "" || len(label) > 63 {
				return nil, 0, errors.New("DNS probe name is invalid")
			}
			message = append(message, byte(len(label)))
			message = append(message, label...)
		}
		message = append(message, 0)
	}
	typeCode := uint16(2)
	switch recordType {
	case "A":
		typeCode = 1
	case "AAAA":
		typeCode = 28
	case "NS":
	default:
		return nil, 0, errors.New("DNS probe type is invalid")
	}
	message = binary.BigEndian.AppendUint16(message, typeCode)
	message = binary.BigEndian.AppendUint16(message, 1)
	return message, id, nil
}

func validateDNSResponse(response []byte, id uint16, latency int, family string) (int, int, string, error) {
	if len(response) < 12 {
		return -1, latency, family, errors.New("DNS response is truncated")
	}
	if binary.BigEndian.Uint16(response[:2]) != id {
		return -1, latency, family, errors.New("DNS response ID does not match")
	}
	flags := binary.BigEndian.Uint16(response[2:4])
	if flags&0x8000 == 0 {
		return -1, latency, family, errors.New("DNS response flag is absent")
	}
	return int(flags & 0x000f), latency, family, nil
}

func dnsErrorCode(err error, actual, expected int) string {
	if err != nil {
		if timeout, ok := err.(net.Error); ok && timeout.Timeout() {
			return "DNS_PROBE_TIMEOUT"
		}
		return "DNS_PROBE_UNREACHABLE"
	}
	if actual != expected {
		return "DNS_PROBE_UNEXPECTED_RCODE"
	}
	return "DNS_PROBE_FAILED"
}

func intPointer(value int) *int { return &value }
