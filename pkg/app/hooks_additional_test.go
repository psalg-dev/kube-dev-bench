package app

import (
	"context"
	"os"
	"path/filepath"
	"runtime"
	"testing"
)

func TestSelectHookScript_UsesE2EOverride(t *testing.T) {
	dir := t.TempDir()
	t.Setenv("KDB_E2E_DIALOG_DIR", dir)

	expected := filepath.Join(dir, "hook.ps1")
	if err := os.WriteFile(filepath.Join(dir, "open-path.txt"), []byte(" "+expected+" "), 0o644); err != nil {
		t.Fatalf("write override: %v", err)
	}

	app := &App{ctx: context.Background()}
	got, err := app.SelectHookScript()
	if err != nil {
		t.Fatalf("SelectHookScript failed: %v", err)
	}
	if got != expected {
		t.Fatalf("SelectHookScript = %q, want %q", got, expected)
	}
}

func TestHook_ExecutesScript(t *testing.T) {
	home := t.TempDir()
	t.Setenv("HOME", home)
	t.Setenv("USERPROFILE", home)

	app := NewApp()

	tmp := t.TempDir()
	var scriptPath string
	if runtime.GOOS == "windows" {
		scriptPath = writeExecutableScript(t, tmp, "ok.cmd", "@echo off\r\necho hook-ok\r\nexit /b 0\r\n")
	} else {
		scriptPath = writeExecutableScript(t, tmp, "ok.sh", "#!/bin/sh\necho hook-ok\nexit 0\n")
	}

	hook, err := app.SaveHook(HookConfig{
		ID:             "hook-1",
		Name:           "ok",
		ScriptPath:     scriptPath,
		TimeoutSeconds: 5,
		Enabled:        true,
	})
	if err != nil {
		t.Fatalf("SaveHook failed: %v", err)
	}

	res, err := app.TestHook(hook.ID)
	if err != nil {
		t.Fatalf("TestHook failed: %v", err)
	}
	if !res.Success {
		t.Fatalf("expected success, got %+v", res)
	}
	if res.HookID != hook.ID {
		t.Fatalf("expected hook ID %q, got %q", hook.ID, res.HookID)
	}
}

func TestEmitHookEvents_NoPanic(t *testing.T) {
	previous := disableWailsEvents
	disableWailsEvents = true
	t.Cleanup(func() { disableWailsEvents = previous })

	app := &App{ctx: context.Background()}
	hook := HookConfig{ID: "hook-1", Name: "test"}
	result := HookExecutionResult{HookID: "hook-1", Success: true}

	app.emitHookStarted(hook, "kubernetes", "conn-1")
	app.emitHookCompleted(hook, result, "kubernetes", "conn-1")
}
