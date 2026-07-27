package main

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"syscall"
	"time"
)

type statusDocument struct {
	Version string `json:"version"`
	Running bool   `json:"running"`
}

func main() {
	if err := run(); err != nil {
		slog.Error("test node stopped", "error", err)
		os.Exit(1)
	}
}

func run() error {
	address := env("LISTEN_ADDR", ":8080")
	username := env("NODE_USERNAME", "agh-admin")
	password := env("NODE_PASSWORD", "node-secret-value")
	version := env("NODE_VERSION", "v0.107.65")
	running, err := strconv.ParseBool(env("NODE_RUNNING", "true"))
	if err != nil {
		return errors.New("NODE_RUNNING must be true or false")
	}
	server := &http.Server{
		Addr:              address,
		Handler:           newHandler(username, password, statusDocument{Version: version, Running: running}),
		ReadHeaderTimeout: 2 * time.Second,
		ReadTimeout:       5 * time.Second,
		WriteTimeout:      5 * time.Second,
		IdleTimeout:       30 * time.Second,
	}
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	errorsChannel := make(chan error, 1)
	go func() { errorsChannel <- server.ListenAndServe() }()
	select {
	case err := <-errorsChannel:
		if errors.Is(err, http.ErrServerClosed) {
			return nil
		}
		return err
	case <-ctx.Done():
		shutdownContext, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		return server.Shutdown(shutdownContext)
	}
}

func newHandler(username, password string, status statusDocument) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", func(response http.ResponseWriter, _ *http.Request) {
		response.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(response).Encode(map[string]string{"status": "ok"})
	})
	mux.HandleFunc("GET /control/status", func(response http.ResponseWriter, request *http.Request) {
		actualUsername, actualPassword, ok := request.BasicAuth()
		if !ok || actualUsername != username || actualPassword != password {
			response.Header().Set("WWW-Authenticate", `Basic realm="AdGuard Home test node"`)
			response.WriteHeader(http.StatusUnauthorized)
			return
		}
		response.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(response).Encode(status)
	})
	return mux
}

func env(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}
