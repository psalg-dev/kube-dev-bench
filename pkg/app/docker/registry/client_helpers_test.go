package registry

import (
	"strings"
	"testing"
)

func TestFormatErrorMessage_EmptyBodyUsesStatus(t *testing.T) {
	got := formatErrorMessage([]byte(""), "404 Not Found")
	if got != "404 Not Found" {
		t.Fatalf("expected status fallback, got %q", got)
	}
}

func TestFormatErrorMessage_WhitespaceBodyUsesStatus(t *testing.T) {
	got := formatErrorMessage([]byte("   "), "503 Service Unavailable")
	if got != "503 Service Unavailable" {
		t.Fatalf("expected status fallback for whitespace body, got %q", got)
	}
}

func TestFormatErrorMessage_ShortBodyReturned(t *testing.T) {
	body := []byte("unauthorized")
	got := formatErrorMessage(body, "401 Unauthorized")
	if got != "unauthorized" {
		t.Fatalf("expected body text, got %q", got)
	}
}

func TestFormatErrorMessage_LongBodyTruncatedTo512(t *testing.T) {
	body := []byte(strings.Repeat("x", 600))
	got := formatErrorMessage(body, "400 Bad Request")
	if len(got) != 512 {
		t.Fatalf("expected truncated length 512, got %d", len(got))
	}
}

func TestFormatErrorMessage_ExactlyBodyLimit(t *testing.T) {
	body := []byte(strings.Repeat("a", 512))
	got := formatErrorMessage(body, "400 Bad Request")
	if len(got) != 512 {
		t.Fatalf("expected length 512, got %d", len(got))
	}
}

func TestChooseManifestDigestFromList_EmptyList(t *testing.T) {
	result := chooseManifestDigestFromList(nil)
	if result != "" {
		t.Fatalf("expected empty result for nil list, got %q", result)
	}
}

func TestChooseManifestDigestFromList_PrefersLinuxAMD64(t *testing.T) {
	manifests := []struct {
		MediaType string `json:"mediaType"`
		Digest    string `json:"digest"`
		Platform  struct {
			Architecture string `json:"architecture"`
			OS           string `json:"os"`
			Variant      string `json:"variant"`
		} `json:"platform"`
	}{
		{Digest: "sha256:arm", Platform: struct {
			Architecture string `json:"architecture"`
			OS           string `json:"os"`
			Variant      string `json:"variant"`
		}{Architecture: "arm64", OS: "linux"}},
		{Digest: "sha256:amd64", Platform: struct {
			Architecture string `json:"architecture"`
			OS           string `json:"os"`
			Variant      string `json:"variant"`
		}{Architecture: "amd64", OS: "linux"}},
	}
	got := chooseManifestDigestFromList(manifests)
	if got != "sha256:amd64" {
		t.Fatalf("expected sha256:amd64, got %q", got)
	}
}

func TestChooseManifestDigestFromList_FallsBackToFirst(t *testing.T) {
	manifests := []struct {
		MediaType string `json:"mediaType"`
		Digest    string `json:"digest"`
		Platform  struct {
			Architecture string `json:"architecture"`
			OS           string `json:"os"`
			Variant      string `json:"variant"`
		} `json:"platform"`
	}{
		{Digest: "sha256:windows", Platform: struct {
			Architecture string `json:"architecture"`
			OS           string `json:"os"`
			Variant      string `json:"variant"`
		}{Architecture: "amd64", OS: "windows"}},
	}
	got := chooseManifestDigestFromList(manifests)
	if got != "sha256:windows" {
		t.Fatalf("expected sha256:windows fallback, got %q", got)
	}
}
