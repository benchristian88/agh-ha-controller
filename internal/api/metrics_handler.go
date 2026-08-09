package api

import (
	"crypto/subtle"
	"fmt"
	"net/http"
	"strconv"
	"strings"
)

func (s *Server) handleMetrics(response http.ResponseWriter, request *http.Request) {
	if s.metrics == nil || s.metricsToken == "" {
		http.NotFound(response, request)
		return
	}
	provided := strings.TrimPrefix(request.Header.Get("Authorization"), "Bearer ")
	if len(provided) != len(s.metricsToken) || subtle.ConstantTimeCompare([]byte(provided), []byte(s.metricsToken)) != 1 {
		response.Header().Set("WWW-Authenticate", `Bearer realm="metrics"`)
		http.Error(response, "authentication required", http.StatusUnauthorized)
		return
	}
	response.Header().Set("Content-Type", "text/plain; version=0.0.4; charset=utf-8")
	response.Header().Set("Cache-Control", "no-store")
	_, _ = fmt.Fprintln(response, "# HELP atlas_worker_runs_total Started worker runs.")
	_, _ = fmt.Fprintln(response, "# TYPE atlas_worker_runs_total counter")
	_, _ = fmt.Fprintln(response, "# HELP atlas_worker_failures_total Worker run failures.")
	_, _ = fmt.Fprintln(response, "# TYPE atlas_worker_failures_total counter")
	_, _ = fmt.Fprintln(response, "# HELP atlas_worker_consecutive_failures Current consecutive worker failures.")
	_, _ = fmt.Fprintln(response, "# TYPE atlas_worker_consecutive_failures gauge")
	_, _ = fmt.Fprintln(response, "# HELP atlas_worker_running Whether a worker is currently running.")
	_, _ = fmt.Fprintln(response, "# TYPE atlas_worker_running gauge")
	for _, worker := range s.metrics.Snapshot() {
		label := strconv.Quote(worker.Name)
		_, _ = fmt.Fprintf(response, "atlas_worker_runs_total{worker=%s} %d\n", label, worker.RunsTotal)
		_, _ = fmt.Fprintf(response, "atlas_worker_failures_total{worker=%s} %d\n", label, worker.FailuresTotal)
		_, _ = fmt.Fprintf(response, "atlas_worker_consecutive_failures{worker=%s} %d\n", label, worker.ConsecutiveFailures)
		running := 0
		if worker.Running {
			running = 1
		}
		_, _ = fmt.Fprintf(response, "atlas_worker_running{worker=%s} %d\n", label, running)
	}
}
