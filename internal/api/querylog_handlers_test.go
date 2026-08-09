package api

import (
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/benchristian88/agh-ha-controller/internal/querylog"
)

type queryLogServiceFake struct {
	page    querylog.Page
	event   querylog.Event
	request querylog.ListRequest
}

func (s *queryLogServiceFake) List(_ context.Context, request querylog.ListRequest) (querylog.Page, error) {
	s.request = request
	return s.page, nil
}
func (s *queryLogServiceFake) Detail(context.Context, string, string) (querylog.Event, error) {
	return s.event, nil
}

func TestQueryLogHandlerForwardsBoundedControllerFilters(t *testing.T) {
	service := &queryLogServiceFake{page: querylog.Page{Items: []querylog.Event{}}}
	server := &Server{queryLog: service, logger: slog.New(slog.NewTextHandler(io.Discard, nil))}
	request := httptest.NewRequest(http.MethodGet, "/?limit=25&nodeId=22222222-2222-4222-8222-222222222222&search=example&status=blocked&queryType=A&client=home", nil)
	request.SetPathValue("clusterId", "11111111-1111-4111-8111-111111111111")
	response := httptest.NewRecorder()
	server.handleQueryEvents(response, request)
	if response.Code != http.StatusOK || service.request.Limit != 25 || service.request.Search != "example" || service.request.NodeID == "" {
		t.Fatalf("response=%d request=%+v body=%s", response.Code, service.request, response.Body.String())
	}
	var body querylog.Page
	if err := json.Unmarshal(response.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
}

func TestQueryLogHandlerRejectsInvalidLimit(t *testing.T) {
	server := &Server{queryLog: &queryLogServiceFake{}, logger: slog.New(slog.NewTextHandler(io.Discard, nil))}
	request := httptest.NewRequest(http.MethodGet, "/?limit=unbounded", nil)
	response := httptest.NewRecorder()
	server.handleQueryEvents(response, request)
	if response.Code != http.StatusBadRequest || !json.Valid(response.Body.Bytes()) {
		t.Fatalf("response=%d body=%s", response.Code, response.Body.String())
	}
}

func TestQueryLogHandlerDoesNotExposeUnavailableImplementation(t *testing.T) {
	server := &Server{logger: slog.New(slog.NewTextHandler(io.Discard, nil))}
	request := httptest.NewRequest(http.MethodGet, "/", nil)
	response := httptest.NewRecorder()
	server.handleQueryEvents(response, request)
	if response.Code != http.StatusUnprocessableEntity || !json.Valid(response.Body.Bytes()) {
		t.Fatalf("response=%d body=%s", response.Code, response.Body.String())
	}
}
