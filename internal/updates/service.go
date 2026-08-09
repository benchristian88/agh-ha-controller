package updates

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/benchristian88/agh-ha-controller/internal/version"
)

const latestReleaseURL = "https://api.github.com/repos/benchristian88/agh-ha-controller/releases/latest"

type Cache struct {
	Version      string    `json:"latestVersion,omitempty"`
	ReleaseURL   string    `json:"releaseUrl,omitempty"`
	ReleaseNotes string    `json:"releaseNotes,omitempty"`
	CheckedAt    time.Time `json:"lastChecked,omitempty"`
	ExpiresAt    time.Time `json:"-"`
	ErrorCode    string    `json:"errorCode,omitempty"`
}

type Repository interface {
	ControllerReleaseCache(context.Context) (Cache, error)
	SaveControllerReleaseCache(context.Context, Cache) error
	UpdateChecksEnabled(context.Context) (bool, error)
}

type Status struct {
	InstalledVersion string    `json:"installedVersion"`
	BuildIdentifier  string    `json:"buildIdentifier"`
	BuildDate        string    `json:"buildDate"`
	Development      bool      `json:"development"`
	LatestVersion    string    `json:"latestVersion,omitempty"`
	State            string    `json:"state"`
	ReleaseURL       string    `json:"releaseUrl,omitempty"`
	ReleaseNotes     string    `json:"releaseNotes,omitempty"`
	LastChecked      time.Time `json:"lastChecked,omitempty"`
	ErrorCode        string    `json:"errorCode,omitempty"`
	InstallationType string    `json:"installationType"`
	UpdateMethod     string    `json:"updateMethod"`
	UpdateCommand    string    `json:"updateCommand,omitempty"`
	BackupRequired   bool      `json:"backupRequired"`
}

type Service struct {
	repository       Repository
	client           *http.Client
	now              func() time.Time
	cacheTTL         time.Duration
	installationType string
}

func NewService(repository Repository, installationType string) *Service {
	return &Service{repository: repository, client: &http.Client{Timeout: 10 * time.Second}, now: time.Now, cacheTTL: 6 * time.Hour, installationType: installationType}
}

func (s *Service) Status(ctx context.Context, force bool) (Status, error) {
	cache, err := s.repository.ControllerReleaseCache(ctx)
	enabled, settingErr := s.repository.UpdateChecksEnabled(ctx)
	if settingErr == nil && !enabled {
		status := s.build(cache)
		status.State = "unknown"
		status.ErrorCode = "CONTROLLER_UPDATE_CHECKS_DISABLED"
		return status, nil
	}
	if force || err != nil || cache.ExpiresAt.IsZero() || !s.now().UTC().Before(cache.ExpiresAt) {
		if refreshErr := s.refresh(ctx, cache); refreshErr != nil {
			cache, err = s.repository.ControllerReleaseCache(ctx)
			if err != nil {
				return s.build(Cache{ErrorCode: "CONTROLLER_UPDATE_CHECK_UNAVAILABLE"}), nil
			}
		} else {
			cache, err = s.repository.ControllerReleaseCache(ctx)
			if err != nil {
				return Status{}, err
			}
		}
	}
	return s.build(cache), nil
}

func (s *Service) refresh(ctx context.Context, previous Cache) error {
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, latestReleaseURL, nil)
	if err != nil {
		return err
	}
	request.Header.Set("Accept", "application/vnd.github+json")
	request.Header.Set("User-Agent", "AGH-HA-Controller")
	response, err := s.client.Do(request)
	if err != nil {
		return s.failure(ctx, previous, "CONTROLLER_UPDATE_CHECK_UNAVAILABLE")
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		code := "CONTROLLER_UPDATE_CHECK_UNAVAILABLE"
		if response.StatusCode == http.StatusForbidden || response.StatusCode == http.StatusTooManyRequests {
			code = "CONTROLLER_UPDATE_CHECK_RATE_LIMITED"
		}
		return s.failure(ctx, previous, code)
	}
	body, err := io.ReadAll(io.LimitReader(response.Body, 128*1024+1))
	if err != nil || len(body) > 128*1024 {
		return s.failure(ctx, previous, "CONTROLLER_UPDATE_METADATA_INVALID")
	}
	var payload struct {
		TagName    string `json:"tag_name"`
		HTMLURL    string `json:"html_url"`
		Body       string `json:"body"`
		Draft      bool   `json:"draft"`
		Prerelease bool   `json:"prerelease"`
	}
	if json.Unmarshal(body, &payload) != nil || payload.Draft || payload.Prerelease || !validRelease(payload.TagName, payload.HTMLURL) {
		return s.failure(ctx, previous, "CONTROLLER_UPDATE_METADATA_INVALID")
	}
	if utf8.RuneCountInString(payload.Body) > 20000 {
		payload.Body = string([]rune(payload.Body)[:20000])
	}
	now := s.now().UTC()
	return s.repository.SaveControllerReleaseCache(ctx, Cache{Version: strings.TrimPrefix(strings.TrimSpace(payload.TagName), "v"), ReleaseURL: payload.HTMLURL, ReleaseNotes: payload.Body, CheckedAt: now, ExpiresAt: now.Add(s.cacheTTL)})
}

func (s *Service) failure(ctx context.Context, previous Cache, code string) error {
	now := s.now().UTC()
	previous.CheckedAt, previous.ExpiresAt, previous.ErrorCode = now, now.Add(15*time.Minute), code
	if err := s.repository.SaveControllerReleaseCache(ctx, previous); err != nil {
		return err
	}
	return errors.New("controller update check failed")
}

func (s *Service) build(cache Cache) Status {
	current := version.Current()
	status := Status{InstalledVersion: current.Version, BuildIdentifier: current.Commit, BuildDate: current.BuiltAt, Development: current.Development, LatestVersion: cache.Version, ReleaseURL: cache.ReleaseURL, ReleaseNotes: cache.ReleaseNotes, LastChecked: cache.CheckedAt, ErrorCode: cache.ErrorCode, InstallationType: s.installationType, BackupRequired: true}
	if current.Development {
		status.State = "development"
	} else if cache.Version == "" {
		status.State = "unknown"
	} else if compare(cache.Version, current.Version) > 0 {
		status.State = "update_available"
	} else {
		status.State = "up_to_date"
	}
	switch s.installationType {
	case "docker":
		status.UpdateMethod = "On the Docker Compose host, set CONTROLLER_VERSION in .env to the reviewed target, check out that release, rebuild, and recreate the service after creating a backup. This repository currently ships a source-build Compose definition rather than claiming a published image."
		if cache.Version != "" {
			status.UpdateCommand = "git fetch --tags\ngit checkout v" + cache.Version + "\ndocker compose build --pull\ndocker compose up --detach"
		}
	case "native_systemd":
		status.UpdateMethod = "Verify the target release tag/commit and published artifact checksums, check out that exact release, then rerun the source-build systemd installer. Existing configuration and database state are preserved."
		if cache.Version != "" {
			status.UpdateCommand = "git fetch --tags\ngit checkout v" + cache.Version + "\nsudo CONTROLLER_VERSION=" + cache.Version + " PUBLIC_BASE_URL=https://controller.example.test ./scripts/install-systemd.sh"
		}
	default:
		status.UpdateMethod = "Use the documented procedure for this installation and verify the release checksum before restarting."
	}
	return status
}

func validRelease(tag, rawURL string) bool {
	if len(tag) > 64 || len(rawURL) > 2048 {
		return false
	}
	if _, _, _, ok := parts(strings.TrimPrefix(strings.TrimSpace(tag), "v")); !ok {
		return false
	}
	parsed, err := url.Parse(rawURL)
	return err == nil && parsed.Scheme == "https" && parsed.Host == "github.com" && strings.HasPrefix(parsed.Path, "/benchristian88/agh-ha-controller/releases/")
}

func compare(left, right string) int {
	lMajor, lMinor, lPatch, lOK := parts(strings.TrimPrefix(left, "v"))
	rMajor, rMinor, rPatch, rOK := parts(strings.TrimPrefix(right, "v"))
	if !lOK || !rOK {
		return 0
	}
	for _, pair := range [][2]int{{lMajor, rMajor}, {lMinor, rMinor}, {lPatch, rPatch}} {
		if pair[0] < pair[1] {
			return -1
		}
		if pair[0] > pair[1] {
			return 1
		}
	}
	return 0
}

func parts(value string) (int, int, int, bool) {
	fields := strings.Split(value, ".")
	if len(fields) != 3 || strings.ContainsAny(value, "+-") {
		return 0, 0, 0, false
	}
	major, e1 := strconv.Atoi(fields[0])
	minor, e2 := strconv.Atoi(fields[1])
	patch, e3 := strconv.Atoi(fields[2])
	return major, minor, patch, e1 == nil && e2 == nil && e3 == nil
}
