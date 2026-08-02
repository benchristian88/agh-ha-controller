package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/benchristian88/agh-ha-controller/internal/adguard"
	controllerapi "github.com/benchristian88/agh-ha-controller/internal/api"
	"github.com/benchristian88/agh-ha-controller/internal/auth"
	"github.com/benchristian88/agh-ha-controller/internal/config"
	"github.com/benchristian88/agh-ha-controller/internal/controlplane"
	"github.com/benchristian88/agh-ha-controller/internal/database"
	"github.com/benchristian88/agh-ha-controller/internal/domain"
	"github.com/benchristian88/agh-ha-controller/internal/inventory"
	"github.com/benchristian88/agh-ha-controller/internal/jobs"
	"github.com/benchristian88/agh-ha-controller/internal/operations"
	"github.com/benchristian88/agh-ha-controller/internal/version"
)

func main() {
	if err := run(); err != nil {
		slog.Error("controller stopped", "error", err)
		os.Exit(1)
	}
}

func run() error {
	configuration, err := config.Load()
	if err != nil {
		return err
	}
	logger := configureLogger(configuration)
	slog.SetDefault(logger)
	rootContext, stopSignals := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stopSignals()

	store, err := database.Open(rootContext, configuration.DatabaseURL)
	if err != nil {
		return err
	}
	defer store.Close()
	if configuration.AutoMigrate {
		if err := database.ApplyMigrations(rootContext, store.Pool()); err != nil {
			return err
		}
	}
	tokens, err := auth.NewTokenManager(configuration.SessionSecret)
	if err != nil {
		return err
	}
	credentialCipher, err := auth.NewCredentialCipher(configuration.CredentialEncryptionKey)
	if err != nil {
		return err
	}
	authService, err := auth.NewService(store, tokens, configuration.SessionDuration)
	if err != nil {
		return err
	}
	probe := adguard.NewProbe(configuration.NodeRequestTimeout)
	management := domain.NewManagementService(store, credentialCipher, probe)
	configurationAdapter := adguard.NewConfigurationReader(probe)
	inventoryService := inventory.NewService(store, credentialCipher, configurationAdapter)
	operationService := operations.NewService(store, credentialCipher)
	operationExecutor := operations.NewExecutor(store, credentialCipher, credentialCipher, configurationAdapter, inventoryService)
	if err := operationExecutor.RecoverInterrupted(rootContext); err != nil {
		return err
	}
	controlplaneService := controlplane.NewService(store, inventoryService)
	deploymentExecutor := controlplane.NewExecutor(store, credentialCipher, configurationAdapter, inventoryService)
	if err := deploymentExecutor.RecoverInterrupted(rootContext); err != nil {
		return err
	}
	reconciler := controlplane.NewReconciler(store, controlplaneService, inventoryService, logger)
	healthPoller := jobs.NewHealthPoller(store, credentialCipher, probe, configuration.NodeHealthInterval, logger)
	go healthPoller.Run(rootContext)
	go jobs.RunDeploymentExecutor(rootContext, deploymentExecutor, logger)
	go jobs.RunOperationalCommandExecutor(rootContext, operationExecutor, logger)
	go jobs.RunReconciler(rootContext, reconciler, configuration.NodeHealthInterval, logger)
	go jobs.RunSessionCleanup(rootContext, store, logger)

	apiServer := controllerapi.NewServer(
		authService, management, inventoryService, store, store, logger,
		configuration.SecureCookies(), configuration.PublicBaseURL.String(),
		configuration.NodeHealthInterval, configuration.WebDistDirectory,
		controlplaneService,
	)
	apiServer.SetDNSOperations(operationService)
	httpServer := &http.Server{
		Addr:              configuration.HTTPAddress,
		Handler:           apiServer.Handler(),
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       15 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       60 * time.Second,
	}
	serverError := make(chan error, 1)
	go func() {
		logger.Info("controller listening", "address", configuration.HTTPAddress, "version", version.Current().Version)
		serverError <- httpServer.ListenAndServe()
	}()
	select {
	case <-rootContext.Done():
		shutdownContext, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		defer cancel()
		if err := httpServer.Shutdown(shutdownContext); err != nil {
			return err
		}
		logger.Info("controller shutdown complete")
		return nil
	case err := <-serverError:
		if errors.Is(err, http.ErrServerClosed) {
			return nil
		}
		return err
	}
}

func configureLogger(configuration config.Config) *slog.Logger {
	level := slog.LevelInfo
	switch configuration.LogLevel {
	case "debug":
		level = slog.LevelDebug
	case "warn":
		level = slog.LevelWarn
	case "error":
		level = slog.LevelError
	}
	options := &slog.HandlerOptions{Level: level}
	if configuration.Environment == "development" {
		return slog.New(slog.NewTextHandler(os.Stdout, options))
	}
	return slog.New(slog.NewJSONHandler(os.Stdout, options))
}
