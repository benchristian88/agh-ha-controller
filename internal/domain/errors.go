package domain

import "fmt"

type ErrorKind string

const (
	ErrorValidation         ErrorKind = "VALIDATION_ERROR"
	ErrorNotFound           ErrorKind = "NOT_FOUND"
	ErrorConflict           ErrorKind = "CONFLICT"
	ErrorAuthentication     ErrorKind = "AUTHENTICATION_REQUIRED"
	ErrorInvalidCredentials ErrorKind = "AUTHENTICATION_FAILED"
	ErrorAuthorisation      ErrorKind = "AUTHORISATION_DENIED"
	ErrorRateLimited        ErrorKind = "RATE_LIMITED"
	ErrorNodeUnreachable    ErrorKind = "NODE_UNREACHABLE"
	ErrorNodeAuth           ErrorKind = "NODE_AUTHENTICATION_FAILED"
	ErrorNodeTLS            ErrorKind = "NODE_TLS_FAILED"
	ErrorNodeResponse       ErrorKind = "NODE_INVALID_RESPONSE"
	ErrorCapability         ErrorKind = "CAPABILITY_ERROR"
	ErrorNodeApply          ErrorKind = "NODE_APPLY_FAILED"
	ErrorVerification       ErrorKind = "VERIFICATION_FAILED"
	ErrorInternal           ErrorKind = "INTERNAL_ERROR"
)

type Error struct {
	Kind    ErrorKind
	Message string
	Field   string
	Cause   error
}

func (e *Error) Error() string {
	if e.Field != "" {
		return fmt.Sprintf("%s: %s", e.Field, e.Message)
	}
	return e.Message
}

func (e *Error) Unwrap() error { return e.Cause }

func NewError(kind ErrorKind, message string) *Error {
	return &Error{Kind: kind, Message: message}
}

func Validation(field, message string) *Error {
	return &Error{Kind: ErrorValidation, Field: field, Message: message}
}
