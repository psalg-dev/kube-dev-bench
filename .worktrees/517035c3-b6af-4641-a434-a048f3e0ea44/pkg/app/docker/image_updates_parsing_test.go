package docker

import (
	"testing"
	"time"
)

func TestIsRegistryHost(t *testing.T) {
	cases := []struct {
		in   string
		want bool
	}{
		{"", false},
		{"nginx", false},
		{"example.com", true},
		{"localhost", true},
		{"localhost:5000", true},
		{"10.0.0.1:5000", true},
	}

	for _, tc := range cases {
		if got := isRegistryHost(tc.in); got != tc.want {
			t.Fatalf("isRegistryHost(%q)=%v want %v", tc.in, got, tc.want)
		}
	}
}

func TestIsDockerHubHost(t *testing.T) {
	cases := []struct {
		in   string
		want bool
	}{
		{"docker.io", true},
		{"index.docker.io", true},
		{"registry-1.docker.io", true},
		{" Docker.IO ", true},
		{"ghcr.io", false},
		{"", false},
	}

	for _, tc := range cases {
		if got := isDockerHubHost(tc.in); got != tc.want {
			t.Fatalf("isDockerHubHost(%q)=%v want %v", tc.in, got, tc.want)
		}
	}
}

func TestParseImageReference(t *testing.T) {
	t.Run("errors for empty", func(t *testing.T) {
		if _, err := parseImageReference("  "); err == nil {
			t.Fatalf("expected error")
		}
	})

	t.Run("docker hub official image normalization", func(t *testing.T) {
		ref, err := parseImageReference("nginx:1.25")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if ref.registryHost != "docker.io" {
			t.Fatalf("registryHost=%q", ref.registryHost)
		}
		if ref.repository != "library/nginx" {
			t.Fatalf("repository=%q", ref.repository)
		}
		if ref.tag != "1.25" {
			t.Fatalf("tag=%q", ref.tag)
		}
		if ref.digest != "" {
			t.Fatalf("digest=%q", ref.digest)
		}
	})

	t.Run("explicit host and digest", func(t *testing.T) {
		ref, err := parseImageReference("localhost:5000/myimg:tag@sha256:abc")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if ref.registryHost != "localhost:5000" {
			t.Fatalf("registryHost=%q", ref.registryHost)
		}
		if ref.repository != "myimg" {
			t.Fatalf("repository=%q", ref.repository)
		}
		if ref.tag != "tag" {
			t.Fatalf("tag=%q", ref.tag)
		}
		if ref.digest != "sha256:abc" {
			t.Fatalf("digest=%q", ref.digest)
		}
	})

	t.Run("digest-only refs keep default host", func(t *testing.T) {
		ref, err := parseImageReference("busybox@sha256:deadbeef")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if ref.registryHost != "docker.io" {
			t.Fatalf("registryHost=%q", ref.registryHost)
		}
		if ref.repository != "library/busybox" {
			t.Fatalf("repository=%q", ref.repository)
		}
		if ref.tag != "" {
			t.Fatalf("tag=%q", ref.tag)
		}
		if ref.digest != "sha256:deadbeef" {
			t.Fatalf("digest=%q", ref.digest)
		}
	})
}

func TestRepoDigestForRef(t *testing.T) {
	ref, err := parseImageReference("nginx:1.25")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	repoDigests := []string{
		"index.docker.io/library/nginx@sha256:111",
		"docker.io/library/other@sha256:222",
		"ghcr.io/org/app@sha256:333",
	}

	got := repoDigestForRef(ref, repoDigests)
	if got != "sha256:111" {
		t.Fatalf("repoDigestForRef=%q want sha256:111", got)
	}
}

func TestApplyCachedImageUpdateFields_TTL(t *testing.T) {
	svc := &SwarmServiceInfo{ID: "svc1", ImageLocalDigest: "keep", ImageRemoteDigest: "keep-remote"}
	info := ImageUpdateInfo{UpdateAvailable: true, LocalDigest: "new-local", RemoteDigest: "new-remote", CheckedAt: "2026-01-11T00:00:00Z"}

	// fresh entry should apply.
	swarmImageUpdateCache.mu.Lock()
	swarmImageUpdateCache.items["svc1"] = cachedImageUpdate{info: info, checkedAt: time.Now()}
	swarmImageUpdateCache.mu.Unlock()
	applyCachedImageUpdateFields("svc1", svc)
	if !svc.ImageUpdateAvailable || svc.ImageLocalDigest != "new-local" || svc.ImageRemoteDigest != "new-remote" {
		t.Fatalf("expected cached fields applied")
	}

	// stale entry should not overwrite current values.
	svc.ImageUpdateAvailable = false
	svc.ImageLocalDigest = "keep"
	svc.ImageRemoteDigest = "keep-remote"
	swarmImageUpdateCache.mu.Lock()
	swarmImageUpdateCache.items["svc1"] = cachedImageUpdate{info: info, checkedAt: time.Now().Add(-defaultImageUpdateCacheTTL - time.Second)}
	swarmImageUpdateCache.mu.Unlock()
	applyCachedImageUpdateFields("svc1", svc)
	if svc.ImageUpdateAvailable || svc.ImageLocalDigest != "keep" || svc.ImageRemoteDigest != "keep-remote" {
		t.Fatalf("expected stale cache not applied")
	}
}
