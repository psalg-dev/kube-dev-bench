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

// detectDialogDirFromTemp checks for the temp directory fallback with marker file.
func detectDialogDirFromTemp() string {
	fallback := filepath.Join(os.TempDir(), "kdb-e2e-dialogs")
	if _, err := os.Stat(filepath.Join(fallback, e2eEnabledMarkerFile)); err == nil {
		return fallback
	}
	return ""
}

// detectDialogDirFromWorkdir checks for a single mapping file in the e2e run directory.
func detectDialogDirFromWorkdir() string {
	wd, err := os.Getwd()
	if err != nil {
		return ""
	}
	mappingDir := filepath.Join(wd, "e2e", ".run", "dialog-dirs")
	entries, err := os.ReadDir(mappingDir)
	if err != nil {
		return ""
	}
	var mappingFiles []fs.DirEntry
	for _, ent := range entries {
		if !ent.IsDir() {
			mappingFiles = append(mappingFiles, ent)
		}
	}
	if len(mappingFiles) != 1 {
		return ""
	}
	b, err := os.ReadFile(filepath.Join(mappingDir, mappingFiles[0].Name()))
	if err != nil {
		return ""
	}
	return strings.TrimSpace(string(b))
}

func e2eDialogDir() string {
	if v := strings.TrimSpace(os.Getenv(e2eDialogDirEnv)); v != "" {
		return v
	}
	if dir := detectDialogDirFromTemp(); dir != "" {
		return dir
	}
	return detectDialogDirFromWorkdir()
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
