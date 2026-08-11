package api

import (
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"github.com/benchristian88/agh-ha-controller/internal/backup"
	"github.com/benchristian88/agh-ha-controller/internal/database"
	"github.com/benchristian88/agh-ha-controller/internal/domain"
	"github.com/benchristian88/agh-ha-controller/internal/version"
)

func (s *Server) handleCreateBackup(response http.ResponseWriter, request *http.Request) {
	_ = http.NewResponseController(response).SetWriteDeadline(time.Now().Add(30 * time.Minute))
	var input struct {
		Type       backup.Type `json:"type"`
		Passphrase string      `json:"passphrase"`
	}
	if err := decodeJSON(response, request, &input); err != nil {
		s.writeError(response, request, err)
		return
	}
	result, err := s.backups.Create(request.Context(), input.Type, input.Passphrase, actor(request.Context()))
	input.Passphrase = ""
	if err != nil {
		s.writeError(response, request, err)
		return
	}
	defer backup.Cleanup(result)
	file, err := os.Open(result.Path)
	if err != nil {
		s.writeError(response, request, err)
		return
	}
	defer file.Close()
	response.Header().Set("Content-Type", "application/vnd.aghha.backup")
	response.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, filepath.Base(result.Path)))
	response.Header().Set("Content-Length", fmt.Sprintf("%d", result.Size))
	response.Header().Set("X-Backup-Type", string(result.Manifest.Type))
	response.Header().Set("X-Backup-Schema-Version", fmt.Sprintf("%d", result.Manifest.DatabaseSchema))
	response.Header().Set("X-Backup-Application-Version", result.Manifest.ApplicationVersion)
	response.Header().Set("X-Backup-Created-At", result.Manifest.CreatedAt.Format(time.RFC3339))
	if _, err := io.Copy(response, file); err != nil {
		s.logger.WarnContext(request.Context(), "backup download interrupted", "request_id", requestID(request.Context()), "error", err)
	}
}

func (s *Server) handleRestorePreflight(response http.ResponseWriter, request *http.Request) {
	controller := http.NewResponseController(response)
	_ = controller.SetReadDeadline(time.Now().Add(30 * time.Minute))
	_ = controller.SetWriteDeadline(time.Now().Add(30 * time.Minute))
	request.Body = http.MaxBytesReader(response, request.Body, backup.MaxArchiveBytes+(1<<20))
	if err := request.ParseMultipartForm(1 << 20); err != nil {
		s.writeError(response, request, domain.Validation("archive", "must be a bounded multipart backup upload"))
		return
	}
	if request.MultipartForm != nil {
		defer request.MultipartForm.RemoveAll()
	}
	passphrase := request.FormValue("passphrase")
	archive, _, err := request.FormFile("archive")
	if err != nil {
		s.writeError(response, request, domain.Validation("archive", "is required"))
		return
	}
	defer archive.Close()
	path, cleanup, err := copyUploadedBackup(archive)
	if err != nil {
		s.writeError(response, request, err)
		return
	}
	defer cleanup()
	result, err := backup.Preflight(path, passphrase, "")
	passphrase = ""
	if err == nil {
		err = backup.ValidateCompatibility(result.Manifest, version.Current().Version, database.LatestSchemaVersion())
	}
	if err != nil {
		s.writeError(response, request, err)
		return
	}
	writeJSON(response, http.StatusOK, map[string]any{
		"valid": result.Valid, "manifest": result.Manifest, "sizeBytes": result.Size,
		"plan": map[string]any{
			"execution": "offline_cli", "requiresRestart": true,
			"replaces":            []string{"users", "nodes", "desired state", "revisions", "deployments", "drift", "system settings"},
			"retains":             []string{"target database credentials", "public URL", "reverse-proxy TLS", "target session secret"},
			"sessionsInvalidated": true,
		},
	})
}

func copyUploadedBackup(source multipart.File) (string, func(), error) {
	directory, err := os.MkdirTemp("", "aghha-upload-")
	if err != nil {
		return "", func() {}, err
	}
	cleanup := func() { _ = os.RemoveAll(directory) }
	if err := os.Chmod(directory, 0o700); err != nil {
		cleanup()
		return "", func() {}, err
	}
	path := filepath.Join(directory, "upload.aghhabackup")
	target, err := os.OpenFile(path, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0o600)
	if err != nil {
		cleanup()
		return "", func() {}, err
	}
	written, copyErr := io.Copy(target, io.LimitReader(source, backup.MaxArchiveBytes+1))
	closeErr := target.Close()
	if copyErr != nil || closeErr != nil || written > backup.MaxArchiveBytes {
		cleanup()
		return "", func() {}, domain.Validation("archive", "exceeds the supported size or could not be stored safely")
	}
	return path, cleanup, nil
}
