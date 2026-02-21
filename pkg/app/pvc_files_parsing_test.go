package app

import (
	"strings"
	"testing"
)

// ---------------------------------------------------------------------------
// TestParseLsLine – table-driven, ≥10 sub-cases
// ---------------------------------------------------------------------------

func TestParseLsLine(t *testing.T) {
	tests := []struct {
		name        string
		line        string
		wantOk      bool
		wantType    string
		wantName    string
		wantSize    int64
		wantSymlink bool
		wantTarget  string
		wantIsDir   bool
	}{
		// 1. Regular file
		{
			name:     "regular file",
			line:     "-rw-r--r-- 1 root root 1234 2024-01-15T10:30:00 filename.txt",
			wantOk:   true,
			wantType: "-",
			wantName: "filename.txt",
			wantSize: 1234,
		},
		// 2. Directory
		{
			name:      "directory",
			line:      "drwxr-xr-x 2 root root 4096 2024-01-15T10:30:00 mydir/",
			wantOk:    true,
			wantType:  "d",
			wantName:  "mydir/",
			wantSize:  4096,
			wantIsDir: true,
		},
		// 3. Symlink with target
		{
			name:        "symlink with target",
			line:        "lrwxrwxrwx 1 root root 10 2024-01-15T10:30:00 mylink -> /some/target",
			wantOk:      true,
			wantType:    "l",
			wantName:    "mylink",
			wantSymlink: true,
			wantTarget:  "/some/target",
		},
		// 4. Symlink without target (malformed but parses as just name)
		{
			name:        "symlink no arrow",
			line:        "lrwxrwxrwx 1 root root 7 2024-01-15T10:30:00 orphan",
			wantOk:      true,
			wantType:    "l",
			wantName:    "orphan",
			wantSymlink: true,
			wantTarget:  "",
		},
		// 5. Empty line – must return false
		{
			name:   "empty line",
			line:   "",
			wantOk: false,
		},
		// 6. Whitespace-only line – must return false
		{
			name:   "whitespace only",
			line:   "   \t  ",
			wantOk: false,
		},
		// 7. Header line "total NNN" – must return false
		{
			name:   "total header line",
			line:   "total 48",
			wantOk: false,
		},
		// 8. Dot entry "." – must return false even if it parses
		{
			name:   "dot entry",
			line:   "drwxr-xr-x 2 root root 4096 2024-01-15T10:30:00 .",
			wantOk: false,
		},
		// 9. Double-dot entry ".." – must return false
		{
			name:   "double-dot entry",
			line:   "drwxr-xr-x 3 root root 4096 2024-01-15T10:30:00 ..",
			wantOk: false,
		},
		// 10. Character device file
		{
			name:     "character device",
			line:     "crw-rw-rw- 1 root root 0 2024-01-15T10:30:00 null",
			wantOk:   true,
			wantType: "c",
			wantName: "null",
		},
		// 11. Block device file
		{
			name:     "block device",
			line:     "brw-rw---- 1 root disk 0 2024-01-15T10:30:00 sda",
			wantOk:   true,
			wantType: "b",
			wantName: "sda",
		},
		// 12. File with spaces in name
		{
			name:     "file with spaces",
			line:     "-rw-r--r-- 1 root root 500 2024-06-01T08:00:00 my file with spaces.txt",
			wantOk:   true,
			wantType: "-",
			wantName: "my file with spaces.txt",
			wantSize: 500,
		},
		// 13. Zero-byte file
		{
			name:     "zero-byte file",
			line:     "-rw-r--r-- 1 user group 0 2023-12-31T23:59:59 empty.dat",
			wantOk:   true,
			wantType: "-",
			wantName: "empty.dat",
			wantSize: 0,
		},
		// 14. Pipe / FIFO
		{
			name:     "named pipe",
			line:     "prw-r--r-- 1 root root 0 2024-01-15T10:30:00 mypipe",
			wantOk:   true,
			wantType: "p",
			wantName: "mypipe",
		},
		// 15. Random garbage line – must return false
		{
			name:   "garbage line",
			line:   "this is not an ls line at all",
			wantOk: false,
		},
		// 16. Executable file with setuid bit
		{
			name:     "setuid executable",
			line:     "-rwsr-xr-x 1 root root 2048 2024-03-10T12:00:00 sudo",
			wantOk:   true,
			wantType: "-",
			wantName: "sudo",
			wantSize: 2048,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			entry, ok := parseLsLine(tc.line)
			if ok != tc.wantOk {
				t.Fatalf("parseLsLine(%q) ok=%v, want %v", tc.line, ok, tc.wantOk)
			}
			if !ok {
				if entry != nil {
					t.Errorf("expected nil entry when ok=false, got %+v", entry)
				}
				return
			}
			if entry.fileType != tc.wantType {
				t.Errorf("fileType=%q, want %q", entry.fileType, tc.wantType)
			}
			if entry.name != tc.wantName {
				t.Errorf("name=%q, want %q", entry.name, tc.wantName)
			}
			if tc.wantSize != 0 && entry.size != tc.wantSize {
				t.Errorf("size=%d, want %d", entry.size, tc.wantSize)
			}
			if entry.isSymlink != tc.wantSymlink {
				t.Errorf("isSymlink=%v, want %v", entry.isSymlink, tc.wantSymlink)
			}
			if tc.wantSymlink && entry.linkTarget != tc.wantTarget {
				t.Errorf("linkTarget=%q, want %q", entry.linkTarget, tc.wantTarget)
			}
			if tc.wantIsDir && entry.fileType != "d" {
				t.Errorf("expected directory fileType, got %q", entry.fileType)
			}
		})
	}
}

// ---------------------------------------------------------------------------
// TestParseLsLineReturnsFalseForHeaders – AC 2 (explicit sub-group)
// ---------------------------------------------------------------------------

func TestParseLsLineReturnsFalseForHeaders(t *testing.T) {
	headers := []string{
		"",
		"   ",
		"total 0",
		"total 1024",
	}
	for _, h := range headers {
		_, ok := parseLsLine(h)
		if ok {
			t.Errorf("parseLsLine(%q) returned ok=true, want false for header/empty", h)
		}
	}
}

// ---------------------------------------------------------------------------
// TestBuildFileEntry – AC 4: symlink target correctly extracted
// ---------------------------------------------------------------------------

func TestBuildFileEntry(t *testing.T) {
	t.Run("regular file at root path", func(t *testing.T) {
		e := &parsedLsEntry{
			fileType: "-",
			perms:    "rw-r--r--",
			size:     512,
			modified: "2024-01-01T00:00:00",
			name:     "readme.txt",
		}
		fe := buildPVCFileEntry(e, "/")
		if fe.Name != "readme.txt" {
			t.Errorf("Name=%q, want 'readme.txt'", fe.Name)
		}
		if fe.Path != "/readme.txt" {
			t.Errorf("Path=%q, want '/readme.txt'", fe.Path)
		}
		if fe.IsDir {
			t.Error("IsDir should be false for regular file")
		}
		if fe.Size != 512 {
			t.Errorf("Size=%d, want 512", fe.Size)
		}
		if fe.Mode != "-rw-r--r--" {
			t.Errorf("Mode=%q, want '-rw-r--r--'", fe.Mode)
		}
	})

	t.Run("symlink target is correctly extracted", func(t *testing.T) {
		e := &parsedLsEntry{
			fileType:   "l",
			perms:      "rwxrwxrwx",
			size:       10,
			modified:   "2024-06-01T12:00:00",
			name:       "mylink",
			isSymlink:  true,
			linkTarget: "/real/path/target",
		}
		fe := buildPVCFileEntry(e, "/data")
		if !fe.IsSymlink {
			t.Error("IsSymlink should be true")
		}
		if fe.LinkTarget != "/real/path/target" {
			t.Errorf("LinkTarget=%q, want '/real/path/target'", fe.LinkTarget)
		}
		if fe.Name != "mylink" {
			t.Errorf("Name=%q, want 'mylink'", fe.Name)
		}
		if fe.Path != "/data/mylink" {
			t.Errorf("Path=%q, want '/data/mylink'", fe.Path)
		}
	})

	t.Run("symlink with relative target", func(t *testing.T) {
		raw := "lrwxrwxrwx 1 root root 5 2024-05-20T08:00:00 link -> ../foo"
		entry, ok := parseLsLine(raw)
		if !ok {
			t.Fatal("parseLsLine should succeed for valid symlink line")
		}
		fe := buildPVCFileEntry(entry, "/var")
		if fe.LinkTarget != "../foo" {
			t.Errorf("LinkTarget=%q, want '../foo'", fe.LinkTarget)
		}
	})

	t.Run("directory entry", func(t *testing.T) {
		e := &parsedLsEntry{
			fileType: "d",
			perms:    "rwxr-xr-x",
			size:     4096,
			modified: "2024-01-01T00:00:00",
			name:     "subdir/",
		}
		fe := buildPVCFileEntry(e, "/mnt/data")
		if !fe.IsDir {
			t.Error("IsDir should be true for directory entry")
		}
		if fe.Path != "/mnt/data/subdir/" {
			t.Errorf("Path=%q, want '/mnt/data/subdir/'", fe.Path)
		}
	})

	t.Run("nested path construction", func(t *testing.T) {
		e := &parsedLsEntry{
			fileType: "-",
			perms:    "rw-rw-r--",
			size:     100,
			modified: "2024-01-01T00:00:00",
			name:     "notes.txt",
		}
		fe := buildPVCFileEntry(e, "/mnt/data/docs")
		if fe.Path != "/mnt/data/docs/notes.txt" {
			t.Errorf("Path=%q, want '/mnt/data/docs/notes.txt'", fe.Path)
		}
	})

	t.Run("path with trailing slash normalised", func(t *testing.T) {
		e := &parsedLsEntry{
			fileType: "-",
			perms:    "rw-------",
			size:     0,
			modified: "2024-01-01T00:00:00",
			name:     "secret",
		}
		fe := buildPVCFileEntry(e, "/mnt/pvc/")
		if fe.Path != "/mnt/pvc/secret" {
			t.Errorf("Path=%q, want '/mnt/pvc/secret'", fe.Path)
		}
	})
}

// ---------------------------------------------------------------------------
// TestSortFileEntries – AC 3: directories before files
// ---------------------------------------------------------------------------

func TestSortFileEntries(t *testing.T) {
	t.Run("dirs before files", func(t *testing.T) {
		entries := []PodFileEntry{
			{Name: "zoo.txt", IsDir: false},
			{Name: "alpha/", IsDir: true},
			{Name: "readme.md", IsDir: false},
			{Name: "beta/", IsDir: true},
			{Name: "aardvark.log", IsDir: false},
		}
		sortFileEntriesByDirFirst(entries)

		// All directories must precede all files
		sawFile := false
		for _, e := range entries {
			if e.IsDir && sawFile {
				t.Errorf("directory %q appears after a file in sorted output", e.Name)
			}
			if !e.IsDir {
				sawFile = true
			}
		}
		// First two should be directories
		if !entries[0].IsDir || !entries[1].IsDir {
			t.Errorf("expected first two entries to be directories, got %+v", entries[:2])
		}
		// Directories sorted alphabetically among themselves
		if entries[0].Name != "alpha/" || entries[1].Name != "beta/" {
			t.Errorf("dirs not sorted alphabetically: got %q, %q", entries[0].Name, entries[1].Name)
		}
		// Files sorted alphabetically among themselves
		if entries[2].Name != "aardvark.log" {
			t.Errorf("files not sorted alphabetically: first file got %q, want 'aardvark.log'", entries[2].Name)
		}
	})

	t.Run("only files", func(t *testing.T) {
		entries := []PodFileEntry{
			{Name: "z.txt", IsDir: false},
			{Name: "a.txt", IsDir: false},
			{Name: "m.txt", IsDir: false},
		}
		sortFileEntriesByDirFirst(entries)
		if entries[0].Name != "a.txt" || entries[1].Name != "m.txt" || entries[2].Name != "z.txt" {
			t.Errorf("files not sorted alphabetically: %v", entries)
		}
	})

	t.Run("only directories", func(t *testing.T) {
		entries := []PodFileEntry{
			{Name: "z/", IsDir: true},
			{Name: "a/", IsDir: true},
		}
		sortFileEntriesByDirFirst(entries)
		if entries[0].Name != "a/" || entries[1].Name != "z/" {
			t.Errorf("dirs not sorted alphabetically: %v", entries)
		}
	})

	t.Run("empty slice", func(t *testing.T) {
		entries := []PodFileEntry{}
		sortFileEntriesByDirFirst(entries) // should not panic
		if len(entries) != 0 {
			t.Error("expected empty slice to remain empty")
		}
	})

	t.Run("single element", func(t *testing.T) {
		entries := []PodFileEntry{{Name: "only.txt", IsDir: false}}
		sortFileEntriesByDirFirst(entries)
		if len(entries) != 1 {
			t.Error("single-element slice should remain single")
		}
	})
}

// ---------------------------------------------------------------------------
// TestParseLsOutput – integration-level test for parsePVCLsOutput
// ---------------------------------------------------------------------------

func TestParseLsOutput(t *testing.T) {
	t.Run("full ls block with mixed entries", func(t *testing.T) {
		raw := strings.Join([]string{
			"-rw-r--r-- 1 root root 100 2024-01-01T00:00:00 file.txt",
			"drwxr-xr-x 2 root root 4096 2024-01-01T00:00:00 subdir/",
			"lrwxrwxrwx 1 root root 7 2024-01-01T00:00:00 link -> file.txt",
			"",
			"total 12",
		}, "\n")
		entries := parsePVCLsOutput(raw, "/mnt")
		if len(entries) != 3 {
			t.Fatalf("expected 3 entries, got %d: %+v", len(entries), entries)
		}
	})

	t.Run("empty output", func(t *testing.T) {
		entries := parsePVCLsOutput("", "/")
		// An empty string still generates one "line" via Split, but parseLsLine returns false
		// so entries should be nil or empty
		if len(entries) != 0 {
			t.Errorf("expected 0 entries for empty input, got %d", len(entries))
		}
	})

	t.Run("paths are rooted correctly", func(t *testing.T) {
		raw := "-rw-r--r-- 1 root root 42 2024-03-01T09:00:00 hello.txt"
		entries := parsePVCLsOutput(raw, "/data")
		if len(entries) != 1 {
			t.Fatalf("expected 1 entry, got %d", len(entries))
		}
		if entries[0].Path != "/data/hello.txt" {
			t.Errorf("Path=%q, want '/data/hello.txt'", entries[0].Path)
		}
	})
}

// ---------------------------------------------------------------------------
// TestSanitizePath – tests for path validation / sanitization helpers
// ---------------------------------------------------------------------------

func TestSanitizePath(t *testing.T) {
	t.Run("validatePVCFilesRequest rejects empty namespace", func(t *testing.T) {
		err := validatePVCFilesRequest("", "mypvc", "/")
		if err == nil {
			t.Error("expected error for empty namespace, got nil")
		}
	})

	t.Run("validatePVCFilesRequest rejects empty pvcName", func(t *testing.T) {
		err := validatePVCFilesRequest("default", "", "/")
		if err == nil {
			t.Error("expected error for empty pvcName, got nil")
		}
	})

	t.Run("validatePVCFilesRequest rejects path traversal", func(t *testing.T) {
		err := validatePVCFilesRequest("default", "mypvc", "/../etc/passwd")
		if err == nil {
			t.Error("expected error for path with '..', got nil")
		}
	})

	t.Run("validatePVCFilesRequest accepts valid inputs", func(t *testing.T) {
		err := validatePVCFilesRequest("default", "mypvc", "/data/files")
		if err != nil {
			t.Errorf("expected no error, got: %v", err)
		}
	})

	t.Run("buildAbsPath no subpath", func(t *testing.T) {
		result := buildAbsPath("/mnt/data", "", "/subdir/file.txt")
		if result != "/mnt/data/subdir/file.txt" {
			t.Errorf("buildAbsPath=%q, want '/mnt/data/subdir/file.txt'", result)
		}
	})

	t.Run("buildAbsPath with subpath", func(t *testing.T) {
		result := buildAbsPath("/mnt", "sub", "/file.txt")
		if result != "/mnt/sub/file.txt" {
			t.Errorf("buildAbsPath=%q, want '/mnt/sub/file.txt'", result)
		}
	})

	t.Run("buildAbsPath root path", func(t *testing.T) {
		result := buildAbsPath("/mnt/pvc", "", "/")
		// rel is "" after TrimPrefix("/", "/")
		if result != "/mnt/pvc" {
			t.Errorf("buildAbsPath=%q, want '/mnt/pvc'", result)
		}
	})

	t.Run("buildAbsPath empty path defaults to mount", func(t *testing.T) {
		result := buildAbsPath("/mnt/pvc", "", "")
		if result != "/mnt/pvc" {
			t.Errorf("buildAbsPath=%q, want '/mnt/pvc'", result)
		}
	})
}

// ---------------------------------------------------------------------------
// TestBuildTarCommand – pure function, no K8s needed
// ---------------------------------------------------------------------------

func TestBuildTarCommand(t *testing.T) {
tests := []struct {
name     string
abs      string
isDir    bool
wantPart string
}{
{
name:     "directory uses -C with dot",
abs:      "/mnt/data/mydir",
isDir:    true,
wantPart: `tar -C "/mnt/data/mydir" -czf - .`,
},
{
name:     "file uses parent dir and filename",
abs:      "/mnt/data/file.txt",
isDir:    false,
wantPart: `tar -C "/mnt/data" -czf - "file.txt"`,
},
{
name:     "nested file",
abs:      "/pvc/sub/deep/report.csv",
isDir:    false,
wantPart: `tar -C "/pvc/sub/deep" -czf - "report.csv"`,
},
{
name:     "root directory",
abs:      "/mnt/pvc",
isDir:    true,
wantPart: `tar -C "/mnt/pvc" -czf - .`,
},
}
for _, tc := range tests {
t.Run(tc.name, func(t *testing.T) {
got := buildTarCommand(tc.abs, tc.isDir)
if got != tc.wantPart {
t.Errorf("buildTarCommand(%q, %v) = %q, want %q", tc.abs, tc.isDir, got, tc.wantPart)
}
})
}
}

// ---------------------------------------------------------------------------
// TestBuildPVCAbsPath – pure function, no K8s needed
// ---------------------------------------------------------------------------

func TestBuildPVCAbsPath(t *testing.T) {
tests := []struct {
name      string
mountPath string
subPath   string
relPath   string
want      string
}{
{"no subpath no relpath", "/mnt/pvc", "", "", "/mnt/pvc"},
{"subpath only", "/mnt/pvc", "sub", "", "/mnt/pvc/sub"},
{"relpath only", "/mnt/pvc", "", "file.txt", "/mnt/pvc/file.txt"},
{"subpath and relpath", "/mnt/pvc", "data", "file.txt", "/mnt/pvc/data/file.txt"},
{"mount with trailing slash", "/mnt/pvc/", "", "f", "/mnt/pvc/f"},
{"subpath leading slash stripped", "/mnt/pvc", "/sub", "x.log", "/mnt/pvc/sub/x.log"},
}
for _, tc := range tests {
t.Run(tc.name, func(t *testing.T) {
got := buildPVCAbsPath(tc.mountPath, tc.subPath, tc.relPath)
if got != tc.want {
t.Errorf("buildPVCAbsPath(%q,%q,%q)=%q, want %q",
tc.mountPath, tc.subPath, tc.relPath, got, tc.want)
}
})
}
}
