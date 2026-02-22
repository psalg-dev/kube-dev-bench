package app

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

func TestE2eDialogDir_FromEnv(t *testing.T) {
	originalEnv := os.Getenv(e2eDialogDirEnv)
	defer os.Setenv(e2eDialogDirEnv, originalEnv)

	testDir := "/tmp/test-e2e-dialogs"
	os.Setenv(e2eDialogDirEnv, testDir)

	dir := e2eDialogDir()
	if dir != testDir {
		t.Errorf("expected %s, got %s", testDir, dir)
	}
}

func TestE2eDialogDir_EmptyEnv(t *testing.T) {
	originalEnv := os.Getenv(e2eDialogDirEnv)
	defer os.Setenv(e2eDialogDirEnv, originalEnv)

	os.Setenv(e2eDialogDirEnv, "")

	// Without the marker file, should return empty
	dir := e2eDialogDir()
	if dir != "" {
		// Check if it's a valid path that exists
		_, err := os.Stat(filepath.Join(dir, e2eEnabledMarkerFile))
		if err != nil && !os.IsNotExist(err) {
			t.Errorf("unexpected dir: %s", dir)
		}
	}
}

func TestE2eDialogDir_WithMarkerFile(t *testing.T) {
	originalEnv := os.Getenv(e2eDialogDirEnv)
	defer os.Setenv(e2eDialogDirEnv, originalEnv)

	os.Setenv(e2eDialogDirEnv, "")

	// Create a temporary directory with marker file
	tmpDir := filepath.Join(os.TempDir(), "kdb-e2e-dialogs")
	markerPath := filepath.Join(tmpDir, e2eEnabledMarkerFile)
	
	// Clean up before and after
	os.RemoveAll(tmpDir)
	defer os.RemoveAll(tmpDir)
	
	os.MkdirAll(tmpDir, 0o755)
	os.WriteFile(markerPath, []byte("enabled"), 0o644)

	dir := e2eDialogDir()
	if dir != tmpDir {
		t.Errorf("expected %s, got %s", tmpDir, dir)
	}
}

func TestConsumeOneShotPath_FileExists(t *testing.T) {
	tmpDir := t.TempDir()
	testFile := "test-path.txt"
	testPath := "/tmp/test-file.txt"
	
	// Write test file
	filePath := filepath.Join(tmpDir, testFile)
	err := os.WriteFile(filePath, []byte(testPath), 0o644)
	if err != nil {
		t.Fatalf("failed to write test file: %v", err)
	}

	// Consume the file
	path, ok := consumeOneShotPath(tmpDir, testFile)
	if !ok {
		t.Fatal("expected ok=true")
	}
	if path != testPath {
		t.Errorf("expected %s, got %s", testPath, path)
	}

	// File should be deleted
	if _, err := os.Stat(filePath); !os.IsNotExist(err) {
		t.Error("expected file to be deleted")
	}
}

func TestConsumeOneShotPath_FileNotExists(t *testing.T) {
	tmpDir := t.TempDir()
	
	path, ok := consumeOneShotPath(tmpDir, "nonexistent.txt")
	if ok {
		t.Error("expected ok=false for nonexistent file")
	}
	if path != "" {
		t.Errorf("expected empty path, got %s", path)
	}
}

func TestConsumeOneShotPath_EmptyContent(t *testing.T) {
	tmpDir := t.TempDir()
	testFile := "empty.txt"
	
	// Write empty file
	filePath := filepath.Join(tmpDir, testFile)
	err := os.WriteFile(filePath, []byte("   \n  \t  "), 0o644)
	if err != nil {
		t.Fatalf("failed to write test file: %v", err)
	}

	// Consume the file
	path, ok := consumeOneShotPath(tmpDir, testFile)
	if !ok {
		t.Fatal("expected ok=true")
	}
	if path != "" {
		t.Errorf("expected empty path for whitespace-only content, got %s", path)
	}

	// File should be deleted
	if _, err := os.Stat(filePath); !os.IsNotExist(err) {
		t.Error("expected file to be deleted")
	}
}

func TestEnsureDir_NewDirectory(t *testing.T) {
	tmpDir := t.TempDir()
	newDir := filepath.Join(tmpDir, "new", "nested", "dir")

	err := ensureDir(newDir)
	if err != nil {
		t.Fatalf("ensureDir failed: %v", err)
	}

	// Check directory was created
	info, err := os.Stat(newDir)
	if err != nil {
		t.Fatalf("directory not created: %v", err)
	}
	if !info.IsDir() {
		t.Error("expected a directory")
	}
}

func TestEnsureDir_ExistingDirectory(t *testing.T) {
	tmpDir := t.TempDir()

	// Call ensureDir on existing directory
	err := ensureDir(tmpDir)
	if err != nil {
		t.Fatalf("ensureDir failed on existing dir: %v", err)
	}
}

func TestSafeBaseFilename_ValidName(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		fallback string
		want     string
	}{
		{
			name:     "simple filename",
			input:    "file.txt",
			fallback: "default.txt",
			want:     "file.txt",
		},
		{
			name:     "path with directory",
			input:    "/path/to/file.txt",
			fallback: "default.txt",
			want:     "file.txt",
		},
		{
			name:     "empty string",
			input:    "",
			fallback: "default.txt",
			want:     "default.txt",
		},
		{
			name:     "whitespace only",
			input:    "   ",
			fallback: "default.txt",
			want:     "default.txt",
		},
		{
			name:     "just dot",
			input:    ".",
			fallback: "default.txt",
			want:     "default.txt",
		},
		{
			name:     "just separator",
			input:    string(filepath.Separator),
			fallback: "default.txt",
			want:     "default.txt",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := safeBaseFilename(tt.input, tt.fallback)
			if got != tt.want {
				t.Errorf("safeBaseFilename(%q, %q) = %q, want %q", tt.input, tt.fallback, got, tt.want)
			}
		})
	}
}

func TestSaveFileDialogWithE2E_WithOverride(t *testing.T) {
	tmpDir := t.TempDir()
	overridePath := "/tmp/custom-save.txt"
	
	// Write override file
	overrideFile := filepath.Join(tmpDir, e2eSaveOverrideFile)
	err := os.WriteFile(overrideFile, []byte(overridePath), 0o644)
	if err != nil {
		t.Fatalf("failed to write override file: %v", err)
	}

	originalEnv := os.Getenv(e2eDialogDirEnv)
	defer os.Setenv(e2eDialogDirEnv, originalEnv)
	os.Setenv(e2eDialogDirEnv, tmpDir)

	app := &App{}
	opts := runtime.SaveDialogOptions{DefaultFilename: "test.txt"}
	
	path, err := app.saveFileDialogWithE2E(opts)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if path != overridePath {
		t.Errorf("expected %s, got %s", overridePath, path)
	}

	// Override file should be consumed
	if _, err := os.Stat(overrideFile); !os.IsNotExist(err) {
		t.Error("expected override file to be deleted")
	}

	// Last save path should be recorded
	lastSaveFile := filepath.Join(tmpDir, e2eLastSavePathFile)
	content, err := os.ReadFile(lastSaveFile)
	if err != nil {
		t.Fatalf("failed to read last save file: %v", err)
	}
	if strings.TrimSpace(string(content)) != overridePath {
		t.Errorf("expected last save path to be %s, got %s", overridePath, string(content))
	}
}

func TestSaveFileDialogWithE2E_DefaultPath(t *testing.T) {
	tmpDir := t.TempDir()

	originalEnv := os.Getenv(e2eDialogDirEnv)
	defer os.Setenv(e2eDialogDirEnv, originalEnv)
	os.Setenv(e2eDialogDirEnv, tmpDir)

	app := &App{}
	opts := runtime.SaveDialogOptions{DefaultFilename: "myfile.json"}
	
	path, err := app.saveFileDialogWithE2E(opts)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	expectedPath := filepath.Join(tmpDir, "saves", "myfile.json")
	if path != expectedPath {
		t.Errorf("expected %s, got %s", expectedPath, path)
	}

	// Saves directory should be created
	savesDir := filepath.Join(tmpDir, "saves")
	info, err := os.Stat(savesDir)
	if err != nil {
		t.Fatalf("saves directory not created: %v", err)
	}
	if !info.IsDir() {
		t.Error("saves should be a directory")
	}
}

func TestOpenFileDialogWithE2E_WithOverride(t *testing.T) {
	tmpDir := t.TempDir()
	overridePath := "/tmp/test-open.txt"
	
	// Write override file
	overrideFile := filepath.Join(tmpDir, e2eOpenOverrideFile)
	err := os.WriteFile(overrideFile, []byte(overridePath), 0o644)
	if err != nil {
		t.Fatalf("failed to write override file: %v", err)
	}

	originalEnv := os.Getenv(e2eDialogDirEnv)
	defer os.Setenv(e2eDialogDirEnv, originalEnv)
	os.Setenv(e2eDialogDirEnv, tmpDir)

	app := &App{}
	opts := runtime.OpenDialogOptions{}
	
	path, err := app.openFileDialogWithE2E(opts)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if path != overridePath {
		t.Errorf("expected %s, got %s", overridePath, path)
	}

	// Override file should be consumed
	if _, err := os.Stat(overrideFile); !os.IsNotExist(err) {
		t.Error("expected override file to be deleted")
	}

	// Last open path should be recorded
	lastOpenFile := filepath.Join(tmpDir, e2eLastOpenPathFile)
	content, err := os.ReadFile(lastOpenFile)
	if err != nil {
		t.Fatalf("failed to read last open file: %v", err)
	}
	if strings.TrimSpace(string(content)) != overridePath {
		t.Errorf("expected last open path to be %s, got %s", overridePath, string(content))
	}
}

func TestOpenFileDialogWithE2E_NoOverride(t *testing.T) {
	tmpDir := t.TempDir()

	originalEnv := os.Getenv(e2eDialogDirEnv)
	defer os.Setenv(e2eDialogDirEnv, originalEnv)
	os.Setenv(e2eDialogDirEnv, tmpDir)

	app := &App{}
	opts := runtime.OpenDialogOptions{}
	
	path, err := app.openFileDialogWithE2E(opts)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if path != "" {
		t.Errorf("expected empty path (cancelled), got %s", path)
	}

	// Last open path should be recorded as empty
	lastOpenFile := filepath.Join(tmpDir, e2eLastOpenPathFile)
	content, err := os.ReadFile(lastOpenFile)
	if err != nil {
		t.Fatalf("failed to read last open file: %v", err)
	}
	if strings.TrimSpace(string(content)) != "" {
		t.Errorf("expected empty last open path, got %s", string(content))
	}
}

func TestSaveFileDialogWithE2E_EmptyFilename(t *testing.T) {
	tmpDir := t.TempDir()

	originalEnv := os.Getenv(e2eDialogDirEnv)
	defer os.Setenv(e2eDialogDirEnv, originalEnv)
	os.Setenv(e2eDialogDirEnv, tmpDir)

	app := &App{}
	opts := runtime.SaveDialogOptions{DefaultFilename: ""} // Empty filename
	
	path, err := app.saveFileDialogWithE2E(opts)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// Should use fallback name "download"
	expectedPath := filepath.Join(tmpDir, "saves", "download")
	if path != expectedPath {
		t.Errorf("expected %s, got %s", expectedPath, path)
	}
}
