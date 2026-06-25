package app

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"

	"gowails/pkg/logger"
)

// AuditEntry represents a single entry in the audit log (SUG-1).
type AuditEntry struct {
	Timestamp string `json:"ts"`
	Action    string `json:"action"`
	Resource  string `json:"resource,omitempty"`
	Namespace string `json:"namespace,omitempty"`
	Context   string `json:"context,omitempty"`
	Detail    string `json:"detail,omitempty"`
}

var (
	auditMu   sync.Mutex
	auditFile *os.File
)

// initAudit opens (or creates) the audit log file at
// ~/.KubeDevBench/audit.jsonl. Safe to call multiple times;
// closes any previously opened file first.
func (a *App) initAudit() {
	auditMu.Lock()
	defer auditMu.Unlock()
	if auditFile != nil {
		// Close previous file (e.g. from prior test or re-init).
		_ = auditFile.Close()
		auditFile = nil
	}
	dir := filepath.Dir(a.configPath)
	if dir == "" || dir == "." {
		home, err := os.UserHomeDir()
		if err != nil {
			logger.Error("audit: cannot determine home dir", "error", err)
			return
		}
		dir = filepath.Join(home, "KubeDevBench")
	}
	path := filepath.Join(dir, "audit.jsonl")
	f, err := os.OpenFile(path, os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0600)
	if err != nil {
		logger.Error("audit: cannot open audit log", "path", path, "error", err)
		return
	}
	auditFile = f
	logger.Info("audit log initialized", "path", path)
}

// closeAudit flushes and closes the audit log file.
func closeAudit() {
	auditMu.Lock()
	defer auditMu.Unlock()
	if auditFile != nil {
		_ = auditFile.Close()
		auditFile = nil
	}
}

// audit writes a structured entry to the audit log.
// action is a short verb like "delete", "scale", "exec".
// resource identifies the target (e.g. "deployment/nginx").
// detail is optional free-form text.
func (a *App) audit(action, resource, detail string) {
	entry := AuditEntry{
		Timestamp: time.Now().UTC().Format(time.RFC3339),
		Action:    action,
		Resource:  resource,
		Namespace: a.currentNamespace,
		Context:   a.getKubeContext(),
		Detail:    detail,
	}

	data, err := json.Marshal(entry)
	if err != nil {
		logger.Error("audit: marshal error", "error", err)
		return
	}

	auditMu.Lock()
	defer auditMu.Unlock()
	if auditFile == nil {
		return
	}
	_, _ = auditFile.Write(append(data, '\n'))
}

// auditf is a convenience wrapper around audit with formatted detail.
func (a *App) auditf(action, resource, format string, args ...interface{}) {
	a.audit(action, resource, fmt.Sprintf(format, args...))
}
