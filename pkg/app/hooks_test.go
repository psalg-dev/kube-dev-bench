package app

import (
	"encoding/json"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
	"time"
)

func writeExecutableScript(t *testing.T, dir string, name string, contents string) string {
	t.Helper()
	p := filepath.Join(dir, name)
	if err := os.WriteFile(p, []byte(contents), 0o755); err != nil {
		t.Fatalf("write script: %v", err)
	}
	if runtime.GOOS != "windows" {
		if err := os.Chmod(p, 0o755); err != nil {
			t.Fatalf("chmod: %v", err)
		}
	}
	return p
}

func TestHookConfig_JSONRoundTrip(t *testing.T) {
	in := HookConfig{
		ID:             "abc",
		Name:           "My Hook",
		Type:           "pre-connect",
		ScriptPath:     "/tmp/hook.sh",
		TimeoutSeconds: 12,
		AbortOnFailure: true,
		Enabled:        true,
		Scope:          "connection",
		ConnectionID:   "id1",
		ConnectionType: "kubernetes",
	}

	b, err := json.Marshal(in)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}

	var out HookConfig
	if err := json.Unmarshal(b, &out); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}

	if out.ID != in.ID || out.Name != in.Name || out.Type != in.Type || out.ScriptPath != in.ScriptPath {
		t.Fatalf("roundtrip mismatch: %#v vs %#v", out, in)
	}
}

func TestExecuteHook_SuccessAndEnv(t *testing.T) {
	tmp := t.TempDir()

	var scriptPath string
	if runtime.GOOS == "windows" {
		scriptPath = writeExecutableScript(t, tmp, "ok.cmd", "@echo off\r\necho hello\r\necho KUBECONFIG=%KUBECONFIG%\r\nexit /b 0\r\n")
	} else {
		scriptPath = writeExecutableScript(t, tmp, "ok.sh", "#!/bin/sh\necho hello\necho KUBECONFIG=$KUBECONFIG\nexit 0\n")
	}

	h := HookConfig{ID: "1", Name: "ok", ScriptPath: scriptPath, TimeoutSeconds: 5}
	res, err := executeHook(h, map[string]string{"KUBECONFIG": "XYZ"})
	if err != nil {
		t.Fatalf("executeHook returned error: %v", err)
	}
	if !res.Success {
		t.Fatalf("expected success, got: %+v", res)
	}
	if !strings.Contains(res.Stdout, "hello") {
		t.Fatalf("expected stdout to contain hello, got: %q", res.Stdout)
	}
	if !strings.Contains(res.Stdout, "KUBECONFIG=XYZ") {
		t.Fatalf("expected env var in stdout, got: %q", res.Stdout)
	}
}

func TestExecuteHook_Timeout(t *testing.T) {
	tmp := t.TempDir()

	var scriptPath string
	if runtime.GOOS == "windows" {
		// ping -n 6 ~ 5 seconds
		scriptPath = writeExecutableScript(t, tmp, "sleep.cmd", "@echo off\r\nping -n 6 127.0.0.1 > nul\r\nexit /b 0\r\n")
	} else {
		scriptPath = writeExecutableScript(t, tmp, "sleep.sh", "#!/bin/sh\nsleep 5\nexit 0\n")
	}

	h := HookConfig{ID: "1", Name: "sleep", ScriptPath: scriptPath, TimeoutSeconds: 1}
	start := time.Now()
	res, err := executeHook(h, nil)
	if err == nil {
		t.Fatalf("expected timeout error")
	}
	if !res.TimedOut {
		t.Fatalf("expected TimedOut=true, got: %+v", res)
	}
	if time.Since(start) > 10*time.Second {
		t.Fatalf("timeout took too long")
	}
}

func TestExecuteHook_NotFound(t *testing.T) {
	h := HookConfig{ID: "1", Name: "missing", ScriptPath: filepath.Join(t.TempDir(), "nope"), TimeoutSeconds: 1}
	_, err := executeHook(h, nil)
	if err == nil {
		t.Fatalf("expected error")
	}
}

func TestExecuteHook_NonZeroExit(t *testing.T) {
	tmp := t.TempDir()

	var scriptPath string
	if runtime.GOOS == "windows" {
		scriptPath = writeExecutableScript(t, tmp, "bad.cmd", "@echo off\r\necho nope\r\nexit /b 5\r\n")
	} else {
		scriptPath = writeExecutableScript(t, tmp, "bad.sh", "#!/bin/sh\necho nope\nexit 5\n")
	}

	h := HookConfig{ID: "1", Name: "bad", ScriptPath: scriptPath, TimeoutSeconds: 5}
	res, err := executeHook(h, nil)
	if err == nil {
		t.Fatalf("expected error")
	}
	if res.ExitCode != 5 {
		t.Fatalf("expected exit code 5, got %d", res.ExitCode)
	}
}

func TestHooksConfig_CRUD(t *testing.T) {
	home := t.TempDir()
	t.Setenv("HOME", home)
	t.Setenv("USERPROFILE", home)

	app := NewApp()

	// Create
	h, err := app.SaveHook(HookConfig{
		Name:           "test",
		Type:           "pre-connect",
		ScriptPath:     filepath.Join(home, "noop"),
		TimeoutSeconds: 1,
		Enabled:        true,
		Scope:          "global",
		ConnectionType: "kubernetes",
	})
	if err == nil {
		// script doesn't exist; SaveHook shouldn't validate it
	} else {
		t.Fatalf("SaveHook: %v", err)
	}
	if strings.TrimSpace(h.ID) == "" {
		t.Fatalf("expected generated ID")
	}

	// Read
	cfg, err := app.GetHooksConfig()
	if err != nil {
		t.Fatalf("GetHooksConfig: %v", err)
	}
	if len(cfg.Hooks) != 1 {
		t.Fatalf("expected 1 hook, got %d", len(cfg.Hooks))
	}

	// Update
	h.Name = "updated"
	if _, err := app.SaveHook(h); err != nil {
		t.Fatalf("SaveHook update: %v", err)
	}
	cfg2, _ := app.GetHooksConfig()
	if cfg2.Hooks[0].Name != "updated" {
		t.Fatalf("expected updated name")
	}

	// Delete
	if err := app.DeleteHook(h.ID); err != nil {
		t.Fatalf("DeleteHook: %v", err)
	}
	cfg3, _ := app.GetHooksConfig()
	if len(cfg3.Hooks) != 0 {
		t.Fatalf("expected hooks empty")
	}
}
