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
	"github.com/benchristian88/agh-ha-controller/internal/backup"
	"github.com/benchristian88/agh-ha-controller/internal/config"
	"github.com/benchristian88/agh-ha-controller/internal/controlplane"
	"github.com/benchristian88/agh-ha-controller/internal/database"
	"github.com/benchristian88/agh-ha-controller/internal/domain"
	"github.com/benchristian88/agh-ha-controller/internal/haoperations"
	"github.com/benchristian88/agh-ha-controller/internal/inventory"
	"github.com/benchristian88/agh-ha-controller/internal/jobs"
	"github.com/benchristian88/agh-ha-controller/internal/operationalhealth"
	"github.com/benchristian88/agh-ha-controller/internal/operations"
	"github.com/benchristian88/agh-ha-controller/internal/querylog"
	"github.com/benchristian88/agh-ha-controller/internal/systemsettings"
	"github.com/benchristian88/agh-ha-controller/internal/telemetry"
	"github.com/benchristian88/agh-ha-controller/internal/updates"
	"github.com/benchristian88/agh-ha-controller/internal/useradmin"
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
	userAdministration := useradmin.NewService(store)
	backupService := backup.NewService(configuration.DatabaseURL, configuration.CredentialEncryptionKey, configuration.PGDumpPath, store)
	controllerUpdates := updates.NewService(store, configuration.InstallationType)
	systemSettings := systemsettings.NewService(store, configuration.QueryLogRetention.String(), configuration.InstallationType)
	probe := adguard.NewProbe(configuration.NodeRequestTimeout)
	management := domain.NewManagementService(store, credentialCipher, probe)
	configurationAdapter := adguard.NewConfigurationReader(probe)
	inventoryService := inventory.NewService(store, credentialCipher, configurationAdapter)
	haOperationsService := haoperations.NewService(store, management, inventoryService, probe, credentialCipher, haoperations.NewWireDNSProber(2*time.Second))
	haOperationsService.SetVersionCompatibility(adguard.ConfigurationCompatibility)
	notificationService := haoperations.NewNotificationService(store, credentialCipher)
	releaseChecker := haoperations.NewReleaseChecker(store)
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
	workerHealth := operationalhealth.NewTracker()
	for _, worker := range []string{"node_connectivity", "dns_service_health", "adguard_release_check", "notification_delivery", "statistics_collection", "statistics_retention", "query_log_collection", "query_log_retention", "deployment", "operational_commands", "drift_reconciliation", "session_cleanup"} {
		workerHealth.Register(worker, (worker == "query_log_collection" || worker == "query_log_retention") && !configuration.QueryLogCollection)
	}
	healthPoller := jobs.NewHealthPoller(store, credentialCipher, probe, configuration.NodeHealthInterval, logger, workerHealth)
	statisticsService := telemetry.NewService(store, configuration.StatisticsPollInterval, configuration.NodeRequestTimeout)
	statisticsPoller := jobs.NewStatisticsPoller(store, credentialCipher, configurationAdapter, configuration.StatisticsPollInterval, configuration.NodeRequestTimeout, logger, workerHealth)
	queryLogService := querylog.NewService(store, configuration.QueryLogPollInterval, querylog.Options{
		CollectionEnabled: configuration.QueryLogCollection,
		Retention:         configuration.QueryLogRetention,
	})
	operationalService := operationalhealth.NewService(store, workerHealth, operationalhealth.Options{
		NodeInterval: configuration.NodeHealthInterval, RequestTimeout: configuration.NodeRequestTimeout,
		StatisticsInterval: configuration.StatisticsPollInterval, QueryLogInterval: configuration.QueryLogPollInterval,
		StatisticsRetention: 400 * 24 * time.Hour, QueryLogRetention: configuration.QueryLogRetention,
		QueryLogEnabled: configuration.QueryLogCollection,
	})
	operationalService.SetHAOperations(haOperationsService)
	go healthPoller.Run(rootContext)
	go jobs.RunHAOperations(rootContext, haOperationsService, configuration.NodeHealthInterval, logger, workerHealth)
	go jobs.RunReleaseChecks(rootContext, releaseChecker, logger, workerHealth)
	go jobs.RunNotificationDelivery(rootContext, notificationService, logger, workerHealth)
	go statisticsPoller.Run(rootContext)
	if configuration.QueryLogCollection {
		queryLogPoller := jobs.NewQueryLogPoller(store, credentialCipher, configurationAdapter, configuration.QueryLogPollInterval, configuration.NodeRequestTimeout, configuration.QueryLogRetention, logger, workerHealth)
		go queryLogPoller.Run(rootContext)
	}
	go jobs.RunDeploymentExecutor(rootContext, deploymentExecutor, logger, workerHealth)
	go jobs.RunOperationalCommandExecutor(rootContext, operationExecutor, logger, workerHealth)
	go jobs.RunReconciler(rootContext, reconciler, configuration.NodeHealthInterval, logger, workerHealth)
	go jobs.RunSessionCleanup(rootContext, store, logger, workerHealth)

	apiServer := controllerapi.NewServer(
		authService, management, inventoryService, store, store, logger,
		configuration.SecureCookies(), configuration.PublicBaseURL.String(),
		configuration.NodeHealthInterval, configuration.WebDistDirectory,
		controlplaneService,
	)
	apiServer.SetDNSOperations(operationService)
	apiServer.SetStatistics(statisticsService)
	apiServer.SetQueryLog(queryLogService)
	apiServer.SetOperationalHealth(operationalService)
	apiServer.SetHAOperations(haOperationsService)
	apiServer.SetNotificationSettings(notificationService)
	apiServer.SetUserAdministration(userAdministration)
	apiServer.SetBackups(backupService)
	apiServer.SetControllerUpdates(controllerUpdates)
	apiServer.SetSystemSettings(systemSettings)
	apiServer.SetMetrics(workerHealth, configuration.MetricsToken)
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
