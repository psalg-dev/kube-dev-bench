package registry

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestBuildDockerHubSearchURL(t *testing.T) {
	originalBase := dockerHubAPIBaseURL
	t.Cleanup(func() { dockerHubAPIBaseURL = originalBase })
	dockerHubAPIBaseURL = "https://hub.example.test"

	u, err := buildDockerHubSearchURL("nginx")
	if err != nil {
		t.Fatalf("buildDockerHubSearchURL returned error: %v", err)
	}
	if !strings.Contains(u, "/v2/search/repositories/") {
		t.Fatalf("expected search path in URL, got %q", u)
	}
	if !strings.Contains(u, "query=nginx") {
		t.Fatalf("expected query parameter in URL, got %q", u)
	}
	if !strings.Contains(u, "page_size=25") {
		t.Fatalf("expected page_size in URL, got %q", u)
	}
}

func TestNormalizeRepoName(t *testing.T) {
	tests := []struct {
		name      string
		repoName  string
		namespace string
		full      string
		wantName  string
		wantFull  string
	}{
		{name: "uses namespace and name", repoName: "nginx", namespace: "library", full: "", wantName: "nginx", wantFull: "library/nginx"},
		{name: "uses full name", repoName: "", namespace: "", full: "library/nginx", wantName: "nginx", wantFull: "library/nginx"},
		{name: "uses name only", repoName: "busybox", namespace: "", full: "", wantName: "busybox", wantFull: "busybox"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			gotName, gotFull := normalizeRepoName(tt.repoName, tt.namespace, tt.full)
			if gotName != tt.wantName || gotFull != tt.wantFull {
				t.Fatalf("normalizeRepoName(%q, %q, %q) = (%q, %q), want (%q, %q)", tt.repoName, tt.namespace, tt.full, gotName, gotFull, tt.wantName, tt.wantFull)
			}
		})
	}
}

func TestSearchDockerHubRepositories_EmptyQuery(t *testing.T) {
	results, err := SearchDockerHubRepositories(context.Background(), "   ")
	if err != nil {
		t.Fatalf("SearchDockerHubRepositories returned error for empty query: %v", err)
	}
	if len(results) != 0 {
		t.Fatalf("expected empty results for empty query, got %d", len(results))
	}
}

func TestSearchDockerHubRepositories_Success(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/v2/search/repositories/" {
			t.Fatalf("unexpected request path: %s", r.URL.Path)
		}
		if r.URL.Query().Get("query") != "nginx" {
			t.Fatalf("unexpected query value: %q", r.URL.Query().Get("query"))
		}
		if err := json.NewEncoder(w).Encode(map[string]any{
			"results": []map[string]any{
				{
					"name":         "nginx",
					"namespace":    "library",
					"repo_name":    "library/nginx",
					"description":  "official image",
					"content_size": int64(123),
					"star_count":   42,
					"pull_count":   1000,
					"is_official":  true,
					"is_automated": false,
					"last_updated": "2026-02-14T00:00:00Z",
				},
			},
		}); err != nil {
			t.Fatalf("encode search response: %v", err)
		}
	}))
	defer srv.Close()

	originalBase := dockerHubAPIBaseURL
	t.Cleanup(func() { dockerHubAPIBaseURL = originalBase })
	dockerHubAPIBaseURL = srv.URL

	results, err := SearchDockerHubRepositories(context.Background(), "nginx")
	if err != nil {
		t.Fatalf("SearchDockerHubRepositories returned error: %v", err)
	}
	if len(results) != 1 {
		t.Fatalf("expected 1 result, got %d", len(results))
	}
	if results[0].FullName != "library/nginx" || results[0].SizeBytes != 123 {
		t.Fatalf("unexpected result: %+v", results[0])
	}
}

func TestGetDockerHubRepositoryDetails_ValidationAndSuccess(t *testing.T) {
	if _, err := GetDockerHubRepositoryDetails(context.Background(), ""); err == nil {
		t.Fatal("expected error for empty repository")
	}

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/v2/repositories/library/nginx/":
			if err := json.NewEncoder(w).Encode(map[string]any{
				"name":         "nginx",
				"namespace":    "library",
				"repo_name":    "library/nginx",
				"description":  "official image",
				"star_count":   7,
				"pull_count":   10,
				"last_updated": "2026-01-01T00:00:00Z",
				"is_private":   false,
			}); err != nil {
				t.Fatalf("encode details response: %v", err)
			}
		case "/v2/repositories/library/nginx/tags/latest/":
			if err := json.NewEncoder(w).Encode(map[string]any{
				"full_size": int64(10),
				"images": []map[string]any{
					{"os": "linux", "architecture": "amd64", "size": int64(222)},
				},
			}); err != nil {
				t.Fatalf("encode tag response: %v", err)
			}
		default:
			t.Fatalf("unexpected request path: %s", r.URL.Path)
		}
	}))
	defer srv.Close()

	originalBase := dockerHubAPIBaseURL
	t.Cleanup(func() { dockerHubAPIBaseURL = originalBase })
	dockerHubAPIBaseURL = srv.URL

	details, err := GetDockerHubRepositoryDetails(context.Background(), "library/nginx")
	if err != nil {
		t.Fatalf("GetDockerHubRepositoryDetails returned error: %v", err)
	}
	if details.FullName != "library/nginx" {
		t.Fatalf("unexpected full name: %q", details.FullName)
	}
	if details.SizeBytes != 222 {
		t.Fatalf("expected preferred tag image size 222, got %d", details.SizeBytes)
	}
}

func TestDockerHubResolveDisplayImageSizeBytes_FallbackAndHelpers(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case strings.HasSuffix(r.URL.Path, "/tags/latest/"):
			w.WriteHeader(http.StatusNotFound)
			_, _ = w.Write([]byte("missing"))
		case strings.HasSuffix(r.URL.Path, "/tags/"):
			if err := json.NewEncoder(w).Encode(map[string]any{
				"results": []map[string]any{
					{"name": "1.0.0", "full_size": int64(333), "images": []map[string]any{{"os": "linux", "architecture": "amd64", "size": int64(444)}}},
				},
			}); err != nil {
				t.Fatalf("encode tags list response: %v", err)
			}
		default:
			t.Fatalf("unexpected request path: %s", r.URL.Path)
		}
	}))
	defer srv.Close()

	originalBase := dockerHubAPIBaseURL
	t.Cleanup(func() { dockerHubAPIBaseURL = originalBase })
	dockerHubAPIBaseURL = srv.URL

	size, err := dockerHubResolveDisplayImageSizeBytes(context.Background(), "library", "nginx")
	if err != nil {
		t.Fatalf("dockerHubResolveDisplayImageSizeBytes returned error: %v", err)
	}
	if size != 444 {
		t.Fatalf("expected fallback size 444, got %d", size)
	}

	if got := dockerHubPickPreferredImageSize([]dockerHubTagImage{{OS: "linux", Architecture: "amd64", Size: 10}, {Size: 20}}, 1); got != 10 {
		t.Fatalf("unexpected preferred image size: %d", got)
	}
	if got := dockerHubPickPreferredImageSize(nil, 5); got != 5 {
		t.Fatalf("expected fallback size 5, got %d", got)
	}

	ns, name := splitDockerHubFullName("nginx")
	if ns != "library" || name != "nginx" {
		t.Fatalf("unexpected split for official image: %q/%q", ns, name)
	}
	ns, name = splitDockerHubFullName("registry-1.docker.io/library/nginx")
	if ns != "library" || name != "nginx" {
		t.Fatalf("unexpected split for host-prefixed image: %q/%q", ns, name)
	}
}
