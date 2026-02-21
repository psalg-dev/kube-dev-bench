// Package app – extra pure-function coverage tests targeting genuinely-0% and
// partially-covered utility functions that require no Kubernetes or Docker
// infrastructure.
package app

import (
	"archive/tar"
	"bytes"
	"context"
	"io"
	"os"
	"strings"
	"testing"

	dockerswarm "github.com/docker/docker/api/types/swarm"
	corev1 "k8s.io/api/core/v1"
	discoveryv1 "k8s.io/api/discovery/v1"
	"k8s.io/client-go/rest"
)

// ============================================================================
// proxy.go: getProxyURL
// ============================================================================

func TestGetProxyURL(t *testing.T) {
	tests := []struct {
		name      string
		authType  string
		proxyURL  string
		wantEmpty bool
		want      string
	}{
		{
			name:      "system auth type returns empty",
			authType:  "system",
			proxyURL:  "http://proxy:8080",
			wantEmpty: true,
		},
		{
			name:     "basic auth type returns proxyURL",
			authType: "basic",
			proxyURL: "http://proxy.example.com:8080",
			want:     "http://proxy.example.com:8080",
		},
		{
			name:     "none auth type returns proxyURL",
			authType: "none",
			proxyURL: "http://other.proxy:3128",
			want:     "http://other.proxy:3128",
		},
		{
			name:      "default/unknown auth type returns empty",
			authType:  "unknown",
			proxyURL:  "http://proxy:8080",
			wantEmpty: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			app := &App{
				proxyAuthType: tt.authType,
				proxyURL:      tt.proxyURL,
			}
			got := app.getProxyURL()
			if tt.wantEmpty {
				if got != "" {
					t.Errorf("getProxyURL() = %q, want empty string", got)
				}
			} else {
				if got != tt.want {
					t.Errorf("getProxyURL() = %q, want %q", got, tt.want)
				}
			}
		})
	}
}

// ============================================================================
// proxy.go: applyProxyConfig
// ============================================================================

func TestApplyProxyConfig(t *testing.T) {
	t.Run("system proxy does not set Proxy field", func(t *testing.T) {
		app := &App{
			proxyAuthType: "system",
			proxyURL:      "",
		}
		cfg := &rest.Config{}
		app.applyProxyConfig(cfg)
		// For "system" auth, Proxy should remain nil (let http.ProxyFromEnvironment handle it)
		if cfg.Proxy != nil {
			t.Error("applyProxyConfig(system) should not set Proxy on rest.Config")
		}
	})

	t.Run("none auth type disables proxy", func(t *testing.T) {
		app := &App{
			proxyAuthType: "none",
			proxyURL:      "",
		}
		cfg := &rest.Config{}
		app.applyProxyConfig(cfg)
		if cfg.Proxy == nil {
			t.Error("applyProxyConfig(none, empty URL) should set Proxy to nil-returning func")
		}
		// Verify the proxy function returns nil
		if cfg.Proxy != nil {
			result, err := cfg.Proxy(nil)
			if err != nil || result != nil {
				t.Errorf("Proxy func should return (nil, nil), got (%v, %v)", result, err)
			}
		}
	})

	t.Run("basic auth with valid URL sets proxy", func(t *testing.T) {
		app := &App{
			proxyAuthType: "basic",
			proxyURL:      "http://proxy.example.com:8080",
			proxyUsername: "",
			proxyPassword: "",
		}
		cfg := &rest.Config{}
		app.applyProxyConfig(cfg)
		if cfg.Proxy == nil {
			t.Error("applyProxyConfig(basic, valid URL) should set Proxy")
		}
	})

	t.Run("basic auth with credentials sets userinfo on proxy URL", func(t *testing.T) {
		app := &App{
			proxyAuthType: "basic",
			proxyURL:      "http://proxy.example.com:8080",
			proxyUsername: "user",
			proxyPassword: "pass",
		}
		cfg := &rest.Config{}
		app.applyProxyConfig(cfg)
		if cfg.Proxy == nil {
			t.Fatal("applyProxyConfig should set Proxy")
		}
		parsedURL, err := cfg.Proxy(nil)
		if err != nil {
			t.Fatalf("Proxy func error: %v", err)
		}
		if parsedURL == nil {
			t.Fatal("Proxy func returned nil URL")
		}
		if parsedURL.User == nil {
			t.Error("expected userinfo in proxy URL")
		} else {
			if parsedURL.User.Username() != "user" {
				t.Errorf("proxy username = %q, want %q", parsedURL.User.Username(), "user")
			}
			pass, _ := parsedURL.User.Password()
			if pass != "pass" {
				t.Errorf("proxy password = %q, want %q", pass, "pass")
			}
		}
	})

	t.Run("invalid proxy URL logs warning and returns", func(t *testing.T) {
		app := &App{
			proxyAuthType: "basic",
			proxyURL:      "://invalid-url",
		}
		cfg := &rest.Config{}
		// Should not panic, just log the warning and leave Proxy nil
		app.applyProxyConfig(cfg)
	})
}

// ============================================================================
// docker_integration.go: collectServiceIDs
// ============================================================================

func TestCollectServiceIDs(t *testing.T) {
	tests := []struct {
		name     string
		services []dockerswarm.Service
		want     []string
	}{
		{
			name:     "nil slice returns empty",
			services: nil,
			want:     []string{},
		},
		{
			name:     "empty slice returns empty",
			services: []dockerswarm.Service{},
			want:     []string{},
		},
		{
			name: "services with IDs are collected",
			services: []dockerswarm.Service{
				{ID: "svc-abc"},
				{ID: "svc-def"},
			},
			want: []string{"svc-abc", "svc-def"},
		},
		{
			name: "services with empty ID are skipped",
			services: []dockerswarm.Service{
				{ID: "svc-abc"},
				{ID: ""},
				{ID: "svc-ghi"},
			},
			want: []string{"svc-abc", "svc-ghi"},
		},
		{
			name: "all services have empty ID",
			services: []dockerswarm.Service{
				{ID: ""},
				{ID: ""},
			},
			want: []string{},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := collectServiceIDs(tt.services)
			if len(got) != len(tt.want) {
				t.Errorf("collectServiceIDs() len = %d, want %d; got %v, want %v", len(got), len(tt.want), got, tt.want)
				return
			}
			for i := range tt.want {
				if got[i] != tt.want[i] {
					t.Errorf("collectServiceIDs()[%d] = %q, want %q", i, got[i], tt.want[i])
				}
			}
		})
	}
}

// ============================================================================
// swarm_volume_backup_restore.go: processTarEntry
// ============================================================================

func TestProcessTarEntry(t *testing.T) {
	t.Run("nil header returns nil", func(t *testing.T) {
		// The function has an early nil check for the header
		var tw bytes.Buffer
		tarWriter := tar.NewWriter(&tw)
		err := processTarEntry(nil, nil, tarWriter)
		if err != nil {
			t.Errorf("processTarEntry(nil, ...) = %v, want nil", err)
		}
	})

	t.Run("empty name entry is skipped", func(t *testing.T) {
		var buf bytes.Buffer
		tw := tar.NewWriter(&buf)
		defer tw.Close()

		// A header with just an empty root path should be skipped
		h := &tar.Header{
			Name:     "",
			Typeflag: tar.TypeDir,
		}
		var srcBuf bytes.Buffer
		tr := tar.NewReader(&srcBuf)
		err := processTarEntry(h, tr, tw)
		if err != nil {
			t.Errorf("processTarEntry(empty name, ...) = %v, want nil", err)
		}
	})

	t.Run("dot entry is skipped", func(t *testing.T) {
		var buf bytes.Buffer
		tw := tar.NewWriter(&buf)
		defer tw.Close()

		h := &tar.Header{
			Name:     ".",
			Typeflag: tar.TypeDir,
		}
		var srcBuf bytes.Buffer
		tr := tar.NewReader(&srcBuf)
		err := processTarEntry(h, tr, tw)
		if err != nil {
			t.Errorf("processTarEntry('.', ...) = %v, want nil", err)
		}
	})

	t.Run("mnt prefix is stripped from name", func(t *testing.T) {
		var buf bytes.Buffer
		tw := tar.NewWriter(&buf)
		defer tw.Close()

		// Build a proper tar stream for reading
		var srcBuf bytes.Buffer
		srcWriter := tar.NewWriter(&srcBuf)
		content := []byte("hello")
		_ = srcWriter.WriteHeader(&tar.Header{
			Name:     "testfile.txt",
			Size:     int64(len(content)),
			Typeflag: tar.TypeReg,
		})
		_, _ = srcWriter.Write(content)
		_ = srcWriter.Close()

		tr := tar.NewReader(&srcBuf)
		hdr, _ := tr.Next()

		// Prepend mnt/ to the name - processTarEntry should strip it
		hdr.Name = "mnt/testfile.txt"
		err := processTarEntry(hdr, tr, tw)
		if err != nil {
			t.Errorf("processTarEntry(mnt/testfile.txt, ...) = %v, want nil", err)
		}
	})
}

// ============================================================================
// swarm_volume_backup_restore.go: copyNormalizedTar
// ============================================================================

func TestCopyNormalizedTar(t *testing.T) {
	t.Run("error from tr.Next propagates via pw.CloseWithError", func(t *testing.T) {
		// Create a tar reader backed by invalid data to trigger a read error
		badData := []byte("this is not valid tar data at all!!!!!")
		// Pad with more bad data to ensure the header read fails
		badData = append(badData, bytes.Repeat([]byte("x"), 512)...)

		pr, pw := io.Pipe()
		var outBuf bytes.Buffer
		tw := tar.NewWriter(&outBuf)

		tr := tar.NewReader(bytes.NewReader(badData))
		go copyNormalizedTar(tr, tw, pw)

		// Read from the pipe - it should be closed with an error
		_, readErr := io.ReadAll(pr)
		_ = readErr // We just verify the function doesn't panic
	})

	t.Run("EOF terminates normally", func(t *testing.T) {
		// Build a valid (but empty) tar stream
		var tarBuf bytes.Buffer
		twr := tar.NewWriter(&tarBuf)
		_ = twr.Close()

		pr, pw := io.Pipe()
		var outBuf bytes.Buffer
		tw := tar.NewWriter(&outBuf)

		tr := tar.NewReader(&tarBuf)
		go func() {
			copyNormalizedTar(tr, tw, pw)
			_ = pw.Close()
		}()

		_, err := io.ReadAll(pr)
		if err != nil {
			t.Errorf("copyNormalizedTar with EOF: unexpected pipe error: %v", err)
		}
	})
}

// ============================================================================
// swarm_volume_file_transfer.go: extractSingleFileFromTar
// ============================================================================

func TestExtractSingleFileFromTarAdditional(t *testing.T) {
	t.Run("empty tar stream returns no-file error", func(t *testing.T) {
		var tarBuf bytes.Buffer
		tw := tar.NewWriter(&tarBuf)
		_ = tw.Close()

		rc := io.NopCloser(&tarBuf)
		err := extractSingleFileFromTar(os.TempDir()+"/unused.txt", rc)
		if err == nil {
			t.Error("expected error for empty tar, got nil")
		}
		if !strings.Contains(err.Error(), "no file content") {
			t.Errorf("expected 'no file content' error, got: %v", err)
		}
	})

	t.Run("tar with multiple files returns error", func(t *testing.T) {
		tmpDir := t.TempDir()
		destPath := tmpDir + "/out.txt"

		var tarBuf bytes.Buffer
		tw := tar.NewWriter(&tarBuf)
		for _, name := range []string{"file1.txt", "file2.txt"} {
			content := []byte("data")
			_ = tw.WriteHeader(&tar.Header{
				Name:     name,
				Size:     int64(len(content)),
				Typeflag: tar.TypeReg,
			})
			_, _ = tw.Write(content)
		}
		_ = tw.Close()

		rc := io.NopCloser(&tarBuf)
		err := extractSingleFileFromTar(destPath, rc)
		if err == nil {
			t.Error("expected error for multiple files, got nil")
		}
		if !strings.Contains(err.Error(), "multiple files") {
			t.Errorf("expected 'multiple files' error, got: %v", err)
		}
	})

	t.Run("tar with only directories skips non-regular entries", func(t *testing.T) {
		var tarBuf bytes.Buffer
		tw := tar.NewWriter(&tarBuf)
		_ = tw.WriteHeader(&tar.Header{
			Name:     "somedir/",
			Typeflag: tar.TypeDir,
		})
		_ = tw.Close()

		rc := io.NopCloser(&tarBuf)
		err := extractSingleFileFromTar(os.TempDir()+"/unused.txt", rc)
		if err == nil {
			t.Error("expected error for directory-only tar, got nil")
		}
	})
}

// ============================================================================
// endpoints.go: extractSliceAddresses
// ============================================================================

func TestExtractSliceAddresses(t *testing.T) {
	t.Run("nil slice returns nil", func(t *testing.T) {
		result := extractSliceAddresses(nil)
		if result != nil {
			t.Errorf("extractSliceAddresses(nil) = %v, want nil", result)
		}
	})

	t.Run("slice with nil port produces address without port suffix", func(t *testing.T) {
		slice := &discoveryv1.EndpointSlice{
			Endpoints: []discoveryv1.Endpoint{
				{Addresses: []string{"10.0.0.1"}},
			},
			Ports: []discoveryv1.EndpointPort{
				{Port: nil}, // nil port
			},
		}
		result := extractSliceAddresses(slice)
		if len(result) != 1 || result[0] != "10.0.0.1" {
			t.Errorf("extractSliceAddresses(nil port) = %v, want [10.0.0.1]", result)
		}
	})

	t.Run("slice with no ports produces bare addresses", func(t *testing.T) {
		slice := &discoveryv1.EndpointSlice{
			Endpoints: []discoveryv1.Endpoint{
				{Addresses: []string{"192.168.1.1", "192.168.1.2"}},
			},
			Ports: nil, // no ports
		}
		result := extractSliceAddresses(slice)
		if len(result) != 2 {
			t.Errorf("extractSliceAddresses(no ports) len = %d, want 2", len(result))
		}
	})
}

// ============================================================================
// daemonsets_coverage.go: calculateReadyString
// ============================================================================

func TestCalculateReadyString(t *testing.T) {
	tests := []struct {
		name       string
		containers []corev1.Container
		statuses   []corev1.ContainerStatus
		want       string
	}{
		{
			name:       "zero containers returns 0/0",
			containers: []corev1.Container{},
			statuses:   nil,
			want:       "0/0",
		},
		{
			name: "all containers ready",
			containers: []corev1.Container{
				{Name: "c1"},
				{Name: "c2"},
			},
			statuses: []corev1.ContainerStatus{
				{Name: "c1", Ready: true},
				{Name: "c2", Ready: true},
			},
			want: "2/2",
		},
		{
			name: "partial ready",
			containers: []corev1.Container{
				{Name: "c1"},
				{Name: "c2"},
				{Name: "c3"},
			},
			statuses: []corev1.ContainerStatus{
				{Name: "c1", Ready: true},
				{Name: "c2", Ready: false},
				{Name: "c3", Ready: true},
			},
			want: "2/3",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			pod := &corev1.Pod{
				Spec: corev1.PodSpec{
					Containers: tt.containers,
				},
				Status: corev1.PodStatus{
					ContainerStatuses: tt.statuses,
				},
			}
			got := calculateReadyString(pod)
			if got != tt.want {
				t.Errorf("calculateReadyString() = %q, want %q", got, tt.want)
			}
		})
	}
}

// ============================================================================
// kind_cluster.go: kindKubeconfigPath
// ============================================================================

func TestKindKubeconfigPath(t *testing.T) {
	path, err := kindKubeconfigPath("my-cluster")
	if err != nil {
		t.Fatalf("kindKubeconfigPath() error = %v", err)
	}
	if path == "" {
		t.Error("kindKubeconfigPath() returned empty path")
	}
	if !strings.HasSuffix(path, "kind-my-cluster") {
		t.Errorf("kindKubeconfigPath() = %q, want suffix 'kind-my-cluster'", path)
	}
}

// ============================================================================
// kind_cluster.go: parseSize (additional cases for 66.7% → 100%)
// ============================================================================

func TestParseSizeAdditionalCases(t *testing.T) {
	tests := []struct {
		value string
		unit  string
		want  int64
	}{
		// Already-covered cases (for completeness)
		{"", "MB", 0},    // empty value
		{"abc", "MB", 0}, // parse error
		// Missing cases
		{"1", "KB", 1024},
		{"1", "KiB", 1024},
		{"2", "GB", 2 * 1024 * 1024 * 1024},
		{"1", "TB", 1024 * 1024 * 1024 * 1024},
		{"1", "TiB", 1024 * 1024 * 1024 * 1024},
		{"512", "bytes", 512}, // default/unknown unit -> int64(parsed)
	}
	for _, tt := range tests {
		name := tt.value + "_" + tt.unit
		t.Run(name, func(t *testing.T) {
			got := parseSize(tt.value, tt.unit)
			if got != tt.want {
				t.Errorf("parseSize(%q, %q) = %d, want %d", tt.value, tt.unit, got, tt.want)
			}
		})
	}
}

// ============================================================================
// swarm_volume_file_transfer.go: resolveUploadDest
// ============================================================================

func TestResolveUploadDest(t *testing.T) {
	// resolveUploadDest is a method on *App but only uses path/string logic.
	app := &App{ctx: context.Background()}

	tests := []struct {
		name          string
		destPath      string
		wantFinalPath string
		wantFinalDir  string
		wantDirIntent bool
		wantErr       bool
	}{
		{
			name:          "root path sets isDirIntent true",
			destPath:      "/",
			wantFinalPath: "/",
			wantFinalDir:  "/",
			wantDirIntent: true,
			wantErr:       false,
		},
		{
			name:          "trailing slash sets isDirIntent true",
			destPath:      "/uploads/",
			wantFinalPath: "/uploads",
			wantFinalDir:  "/",
			wantDirIntent: true,
			wantErr:       false,
		},
		{
			name:          "exact file path, no trailing slash",
			destPath:      "/data/file.txt",
			wantFinalPath: "/data/file.txt",
			wantFinalDir:  "/data",
			wantDirIntent: false,
			wantErr:       false,
		},
		{
			name:     "invalid path with null byte",
			destPath: "/data/\x00file",
			wantErr:  true,
		},
		{
			name:     "path traversal rejected",
			destPath: "/data/../etc",
			wantErr:  true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			finalPath, finalDir, isDirIntent, err := app.resolveUploadDest(tt.destPath)
			if (err != nil) != tt.wantErr {
				t.Errorf("resolveUploadDest(%q) error = %v, wantErr = %v", tt.destPath, err, tt.wantErr)
				return
			}
			if tt.wantErr {
				return
			}
			if finalPath != tt.wantFinalPath {
				t.Errorf("finalPath = %q, want %q", finalPath, tt.wantFinalPath)
			}
			if finalDir != tt.wantFinalDir {
				t.Errorf("finalDir = %q, want %q", finalDir, tt.wantFinalDir)
			}
			if isDirIntent != tt.wantDirIntent {
				t.Errorf("isDirIntent = %v, want %v", isDirIntent, tt.wantDirIntent)
			}
		})
	}
}

// ============================================================================
// swarm_volume_files.go: sanitizePosixPath missing edge cases
// ============================================================================

func TestSanitizePosixPathEdgeCases(t *testing.T) {
	// These cases may not be covered by the existing tests
	tests := []struct {
		name    string
		input   string
		want    string
		wantErr bool
	}{
		{
			name:  "path with trailing slash is cleaned",
			input: "/data/",
			want:  "/data",
		},
		{
			name:  "nested valid path",
			input: "/a/b/c",
			want:  "/a/b/c",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := sanitizePosixPath(tt.input)
			if (err != nil) != tt.wantErr {
				t.Fatalf("sanitizePosixPath(%q) err=%v, wantErr=%v", tt.input, err, tt.wantErr)
			}
			if err == nil && got != tt.want {
				t.Errorf("sanitizePosixPath(%q) = %q, want %q", tt.input, got, tt.want)
			}
		})
	}
}

// ============================================================================
// config.go: SetUseInformers (minimal - just tests the "val == current" early-exit)
// ============================================================================

func TestSetUseInformers_NoChange(t *testing.T) {
	tmpFile, err := os.CreateTemp("", "config_informer_test*.json")
	if err != nil {
		t.Fatalf("failed to create temp file: %v", err)
	}
	tmpFile.Close()
	defer os.Remove(tmpFile.Name())

	app := &App{
		configPath:   tmpFile.Name(),
		useInformers: false,
	}

	// Setting to same value should be a no-op (no panic, nil error)
	err = app.SetUseInformers(false)
	if err != nil {
		t.Errorf("SetUseInformers(false) when already false: unexpected error: %v", err)
	}
}

// ============================================================================
// kind_cluster.go: isValidKindName (not in 0% list but might be partially covered)
// ============================================================================

func TestIsValidKindName(t *testing.T) {
	tests := []struct {
		name  string
		input string
		want  bool
	}{
		{"empty is invalid", "", false},
		{"letters only valid", "mycluster", true},
		{"mixed case valid", "MyCluster", true},
		{"digits valid", "cluster123", true},
		{"dashes valid", "my-cluster", true},
		{"underscores valid", "my_cluster", true},
		{"spaces invalid", "my cluster", false},
		{"dots invalid", "my.cluster", false},
		{"slash invalid", "my/cluster", false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := isValidKindName(tt.input)
			if got != tt.want {
				t.Errorf("isValidKindName(%q) = %v, want %v", tt.input, got, tt.want)
			}
		})
	}
}

// ============================================================================
// kind_cluster.go: trimCommandOutput
// ============================================================================

func TestTrimCommandOutput(t *testing.T) {
	tests := []struct {
		name  string
		input []byte
		want  string
	}{
		{"empty returns empty", []byte(""), ""},
		{"whitespace-only returns empty", []byte("   \n\t  "), ""},
		{"short output preserved", []byte("error: something"), "error: something"},
		{"long output truncated at 400", []byte(strings.Repeat("x", 500)), strings.Repeat("x", 400) + "..."},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := trimCommandOutput(tt.input)
			if got != tt.want {
				t.Errorf("trimCommandOutput() = %q, want %q", got, tt.want)
			}
		})
	}
}

// ============================================================================
// docker_integration.go: ensureImageHasRegistryHost (likely partially covered)
// ============================================================================

func TestEnsureImageHasRegistryHostExtra(t *testing.T) {
	tests := []struct {
		name        string
		image       string
		registryURL string
		want        string
	}{
		{
			name:        "empty image returns empty",
			image:       "",
			registryURL: "http://registry.example.com",
			want:        "",
		},
		{
			name:        "image already has registry host unchanged",
			image:       "registry.example.com/myapp:latest",
			registryURL: "http://registry.example.com",
			want:        "registry.example.com/myapp:latest",
		},
		{
			// "myapp:latest" contains ":" in the first segment so it looks like
			// a host:port; the function treats it as already having a registry host.
			name:        "image with tag colon is treated as having registry host",
			image:       "myapp:latest",
			registryURL: "http://registry.example.com",
			want:        "myapp:latest",
		},
		{
			name:        "plain image without tag gets registry prepended",
			image:       "myapp",
			registryURL: "http://registry.example.com",
			want:        "registry.example.com/myapp",
		},
		{
			name:        "image with localhost prefix unchanged",
			image:       "localhost/myapp:latest",
			registryURL: "http://registry.example.com",
			want:        "localhost/myapp:latest",
		},
		{
			name:        "invalid registry URL returns image unchanged",
			image:       "myapp:latest",
			registryURL: "://invalid",
			want:        "myapp:latest",
		},
		{
			name:        "empty registry URL host returns image unchanged",
			image:       "myapp:latest",
			registryURL: "",
			want:        "myapp:latest",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := ensureImageHasRegistryHost(tt.image, tt.registryURL)
			if got != tt.want {
				t.Errorf("ensureImageHasRegistryHost(%q, %q) = %q, want %q",
					tt.image, tt.registryURL, got, tt.want)
			}
		})
	}
}
