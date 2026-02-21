package app

import (
	"strings"
	"testing"
	"time"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes/fake"
)

// ---------------------------------------------------------------------------
// TestNormalizePath
// ---------------------------------------------------------------------------

func TestNormalizePath(t *testing.T) {
	tests := []struct {
		name  string
		input string
		want  string
	}{
		{"empty string returns /", "", "/"},
		{"already rooted", "/foo/bar", "/foo/bar"},
		{"missing leading slash", "foo/bar", "/foo/bar"},
		{"root is unchanged", "/", "/"},
		{"single segment no slash", "data", "/data"},
		{"nested path", "a/b/c", "/a/b/c"},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got := normalizePath(tc.input)
			if got != tc.want {
				t.Errorf("normalizePath(%q) = %q, want %q", tc.input, got, tc.want)
			}
		})
	}
}

// ---------------------------------------------------------------------------
// TestParseFileType
// ---------------------------------------------------------------------------

func TestParseFileType(t *testing.T) {
	tests := []struct {
		tchar   string
		isDir   bool
		mode    string
	}{
		{"d", true, "dir"},
		{"l", false, "symlink"},
		{"f", false, "file"},
		{"-", false, "other"},
		{"x", false, "other"},
		{"", false, "other"},
	}
	for _, tc := range tests {
		t.Run("tchar="+tc.tchar, func(t *testing.T) {
			isDir, mode := parseFileType(tc.tchar)
			if isDir != tc.isDir {
				t.Errorf("parseFileType(%q).isDir = %v, want %v", tc.tchar, isDir, tc.isDir)
			}
			if mode != tc.mode {
				t.Errorf("parseFileType(%q).mode = %q, want %q", tc.tchar, mode, tc.mode)
			}
		})
	}
}

// ---------------------------------------------------------------------------
// TestParseFileEntry
// ---------------------------------------------------------------------------

func TestParseFileEntry(t *testing.T) {
	tests := []struct {
		name    string
		line    string
		base    string
		wantOk  bool
		wantName string
		wantPath string
		wantDir bool
		wantSize int64
	}{
		{
			name:     "regular file entry",
			line:     "readme.txt\tf\t1024\t1704067200",
			base:     "/",
			wantOk:   true,
			wantName: "readme.txt",
			wantPath: "/readme.txt",
			wantDir:  false,
			wantSize: 1024,
		},
		{
			name:     "directory entry",
			line:     "subdir\td\t4096\t1704067200",
			base:     "/data",
			wantOk:   true,
			wantName: "subdir",
			wantPath: "/data/subdir",
			wantDir:  true,
		},
		{
			name:    "empty line returns false",
			line:    "",
			base:    "/",
			wantOk:  false,
		},
		{
			name:    "too few fields",
			line:    "name\ttype",
			base:    "/",
			wantOk:  false,
		},
		{
			name:    "dot entry skipped",
			line:    ".\td\t0\t0",
			base:    "/",
			wantOk:  false,
		},
		{
			name:    "double-dot entry skipped",
			line:    "..\td\t0\t0",
			base:    "/",
			wantOk:  false,
		},
		{
			name:     "symlink entry",
			line:     "mylink\tl\t0\t1704067200",
			base:     "/mnt",
			wantOk:   true,
			wantName: "mylink",
			wantPath: "/mnt/mylink",
			wantDir:  false,
		},
		{
			name:     "base with trailing slash normalised",
			line:     "file.txt\tf\t42\t1704067200",
			base:     "/mnt/",
			wantOk:   true,
			wantName: "file.txt",
			wantPath: "/mnt/file.txt",
		},
		{
			name:     "zero-size file",
			line:     "empty\tf\t0\t1704067200",
			base:     "/",
			wantOk:   true,
			wantName: "empty",
			wantSize: 0,
		},
		{
			name:     "other type entry",
			line:     "pipe\to\t0\t1704067200",
			base:     "/",
			wantOk:   true,
			wantName: "pipe",
			wantDir:  false,
		},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			entry, ok := parseFileEntry(tc.line, tc.base)
			if ok != tc.wantOk {
				t.Fatalf("parseFileEntry(%q, %q) ok=%v, want %v", tc.line, tc.base, ok, tc.wantOk)
			}
			if !ok {
				return
			}
			if entry.Name != tc.wantName {
				t.Errorf("Name=%q, want %q", entry.Name, tc.wantName)
			}
			if tc.wantPath != "" && entry.Path != tc.wantPath {
				t.Errorf("Path=%q, want %q", entry.Path, tc.wantPath)
			}
			if entry.IsDir != tc.wantDir {
				t.Errorf("IsDir=%v, want %v", entry.IsDir, tc.wantDir)
			}
			if tc.wantSize != 0 && entry.Size != tc.wantSize {
				t.Errorf("Size=%d, want %d", entry.Size, tc.wantSize)
			}
		})
	}
}

// ---------------------------------------------------------------------------
// TestParseSearchEntry
// ---------------------------------------------------------------------------

func TestParseSearchEntry(t *testing.T) {
	tests := []struct {
		name     string
		line     string
		query    string
		wantOk   bool
		wantName string
		wantPath string
		wantDir  bool
	}{
		{
			name:     "matching file",
			line:     "/data/config.txt\tf\t100\t1704067200",
			query:    "config",
			wantOk:   true,
			wantName: "config.txt",
			wantPath: "/data/config.txt",
			wantDir:  false,
		},
		{
			name:   "non-matching file",
			line:   "/data/readme.md\tf\t50\t1704067200",
			query:  "config",
			wantOk: false,
		},
		{
			name:   "empty line",
			line:   "",
			query:  "test",
			wantOk: false,
		},
		{
			name:   "too few fields",
			line:   "/path\tf",
			query:  "test",
			wantOk: false,
		},
		{
			name:     "directory match",
			line:     "/var/log/mydir\td\t0\t1704067200",
			query:    "mydir",
			wantOk:   true,
			wantName: "mydir",
			wantDir:  true,
		},
		{
			name:     "case insensitive match",
			line:     "/data/Config.yaml\tf\t200\t1704067200",
			query:    "config",
			wantOk:   true,
			wantName: "Config.yaml",
		},
		{
			name:     "fractional timestamp",
			line:     "/tmp/test.txt\tf\t77\t1704067200.123",
			query:    "test",
			wantOk:   true,
			wantName: "test.txt",
		},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			entry, ok := parseSearchEntry(tc.line, tc.query)
			if ok != tc.wantOk {
				t.Fatalf("parseSearchEntry ok=%v, want %v", ok, tc.wantOk)
			}
			if !ok {
				return
			}
			if entry.Name != tc.wantName {
				t.Errorf("Name=%q, want %q", entry.Name, tc.wantName)
			}
			if tc.wantPath != "" && entry.Path != tc.wantPath {
				t.Errorf("Path=%q, want %q", entry.Path, tc.wantPath)
			}
			if entry.IsDir != tc.wantDir {
				t.Errorf("IsDir=%v, want %v", entry.IsDir, tc.wantDir)
			}
		})
	}
}

// ---------------------------------------------------------------------------
// TestDetectBinary
// ---------------------------------------------------------------------------

func TestDetectBinary(t *testing.T) {
	tests := []struct {
		name   string
		data   []byte
		isBin  bool
	}{
		{"empty", []byte{}, false},
		{"plain text", []byte("hello world\n"), false},
		{"text with newlines", []byte("line1\nline2\nline3\n"), false},
		{"null byte = binary", []byte("data\x00more"), true},
		{"high non-printable ratio", []byte{0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x0E, 0x0F}, true},
		{"mostly printable", []byte("hello world!! with a\x01few"), false},
		{"large text stays non-binary", []byte(strings.Repeat("a", 9000)), false},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got := detectBinary(tc.data)
			if got != tc.isBin {
				t.Errorf("detectBinary(%q) = %v, want %v", tc.data, got, tc.isBin)
			}
		})
	}
}

// ---------------------------------------------------------------------------
// TestParseAndSortFileEntries
// ---------------------------------------------------------------------------

func TestParseAndSortFileEntries(t *testing.T) {
	t.Run("directories sorted before files", func(t *testing.T) {
		output := "zoo.txt\tf\t100\t0\nalpha\td\t0\t0\nbeta\td\t0\t0\naardvark.log\tf\t50\t0"
		entries := parseAndSortFileEntries(output, "/mnt")
		if len(entries) != 4 {
			t.Fatalf("expected 4 entries, got %d", len(entries))
		}
		if !entries[0].IsDir || !entries[1].IsDir {
			t.Errorf("first two entries should be dirs: %+v", entries[:2])
		}
		if entries[2].IsDir || entries[3].IsDir {
			t.Errorf("last two should be files")
		}
		if entries[0].Name != "alpha" || entries[1].Name != "beta" {
			t.Errorf("dirs not sorted: %s, %s", entries[0].Name, entries[1].Name)
		}
	})

	t.Run("empty output returns empty slice", func(t *testing.T) {
		entries := parseAndSortFileEntries("", "/")
		if len(entries) != 0 {
			t.Errorf("expected 0 entries for empty input, got %d", len(entries))
		}
	})

	t.Run("single file", func(t *testing.T) {
		entries := parseAndSortFileEntries("only.txt\tf\t1\t0", "/")
		if len(entries) != 1 || entries[0].Name != "only.txt" {
			t.Errorf("unexpected entries: %+v", entries)
		}
	})

	t.Run("skips malformed lines", func(t *testing.T) {
		output := "good.txt\tf\t1\t0\nbad-line\ngood2.txt\tf\t2\t0"
		entries := parseAndSortFileEntries(output, "/")
		if len(entries) != 2 {
			t.Errorf("expected 2 entries (skip malformed), got %d", len(entries))
		}
	})
}

// ---------------------------------------------------------------------------
// TestParseSearchResults
// ---------------------------------------------------------------------------

func TestParseSearchResults(t *testing.T) {
	t.Run("matches multiple files", func(t *testing.T) {
		output := "/data/config.yml\tf\t100\t0\n/data/config.json\tf\t200\t0\n/data/readme.md\tf\t50\t0"
		results := parseSearchResults(output, "config", 10)
		if len(results) != 2 {
			t.Fatalf("expected 2 results, got %d", len(results))
		}
	})

	t.Run("respects maxResults limit", func(t *testing.T) {
		output := "/data/a.txt\tf\t1\t0\n/data/b.txt\tf\t2\t0\n/data/c.txt\tf\t3\t0"
		results := parseSearchResults(output, "txt", 2)
		if len(results) != 2 {
			t.Errorf("expected 2 results (maxResults=2), got %d", len(results))
		}
	})

	t.Run("maxResults=0 means unlimited", func(t *testing.T) {
		output := "/a.log\tf\t1\t0\n/b.log\tf\t2\t0\n/c.log\tf\t3\t0"
		results := parseSearchResults(output, "log", 0)
		if len(results) != 3 {
			t.Errorf("expected 3 results, got %d", len(results))
		}
	})

	t.Run("empty output returns empty", func(t *testing.T) {
		results := parseSearchResults("", "test", 0)
		if len(results) != 0 {
			t.Errorf("expected 0 results, got %d", len(results))
		}
	})

	t.Run("results sorted by path", func(t *testing.T) {
		output := "/z/file.txt\tf\t1\t0\n/a/file.txt\tf\t2\t0"
		results := parseSearchResults(output, "file", 0)
		if len(results) != 2 {
			t.Fatalf("expected 2")
		}
		if results[0].Path > results[1].Path {
			t.Errorf("results not sorted by path: %s > %s", results[0].Path, results[1].Path)
		}
	})
}

// ---------------------------------------------------------------------------
// TestResolveContainerName
// ---------------------------------------------------------------------------

func TestResolveContainerName(t *testing.T) {
	pod := &corev1.Pod{
		Spec: corev1.PodSpec{
			Containers: []corev1.Container{
				{Name: "main"},
				{Name: "sidecar"},
			},
		},
	}

	t.Run("empty container returns first", func(t *testing.T) {
		name, err := resolveContainerName(pod, "")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if name != "main" {
			t.Errorf("expected 'main', got %q", name)
		}
	})

	t.Run("named container found", func(t *testing.T) {
		name, err := resolveContainerName(pod, "sidecar")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if name != "sidecar" {
			t.Errorf("expected 'sidecar', got %q", name)
		}
	})

	t.Run("named container not found", func(t *testing.T) {
		_, err := resolveContainerName(pod, "nonexistent")
		if err == nil {
			t.Fatal("expected error for nonexistent container")
		}
		if !strings.Contains(err.Error(), "nonexistent") {
			t.Errorf("error should mention container name: %v", err)
		}
	})

	t.Run("empty container empty pod", func(t *testing.T) {
		emptyPod := &corev1.Pod{Spec: corev1.PodSpec{}}
		_, err := resolveContainerName(emptyPod, "")
		if err == nil {
			t.Fatal("expected error for empty pod")
		}
	})
}

// ---------------------------------------------------------------------------
// TestValidatePodFilesRequest
// ---------------------------------------------------------------------------

func TestValidatePodFilesRequest(t *testing.T) {
	t.Run("no namespace", func(t *testing.T) {
		app := &App{currentNamespace: ""}
		err := app.validatePodFilesRequest("mypod")
		if err == nil || !strings.Contains(err.Error(), "namespace") {
			t.Fatalf("expected namespace error, got: %v", err)
		}
	})

	t.Run("empty pod name", func(t *testing.T) {
		app := &App{currentNamespace: "default"}
		err := app.validatePodFilesRequest("")
		if err == nil || !strings.Contains(err.Error(), "pod name") {
			t.Fatalf("expected pod name error, got: %v", err)
		}
	})

	t.Run("valid inputs", func(t *testing.T) {
		app := &App{currentNamespace: "default"}
		err := app.validatePodFilesRequest("mypod")
		if err != nil {
			t.Fatalf("expected no error, got: %v", err)
		}
	})
}

// ---------------------------------------------------------------------------
// TestGetServiceDetail (resource_details.go)
// ---------------------------------------------------------------------------

func TestGetServiceDetail_HappyPath(t *testing.T) {
	ns := "default"
	cs := fake.NewSimpleClientset(
		&corev1.Service{
			ObjectMeta: metav1.ObjectMeta{Name: "my-svc", Namespace: ns},
			Spec: corev1.ServiceSpec{
				Ports: []corev1.ServicePort{{Port: 80, Protocol: corev1.ProtocolTCP}},
			},
		},
		&corev1.Endpoints{
			ObjectMeta: metav1.ObjectMeta{Name: "my-svc", Namespace: ns},
		},
	)
	app := &App{
		ctx:           t.Context(),
		testClientset: cs,
	}
	detail, err := app.GetServiceDetail(ns, "my-svc")
	if err != nil {
		t.Fatalf("GetServiceDetail: %v", err)
	}
	if detail == nil {
		t.Fatal("expected non-nil ServiceDetail")
	}
}

func TestGetServiceDetail_EmptyNamespace(t *testing.T) {
	app := &App{ctx: t.Context(), testClientset: fake.NewSimpleClientset()}
	_, err := app.GetServiceDetail("", "svc")
	if err == nil || !strings.Contains(err.Error(), "namespace") {
		t.Fatalf("expected namespace error, got: %v", err)
	}
}

func TestGetServiceDetail_EmptyName(t *testing.T) {
	app := &App{ctx: t.Context(), testClientset: fake.NewSimpleClientset()}
	_, err := app.GetServiceDetail("default", "")
	if err == nil || !strings.Contains(err.Error(), "name") {
		t.Fatalf("expected name error, got: %v", err)
	}
}

func TestGetServiceDetail_NotFound(t *testing.T) {
	app := &App{ctx: t.Context(), testClientset: fake.NewSimpleClientset()}
	_, err := app.GetServiceDetail("default", "no-svc")
	if err == nil {
		t.Fatal("expected not-found error")
	}
}

func TestGetServiceDetail_WithEndpoints(t *testing.T) {
	ns := "default"
	cs := fake.NewSimpleClientset(
		&corev1.Service{
			ObjectMeta: metav1.ObjectMeta{Name: "ep-svc", Namespace: ns},
			Spec: corev1.ServiceSpec{
				Ports: []corev1.ServicePort{
					{Name: "http", Port: 80, Protocol: corev1.ProtocolTCP},
				},
			},
		},
		&corev1.Endpoints{
			ObjectMeta: metav1.ObjectMeta{Name: "ep-svc", Namespace: ns},
			Subsets: []corev1.EndpointSubset{
				{
					Addresses: []corev1.EndpointAddress{
						{IP: "10.0.0.1"},
					},
					NotReadyAddresses: []corev1.EndpointAddress{
						{IP: "10.0.0.2"},
					},
					Ports: []corev1.EndpointPort{{Name: "http", Port: 80}},
				},
			},
		},
	)
	app := &App{ctx: t.Context(), testClientset: cs}
	detail, err := app.GetServiceDetail(ns, "ep-svc")
	if err != nil {
		t.Fatalf("GetServiceDetail: %v", err)
	}
	if len(detail.Endpoints) != 2 {
		t.Errorf("expected 2 endpoints (1 ready + 1 not-ready), got %d", len(detail.Endpoints))
	}
}

// ---------------------------------------------------------------------------
// TestGetPVCDetail (resource_details.go)
// ---------------------------------------------------------------------------

func TestGetPVCDetail_HappyPath(t *testing.T) {
	ns := "default"
	cs := fake.NewSimpleClientset(
		&corev1.PersistentVolumeClaim{
			ObjectMeta: metav1.ObjectMeta{Name: "my-pvc", Namespace: ns},
			Status: corev1.PersistentVolumeClaimStatus{
				Conditions: []corev1.PersistentVolumeClaimCondition{
					{
						Type:               corev1.PersistentVolumeClaimResizing,
						Status:             corev1.ConditionTrue,
						LastTransitionTime: metav1.NewTime(time.Now()),
						Reason:             "Resizing",
						Message:            "PVC is being resized",
					},
				},
			},
		},
	)
	app := &App{ctx: t.Context(), testClientset: cs}
	detail, err := app.GetPersistentVolumeClaimDetail(ns, "my-pvc")
	if err != nil {
		t.Fatalf("GetPersistentVolumeClaimDetail: %v", err)
	}
	if len(detail.Conditions) != 1 {
		t.Errorf("expected 1 condition, got %d", len(detail.Conditions))
	}
	if detail.Conditions[0].Type != "Resizing" {
		t.Errorf("unexpected condition type: %s", detail.Conditions[0].Type)
	}
}

func TestGetPVCDetail_EmptyNamespace(t *testing.T) {
	app := &App{ctx: t.Context(), testClientset: fake.NewSimpleClientset()}
	_, err := app.GetPersistentVolumeClaimDetail("", "pvc")
	if err == nil || !strings.Contains(err.Error(), "namespace") {
		t.Fatalf("expected namespace error, got: %v", err)
	}
}

func TestGetPVCDetail_EmptyName(t *testing.T) {
	app := &App{ctx: t.Context(), testClientset: fake.NewSimpleClientset()}
	_, err := app.GetPersistentVolumeClaimDetail("default", "")
	if err == nil || !strings.Contains(err.Error(), "name") {
		t.Fatalf("expected name error, got: %v", err)
	}
}

func TestGetPVCDetail_NotFound(t *testing.T) {
	app := &App{ctx: t.Context(), testClientset: fake.NewSimpleClientset()}
	_, err := app.GetPersistentVolumeClaimDetail("default", "no-pvc")
	if err == nil {
		t.Fatal("expected not-found error")
	}
}

func TestGetPVCDetail_NoConditions(t *testing.T) {
	ns := "default"
	cs := fake.NewSimpleClientset(
		&corev1.PersistentVolumeClaim{
			ObjectMeta: metav1.ObjectMeta{Name: "empty-pvc", Namespace: ns},
			Status:     corev1.PersistentVolumeClaimStatus{},
		},
	)
	app := &App{ctx: t.Context(), testClientset: cs}
	detail, err := app.GetPersistentVolumeClaimDetail(ns, "empty-pvc")
	if err != nil {
		t.Fatalf("GetPersistentVolumeClaimDetail: %v", err)
	}
	if len(detail.Conditions) != 0 {
		t.Errorf("expected no conditions, got %d", len(detail.Conditions))
	}
}

// ---------------------------------------------------------------------------
// TestGetPVDetail (resource_details.go)
// ---------------------------------------------------------------------------

func TestGetPVDetail_HappyPath(t *testing.T) {
	cs := fake.NewSimpleClientset(
		&corev1.PersistentVolume{
			ObjectMeta: metav1.ObjectMeta{Name: "my-pv"},
		},
	)
	app := &App{ctx: t.Context(), testClientset: cs}
	detail, err := app.GetPersistentVolumeDetail("my-pv")
	if err != nil {
		t.Fatalf("GetPersistentVolumeDetail: %v", err)
	}
	if detail == nil {
		t.Fatal("expected non-nil PersistentVolumeDetail")
	}
	if len(detail.Conditions) != 0 {
		t.Errorf("expected 0 conditions (PVs don't have conditions), got %d", len(detail.Conditions))
	}
}

func TestGetPVDetail_EmptyName(t *testing.T) {
	app := &App{ctx: t.Context(), testClientset: fake.NewSimpleClientset()}
	_, err := app.GetPersistentVolumeDetail("")
	if err == nil || !strings.Contains(err.Error(), "name") {
		t.Fatalf("expected name error, got: %v", err)
	}
}

func TestGetPVDetail_NotFound(t *testing.T) {
	app := &App{ctx: t.Context(), testClientset: fake.NewSimpleClientset()}
	_, err := app.GetPersistentVolumeDetail("no-pv")
	if err == nil {
		t.Fatal("expected not-found error")
	}
}
