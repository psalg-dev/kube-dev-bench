package app

import (
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"strings"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// E2E dialog override strategy:
// - When KDB_E2E_DIALOG_DIR is set, native OS dialogs are skipped.
// - Tests can write one-shot override files into that directory:
//     - save-path.txt : absolute path to use for the next SaveFileDialog
//     - open-path.txt : absolute path to use for the next OpenFileDialog
//   The override file is deleted after it is consumed.
// - If no override file is present:
//     - SaveFileDialog defaults to <dir>/saves/<DefaultFilename>
//     - OpenFileDialog defaults to returning empty (cancelled)
//
// This is intentionally minimal and only used for automated tests; normal UX still uses Wails dialogs.

const (
	e2eDialogDirEnv      = "KDB_E2E_DIALOG_DIR"
	e2eSaveOverrideFile  = "save-path.txt"
	e2eOpenOverrideFile  = "open-path.txt"
	e2eLastSavePathFile  = "last-save-path.txt"
	e2eLastOpenPathFile  = "last-open-path.txt"
	e2eEnabledMarkerFile = "enabled.txt"
)

func e2eDialogDir() string {
	if v := strings.TrimSpace(os.Getenv(e2eDialogDirEnv)); v != "" {
		return v
	}

	// Auto-detect for E2E runs: if the marker file exists under os.TempDir(),
	// treat that directory as the dialog override dir.
	fallback := filepath.Join(os.TempDir(), "kdb-e2e-dialogs")
	if _, err := os.Stat(filepath.Join(fallback, e2eEnabledMarkerFile)); err == nil {
		return fallback
	}

	// Repo-local fallback: e2e harness can write a dialog dir mapping file.
	// This is intended for single-instance runs; if multiple mappings exist, we do not guess.
	if wd, err := os.Getwd(); err == nil {
		mappingDir := filepath.Join(wd, "e2e", ".run", "dialog-dirs")
		entries, err := os.ReadDir(mappingDir)
		if err == nil {
			var mappingFiles []fs.DirEntry
			for _, ent := range entries {
				if ent.IsDir() {
					continue
				}
				mappingFiles = append(mappingFiles, ent)
			}
			if len(mappingFiles) == 1 {
				b, err := os.ReadFile(filepath.Join(mappingDir, mappingFiles[0].Name()))
				if err == nil {
					p := strings.TrimSpace(string(b))
					if p != "" {
						return p
					}
				}
			}
		}
	}

	return ""
}

func consumeOneShotPath(dir string, filename string) (string, bool) {
	p := filepath.Join(dir, filename)
	b, err := os.ReadFile(p)
	if err != nil {
		return "", false
	}
	_ = os.Remove(p)
	val := strings.TrimSpace(string(b))
	if val == "" {
		return "", true
	}
	return val, true
}

func ensureDir(p string) error {
	return os.MkdirAll(p, 0o755)
}

func safeBaseFilename(name string, fallback string) string {
	n := strings.TrimSpace(name)
	if n == "" {
		n = fallback
	}
	n = filepath.Base(n)
	if n == "." || n == string(filepath.Separator) || n == "" {
		n = fallback
	}
	return n
}

func (a *App) saveFileDialogWithE2E(opts runtime.SaveDialogOptions) (string, error) {
	dir := e2eDialogDir()
	if dir == "" {
		return runtime.SaveFileDialog(a.ctx, opts)
	}

	if p, ok := consumeOneShotPath(dir, e2eSaveOverrideFile); ok {
		// Best-effort record for tests.
		_ = os.WriteFile(filepath.Join(dir, e2eLastSavePathFile), []byte(p), 0o644)
		return p, nil
	}

	savesDir := filepath.Join(dir, "saves")
	if err := ensureDir(savesDir); err != nil {
		return "", fmt.Errorf("failed to create e2e saves dir: %w", err)
	}

	name := safeBaseFilename(opts.DefaultFilename, "download")
	p := filepath.Join(savesDir, name)
	// Best-effort record for tests.
	_ = os.WriteFile(filepath.Join(dir, e2eLastSavePathFile), []byte(p), 0o644)
	return p, nil
}

func (a *App) openFileDialogWithE2E(opts runtime.OpenDialogOptions) (string, error) {
	dir := e2eDialogDir()
	if dir == "" {
		return runtime.OpenFileDialog(a.ctx, opts)
	}

	if p, ok := consumeOneShotPath(dir, e2eOpenOverrideFile); ok {
		// Best-effort record for tests.
		_ = os.WriteFile(filepath.Join(dir, e2eLastOpenPathFile), []byte(p), 0o644)
		return p, nil
	}

	// No default file available: treat as cancelled.
	_ = os.WriteFile(filepath.Join(dir, e2eLastOpenPathFile), []byte(""), 0o644)
	return "", nil
}
