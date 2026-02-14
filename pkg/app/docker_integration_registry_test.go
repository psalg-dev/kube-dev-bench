package app

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"

	"gowails/pkg/app/docker/registry"
)

func TestRegistryWailsBindings_CRUDAndBrowse(t *testing.T) {
	tmp := t.TempDir()
	restore := registry.SetStorageOverridesForTests(
		filepath.Join(tmp, "registries.json"),
		filepath.Join(tmp, "registry-secrets.key"),
	)
	defer restore()

	wantAuth := "Basic " + base64.StdEncoding.EncodeToString([]byte("alice:supersecret"))

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/v2" || r.URL.Path == "/v2/" {
			if r.Header.Get("Authorization") != wantAuth {
				w.WriteHeader(http.StatusUnauthorized)
				return
			}
			w.WriteHeader(http.StatusOK)
			return
		}

		// All other endpoints in this test require auth.
		if r.Header.Get("Authorization") != wantAuth {
			w.WriteHeader(http.StatusUnauthorized)
			return
		}

		switch r.URL.Path {
		case "/v2/_catalog":
			_ = json.NewEncoder(w).Encode(map[string]any{"repositories": []string{"repo1"}})
		case "/v2/repo1/tags/list":
			_ = json.NewEncoder(w).Encode(map[string]any{"name": "repo1", "tags": []string{"latest"}})
		case "/v2/repo1/manifests/latest":
			w.Header().Set("Docker-Content-Digest", "sha256:deadbeef")
			w.WriteHeader(http.StatusOK)
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	defer srv.Close()

	app := &App{ctx: context.Background()}

	cfg := registry.RegistryConfig{
		Name: "TestRegistry",
		URL:  srv.URL,
		Type: registry.RegistryTypeGenericV2,
		Credentials: registry.RegistryCredentials{
			Username: "alice",
			Password: "supersecret",
		},
		AllowInsecureHTTP: true,
	}

	if err := app.AddRegistry(cfg); err != nil {
		t.Fatalf("AddRegistry: %v", err)
	}

	public, err := app.GetRegistries()
	if err != nil {
		t.Fatalf("GetRegistries: %v", err)
	}
	if len(public) != 1 {
		t.Fatalf("expected 1 registry, got %d", len(public))
	}
	if public[0].Credentials.Password != "" || public[0].Credentials.Token != "" {
		t.Fatalf("expected credentials redacted")
	}

	if err := app.TestRegistryConnection(cfg); err != nil {
		t.Fatalf("TestRegistryConnection: %v", err)
	}

	repos, err := app.ListRegistryRepositories("TestRegistry")
	if err != nil {
		t.Fatalf("ListRegistryRepositories: %v", err)
	}
	if len(repos) != 1 || repos[0] != "repo1" {
		t.Fatalf("unexpected repos: %#v", repos)
	}

	tags, err := app.ListRegistryTags("TestRegistry", "repo1")
	if err != nil {
		t.Fatalf("ListRegistryTags: %v", err)
	}
	if len(tags) != 1 || tags[0] != "latest" {
		t.Fatalf("unexpected tags: %#v", tags)
	}

	digest, err := app.GetImageDigest("TestRegistry", "repo1", "latest")
	if err != nil {
		t.Fatalf("GetImageDigest: %v", err)
	}
	if digest != "sha256:deadbeef" {
		t.Fatalf("unexpected digest: %q", digest)
	}

	if err := app.RemoveRegistry("TestRegistry"); err != nil {
		t.Fatalf("RemoveRegistry: %v", err)
	}
}

func TestRegistryWailsBindings_SearchAndDetailsBranches(t *testing.T) {
	tmp := t.TempDir()
	restore := registry.SetStorageOverridesForTests(
		filepath.Join(tmp, "registries.json"),
		filepath.Join(tmp, "registry-secrets.key"),
	)
	defer restore()

	app := &App{ctx: context.Background()}

	cfg := registry.RegistryConfig{
		Name: "DockerHub",
		URL:  "https://index.docker.io",
		Type: registry.RegistryTypeDockerHub,
	}
	if err := app.AddRegistry(cfg); err != nil {
		t.Fatalf("AddRegistry: %v", err)
	}

	if _, err := app.SearchRegistryRepositories("DockerHub", "nginx"); err == nil {
		t.Fatal("expected dockerhub search-not-supported error")
	}
	if _, err := app.GetRegistryRepositoryDetails("DockerHub", "library/nginx"); err == nil {
		t.Fatal("expected dockerhub details-not-supported error")
	}

	results, err := app.SearchDockerHubRepositories("   ")
	if err != nil {
		t.Fatalf("SearchDockerHubRepositories empty query returned error: %v", err)
	}
	if len(results) != 0 {
		t.Fatalf("expected empty results for empty query, got %d", len(results))
	}

	if _, err := app.GetDockerHubRepositoryDetails(""); err == nil {
		t.Fatal("expected validation error for empty full name")
	}
}
