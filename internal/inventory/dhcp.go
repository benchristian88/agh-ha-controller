package inventory

import (
	"context"
	"errors"
	"sort"
	"strings"
	"time"
	"unicode"

	"github.com/benchristian88/agh-ha-controller/internal/domain"
)

type DHCPInterface struct {
	Name            string   `json:"name"`
	HardwareAddress string   `json:"hardwareAddress,omitempty"`
	IPv4Addresses   []string `json:"ipv4Addresses"`
	IPv6Addresses   []string `json:"ipv6Addresses"`
	GatewayIP       string   `json:"gatewayIp,omitempty"`
	Flags           []string `json:"flags"`
	Available       bool     `json:"available"`
}

type DHCPInterfaces struct {
	NodeID     string          `json:"nodeId"`
	NodeName   string          `json:"nodeName"`
	Interfaces []DHCPInterface `json:"interfaces"`
	FetchedAt  time.Time       `json:"fetchedAt"`
}

type DHCPCheckValue struct {
	Status  string `json:"status"`
	Message string `json:"message,omitempty"`
}

type DHCPStaticIPCheck struct {
	Status string `json:"status"`
	IP     string `json:"ip,omitempty"`
}

type DHCPActiveCheck struct {
	IPv4OtherServer DHCPCheckValue    `json:"ipv4OtherServer"`
	IPv4StaticIP    DHCPStaticIPCheck `json:"ipv4StaticIp"`
	IPv6OtherServer DHCPCheckValue    `json:"ipv6OtherServer"`
}

type DHCPActiveCheckResult struct {
	NodeID        string            `json:"nodeId"`
	NodeName      string            `json:"nodeName"`
	InterfaceName string            `json:"interfaceName"`
	Status        string            `json:"status"`
	IPv4          DHCPCheckValue    `json:"ipv4"`
	IPv4StaticIP  DHCPStaticIPCheck `json:"ipv4StaticIp"`
	IPv6          DHCPCheckValue    `json:"ipv6"`
	CheckedAt     time.Time         `json:"checkedAt"`
}

func (s *Service) DHCPInterfaces(ctx context.Context, nodeID string) (DHCPInterfaces, error) {
	if !domain.ValidID(nodeID) {
		return DHCPInterfaces{}, domain.Validation("nodeId", "must be a valid UUID")
	}
	reader, ok := s.reader.(DHCPInterfaceReader)
	if !ok {
		return DHCPInterfaces{}, domain.NewError(domain.ErrorCapability, "DHCP interface discovery is unavailable")
	}
	record, request, err := s.dhcpNodeRequest(ctx, nodeID, false)
	if err != nil {
		return DHCPInterfaces{}, err
	}
	interfaces, err := reader.ReadDHCPInterfaces(ctx, request)
	if err != nil {
		return DHCPInterfaces{}, err
	}
	for index := range interfaces {
		interfaces[index].IPv4Addresses = cleanStrings(interfaces[index].IPv4Addresses)
		interfaces[index].IPv6Addresses = cleanStrings(interfaces[index].IPv6Addresses)
		interfaces[index].Flags = cleanStrings(interfaces[index].Flags)
		flags := make(map[string]bool, len(interfaces[index].Flags))
		for _, flag := range interfaces[index].Flags {
			flags[strings.ToLower(flag)] = true
		}
		interfaces[index].Available = flags["up"] && !flags["loopback"] && (len(interfaces[index].IPv4Addresses) > 0 || len(interfaces[index].IPv6Addresses) > 0)
	}
	sort.Slice(interfaces, func(i, j int) bool { return interfaces[i].Name < interfaces[j].Name })
	return DHCPInterfaces{NodeID: nodeID, NodeName: record.Node.Name, Interfaces: interfaces, FetchedAt: s.now().UTC()}, nil
}

func (s *Service) FindActiveDHCP(ctx context.Context, actor domain.Actor, nodeID, interfaceName string) (DHCPActiveCheckResult, error) {
	interfaceName = strings.TrimSpace(interfaceName)
	if err := validateInterfaceName(interfaceName); err != nil {
		return DHCPActiveCheckResult{}, err
	}
	checker, ok := s.reader.(DHCPActiveChecker)
	if !ok {
		return DHCPActiveCheckResult{}, domain.NewError(domain.ErrorCapability, "active DHCP detection is unavailable")
	}
	audits, ok := s.repository.(interface {
		RecordAuditEvent(context.Context, domain.AuditEvent) error
	})
	if !ok {
		return DHCPActiveCheckResult{}, domain.NewError(domain.ErrorCapability, "audited active DHCP detection is unavailable")
	}
	record, request, err := s.dhcpNodeRequest(ctx, nodeID, true)
	if err != nil {
		return DHCPActiveCheckResult{}, err
	}
	requested, err := inventoryAudit(actor, "dhcp.active_check_requested", nodeID, map[string]any{"interfaceName": interfaceName}, s.now().UTC())
	if err != nil {
		return DHCPActiveCheckResult{}, err
	}
	if err := audits.RecordAuditEvent(ctx, requested); err != nil {
		return DHCPActiveCheckResult{}, err
	}

	check, checkErr := checker.FindActiveDHCP(ctx, request, interfaceName)
	status := aggregateDHCPCheckStatus(check)
	action := "dhcp.active_check_succeeded"
	if checkErr != nil {
		action = "dhcp.active_check_failed"
		status = "error"
	}
	metadata := map[string]any{"interfaceName": interfaceName, "status": status}
	if checkErr != nil {
		metadata["errorCode"] = errorCode(checkErr)
	}
	completed, eventErr := inventoryAudit(actor, action, nodeID, metadata, s.now().UTC())
	if eventErr != nil {
		return DHCPActiveCheckResult{}, eventErr
	}
	auditCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), 5*time.Second)
	defer cancel()
	if err := audits.RecordAuditEvent(auditCtx, completed); err != nil {
		return DHCPActiveCheckResult{}, err
	}
	if checkErr != nil {
		return DHCPActiveCheckResult{}, checkErr
	}
	return DHCPActiveCheckResult{
		NodeID: nodeID, NodeName: record.Node.Name, InterfaceName: interfaceName,
		Status: status, IPv4: check.IPv4OtherServer, IPv4StaticIP: check.IPv4StaticIP,
		IPv6: check.IPv6OtherServer, CheckedAt: completed.CreatedAt,
	}, nil
}

func (s *Service) dhcpNodeRequest(ctx context.Context, nodeID string, mutationGuard bool) (domain.NodeRecord, domain.NodeProbeRequest, error) {
	if !domain.ValidID(nodeID) {
		return domain.NodeRecord{}, domain.NodeProbeRequest{}, domain.Validation("nodeId", "must be a valid UUID")
	}
	record, err := s.repository.NodeRecordByID(ctx, nodeID)
	if err != nil {
		return domain.NodeRecord{}, domain.NodeProbeRequest{}, err
	}
	if !record.Node.Enabled {
		return domain.NodeRecord{}, domain.NodeProbeRequest{}, domain.NewError(domain.ErrorConflict, "DHCP inspection requires an enabled node")
	}
	if mutationGuard && record.Node.MaintenanceMode {
		return domain.NodeRecord{}, domain.NodeProbeRequest{}, domain.NewError(domain.ErrorConflict, "active DHCP detection requires a node outside maintenance")
	}
	credentials, err := s.credentials.Decrypt(nodeID, record.Secrets.Credentials)
	if err != nil {
		return domain.NodeRecord{}, domain.NodeProbeRequest{}, errors.New("stored node credentials could not be decrypted")
	}
	request := domain.NodeProbeRequest{BaseURL: record.Node.BaseURL, CertificatePolicy: record.Node.CertificatePolicy, CustomCAPEM: record.Secrets.CustomCAPEM, Credentials: credentials}
	return record, request, nil
}

func validateInterfaceName(value string) error {
	if value == "" {
		return domain.Validation("interfaceName", "is required")
	}
	if len(value) > 128 || strings.IndexFunc(value, unicode.IsControl) >= 0 {
		return domain.Validation("interfaceName", "is invalid")
	}
	return nil
}

func aggregateDHCPCheckStatus(check DHCPActiveCheck) string {
	statuses := []string{check.IPv4OtherServer.Status, check.IPv6OtherServer.Status}
	found, failed, available := 0, 0, 0
	for _, status := range statuses {
		switch status {
		case "yes":
			found++
			available++
		case "no":
			available++
		case "error":
			failed++
		}
	}
	if failed > 0 && available > 0 {
		return "partial"
	}
	if failed > 0 || available == 0 {
		return "error"
	}
	if found > 1 {
		return "multiple"
	}
	if found == 1 {
		return "found"
	}
	return "none"
}

func cleanStrings(values []string) []string {
	result := make([]string, 0, len(values))
	seen := map[string]bool{}
	for _, value := range values {
		value = strings.TrimSpace(value)
		if value == "" || seen[value] {
			continue
		}
		seen[value] = true
		result = append(result, value)
	}
	sort.Strings(result)
	return result
}
