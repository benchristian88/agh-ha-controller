package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestStatusRequiresCredentials(t *testing.T) {
	handler := newHandler("admin", "secret", statusDocument{Version: "v0.107.65", Running: true})
	request := httptest.NewRequest(http.MethodGet, "/control/status", nil)
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, request)
	if response.Code != http.StatusUnauthorized {
		t.Fatalf("unauthenticated status = %d, want %d", response.Code, http.StatusUnauthorized)
	}

	request = httptest.NewRequest(http.MethodGet, "/control/status", nil)
	request.SetBasicAuth("admin", "secret")
	response = httptest.NewRecorder()
	handler.ServeHTTP(response, request)
	if response.Code != http.StatusOK {
		t.Fatalf("authenticated status = %d, want %d", response.Code, http.StatusOK)
	}
	var document statusDocument
	if err := json.NewDecoder(response.Body).Decode(&document); err != nil {
		t.Fatal(err)
	}
	if document.Version != "v0.107.65" || !document.Running {
		t.Fatalf("status document = %#v", document)
	}
}
