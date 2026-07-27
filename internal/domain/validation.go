package domain

import (
	"net/mail"
	"net/url"
	"strings"
	"unicode/utf8"
)

func NormaliseEmail(value string) (string, error) {
	value = strings.ToLower(strings.TrimSpace(value))
	address, err := mail.ParseAddress(value)
	if err != nil || address.Address != value || len(value) > 254 {
		return "", Validation("email", "enter a valid email address")
	}
	return value, nil
}

func ValidateDisplayName(value string) error {
	length := utf8.RuneCountInString(strings.TrimSpace(value))
	if length < 1 || length > 120 {
		return Validation("displayName", "must contain between 1 and 120 characters")
	}
	return nil
}

func ValidateResourceName(field, value string) error {
	length := utf8.RuneCountInString(strings.TrimSpace(value))
	if length < 1 || length > 120 {
		return Validation(field, "must contain between 1 and 120 characters")
	}
	return nil
}

func NormaliseNodeURL(value string, policy CertificatePolicy) (string, error) {
	parsed, err := url.Parse(strings.TrimSpace(value))
	if err != nil || parsed.Host == "" || parsed.User != nil || parsed.RawQuery != "" || parsed.Fragment != "" {
		return "", Validation("baseUrl", "must be an absolute node URL without credentials, query, or fragment")
	}
	parsed.Path = strings.TrimRight(parsed.Path, "/")
	switch parsed.Scheme {
	case "https":
		if policy == CertificateInsecureHTTP {
			return "", Validation("certificatePolicy", "insecure_http is valid only for an http URL")
		}
	case "http":
		if policy != CertificateInsecureHTTP {
			return "", Validation("certificatePolicy", "http requires the explicit insecure_http policy")
		}
	default:
		return "", Validation("baseUrl", "scheme must be https or explicitly permitted http")
	}
	return parsed.String(), nil
}

func ValidateCertificatePolicy(policy CertificatePolicy, customCAPEM string) error {
	switch policy {
	case CertificateSystemTrust, CertificateInsecureHTTP:
		if strings.TrimSpace(customCAPEM) != "" {
			return Validation("customCaPem", "is only valid with custom_ca policy")
		}
	case CertificateCustomCA:
		if strings.TrimSpace(customCAPEM) == "" {
			return Validation("customCaPem", "is required with custom_ca policy")
		}
	default:
		return Validation("certificatePolicy", "must be system, custom_ca, or insecure_http")
	}
	return nil
}
