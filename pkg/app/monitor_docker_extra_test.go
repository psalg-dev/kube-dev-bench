package app

import (
	"context"
	"os"
	"path/filepath"
	"runtime"
	"testing"

	dockerpkg "gowails/pkg/app/docker"
)

// ─── monitorIssuesPath ───────────────────────────────────────────────────────

// TestMonitorIssuesPath_EnvVar exercises the KDB_MONITOR_ISSUES_PATH override
// branch (currently at 83.3%).
func TestMonitorIssuesPath_EnvVar(t *testing.T) {
	want := filepath.Join(t.TempDir(), "custom-issues.json")
	t.Setenv("KDB_MONITOR_ISSUES_PATH", want)

	got, err := monitorIssuesPath()
	if err != nil {
		t.Fatalf("monitorIssuesPath() error = %v", err)
	}
	if got != want {
		t.Errorf("monitorIssuesPath() = %q, want %q", got, want)
	}
}

// ─── savePersistedIssues / loadPersistedIssues ───────────────────────────────

// TestSaveAndLoadPersistedIssues_RoundTrip verifies that issues written by
// savePersistedIssues are faithfully read back by loadPersistedIssues.
func TestSaveAndLoadPersistedIssues_RoundTrip(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "issues.json")
	t.Setenv("KDB_MONITOR_ISSUES_PATH", path)

	issues := map[string]PersistedIssue{
		"dep-default-web-Crashing": {
			IssueID:        "dep-default-web-Crashing",
			Dismissed:      false,
			HolmesAnalysis: "some analysis text",
		},
	}

	if err := savePersistedIssues(issues); err != nil {
		t.Fatalf("savePersistedIssues() error = %v", err)
	}

	loaded, err := loadPersistedIssues()
	if err != nil {
		t.Fatalf("loadPersistedIssues() error = %v", err)
	}
	if len(loaded) != 1 {
		t.Fatalf("expected 1 persisted issue, got %d", len(loaded))
	}
	got := loaded["dep-default-web-Crashing"]
	if got.IssueID != "dep-default-web-Crashing" {
		t.Errorf("IssueID = %q, want 'dep-default-web-Crashing'", got.IssueID)
	}
	if got.HolmesAnalysis != "some analysis text" {
		t.Errorf("HolmesAnalysis = %q, want 'some analysis text'", got.HolmesAnalysis)
	}
}

// TestSavePersistedIssues_Empty saves an empty map (exercises the MkdirAll /
// WriteFile path with empty JSON object).
func TestSavePersistedIssues_Empty(t *testing.T) {
	path := filepath.Join(t.TempDir(), "issues.json")
	t.Setenv("KDB_MONITOR_ISSUES_PATH", path)

	if err := savePersistedIssues(map[string]PersistedIssue{}); err != nil {
		t.Fatalf("savePersistedIssues(empty) error = %v", err)
	}
	if _, err := os.Stat(path); err != nil {
		t.Errorf("expected file to exist: %v", err)
	}
}

// TestLoadPersistedIssues_EmptyContent exercises the len(data)==0 branch that
// returns an empty map rather than a JSON parse error.
func TestLoadPersistedIssues_EmptyContent(t *testing.T) {
	path := filepath.Join(t.TempDir(), "issues.json")
	t.Setenv("KDB_MONITOR_ISSUES_PATH", path)
	if err := os.WriteFile(path, []byte{}, 0o600); err != nil {
		t.Fatalf("setup: %v", err)
	}

	issues, err := loadPersistedIssues()
	if err != nil {
		t.Fatalf("loadPersistedIssues() error = %v", err)
	}
	if len(issues) != 0 {
		t.Errorf("expected empty map, got %d entries", len(issues))
	}
}

// TestLoadPersistedIssues_InvalidJSON exercises the json.Unmarshal error branch.
func TestLoadPersistedIssues_InvalidJSON(t *testing.T) {
	path := filepath.Join(t.TempDir(), "issues.json")
	t.Setenv("KDB_MONITOR_ISSUES_PATH", path)
	if err := os.WriteFile(path, []byte("NOT JSON"), 0o600); err != nil {
		t.Fatalf("setup: %v", err)
	}

	_, err := loadPersistedIssues()
	if err == nil {
		t.Error("expected an error for invalid JSON, got nil")
	}
}

// ─── enrichMonitorInfo ───────────────────────────────────────────────────────

// TestEnrichMonitorInfo_WithLoadError covers the loadPersistedIssues error
// path (currently uncovered) inside enrichMonitorInfo.  The file at the
// KDB_MONITOR_ISSUES_PATH contains invalid JSON so that loadPersistedIssues
// returns an error, triggering the fallback branch that only assigns IssueIDs.
func TestEnrichMonitorInfo_WithLoadError(t *testing.T) {
	path := filepath.Join(t.TempDir(), "bad.json")
	t.Setenv("KDB_MONITOR_ISSUES_PATH", path)
	if err := os.WriteFile(path, []byte("{bad json}"), 0o600); err != nil {
		t.Fatalf("setup: %v", err)
	}

	app := &App{ctx: context.Background()}
	info := MonitorInfo{
		Warnings: []MonitorIssue{{Resource: "Pod", Namespace: "default", Name: "mypod", Reason: "OOMKilled"}},
		Errors:   []MonitorIssue{{Resource: "Deploy", Namespace: "default", Name: "web", Reason: "Crash"}},
	}
	enriched := app.enrichMonitorInfo(info)

	// IssueIDs should be generated even in the error path.
	for _, w := range enriched.Warnings {
		if w.IssueID == "" {
			t.Error("expected IssueID to be set on warning issue after load error")
		}
	}
	for _, e := range enriched.Errors {
		if e.IssueID == "" {
			t.Error("expected IssueID to be set on error issue after load error")
		}
	}
}

// ─── resolveWorkingDockerConfig ──────────────────────────────────────────────

// TestResolveWorkingDockerConfig_InvalidHost calls resolveWorkingDockerConfig
// with an unreachable Docker host.  The function must return gracefully with
// Connected=false rather than panicking or hanging.
func TestResolveWorkingDockerConfig_InvalidHost(t *testing.T) {
	app := &App{ctx: context.Background()}
	cfg := dockerpkg.DockerConfig{Host: "tcp://127.0.0.1:19999"}

	resolvedCfg, status := app.resolveWorkingDockerConfig(cfg)

	// We don't assert Connected because the local environment may or may not
	// have Docker running; we only require that the call completes without panic.
	_ = resolvedCfg
	if status == nil {
		t.Error("expected non-nil status from resolveWorkingDockerConfig")
	}
}

// TestResolveWorkingDockerConfig_EmptyHost passes an empty host so the
// function falls back to DefaultDockerHost() candidates.
func TestResolveWorkingDockerConfig_EmptyHost(t *testing.T) {
	app := &App{ctx: context.Background()}
	cfg := dockerpkg.DockerConfig{Host: ""}

	_, status := app.resolveWorkingDockerConfig(cfg)
	// Only require that the call completes and returns a non-nil status.
	if status == nil {
		t.Error("expected non-nil status")
	}
}

// ─── TestDockerConnection ────────────────────────────────────────────────────

// TestTestDockerConnection_InvalidHost exercises the one-line delegation to
// docker.TestConnection.  With an unreachable host it returns an error or a
// disconnected status rather than panicking.
func TestTestDockerConnection_InvalidHost(t *testing.T) {
	app := &App{ctx: context.Background()}
	status, err := app.TestDockerConnection(dockerpkg.DockerConfig{Host: "tcp://127.0.0.1:19999"})

	// Either an error is returned or the status shows not connected; both are
	// acceptable outcomes when the target is unreachable.
	if err == nil && status != nil && status.Connected {
		t.Error("unexpected successful connection to unreachable Docker host")
	}
}

// ─── GetImageUpdateSettings / SetImageUpdateSettings ─────────────────────────

// setTestHomeForSettings points USERPROFILE (Windows) or HOME (other) to a
// temp directory so that image-update-settings.json is isolated to the test.
func setTestHomeForSettings(t *testing.T) string {
	t.Helper()
	dir := t.TempDir()
	if runtime.GOOS == "windows" {
		t.Setenv("USERPROFILE", dir)
	} else {
		t.Setenv("HOME", dir)
	}
	return dir
}

// TestGetImageUpdateSettings_NoFile verifies that LoadImageUpdateSettings
// returns defaults when the file does not exist.
func TestGetImageUpdateSettings_NoFile(t *testing.T) {
	setTestHomeForSettings(t)
	app := &App{ctx: context.Background()}
	settings, err := app.GetImageUpdateSettings()
	if err != nil {
		t.Fatalf("GetImageUpdateSettings() error = %v", err)
	}
	// Defaults: Enabled=false, IntervalSeconds > 0
	if settings.Enabled {
		t.Error("expected Enabled=false for default settings")
	}
	if settings.IntervalSeconds <= 0 {
		t.Errorf("expected positive IntervalSeconds, got %d", settings.IntervalSeconds)
	}
}

// TestSetAndGetImageUpdateSettings_RoundTrip verifies that settings saved via
// SetImageUpdateSettings are returned by a subsequent GetImageUpdateSettings.
func TestSetAndGetImageUpdateSettings_RoundTrip(t *testing.T) {
	setTestHomeForSettings(t)
	app := &App{ctx: context.Background()}

	want := dockerpkg.ImageUpdateSettings{Enabled: true, IntervalSeconds: 120}
	if err := app.SetImageUpdateSettings(want); err != nil {
		t.Fatalf("SetImageUpdateSettings() error = %v", err)
	}

	got, err := app.GetImageUpdateSettings()
	if err != nil {
		t.Fatalf("GetImageUpdateSettings() after set error = %v", err)
	}
	if got.Enabled != want.Enabled {
		t.Errorf("Enabled = %v, want %v", got.Enabled, want.Enabled)
	}
	if got.IntervalSeconds != want.IntervalSeconds {
		t.Errorf("IntervalSeconds = %d, want %d", got.IntervalSeconds, want.IntervalSeconds)
	}
}
