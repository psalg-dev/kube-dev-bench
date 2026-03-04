package app

import (
	"context"
	"path/filepath"
	"testing"
	"time"
)

func TestStartSessionProbe_DisabledByDefault(t *testing.T) {
	a := &App{
		ctx:                  context.Background(),
		sessionProbeInterval: 0,
	}
	// Should not panic and should not start a goroutine
	a.startSessionProbe()

	// sessionProbeCancel should remain nil when disabled
	if a.sessionProbeCancel != nil {
		t.Error("sessionProbeCancel should be nil when probe is disabled")
	}
}

func TestStartSessionProbe_StartsWhenEnabled(t *testing.T) {
	a := &App{
		ctx:                  context.Background(),
		sessionProbeInterval: 5 * time.Minute,
	}
	a.startSessionProbe()
	defer a.stopSessionProbe()

	if a.sessionProbeCancel == nil {
		t.Error("sessionProbeCancel should be set when probe is started")
	}
}

func TestStopSessionProbe_StopsCleanly(t *testing.T) {
	a := &App{
		ctx:                  context.Background(),
		sessionProbeInterval: 5 * time.Minute,
	}
	a.startSessionProbe()
	a.stopSessionProbe()

	if a.sessionProbeCancel != nil {
		t.Error("sessionProbeCancel should be nil after stop")
	}
}

func TestStopSessionProbe_NoOpWhenNotStarted(t *testing.T) {
	a := &App{}
	// Should not panic
	a.stopSessionProbe()
}

func TestSetSessionProbeInterval(t *testing.T) {
	dir := t.TempDir()
	a := &App{
		ctx:        context.Background(),
		configPath: filepath.Join(dir, "config.json"),
	}

	if err := a.SetSessionProbeInterval(10); err != nil {
		t.Fatalf("SetSessionProbeInterval should succeed, got: %v", err)
	}
	if a.sessionProbeInterval != 10*time.Minute {
		t.Errorf("sessionProbeInterval = %v, want %v", a.sessionProbeInterval, 10*time.Minute)
	}

	if err := a.SetSessionProbeInterval(0); err != nil {
		t.Fatalf("SetSessionProbeInterval(0) should succeed, got: %v", err)
	}
	if a.sessionProbeInterval != 0 {
		t.Errorf("sessionProbeInterval = %v, want 0", a.sessionProbeInterval)
	}
}

func TestGetSessionProbeInterval(t *testing.T) {
	a := &App{sessionProbeInterval: 15 * time.Minute}
	if got := a.GetSessionProbeInterval(); got != 15 {
		t.Errorf("GetSessionProbeInterval() = %d, want 15", got)
	}

	a.sessionProbeInterval = 0
	if got := a.GetSessionProbeInterval(); got != 0 {
		t.Errorf("GetSessionProbeInterval() = %d, want 0", got)
	}
}

func TestRefreshCredentials_EmptyContext(t *testing.T) {
	a := &App{currentKubeContext: ""}
	// Should be a no-op
	if err := a.RefreshCredentials(""); err != nil {
		t.Fatalf("RefreshCredentials with empty context should be no-op, got: %v", err)
	}
}
