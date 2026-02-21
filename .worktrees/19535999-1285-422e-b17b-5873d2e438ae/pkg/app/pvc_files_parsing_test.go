package app

import (
	"testing"
)

// TestParseLsLine covers ≥10 cases: regular files, directories, symlinks, empty lines, and header lines.
func TestParseLsLine(t *testing.T) {
	tests := []struct {
		name        string
		line        string
		wantOk      bool
		wantType    string
		wantName    string
		wantSymlink bool
		wantTarget  string
		wantSize    int64
	}{
		{
			name:     "regular file",
			line:     "-rw-r--r-- 1 root root 1234 2024-01-15T10:30:00 myfile.txt",
			wantOk:   true,
			wantType: "-",
			wantName: "myfile.txt",
			wantSize: 1234,
		},
		{
			name:     "executable file",
			line:     "-rwxr-xr-x 1 root root 8192 2024-06-01T12:00:00 run.sh",
			wantOk:   true,
			wantType: "-",
			wantName: "run.sh",
			wantSize: 8192,
		},
		{
			name:     "directory",
			line:     "drwxr-xr-x 2 root root 4096 2024-03-10T08:00:00 mydir/",
			wantOk:   true,
			wantType: "d",
			wantName: "mydir/",
		},
		{
			name:     "directory without trailing slash",
			line:     "drwxr-xr-x 5 user group 4096 2025-01-01T00:00:00 subdir",
			wantOk:   true,
			wantType: "d",
			wantName: "subdir",
		},
		{
			name:        "symlink with target",
			line:        "lrwxrwxrwx 1 root root 12 2024-04-20T15:45:00 link -> /etc/target",
			wantOk:      true,
			wantType:    "l",
			wantName:    "link",
			wantSymlink: true,
			wantTarget:  "/etc/target",
		},
		{
			name:        "symlink relative target",
			line:        "lrwxrwxrwx 1 root root 8 2024-04-20T15:45:00 rel -> ../other",
			wantOk:      true,
			wantType:    "l",
			wantName:    "rel",
			wantSymlink: true,
			wantTarget:  "../other",
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
			name:   "total header line",
			line:   "total 48",
			wantOk: false,
		},
		{
			name:   "dot entry is skipped",
			line:   "drwxr-xr-x 2 root root 4096 2024-01-15T10:30:00 .",
			wantOk: false,
		},
		{
			name:   "dot-dot entry is skipped",
			line:   "drwxr-xr-x 2 root root 4096 2024-01-15T10:30:00 ..",
			wantOk: false,
		},
		{
			name:   "arbitrary text line",
			line:   "this is not an ls line at all",
			wantOk: false,
		},
		{
			name:     "file with spaces in name",
			line:     "-rw-r--r-- 1 user group 512 2024-07-04T09:00:00 my file with spaces.txt",
			wantOk:   true,
			wantType: "-",
			wantName: "my file with spaces.txt",
			wantSize: 512,
		},
		{
			name:     "zero-size file",
			line:     "-rw-r--r-- 1 root root 0 2025-02-01T00:00:00 empty.txt",
			wantOk:   true,
			wantType: "-",
			wantName: "empty.txt",
			wantSize: 0,
		},
		{
			name:   "char device type",
			line:   "crw-rw-rw- 1 root tty 5 2024-01-01T00:00:00 ttyS0",
			wantOk: true,
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
					t.Errorf("parseLsLine(%q): expected nil entry when ok=false, got %+v", tc.line, entry)
				}
				return
			}
			if tc.wantType != "" && entry.fileType != tc.wantType {
				t.Errorf("fileType=%q, want %q", entry.fileType, tc.wantType)
			}
			if tc.wantName != "" && entry.name != tc.wantName {
				t.Errorf("name=%q, want %q", entry.name, tc.wantName)
			}
			if entry.isSymlink != tc.wantSymlink {
				t.Errorf("isSymlink=%v, want %v", entry.isSymlink, tc.wantSymlink)
			}
			if tc.wantTarget != "" && entry.linkTarget != tc.wantTarget {
				t.Errorf("linkTarget=%q, want %q", entry.linkTarget, tc.wantTarget)
			}
			if tc.wantSize != 0 && entry.size != tc.wantSize {
				t.Errorf("size=%d, want %d", entry.size, tc.wantSize)
			}
		})
	}
}

// TestParseLsLine_EmptyAndHeaderReturnFalse specifically verifies AC#2.
func TestParseLsLine_EmptyAndHeaderReturnFalse(t *testing.T) {
	cases := []string{"", "   ", "\t", "total 0", "total 128"}
	for _, line := range cases {
		_, ok := parseLsLine(line)
		if ok {
			t.Errorf("parseLsLine(%q) = true, want false", line)
		}
	}
}

// TestParseLsOutput verifies the full output parser skips non-matching lines.
func TestParseLsOutput(t *testing.T) {
	raw := `drwxr-xr-x 2 root root 4096 2024-01-15T10:30:00 subdir/
-rw-r--r-- 1 root root 512 2024-01-15T10:31:00 file.txt
lrwxrwxrwx 1 root root 7 2024-01-15T10:32:00 link -> file.txt
this line is garbage
`
	entries := parsePVCLsOutput(raw, "/data")
	if len(entries) != 3 {
		t.Fatalf("parsePVCLsOutput: got %d entries, want 3", len(entries))
	}
	if entries[0].Name != "subdir/" {
		t.Errorf("entry[0].Name=%q, want subdir/", entries[0].Name)
	}
	if entries[1].Name != "file.txt" {
		t.Errorf("entry[1].Name=%q, want file.txt", entries[1].Name)
	}
	if !entries[2].IsSymlink {
		t.Errorf("entry[2].IsSymlink=false, want true")
	}
}

// TestBuildFileEntry_Symlink verifies AC#4: symlink target is populated.
func TestBuildFileEntry(t *testing.T) {
	t.Run("symlink target populated", func(t *testing.T) {
		entry := &parsedLsEntry{
			fileType:   "l",
			perms:      "rwxrwxrwx",
			size:       7,
			modified:   "2024-01-15T10:30:00",
			name:       "mylink",
			isSymlink:  true,
			linkTarget: "/etc/target",
		}
		fe := buildPVCFileEntry(entry, "/data")
		if !fe.IsSymlink {
			t.Errorf("IsSymlink=false, want true")
		}
		if fe.LinkTarget != "/etc/target" {
			t.Errorf("LinkTarget=%q, want /etc/target", fe.LinkTarget)
		}
		if fe.Name != "mylink" {
			t.Errorf("Name=%q, want mylink", fe.Name)
		}
		if fe.Path != "/data/mylink" {
			t.Errorf("Path=%q, want /data/mylink", fe.Path)
		}
	})

	t.Run("regular file not symlink", func(t *testing.T) {
		entry := &parsedLsEntry{
			fileType:  "-",
			perms:     "rw-r--r--",
			size:      100,
			modified:  "2024-01-15T10:30:00",
			name:      "readme.txt",
			isSymlink: false,
		}
		fe := buildPVCFileEntry(entry, "/mnt")
		if fe.IsSymlink {
			t.Errorf("IsSymlink=true, want false")
		}
		if fe.LinkTarget != "" {
			t.Errorf("LinkTarget=%q, want empty", fe.LinkTarget)
		}
	})

	t.Run("directory IsDir flag", func(t *testing.T) {
		entry := &parsedLsEntry{
			fileType: "d",
			perms:    "rwxr-xr-x",
			size:     4096,
			modified: "2024-01-15T10:30:00",
			name:     "configs",
		}
		fe := buildPVCFileEntry(entry, "/var")
		if !fe.IsDir {
			t.Errorf("IsDir=false, want true")
		}
		if fe.Path != "/var/configs" {
			t.Errorf("Path=%q, want /var/configs", fe.Path)
		}
	})

	t.Run("root path prefix", func(t *testing.T) {
		entry := &parsedLsEntry{
			fileType: "-",
			perms:    "rw-r--r--",
			size:     50,
			modified: "2024-01-15T10:30:00",
			name:     "top.txt",
		}
		fe := buildPVCFileEntry(entry, "/")
		if fe.Path != "/top.txt" {
			t.Errorf("Path=%q, want /top.txt", fe.Path)
		}
	})

	t.Run("mode field includes type prefix", func(t *testing.T) {
		entry := &parsedLsEntry{
			fileType: "-",
			perms:    "rw-r--r--",
			size:     0,
			modified: "2024-01-15T10:30:00",
			name:     "a.txt",
		}
		fe := buildPVCFileEntry(entry, "/x")
		if fe.Mode != "-rw-r--r--" {
			t.Errorf("Mode=%q, want -rw-r--r--", fe.Mode)
		}
	})
}

// TestSortFileEntries verifies AC#3: directories appear before files.
func TestSortFileEntries(t *testing.T) {
	entries := []PodFileEntry{
		{Name: "zebra.txt", IsDir: false},
		{Name: "alpha/", IsDir: true},
		{Name: "mango.log", IsDir: false},
		{Name: "beta/", IsDir: true},
		{Name: "aardvark.sh", IsDir: false},
	}
	sortFileEntriesByDirFirst(entries)

	// First two must be directories
	for i := 0; i < 2; i++ {
		if !entries[i].IsDir {
			t.Errorf("entries[%d].IsDir=false, expected dir first (name=%q)", i, entries[i].Name)
		}
	}
	// Remaining must be files
	for i := 2; i < len(entries); i++ {
		if entries[i].IsDir {
			t.Errorf("entries[%d].IsDir=true, expected file (name=%q)", i, entries[i].Name)
		}
	}
	// Directories sorted alphabetically among themselves
	if entries[0].Name != "alpha/" || entries[1].Name != "beta/" {
		t.Errorf("dirs not sorted: got %q %q, want alpha/ beta/", entries[0].Name, entries[1].Name)
	}
	// Files sorted alphabetically among themselves
	if entries[2].Name != "aardvark.sh" || entries[3].Name != "mango.log" || entries[4].Name != "zebra.txt" {
		t.Errorf("files not sorted: got %q %q %q", entries[2].Name, entries[3].Name, entries[4].Name)
	}
}

// TestSortFileEntries_AllDirs verifies sort is stable when all entries are directories.
func TestSortFileEntries_AllDirs(t *testing.T) {
	entries := []PodFileEntry{
		{Name: "z/", IsDir: true},
		{Name: "a/", IsDir: true},
	}
	sortFileEntriesByDirFirst(entries)
	if entries[0].Name != "a/" || entries[1].Name != "z/" {
		t.Errorf("expected alphabetical sort, got %q %q", entries[0].Name, entries[1].Name)
	}
}

// TestSortFileEntries_AllFiles verifies sort is stable when all entries are files.
func TestSortFileEntries_AllFiles(t *testing.T) {
	entries := []PodFileEntry{
		{Name: "z.txt", IsDir: false},
		{Name: "a.txt", IsDir: false},
	}
	sortFileEntriesByDirFirst(entries)
	if entries[0].Name != "a.txt" || entries[1].Name != "z.txt" {
		t.Errorf("expected alphabetical sort, got %q %q", entries[0].Name, entries[1].Name)
	}
}

// TestSanitizePath tests buildAbsPath which builds absolute container paths.
func TestSanitizePath(t *testing.T) {
	tests := []struct {
		name      string
		mountPath string
		subPath   string
		path      string
		want      string
	}{
		{
			name:      "simple root browse",
			mountPath: "/mnt/data",
			subPath:   "",
			path:      "",
			want:      "/mnt/data",
		},
		{
			name:      "root with relative path",
			mountPath: "/mnt/data",
			subPath:   "",
			path:      "subdir",
			want:      "/mnt/data/subdir",
		},
		{
			name:      "with subpath no rel",
			mountPath: "/mnt/data",
			subPath:   "myapp",
			path:      "",
			want:      "/mnt/data/myapp",
		},
		{
			name:      "with subpath and rel",
			mountPath: "/mnt/data",
			subPath:   "myapp",
			path:      "config",
			want:      "/mnt/data/myapp/config",
		},
		{
			name:      "trailing slash on mountPath normalized",
			mountPath: "/mnt/data/",
			subPath:   "",
			path:      "file.txt",
			want:      "/mnt/data/file.txt",
		},
		{
			name:      "subpath with leading slash stripped",
			mountPath: "/vol",
			subPath:   "/sub",
			path:      "",
			want:      "/vol/sub",
		},
		{
			name:      "nested relative path",
			mountPath: "/storage",
			subPath:   "ns",
			path:      "a/b/c",
			want:      "/storage/ns/a/b/c",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got := buildAbsPath(tc.mountPath, tc.subPath, tc.path)
			if got != tc.want {
				t.Errorf("buildAbsPath(%q,%q,%q) = %q, want %q",
					tc.mountPath, tc.subPath, tc.path, got, tc.want)
			}
		})
	}
}
