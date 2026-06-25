package app

import (
	"context"
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
	home := t.TempDir()
	t.Setenv("HOME", home)
	t.Setenv("USERPROFILE", home)

	scriptsDir := filepath.Join(home, "scripts")
	if err := os.MkdirAll(scriptsDir, 0o755); err != nil {
		t.Fatalf("mkdir scripts: %v", err)
	}
	var scriptPath string
	if runtime.GOOS == "windows" {
		scriptPath = writeExecutableScript(t, scriptsDir, "ok.cmd", "@echo off\r\necho hello\r\necho KUBECONFIG=%KUBECONFIG%\r\nexit /b 0\r\n")
	} else {
		scriptPath = writeExecutableScript(t, scriptsDir, "ok.sh", "#!/bin/sh\necho hello\necho KUBECONFIG=$KUBECONFIG\nexit 0\n")
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
	home := t.TempDir()
	t.Setenv("HOME", home)
	t.Setenv("USERPROFILE", home)

	scriptsDir := filepath.Join(home, "scripts")
	if err := os.MkdirAll(scriptsDir, 0o755); err != nil {
		t.Fatalf("mkdir scripts: %v", err)
	}
	var scriptPath string
	if runtime.GOOS == "windows" {
		// ping -n 6 ~ 5 seconds
		scriptPath = writeExecutableScript(t, scriptsDir, "sleep.cmd", "@echo off\r\nping -n 6 127.0.0.1 > nul\r\nexit /b 0\r\n")
	} else {
		scriptPath = writeExecutableScript(t, scriptsDir, "sleep.sh", "#!/bin/sh\nsleep 5\nexit 0\n")
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
	home := t.TempDir()
	t.Setenv("HOME", home)
	t.Setenv("USERPROFILE", home)

	scriptsDir := filepath.Join(home, "scripts")
	if err := os.MkdirAll(scriptsDir, 0o755); err != nil {
		t.Fatalf("mkdir scripts: %v", err)
	}
	var scriptPath string
	if runtime.GOOS == "windows" {
		scriptPath = writeExecutableScript(t, scriptsDir, "bad.cmd", "@echo off\r\necho nope\r\nexit /b 5\r\n")
	} else {
		scriptPath = writeExecutableScript(t, scriptsDir, "bad.sh", "#!/bin/sh\necho nope\nexit 5\n")
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
	if err != nil {
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

func TestBuildHookCommand_Unix(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("Unix-specific test")
	}

	tests := []struct {
		name        string
		scriptPath  string
		wantCommand string
		wantArgs    []string
	}{
		{
			name:        "shell script",
			scriptPath:  "/tmp/test.sh",
			wantCommand: "sh",
			wantArgs:    []string{"/tmp/test.sh"},
		},
		{
			name:        "executable without extension",
			scriptPath:  "/tmp/test",
			wantCommand: "/tmp/test",
			wantArgs:    []string{},
		},
		{
			name:        "script with other extension",
			scriptPath:  "/tmp/test.py",
			wantCommand: "/tmp/test.py",
			wantArgs:    []string{},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			cmd, err := buildHookCommand(context.Background(), tt.scriptPath)
			if err != nil {
				t.Fatalf("buildHookCommand failed: %v", err)
			}

			if cmd.Path != tt.wantCommand && !strings.Contains(cmd.Path, tt.wantCommand) {
				t.Errorf("expected command containing %q, got %q", tt.wantCommand, cmd.Path)
			}

			if len(tt.wantArgs) > 0 {
				if len(cmd.Args) < 2 {
					t.Fatalf("expected at least 2 args, got %d", len(cmd.Args))
				}
				if cmd.Args[1] != tt.wantArgs[0] {
					t.Errorf("expected arg %q, got %q", tt.wantArgs[0], cmd.Args[1])
				}
			}
		})
	}
}

func TestBuildHookCommand_Windows(t *testing.T) {
	if runtime.GOOS != "windows" {
		t.Skip("Windows-specific test")
	}

	tests := []struct {
		name        string
		scriptPath  string
		wantCommand string
	}{
		{
			name:        "batch file",
			scriptPath:  "C:\\test.bat",
			wantCommand: "cmd",
		},
		{
			name:        "cmd file",
			scriptPath:  "C:\\test.cmd",
			wantCommand: "cmd",
		},
		{
			name:        "powershell script",
			scriptPath:  "C:\\test.ps1",
			wantCommand: "powershell",
		},
		{
			name:        "executable",
			scriptPath:  "C:\\test.exe",
			wantCommand: "C:\\test.exe",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			cmd, err := buildHookCommand(context.Background(), tt.scriptPath)
			if err != nil {
				t.Fatalf("buildHookCommand failed: %v", err)
			}

			if !strings.Contains(cmd.Path, tt.wantCommand) {
				t.Errorf("expected command containing %q, got %q", tt.wantCommand, cmd.Path)
			}
		})
	}
}

func TestMergeEnv(t *testing.T) {
	tests := []struct {
		name      string
		base      []string
		overrides map[string]string
		want      []string
	}{
		{
			name:      "empty overrides",
			base:      []string{"FOO=bar", "BAZ=qux"},
			overrides: map[string]string{},
			want:      []string{"FOO=bar", "BAZ=qux"},
		},
		{
			name:      "add new variable",
			base:      []string{"FOO=bar"},
			overrides: map[string]string{"NEW": "value"},
			want:      []string{"FOO=bar", "NEW=value"},
		},
		{
			name:      "override existing variable",
			base:      []string{"FOO=bar", "BAZ=qux"},
			overrides: map[string]string{"FOO": "updated"},
			want:      []string{"FOO=updated", "BAZ=qux"},
		},
		{
			name:      "multiple overrides",
			base:      []string{"A=1", "B=2", "C=3"},
			overrides: map[string]string{"B": "updated", "D": "new"},
			want:      []string{"A=1", "B=updated", "C=3", "D=new"},
		},
		{
			name:      "empty base",
			base:      []string{},
			overrides: map[string]string{"NEW": "value"},
			want:      []string{"NEW=value"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := mergeEnv(tt.base, tt.overrides)

			// Convert to maps for easier comparison
			gotMap := make(map[string]string)
			for _, kv := range got {
				k, v, ok := strings.Cut(kv, "=")
				if ok {
					gotMap[k] = v
				}
			}

			wantMap := make(map[string]string)
			for _, kv := range tt.want {
				k, v, ok := strings.Cut(kv, "=")
				if ok {
					wantMap[k] = v
				}
			}

			for k, wantV := range wantMap {
				if gotV, ok := gotMap[k]; !ok {
					t.Errorf("missing key %q", k)
				} else if gotV != wantV {
					t.Errorf("key %q: got %q, want %q", k, gotV, wantV)
				}
			}

			for k := range gotMap {
				if _, ok := wantMap[k]; !ok {
					t.Errorf("unexpected key %q", k)
				}
			}
		})
	}
}

func TestGetApplicableHooks(t *testing.T) {
	home := t.TempDir()
	t.Setenv("HOME", home)
	t.Setenv("USERPROFILE", home)

	app := NewApp()

	// Create test hooks
	hooks := []HookConfig{
		{
			Name:           "global-pre",
			Type:           "pre-connect",
			Scope:          "global",
			ConnectionType: "kubernetes",
			Enabled:        true,
			ScriptPath:     "/tmp/test1.sh",
		},
		{
			Name:           "connection-pre",
			Type:           "pre-connect",
			Scope:          "connection",
			ConnectionType: "kubernetes",
			ConnectionID:   "conn-1",
			Enabled:        true,
			ScriptPath:     "/tmp/test2.sh",
		},
		{
			Name:           "disabled-pre",
			Type:           "pre-connect",
			Scope:          "global",
			ConnectionType: "kubernetes",
			Enabled:        false,
			ScriptPath:     "/tmp/test3.sh",
		},
		{
			Name:           "post-connect",
			Type:           "post-connect",
			Scope:          "global",
			ConnectionType: "kubernetes",
			Enabled:        true,
			ScriptPath:     "/tmp/test4.sh",
		},
		{
			Name:           "swarm-hook",
			Type:           "pre-connect",
			Scope:          "global",
			ConnectionType: "swarm",
			Enabled:        true,
			ScriptPath:     "/tmp/test5.sh",
		},
	}

	for _, h := range hooks {
		if _, err := app.SaveHook(h); err != nil {
			t.Fatalf("SaveHook failed: %v", err)
		}
	}

	tests := []struct {
		name           string
		hookType       string
		connectionType string
		connectionID   string
		wantCount      int
		wantNames      []string
	}{
		{
			name:           "pre-connect kubernetes global",
			hookType:       "pre-connect",
			connectionType: "kubernetes",
			connectionID:   "other-conn",
			wantCount:      1,
			wantNames:      []string{"global-pre"},
		},
		{
			name:           "pre-connect kubernetes with matching connection",
			hookType:       "pre-connect",
			connectionType: "kubernetes",
			connectionID:   "conn-1",
			wantCount:      2,
			wantNames:      []string{"global-pre", "connection-pre"},
		},
		{
			name:           "post-connect kubernetes",
			hookType:       "post-connect",
			connectionType: "kubernetes",
			connectionID:   "any",
			wantCount:      1,
			wantNames:      []string{"post-connect"},
		},
		{
			name:           "pre-connect swarm",
			hookType:       "pre-connect",
			connectionType: "swarm",
			connectionID:   "any",
			wantCount:      1,
			wantNames:      []string{"swarm-hook"},
		},
		{
			name:           "wrong type",
			hookType:       "wrong-type",
			connectionType: "kubernetes",
			connectionID:   "any",
			wantCount:      0,
			wantNames:      []string{},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := app.getApplicableHooks(tt.hookType, tt.connectionType, tt.connectionID)
			if err != nil {
				t.Fatalf("getApplicableHooks failed: %v", err)
			}

			if len(got) != tt.wantCount {
				t.Errorf("got %d hooks, want %d", len(got), tt.wantCount)
			}

			gotNames := make([]string, len(got))
			for i, h := range got {
				gotNames[i] = h.Name
			}

			for _, wantName := range tt.wantNames {
				found := false
				for _, gotName := range gotNames {
					if gotName == wantName {
						found = true
						break
					}
				}
				if !found {
					t.Errorf("expected hook %q not found in results", wantName)
				}
			}
		})
	}
}

func TestDeleteHook_EmptyID(t *testing.T) {
	app := NewApp()
	err := app.DeleteHook("")
	if err == nil {
		t.Fatal("expected error for empty hookID")
	}
}
