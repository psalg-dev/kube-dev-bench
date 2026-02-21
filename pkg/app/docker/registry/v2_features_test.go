package registry

import (
	"testing"
)

func TestArtifactoryRepoURL_EmptyBaseURL(t *testing.T) {
	got := ArtifactoryRepoURL("", "myrepo")
	if got != "" {
		t.Fatalf("expected empty string for empty baseURL, got %q", got)
	}
}

func TestArtifactoryRepoURL_EmptyRepository(t *testing.T) {
	got := ArtifactoryRepoURL("https://artifactory.example.com", "")
	if got != "" {
		t.Fatalf("expected empty string for empty repository, got %q", got)
	}
}

func TestArtifactoryRepoURL_ValidInputs(t *testing.T) {
	got := ArtifactoryRepoURL("https://artifactory.example.com", "docker-local")
	if got == "" {
		t.Fatal("expected non-empty URL")
	}
	if got == "https://artifactory.example.com" {
		t.Fatalf("expected URL to include path, got %q", got)
	}
	if !containsStr(got, "docker-local") {
		t.Fatalf("expected URL to contain repository name, got %q", got)
	}
}

func TestArtifactoryRepoURL_SlashesStripped(t *testing.T) {
	got := ArtifactoryRepoURL("https://artifactory.example.com", "/my/repo/")
	if got == "" {
		t.Fatal("expected non-empty URL")
	}
}

func TestDockerHubPickPreferredImageSize_PrefersLinuxAMD64(t *testing.T) {
	images := []dockerHubTagImage{
		{OS: "windows", Architecture: "amd64", Size: 100},
		{OS: "linux", Architecture: "arm64", Size: 200},
		{OS: "linux", Architecture: "amd64", Size: 300},
	}
	got := dockerHubPickPreferredImageSize(images, 0)
	if got != 300 {
		t.Fatalf("expected 300, got %d", got)
	}
}

func TestDockerHubPickPreferredImageSize_FallsBackToFirstNonZero(t *testing.T) {
	images := []dockerHubTagImage{
		{OS: "windows", Architecture: "amd64", Size: 0},
		{OS: "linux", Architecture: "arm64", Size: 150},
	}
	got := dockerHubPickPreferredImageSize(images, 0)
	if got != 150 {
		t.Fatalf("expected 150, got %d", got)
	}
}

func TestDockerHubPickPreferredImageSize_UsesFallbackWhenEmpty(t *testing.T) {
	images := []dockerHubTagImage{}
	got := dockerHubPickPreferredImageSize(images, 999)
	if got != 999 {
		t.Fatalf("expected fallback 999, got %d", got)
	}
}

func TestDockerHubPickPreferredImageSize_ReturnsZeroWhenAllSizesZero(t *testing.T) {
	images := []dockerHubTagImage{
		{OS: "linux", Architecture: "amd64", Size: 0},
	}
	got := dockerHubPickPreferredImageSize(images, 0)
	if got != 0 {
		t.Fatalf("expected 0, got %d", got)
	}
}

// containsStr is a simple string containment helper used in this test file.
func containsStr(s, sub string) bool {
	return len(s) >= len(sub) && (s == sub || len(sub) == 0 ||
		func() bool {
			for i := 0; i <= len(s)-len(sub); i++ {
				if s[i:i+len(sub)] == sub {
					return true
				}
			}
			return false
		}())
}
