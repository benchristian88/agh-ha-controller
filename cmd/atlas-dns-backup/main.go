package main

import (
	"context"
	"flag"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/benchristian88/atlas-dns/internal/backup"
	"github.com/benchristian88/atlas-dns/internal/config"
	"github.com/benchristian88/atlas-dns/internal/database"
	"github.com/benchristian88/atlas-dns/internal/domain"
	"github.com/benchristian88/atlas-dns/internal/version"
)

func main() {
	if err := run(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func run() error {
	if len(os.Args) < 2 {
		return fmt.Errorf("usage: atlas-dns-backup create|preflight|restore [options]")
	}
	switch os.Args[1] {
	case "create":
		return create(os.Args[2:])
	case "preflight":
		return preflight(os.Args[2:])
	case "restore":
		return restore(os.Args[2:])
	default:
		return fmt.Errorf("unknown backup command %q", os.Args[1])
	}
}

func create(arguments []string) error {
	flags := flag.NewFlagSet("create", flag.ContinueOnError)
	typeValue := flags.String("type", string(backup.Standard), "standard or full")
	output := flags.String("output", "", "output archive path")
	passphraseFile := flags.String("passphrase-file", "", "0600 file containing the backup passphrase")
	if err := flags.Parse(arguments); err != nil {
		return err
	}
	passphrase, err := protectedFile(*passphraseFile, "passphrase")
	if err != nil {
		return err
	}
	configuration, err := config.Load()
	if err != nil {
		return err
	}
	store, err := database.Open(context.Background(), configuration.DatabaseURL)
	if err != nil {
		return err
	}
	defer store.Close()
	service := backup.NewService(configuration.DatabaseURL, configuration.CredentialEncryptionKey, configuration.PGDumpPath, store)
	result, err := service.Create(context.Background(), backup.Type(*typeValue), passphrase, domain.Actor{RequestID: "backup-cli"})
	if err != nil {
		return err
	}
	defer backup.Cleanup(result)
	if *output == "" {
		*output = filepath.Base(result.Path)
	}
	return copyExclusive(result.Path, *output)
}

func preflight(arguments []string) error {
	flags := flag.NewFlagSet("preflight", flag.ContinueOnError)
	archive := flags.String("archive", "", "backup archive")
	passphraseFile := flags.String("passphrase-file", "", "file containing the backup passphrase")
	if err := flags.Parse(arguments); err != nil {
		return err
	}
	passphrase, err := protectedFile(*passphraseFile, "passphrase")
	if err != nil {
		return err
	}
	result, err := backup.Preflight(*archive, passphrase, "")
	if err != nil {
		return err
	}
	if err := backup.ValidateCompatibility(result.Manifest, version.Current().Version, database.LatestSchemaVersion()); err != nil {
		return err
	}
	fmt.Printf("valid backup: type=%s app=%s schema=%d created=%s size=%d\n", result.Manifest.Type, result.Manifest.ApplicationVersion, result.Manifest.DatabaseSchema, result.Manifest.CreatedAt.Format(time.RFC3339), result.Size)
	return nil
}

func restore(arguments []string) error {
	flags := flag.NewFlagSet("restore", flag.ContinueOnError)
	archive := flags.String("archive", "", "backup archive")
	passphraseFile := flags.String("passphrase-file", "", "file containing the backup passphrase")
	targetFile := flags.String("target-database-url-file", "", "0600 file containing the new empty target PostgreSQL URL")
	keyOutput := flags.String("credential-key-output", "", "new path for the restored credential key")
	pgRestore := flags.String("pg-restore", strings.TrimSpace(os.Getenv("PG_RESTORE_PATH")), "path to a matching pg_restore executable")
	confirmation := flags.String("confirm", "", "required destructive confirmation")
	if err := flags.Parse(arguments); err != nil {
		return err
	}
	passphrase, err := protectedFile(*passphraseFile, "passphrase")
	if err != nil {
		return err
	}
	target, err := protectedFile(*targetFile, "target database URL")
	if err != nil {
		return err
	}
	result, err := backup.Restore(context.Background(), backup.RestoreOptions{ArchivePath: *archive, Passphrase: passphrase, TargetDatabaseURL: target, CredentialKeyPath: *keyOutput, PGRestore: *pgRestore, TargetVersion: version.Current().Version, TargetSchema: database.LatestSchemaVersion(), Confirmation: *confirmation})
	if err != nil {
		return err
	}
	fmt.Printf("restore complete: source=%s schema=%d; install the protected credential key and restart the controller\n", result.Manifest.ApplicationVersion, result.Manifest.DatabaseSchema)
	return nil
}

func protectedFile(path, label string) (string, error) {
	if strings.TrimSpace(path) == "" {
		return "", fmt.Errorf("%s file is required", label)
	}
	linkInfo, err := os.Lstat(path)
	if err != nil {
		return "", err
	}
	if linkInfo.Mode()&os.ModeSymlink != 0 {
		return "", fmt.Errorf("%s file must not be a symbolic link", label)
	}
	file, err := os.Open(path)
	if err != nil {
		return "", err
	}
	defer file.Close()
	info, err := file.Stat()
	if err != nil {
		return "", err
	}
	if info.Mode().Perm()&0o077 != 0 {
		return "", fmt.Errorf("%s file must not be accessible by group or others", label)
	}
	if !info.Mode().IsRegular() {
		return "", fmt.Errorf("%s file must be a regular file", label)
	}
	data, err := io.ReadAll(io.LimitReader(file, 1025))
	if err != nil {
		return "", err
	}
	if len(data) > 1024 {
		return "", fmt.Errorf("%s file must not exceed 1024 bytes", label)
	}
	return strings.TrimSpace(string(data)), nil
}

func copyExclusive(source, target string) error {
	input, err := os.Open(source)
	if err != nil {
		return err
	}
	defer input.Close()
	output, err := os.OpenFile(target, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0o600)
	if err != nil {
		return err
	}
	_, copyErr := io.Copy(output, input)
	closeErr := output.Close()
	if copyErr != nil {
		_ = os.Remove(target)
		return copyErr
	}
	if closeErr != nil {
		_ = os.Remove(target)
	}
	return closeErr
}
