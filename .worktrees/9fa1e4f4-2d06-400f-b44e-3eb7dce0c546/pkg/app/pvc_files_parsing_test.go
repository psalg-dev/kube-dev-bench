package app

import (
	"bytes"
	"strings"
	"testing"
)

// --- parseLsLine ---

func TestParseLsLine(t *testing.T) {
	tests := []struct {
		name           string
		line           string
		wantOk         bool
		wantFileType   string
		wantName       string
		wantIsDir      bool
		wantIsSymlink  bool
		wantLinkTarget string
		wantSize       int64
	}{
		{
			name:         "regular file",
			line:         `-rw-r--r-- 1 root root 1234 2024-01-15T10:30:00 myfile.txt`,
			wantOk:       true,
			wantFileType: "-",
			wantName:     "myfile.txt",
			wantIsDir:    false,
			wantSize:     1234,
		},
		{
			name:         "directory with trailing slash",
			line:         `drwxr-xr-x 2 root root 4096 2024-01-15T10:30:00 subdir/`,
			wantOk:       true,
			wantFileType: "d",
			wantName:     "subdir/",
			wantIsDir:    true,
			wantSize:     4096,
		},
		{
			name:           "symlink with target",
			line:           `lrwxrwxrwx 1 root root 7 2024-01-15T10:30:00 link.txt -> real.txt`,
			wantOk:         true,
			wantFileType:   "l",
			wantName:       "link.txt",
			wantIsSymlink:  true,
			wantLinkTarget: "real.txt",
			wantSize:       7,
		},
		{
			name:           "symlink with absolute target",
			line:           `lrwxrwxrwx 1 root root 15 2024-01-15T10:30:00 shortcut -> /var/log/app.log`,
			wantOk:         true,
			wantFileType:   "l",
			wantName:       "shortcut",
			wantIsSymlink:  true,
			wantLinkTarget: "/var/log/app.log",
		},
		{
			name:   "empty line",
			line:   "",
			wantOk: false,
		},
		{
			name:   "whitespace only line",
			line:   "   ",
			wantOk: false,
		},
		{
			name:   "header line total",
			line:   "total 42",
			wantOk: false,
		},
		{
			name:   "dot entry skipped",
			line:   `drwxr-xr-x 2 root root 4096 2024-01-15T10:30:00 .`,
			wantOk: false,
		},
		{
			name:   "dotdot entry skipped",
			line:   `drwxr-xr-x 2 root root 4096 2024-01-15T10:30:00 ..`,
			wantOk: false,
		},
		{
			name:         "zero-size file",
			line:         `-rw-r--r-- 1 nobody nobody 0 2024-06-01T00:00:00 empty.txt`,
			wantOk:       true,
			wantFileType: "-",
			wantName:     "empty.txt",
			wantSize:     0,
		},
		{
			name:         "large file size",
			line:         `-rw-r--r-- 1 root root 1073741824 2024-06-01T12:00:00 bigfile.bin`,
			wantOk:       true,
			wantFileType: "-",
			wantName:     "bigfile.bin",
			wantSize:     1073741824,
		},
		{
			name:         "file with spaces in name",
			line:         `-rw-r--r-- 1 root root 100 2024-06-01T12:00:00 my file.txt`,
			wantOk:       true,
			wantFileType: "-",
			wantName:     "my file.txt",
			wantSize:     100,
		},
		{
			name:   "garbage line",
			line:   "not a valid ls line at all",
			wantOk: false,
		},
		{
			name:         "character device",
			line:         `crw-rw-rw- 1 root root 0 2024-01-15T10:30:00 tty0`,
			wantOk:       true,
			wantFileType: "c",
			wantName:     "tty0",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			entry, ok := parseLsLine(tc.line)
			if ok != tc.wantOk {
				t.Fatalf("parseLsLine(%q) ok=%v, want %v", tc.line, ok, tc.wantOk)
			}
			if !ok {
				return
			}
			if entry.fileType != tc.wantFileType {
				t.Errorf("fileType=%q, want %q", entry.fileType, tc.wantFileType)
			}
			if entry.name != tc.wantName {
				t.Errorf("name=%q, want %q", entry.name, tc.wantName)
			}
			isDir := entry.fileType == "d"
			if isDir != tc.wantIsDir {
				t.Errorf("isDir=%v, want %v", isDir, tc.wantIsDir)
			}
			if entry.isSymlink != tc.wantIsSymlink {
				t.Errorf("isSymlink=%v, want %v", entry.isSymlink, tc.wantIsSymlink)
			}
			if tc.wantLinkTarget != "" && entry.linkTarget != tc.wantLinkTarget {
				t.Errorf("linkTarget=%q, want %q", entry.linkTarget, tc.wantLinkTarget)
			}
			if tc.wantSize != 0 && entry.size != tc.wantSize {
				t.Errorf("size=%d, want %d", entry.size, tc.wantSize)
			}
		})
	}
}

// --- parsePVCLsOutput ---

func TestParseLsOutput(t *testing.T) {
	raw := strings.Join([]string{
		`-rw-r--r-- 1 root root 100 2024-01-15T10:30:00 file1.txt`,
		`drwxr-xr-x 2 root root 4096 2024-01-15T10:30:00 subdir/`,
		`lrwxrwxrwx 1 root root 7 2024-01-15T10:30:00 link -> file1.txt`,
		``,
		`total 8`,
		`drwxr-xr-x 2 root root 4096 2024-01-15T10:30:00 another/`,
	}, "\n")

	entries := parsePVCLsOutput(raw, "/")
	if len(entries) != 4 {
		t.Fatalf("expected 4 entries, got %d", len(entries))
	}
}

func TestParseLsOutput_Empty(t *testing.T) {
	entries := parsePVCLsOutput("", "/")
	if len(entries) != 0 {
		t.Errorf("expected 0 entries for empty input, got %d", len(entries))
	}
}

func TestParseLsOutput_OnlyInvalid(t *testing.T) {
	raw := "total 0\n\n"
	entries := parsePVCLsOutput(raw, "/")
	if len(entries) != 0 {
		t.Errorf("expected 0 entries, got %d", len(entries))
	}
}

func TestParseLsOutput_PathPrefix(t *testing.T) {
	raw := `-rw-r--r-- 1 root root 50 2024-01-15T10:30:00 data.txt`
	entries := parsePVCLsOutput(raw, "/some/path")
	if len(entries) != 1 {
		t.Fatalf("expected 1 entry, got %d", len(entries))
	}
	if entries[0].Path != "/some/path/data.txt" {
		t.Errorf("path=%q, want %q", entries[0].Path, "/some/path/data.txt")
	}
}

// --- buildPVCFileEntry ---

func TestBuildFileEntry(t *testing.T) {
	t.Run("regular file at root", func(t *testing.T) {
		e := &parsedLsEntry{
			fileType: "-",
			perms:    "rw-r--r--",
			size:     512,
			modified: "2024-01-15T10:30:00",
			name:     "hello.txt",
		}
		fe := buildPVCFileEntry(e, "/")
		if fe.Name != "hello.txt" {
			t.Errorf("Name=%q, want hello.txt", fe.Name)
		}
		if fe.Path != "/hello.txt" {
			t.Errorf("Path=%q, want /hello.txt", fe.Path)
		}
		if fe.IsDir {
			t.Error("IsDir should be false")
		}
		if fe.Size != 512 {
			t.Errorf("Size=%d, want 512", fe.Size)
		}
		if fe.Mode != "-rw-r--r--" {
			t.Errorf("Mode=%q, want -rw-r--r--", fe.Mode)
		}
	})

	t.Run("directory at subpath", func(t *testing.T) {
		e := &parsedLsEntry{
			fileType: "d",
			perms:    "rwxr-xr-x",
			size:     4096,
			modified: "2024-01-15T10:30:00",
			name:     "subdir/",
		}
		fe := buildPVCFileEntry(e, "/data")
		if !fe.IsDir {
			t.Error("IsDir should be true")
		}
		if fe.Path != "/data/subdir/" {
			t.Errorf("Path=%q, want /data/subdir/", fe.Path)
		}
	})

	t.Run("symlink", func(t *testing.T) {
		e := &parsedLsEntry{
			fileType:   "l",
			perms:      "rwxrwxrwx",
			size:       7,
			modified:   "2024-01-15T10:30:00",
			name:       "link.txt",
			isSymlink:  true,
			linkTarget: "real.txt",
		}
		fe := buildPVCFileEntry(e, "/")
		if !fe.IsSymlink {
			t.Error("IsSymlink should be true")
		}
		if fe.LinkTarget != "real.txt" {
			t.Errorf("LinkTarget=%q, want real.txt", fe.LinkTarget)
		}
	})

	t.Run("path with trailing slash normalised", func(t *testing.T) {
		e := &parsedLsEntry{
			fileType: "-",
			perms:    "rw-r--r--",
			name:     "file.txt",
		}
		fe := buildPVCFileEntry(e, "/data/")
		if fe.Path != "/data/file.txt" {
			t.Errorf("Path=%q, want /data/file.txt", fe.Path)
		}
	})
}

// --- sortFileEntriesByDirFirst ---

func TestSortFileEntries(t *testing.T) {
	t.Run("dirs before files", func(t *testing.T) {
		entries := []PodFileEntry{
			{Name: "zebra.txt", IsDir: false},
			{Name: "alpha/", IsDir: true},
			{Name: "beta.txt", IsDir: false},
			{Name: "gamma/", IsDir: true},
		}
		sortFileEntriesByDirFirst(entries)
		if !entries[0].IsDir || !entries[1].IsDir {
			t.Error("first two entries should be directories")
		}
		if entries[2].IsDir || entries[3].IsDir {
			t.Error("last two entries should be files")
		}
	})

	t.Run("directories alpha-sorted among themselves", func(t *testing.T) {
		entries := []PodFileEntry{
			{Name: "zoo/", IsDir: true},
			{Name: "apple/", IsDir: true},
			{Name: "mango/", IsDir: true},
		}
		sortFileEntriesByDirFirst(entries)
		if entries[0].Name != "apple/" || entries[1].Name != "mango/" || entries[2].Name != "zoo/" {
			t.Errorf("dirs not alpha-sorted: got %v %v %v", entries[0].Name, entries[1].Name, entries[2].Name)
		}
	})

	t.Run("files alpha-sorted among themselves", func(t *testing.T) {
		entries := []PodFileEntry{
			{Name: "z.txt", IsDir: false},
			{Name: "a.txt", IsDir: false},
			{Name: "m.txt", IsDir: false},
		}
		sortFileEntriesByDirFirst(entries)
		if entries[0].Name != "a.txt" || entries[1].Name != "m.txt" || entries[2].Name != "z.txt" {
			t.Errorf("files not alpha-sorted: got %v %v %v", entries[0].Name, entries[1].Name, entries[2].Name)
		}
	})

	t.Run("already sorted unchanged", func(t *testing.T) {
		entries := []PodFileEntry{
			{Name: "adir/", IsDir: true},
			{Name: "bdir/", IsDir: true},
			{Name: "afile.txt", IsDir: false},
			{Name: "bfile.txt", IsDir: false},
		}
		sortFileEntriesByDirFirst(entries)
		names := []string{entries[0].Name, entries[1].Name, entries[2].Name, entries[3].Name}
		want := []string{"adir/", "bdir/", "afile.txt", "bfile.txt"}
		for i, n := range names {
			if n != want[i] {
				t.Errorf("pos %d: got %q, want %q", i, n, want[i])
			}
		}
	})

	t.Run("empty slice", func(t *testing.T) {
		sortFileEntriesByDirFirst(nil)
	})
}

// --- buildAbsPath (sanitize/path-building) ---

func TestSanitizePath(t *testing.T) {
	tests := []struct {
		name      string
		mountPath string
		subPath   string
		path      string
		want      string
	}{
		{
			name:      "root path no subpath",
			mountPath: "/mnt/data",
			subPath:   "",
			path:      "/",
			want:      "/mnt/data",
		},
		{
			name:      "relative path appended",
			mountPath: "/mnt/data",
			subPath:   "",
			path:      "/subdir",
			want:      "/mnt/data/subdir",
		},
		{
			name:      "subpath included",
			mountPath: "/mnt/data",
			subPath:   "mysubdir",
			path:      "/file.txt",
			want:      "/mnt/data/mysubdir/file.txt",
		},
		{
			name:      "empty path returns mount",
			mountPath: "/mnt/claim",
			subPath:   "",
			path:      "",
			want:      "/mnt/claim",
		},
		{
			name:      "subpath with leading slash normalised",
			mountPath: "/mnt/data",
			subPath:   "/sub",
			path:      "/foo",
			want:      "/mnt/data/sub/foo",
		},
		{
			name:      "mount with trailing slash",
			mountPath: "/mnt/data/",
			subPath:   "",
			path:      "/bar",
			want:      "/mnt/data/bar",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got := buildAbsPath(tc.mountPath, tc.subPath, tc.path)
			if got != tc.want {
				t.Errorf("buildAbsPath(%q, %q, %q) = %q, want %q", tc.mountPath, tc.subPath, tc.path, got, tc.want)
			}
		})
	}
}

// --- validatePVCFilesRequest ---

func TestSanitizePVCFilesRequest(t *testing.T) {
tests := []struct {
name      string
namespace string
pvcName   string
path      string
wantErr   bool
errSubstr string
}{
{"valid", "default", "my-pvc", "/", false, ""},
{"empty namespace", "", "my-pvc", "/", true, "namespace"},
{"empty pvc name", "default", "", "/", true, "pvc name"},
{"path with dotdot", "default", "my-pvc", "/../etc", true, "invalid path"},
{"path with dotdot subdir", "default", "my-pvc", "/foo/../bar", true, "invalid path"},
{"empty path ok", "default", "my-pvc", "", false, ""},
{"root path ok", "default", "my-pvc", "/", false, ""},
{"subdir path ok", "default", "my-pvc", "/data/files", false, ""},
}
for _, tc := range tests {
t.Run(tc.name, func(t *testing.T) {
err := validatePVCFilesRequest(tc.namespace, tc.pvcName, tc.path)
if (err != nil) != tc.wantErr {
t.Fatalf("wantErr=%v, got err=%v", tc.wantErr, err)
}
if tc.errSubstr != "" && err != nil && !strings.Contains(err.Error(), tc.errSubstr) {
t.Errorf("error %q does not contain %q", err.Error(), tc.errSubstr)
}
})
}
}

// --- buildPVCAbsPath ---

func TestBuildFilePVCAbsPath(t *testing.T) {
tests := []struct {
name      string
mountPath string
subPath   string
relPath   string
want      string
}{
{"no subpath no relpath", "/mnt/data", "", "", "/mnt/data"},
{"subpath only", "/mnt/data", "sub", "", "/mnt/data/sub"},
{"relpath only", "/mnt/data", "", "file.txt", "/mnt/data/file.txt"},
{"subpath and relpath", "/mnt/data", "sub", "file.txt", "/mnt/data/sub/file.txt"},
{"subpath with leading slash", "/mnt/data", "/sub", "file.txt", "/mnt/data/sub/file.txt"},
{"mount trailing slash removed", "/mnt/data/", "sub", "file.txt", "/mnt/data/sub/file.txt"},
{"deep relpath", "/mnt", "", "a/b/c", "/mnt/a/b/c"},
}
for _, tc := range tests {
t.Run(tc.name, func(t *testing.T) {
got := buildPVCAbsPath(tc.mountPath, tc.subPath, tc.relPath)
if got != tc.want {
t.Errorf("buildPVCAbsPath(%q,%q,%q)=%q want %q", tc.mountPath, tc.subPath, tc.relPath, got, tc.want)
}
})
}
}

// --- buildTarCommand ---

func TestBuildFileTarCommand(t *testing.T) {
t.Run("directory", func(t *testing.T) {
cmd := buildTarCommand("/mnt/data/mydir", true)
if !strings.Contains(cmd, `tar -C`) {
t.Errorf("expected tar -C, got %q", cmd)
}
if !strings.Contains(cmd, `-czf - .`) {
t.Errorf("expected '-czf - .', got %q", cmd)
}
if !strings.Contains(cmd, "/mnt/data/mydir") {
t.Errorf("expected mount path in cmd, got %q", cmd)
}
})
t.Run("file", func(t *testing.T) {
cmd := buildTarCommand("/mnt/data/file.txt", false)
if !strings.Contains(cmd, `tar -C`) {
t.Errorf("expected tar -C, got %q", cmd)
}
if strings.Contains(cmd, ". ") {
t.Errorf("file tar should not archive '.', got %q", cmd)
}
if !strings.Contains(cmd, "file.txt") {
t.Errorf("expected filename in cmd, got %q", cmd)
}
if !strings.Contains(cmd, "/mnt/data") {
t.Errorf("expected parent dir in cmd, got %q", cmd)
}
})
t.Run("root file", func(t *testing.T) {
cmd := buildTarCommand("/file.txt", false)
if !strings.Contains(cmd, "file.txt") {
t.Errorf("expected filename, got %q", cmd)
}
})
}


// --- limitedWriter ---

func TestParseLsLimitedWriter(t *testing.T) {
t.Run("writes within limit", func(t *testing.T) {
var buf bytes.Buffer
lw := &limitedWriter{W: &buf, Limit: 10}
n, err := lw.Write([]byte("hello"))
if err != nil {
t.Fatal(err)
}
if n != 5 {
t.Errorf("n=%d want 5", n)
}
if buf.String() != "hello" {
t.Errorf("buf=%q want hello", buf.String())
}
})

t.Run("truncates at limit", func(t *testing.T) {
var buf bytes.Buffer
lw := &limitedWriter{W: &buf, Limit: 5}
n, err := lw.Write([]byte("hello world"))
if err != nil {
t.Fatal(err)
}
if n != 11 {
t.Errorf("n=%d want 11 (full input length)", n)
}
if buf.Len() != 5 {
t.Errorf("buf len=%d want 5", buf.Len())
}
if buf.String() != "hello" {
t.Errorf("buf=%q want hello", buf.String())
}
})

t.Run("discards writes when already full", func(t *testing.T) {
var buf bytes.Buffer
lw := &limitedWriter{W: &buf, Limit: 3}
lw.Write([]byte("abc"))
n, err := lw.Write([]byte("more"))
if err != nil {
t.Fatal(err)
}
if n != 4 {
t.Errorf("n=%d want 4", n)
}
if buf.String() != "abc" {
t.Errorf("buf=%q want abc (no more written)", buf.String())
}
})

t.Run("partial fill then full", func(t *testing.T) {
var buf bytes.Buffer
lw := &limitedWriter{W: &buf, Limit: 8}
lw.Write([]byte("abc"))    // 3 written, 5 remaining
lw.Write([]byte("defghij")) // should write 5, truncate 2
if buf.Len() != 8 {
t.Errorf("buf len=%d want 8", buf.Len())
}
if buf.String() != "abcdefgh" {
t.Errorf("buf=%q want abcdefgh", buf.String())
}
})
}
