package app

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"testing"
	"time"
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

	// Scripts must live under home so validateHookScriptPath accepts them on all OSes.
	scriptsDir := filepath.Join(home, "scripts")
	if err := os.MkdirAll(scriptsDir, 0o755); err != nil {
		t.Fatalf("mkdir scripts: %v", err)
	}
	var scriptPath string
	if runtime.GOOS == "windows" {
		scriptPath = writeExecutableScript(t, scriptsDir, "ok.cmd", "@echo off\r\necho hook-ok\r\nexit /b 0\r\n")
	} else {
		scriptPath = writeExecutableScript(t, scriptsDir, "ok.sh", "#!/bin/sh\necho hook-ok\nexit 0\n")
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

func TestRunPreConnectHooks_Success(t *testing.T) {
	previous := disableWailsEvents
	disableWailsEvents = true
	t.Cleanup(func() { disableWailsEvents = previous })

	home := t.TempDir()
	t.Setenv("HOME", home)
	t.Setenv("USERPROFILE", home)

	app := NewApp()
	app.ctx = context.Background()

	// Scripts must live under home so validateHookScriptPath accepts them on all OSes.
	scriptsDir := filepath.Join(home, "scripts")
	if err := os.MkdirAll(scriptsDir, 0o755); err != nil {
		t.Fatalf("mkdir scripts: %v", err)
	}
	var scriptOne string
	var scriptTwo string
	if runtime.GOOS == "windows" {
		scriptOne = writeExecutableScript(t, scriptsDir, "hook-one.cmd", "@echo off\r\necho one\r\nexit /b 0\r\n")
		scriptTwo = writeExecutableScript(t, scriptsDir, "hook-two.cmd", "@echo off\r\necho two\r\nexit /b 0\r\n")
	} else {
		scriptOne = writeExecutableScript(t, scriptsDir, "hook-one.sh", "#!/bin/sh\necho one\nexit 0\n")
		scriptTwo = writeExecutableScript(t, scriptsDir, "hook-two.sh", "#!/bin/sh\necho two\nexit 0\n")
	}

	_, err := app.SaveHook(HookConfig{
		ID:             "hook-1",
		Name:           "one",
		Type:           hookTypePreConnect,
		ScriptPath:     scriptOne,
		TimeoutSeconds: 5,
		Enabled:        true,
		Scope:          hookScopeGlobal,
		ConnectionType: "kubernetes",
	})
	if err != nil {
		t.Fatalf("SaveHook hook-1: %v", err)
	}

	_, err = app.SaveHook(HookConfig{
		ID:             "hook-2",
		Name:           "two",
		Type:           hookTypePreConnect,
		ScriptPath:     scriptTwo,
		TimeoutSeconds: 5,
		Enabled:        true,
		Scope:          hookScopeConnection,
		ConnectionID:   "conn-1",
		ConnectionType: "kubernetes",
	})
	if err != nil {
		t.Fatalf("SaveHook hook-2: %v", err)
	}

	res, err := app.runPreConnectHooks("kubernetes", "conn-1", map[string]string{"KUBECONFIG": "x"})
	if err != nil {
		t.Fatalf("runPreConnectHooks error: %v", err)
	}
	if res.Aborted {
		t.Fatalf("unexpected abort: %+v", res)
	}
	if len(res.Results) != 2 {
		t.Fatalf("expected 2 results, got %d", len(res.Results))
	}
}

func TestRunPreConnectHooks_AbortOnFailure(t *testing.T) {
	previous := disableWailsEvents
	disableWailsEvents = true
	t.Cleanup(func() { disableWailsEvents = previous })

	home := t.TempDir()
	t.Setenv("HOME", home)
	t.Setenv("USERPROFILE", home)

	app := NewApp()
	app.ctx = context.Background()

	// Scripts must live under home so validateHookScriptPath accepts them on all OSes.
	scriptsDir := filepath.Join(home, "scripts")
	if err := os.MkdirAll(scriptsDir, 0o755); err != nil {
		t.Fatalf("mkdir scripts: %v", err)
	}
	var scriptPath string
	if runtime.GOOS == "windows" {
		scriptPath = writeExecutableScript(t, scriptsDir, "hook-fail.cmd", "@echo off\r\necho fail\r\nexit /b 5\r\n")
	} else {
		scriptPath = writeExecutableScript(t, scriptsDir, "hook-fail.sh", "#!/bin/sh\necho fail\nexit 5\n")
	}

	_, err := app.SaveHook(HookConfig{
		ID:             "hook-fail",
		Name:           "fail",
		Type:           hookTypePreConnect,
		ScriptPath:     scriptPath,
		TimeoutSeconds: 5,
		Enabled:        true,
		AbortOnFailure: true,
		Scope:          hookScopeGlobal,
		ConnectionType: "kubernetes",
	})
	if err != nil {
		t.Fatalf("SaveHook hook-fail: %v", err)
	}

	res, err := app.runPreConnectHooks("kubernetes", "conn-1", map[string]string{"KUBECONFIG": "x"})
	if err == nil {
		t.Fatal("expected error")
	}
	if !res.Aborted {
		t.Fatalf("expected aborted result, got %+v", res)
	}
	if len(res.Results) != 1 {
		t.Fatalf("expected 1 result, got %d", len(res.Results))
	}
}

func TestRunPostConnectHooksAsync_Executes(t *testing.T) {
	previous := disableWailsEvents
	disableWailsEvents = true
	t.Cleanup(func() { disableWailsEvents = previous })

	home := t.TempDir()
	t.Setenv("HOME", home)
	t.Setenv("USERPROFILE", home)

	app := NewApp()
	app.ctx = context.Background()

	// Scripts must live under home so validateHookScriptPath accepts them on all OSes.
	scriptsDir := filepath.Join(home, "scripts")
	if err := os.MkdirAll(scriptsDir, 0o755); err != nil {
		t.Fatalf("mkdir scripts: %v", err)
	}
	outFile := filepath.Join(scriptsDir, "post-hook.txt")

	var scriptPath string
	if runtime.GOOS == "windows" {
		scriptPath = writeExecutableScript(
			t,
			scriptsDir,
			"hook-post.cmd",
			fmt.Sprintf("@echo off\r\necho ok> \"%s\"\r\nexit /b 0\r\n", outFile),
		)
	} else {
		scriptPath = writeExecutableScript(
			t,
			scriptsDir,
			"hook-post.sh",
			fmt.Sprintf("#!/bin/sh\necho ok > \"%s\"\nexit 0\n", outFile),
		)
	}

	_, err := app.SaveHook(HookConfig{
		ID:             "hook-post",
		Name:           "post",
		Type:           hookTypePostConnect,
		ScriptPath:     scriptPath,
		TimeoutSeconds: 5,
		Enabled:        true,
		Scope:          hookScopeGlobal,
		ConnectionType: "kubernetes",
	})
	if err != nil {
		t.Fatalf("SaveHook hook-post: %v", err)
	}

	app.runPostConnectHooksAsync("kubernetes", "conn-1", map[string]string{"KUBECONFIG": "x"})

	deadline := time.Now().Add(2 * time.Second)
	for {
		if _, err := os.Stat(outFile); err == nil {
			return
		}
		if time.Now().After(deadline) {
			t.Fatalf("expected post-connect hook to create %s", outFile)
		}
		time.Sleep(20 * time.Millisecond)
	}
}
