package app

import (
	"strings"
	"testing"
)

// ---------------------------------------------------------------------------
// TestSanitizePosixPath
// ---------------------------------------------------------------------------

func TestSanitizePosixPath(t *testing.T) {
	tests := []struct {
		name    string
		input   string
		want    string
		wantErr bool
	}{
		{"empty returns root", "", "/", false},
		{"root unchanged", "/", "/", false},
		{"simple path", "/data/files", "/data/files", false},
		{"path without leading slash gets one", "data/files", "/data/files", false},
		{"null byte rejected", "/data/\x00file", "", true},
		{"path traversal rejected", "/data/../etc", "", true},
		{"double-dot in middle rejected", "/a/../../b", "", true},
		{"windows separator rejected", "/data\\files", "", true},
		{"nested path", "/a/b/c/d", "/a/b/c/d", false},
		{"single segment", "/mydir", "/mydir", false},
		{"cleans double slashes", "/data//files", "/data/files", false},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got, err := sanitizePosixPath(tc.input)
			if (err != nil) != tc.wantErr {
				t.Fatalf("sanitizePosixPath(%q) err=%v, wantErr=%v", tc.input, err, tc.wantErr)
			}
			if err == nil && got != tc.want {
				t.Errorf("sanitizePosixPath(%q) = %q, want %q", tc.input, got, tc.want)
			}
		})
	}
}

// ---------------------------------------------------------------------------
// TestParseSwarmVolumeLsLine
// ---------------------------------------------------------------------------

func TestParseSwarmVolumeLsLine(t *testing.T) {
	tests := []struct {
		name        string
		line        string
		basePath    string
		wantOk      bool
		wantName    string
		wantPath    string
		wantIsDir   bool
		wantIsLink  bool
		wantTarget  string
		wantSize    int64
	}{
		{
			name:     "regular file",
			line:     "-rw-r--r-- 1 root root 1234 2024-01-15T10:30:00 myfile.txt",
			basePath: "/mnt",
			wantOk:   true,
			wantName: "myfile.txt",
			wantPath: "/mnt/myfile.txt",
			wantIsDir: false,
			wantSize: 1234,
		},
		{
			name:     "directory at root base",
			line:     "drwxr-xr-x 2 root root 4096 2024-01-15T10:30:00 subdir/",
			basePath: "/",
			wantOk:   true,
			wantName: "subdir/",
			wantPath: "/subdir/",
			wantIsDir: true,
		},
		{
			name:       "symlink with target",
			line:       "lrwxrwxrwx 1 root root 7 2024-01-15T10:30:00 link -> target",
			basePath:   "/data",
			wantOk:     true,
			wantName:   "link",
			wantPath:   "/data/link",
			wantIsLink: true,
			wantTarget: "target",
		},
		{
			name:    "empty line",
			line:    "",
			wantOk:  false,
		},
		{
			name:    "total line rejected",
			line:    "total 42",
			wantOk:  false,
		},
		{
			name:    "dot entry rejected",
			line:    "drwxr-xr-x 2 root root 4096 2024-01-15T10:30:00 .",
			wantOk:  false,
		},
		{
			name:    "double-dot entry rejected",
			line:    "drwxr-xr-x 2 root root 4096 2024-01-15T10:30:00 ..",
			wantOk:  false,
		},
		{
			name:    "garbage line",
			line:    "not a valid ls line",
			wantOk:  false,
		},
		{
			name:     "zero-size file",
			line:     "-rw-r--r-- 1 user grp 0 2024-06-01T00:00:00 empty.dat",
			basePath: "/vol",
			wantOk:   true,
			wantName: "empty.dat",
			wantSize: 0,
		},
		{
			name:       "symlink no target",
			line:       "lrwxrwxrwx 1 root root 0 2024-01-15T10:30:00 orphan",
			basePath:   "/mnt",
			wantOk:     true,
			wantName:   "orphan",
			wantIsLink: true,
			wantTarget: "",
		},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			entry, ok := parseSwarmVolumeLsLine(tc.line, tc.basePath)
			if ok != tc.wantOk {
				t.Fatalf("parseSwarmVolumeLsLine(%q) ok=%v, want %v", tc.line, ok, tc.wantOk)
			}
			if !ok {
				if entry != nil {
					t.Errorf("expected nil entry when ok=false, got %+v", entry)
				}
				return
			}
			if entry.Name != tc.wantName {
				t.Errorf("Name=%q, want %q", entry.Name, tc.wantName)
			}
			if tc.wantPath != "" && entry.Path != tc.wantPath {
				t.Errorf("Path=%q, want %q", entry.Path, tc.wantPath)
			}
			if entry.IsDir != tc.wantIsDir {
				t.Errorf("IsDir=%v, want %v", entry.IsDir, tc.wantIsDir)
			}
			if entry.IsSymlink != tc.wantIsLink {
				t.Errorf("IsSymlink=%v, want %v", entry.IsSymlink, tc.wantIsLink)
			}
			if tc.wantIsLink && entry.LinkTarget != tc.wantTarget {
				t.Errorf("LinkTarget=%q, want %q", entry.LinkTarget, tc.wantTarget)
			}
			if tc.wantSize != 0 && entry.Size != tc.wantSize {
				t.Errorf("Size=%d, want %d", entry.Size, tc.wantSize)
			}
		})
	}
}

// ---------------------------------------------------------------------------
// TestSanitizePosixPath_InvalidPath
// ---------------------------------------------------------------------------

func TestSanitizePosixPath_InvalidPath_ErrorMessage(t *testing.T) {
	tests := []string{
		"/foo/../../bar",
		"..",
		"../etc/passwd",
	}
	for _, p := range tests {
		_, err := sanitizePosixPath(p)
		if err == nil {
			t.Errorf("sanitizePosixPath(%q) should fail", p)
		}
		if !strings.Contains(err.Error(), "invalid path") {
			t.Errorf("sanitizePosixPath(%q) error should say 'invalid path', got: %v", p, err)
		}
	}
}
