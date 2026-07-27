package api

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"

	"github.com/benchristian88/agh-ha-controller/internal/domain"
)

const maxRequestBody = 1 << 20

type errorEnvelope struct {
	Error errorBody `json:"error"`
}

type errorBody struct {
	Code      string `json:"code"`
	Message   string `json:"message"`
	Field     string `json:"field,omitempty"`
	RequestID string `json:"requestId"`
}

func decodeJSON(response http.ResponseWriter, request *http.Request, target any) error {
	request.Body = http.MaxBytesReader(response, request.Body, maxRequestBody)
	decoder := json.NewDecoder(request.Body)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(target); err != nil {
		return domain.Validation("body", "must be a valid JSON object with known fields")
	}
	if err := decoder.Decode(&struct{}{}); !errors.Is(err, io.EOF) {
		return domain.Validation("body", "must contain exactly one JSON object")
	}
	return nil
}

func writeJSON(response http.ResponseWriter, status int, value any) {
	response.Header().Set("Content-Type", "application/json; charset=utf-8")
	response.WriteHeader(status)
	_ = json.NewEncoder(response).Encode(value)
}

func (s *Server) writeError(response http.ResponseWriter, request *http.Request, err error) {
	status := http.StatusInternalServerError
	body := errorBody{Code: string(domain.ErrorInternal), Message: "An internal error occurred.", RequestID: requestID(request.Context())}
	var domainError *domain.Error
	if errors.As(err, &domainError) {
		body.Code = string(domainError.Kind)
		body.Message = domainError.Message
		body.Field = domainError.Field
		switch domainError.Kind {
		case domain.ErrorValidation:
			status = http.StatusBadRequest
		case domain.ErrorNotFound:
			status = http.StatusNotFound
		case domain.ErrorConflict:
			status = http.StatusConflict
		case domain.ErrorAuthentication, domain.ErrorInvalidCredentials:
			status = http.StatusUnauthorized
		case domain.ErrorAuthorisation:
			status = http.StatusForbidden
		case domain.ErrorRateLimited:
			status = http.StatusTooManyRequests
			response.Header().Set("Retry-After", "900")
		case domain.ErrorNodeAuth, domain.ErrorNodeTLS:
			status = http.StatusUnprocessableEntity
		case domain.ErrorNodeUnreachable, domain.ErrorNodeResponse:
			status = http.StatusBadGateway
		}
	}
	if status >= 500 {
		s.logger.ErrorContext(request.Context(), "http request failed", "request_id", body.RequestID, "error", err)
	}
	writeJSON(response, status, errorEnvelope{Error: body})
}
