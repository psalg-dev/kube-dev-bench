package app

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestAudit_InitAndWrite(t *testing.T) {
	dir := t.TempDir()
	app := &App{configPath: filepath.Join(dir, "config.json")}

	app.initAudit()
	defer closeAudit()

	app.audit("delete", "deployment/nginx", "namespace=default")
	app.auditf("scale", "deployment/web", "replicas=%d", 3)

	// Force close so we can read the file.
	closeAudit()

	data, err := os.ReadFile(filepath.Join(dir, "audit.jsonl"))
	if err != nil {
		t.Fatalf("failed to read audit log: %v", err)
	}

	lines := strings.Split(strings.TrimSpace(string(data)), "\n")
	if len(lines) != 2 {
		t.Fatalf("expected 2 audit lines, got %d", len(lines))
	}

	var entry AuditEntry
	if err := json.Unmarshal([]byte(lines[0]), &entry); err != nil {
		t.Fatalf("failed to parse audit entry: %v", err)
	}
	if entry.Action != "delete" {
		t.Errorf("expected action 'delete', got %q", entry.Action)
	}
	if entry.Resource != "deployment/nginx" {
		t.Errorf("expected resource 'deployment/nginx', got %q", entry.Resource)
	}
	if entry.Detail != "namespace=default" {
		t.Errorf("expected detail 'namespace=default', got %q", entry.Detail)
	}
	if entry.Timestamp == "" {
		t.Error("expected non-empty timestamp")
	}

	var entry2 AuditEntry
	if err := json.Unmarshal([]byte(lines[1]), &entry2); err != nil {
		t.Fatalf("failed to parse second audit entry: %v", err)
	}
	if entry2.Action != "scale" {
		t.Errorf("expected action 'scale', got %q", entry2.Action)
	}
	if entry2.Detail != "replicas=3" {
		t.Errorf("expected detail 'replicas=3', got %q", entry2.Detail)
	}
}

func TestAudit_NoFileIsNoop(t *testing.T) {
	// When auditFile is nil, audit calls should be no-ops (no panic).
	auditMu.Lock()
	auditFile = nil
	auditMu.Unlock()

	app := &App{}
	app.audit("test", "resource/name", "detail")
	// No panic = pass
}

func TestAudit_CloseIdempotent(t *testing.T) {
	closeAudit()
	closeAudit() // should not panic
}

func TestAudit_InitCreatesFile(t *testing.T) {
	dir := t.TempDir()
	app := &App{configPath: filepath.Join(dir, "config.json")}

	app.initAudit()
	defer closeAudit()

	path := filepath.Join(dir, "audit.jsonl")
	if _, err := os.Stat(path); os.IsNotExist(err) {
		t.Fatalf("expected audit.jsonl to be created at %s", path)
	}
}

func TestAudit_DoubleInitIsNoop(t *testing.T) {
	dir := t.TempDir()
	app := &App{configPath: filepath.Join(dir, "config.json")}

	app.initAudit()
	app.initAudit() // second call should close and reopen, not panic
	defer closeAudit()
}
