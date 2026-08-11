package backup

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/jackc/pgx/v5"

	"github.com/benchristian88/agh-ha-controller/internal/domain"
)

const RestoreConfirmation = "RESTORE_TO_EMPTY_DATABASE"

type RestoreOptions struct {
	ArchivePath       string
	Passphrase        string
	TargetDatabaseURL string
	CredentialKeyPath string
	PGRestore         string
	TargetVersion     string
	TargetSchema      int64
	Confirmation      string
}

func ValidateCompatibility(manifest Manifest, targetVersion string, targetSchema int64) error {
	if manifest.DatabaseSchema > targetSchema {
		return domain.NewError(domain.ErrorConflict, "backup schema is newer than this controller supports")
	}
	sourceMajor, sourceMinor, sourceOK := releaseParts(manifest.ApplicationVersion)
	targetMajor, targetMinor, targetOK := releaseParts(targetVersion)
	if sourceOK && targetOK && (sourceMajor > targetMajor || (sourceMajor == targetMajor && sourceMinor > targetMinor)) {
		return domain.NewError(domain.ErrorConflict, "backup application version is newer than the target controller")
	}
	return nil
}

func Restore(ctx context.Context, options RestoreOptions) (PreflightResult, error) {
	if options.Confirmation != RestoreConfirmation {
		return PreflightResult{}, domain.Validation("confirmation", "must exactly confirm restore to an empty database")
	}
	if strings.TrimSpace(options.TargetDatabaseURL) == "" {
		return PreflightResult{}, domain.Validation("targetDatabaseUrl", "is required")
	}
	if strings.TrimSpace(options.CredentialKeyPath) == "" {
		return PreflightResult{}, domain.Validation("credentialKeyPath", "is required")
	}
	if options.PGRestore == "" {
		options.PGRestore = "pg_restore"
	}
	temporary, err := os.MkdirTemp("", "aghha-restore-")
	if err != nil {
		return PreflightResult{}, err
	}
	defer os.RemoveAll(temporary)
	if err := os.Chmod(temporary, 0o700); err != nil {
		return PreflightResult{}, err
	}
	result, err := Preflight(options.ArchivePath, options.Passphrase, temporary)
	if err != nil {
		return PreflightResult{}, err
	}
	if err := ValidateCompatibility(result.Manifest, options.TargetVersion, options.TargetSchema); err != nil {
		return PreflightResult{}, err
	}
	connection, err := pgx.Connect(ctx, options.TargetDatabaseURL)
	if err != nil {
		return PreflightResult{}, fmt.Errorf("connect to restore target: %w", err)
	}
	var tableCount int
	err = connection.QueryRow(ctx, `SELECT count(*) FROM information_schema.tables WHERE table_schema='public'`).Scan(&tableCount)
	_ = connection.Close(ctx)
	if err != nil {
		return PreflightResult{}, fmt.Errorf("inspect restore target: %w", err)
	}
	if tableCount != 0 {
		return PreflightResult{}, domain.NewError(domain.ErrorConflict, "restore target must be a new empty PostgreSQL database")
	}
	encodedKey, err := os.ReadFile(filepath.Join(temporary, "credential.key"))
	if err != nil {
		return PreflightResult{}, err
	}
	key, err := base64.StdEncoding.DecodeString(strings.TrimSpace(string(encodedKey)))
	if err != nil || len(key) != 32 {
		return PreflightResult{}, domain.NewError(domain.ErrorValidation, "backup credential key is invalid")
	}
	keyOutput, err := os.OpenFile(options.CredentialKeyPath, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0o600)
	if err != nil {
		return PreflightResult{}, fmt.Errorf("write restored credential key without overwriting an existing file: %w", err)
	}
	if _, err := keyOutput.Write([]byte(strings.TrimSpace(string(encodedKey)) + "\n")); err != nil {
		_ = keyOutput.Close()
		return PreflightResult{}, fmt.Errorf("write restored credential key: %w", err)
	}
	if err := keyOutput.Close(); err != nil {
		return PreflightResult{}, err
	}
	if err := os.Chmod(options.CredentialKeyPath, 0o600); err != nil {
		_ = os.Remove(options.CredentialKeyPath)
		return PreflightResult{}, err
	}
	keepCredentialKey := false
	defer func() {
		if !keepCredentialKey {
			_ = os.Remove(options.CredentialKeyPath)
		}
	}()
	safeTargetURL, commandEnvironment, err := protectedDatabaseCommand(options.TargetDatabaseURL)
	if err != nil {
		return PreflightResult{}, err
	}
	command := exec.CommandContext(ctx, options.PGRestore, "--exit-on-error", "--single-transaction", "--no-owner", "--no-acl", "--dbname", safeTargetURL, filepath.Join(temporary, "database.dump"))
	command.Env = commandEnvironment
	var stderr strings.Builder
	command.Stdout = ioDiscard{}
	command.Stderr = &stderr
	if err := command.Run(); err != nil {
		return PreflightResult{}, fmt.Errorf("restore PostgreSQL backup: %s", safeToolError(stderr.String()))
	}
	keepCredentialKey = true
	connection, err = pgx.Connect(ctx, options.TargetDatabaseURL)
	if err != nil {
		return PreflightResult{}, fmt.Errorf("connect for restore audit: %w", err)
	}
	defer connection.Close(ctx)
	auditID, err := domain.NewID()
	if err != nil {
		return PreflightResult{}, err
	}
	metadata, _ := json.Marshal(map[string]any{"formatVersion": result.Manifest.BackupFormatVersion, "sourceApplicationVersion": result.Manifest.ApplicationVersion, "sourceSchemaVersion": result.Manifest.DatabaseSchema, "type": result.Manifest.Type, "sessionsRestored": false})
	if _, err := connection.Exec(ctx, `INSERT INTO audit_events (id,actor_type,action,resource_type,request_id,metadata_json,created_at) VALUES($1,'system','backup.restored','backup','restore-cli',$2,now())`, auditID, metadata); err != nil {
		return PreflightResult{}, fmt.Errorf("record restore audit: %w", err)
	}
	return result, nil
}

type ioDiscard struct{}

func (ioDiscard) Write(value []byte) (int, error) { return len(value), nil }

func releaseParts(value string) (int, int, bool) {
	value = strings.TrimPrefix(strings.TrimSpace(value), "v")
	parts := strings.Split(value, ".")
	if len(parts) < 2 {
		return 0, 0, false
	}
	major, errMajor := strconv.Atoi(parts[0])
	minor, errMinor := strconv.Atoi(parts[1])
	return major, minor, errMajor == nil && errMinor == nil
}
