package registry

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestDockerHubClient_ListRepositories_PaginatesAndPrefixesNamespace(t *testing.T) {
	ctx := context.Background()

	// Hub API mock
	var hub *httptest.Server
	hub = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		switch r.URL.Path {
		case "/v2/users/login/":
			b, _ := io.ReadAll(r.Body)
			_ = r.Body.Close()
			if !strings.Contains(string(b), "\"username\":\"alice\"") || !strings.Contains(string(b), "\"password\":\"pat\"") {
				t.Fatalf("unexpected login payload: %s", string(b))
			}
			_ = json.NewEncoder(w).Encode(map[string]any{"token": "jwt-123"})
			return
		default:
			if !strings.HasPrefix(r.URL.Path, "/v2/repositories/alice/") {
				t.Fatalf("unexpected path: %s", r.URL.Path)
			}
			if got := r.Header.Get("Authorization"); got != "JWT jwt-123" {
				t.Fatalf("unexpected auth header: %q", got)
			}
			switch r.URL.Query().Get("page") {
			case "2":
				_ = json.NewEncoder(w).Encode(map[string]any{
					"next":    nil,
					"results": []map[string]any{{"namespace": "alice", "name": "repo2"}},
				})
			default:
				next := hub.URL + "/v2/repositories/alice/?page=2&page_size=100"
				_ = json.NewEncoder(w).Encode(map[string]any{
					"next":    next,
					"results": []map[string]any{{"namespace": "alice", "name": "repo1"}},
				})
			}
		}
	}))
	defer hub.Close()

	// Registry endpoint mock (not exercised by this test beyond construction)
	reg := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	defer reg.Close()

	cli, err := NewDockerHubClient(RegistryConfig{
		URL:               reg.URL,
		Type:              RegistryTypeDockerHub,
		AllowInsecureHTTP: true,
		Credentials: RegistryCredentials{
			Username: "alice",
			Password: "pat",
		},
	})
	if err != nil {
		t.Fatalf("NewDockerHubClient: %v", err)
	}

	// Inject hub base URL for deterministic tests.
	dh, ok := cli.(*dockerHubClient)
	if !ok {
		t.Fatalf("expected *dockerHubClient")
	}
	dh.hubBaseURL = hub.URL

	repos, err := cli.ListRepositories(ctx)
	if err != nil {
		t.Fatalf("ListRepositories: %v", err)
	}
	if len(repos) != 2 || repos[0] != "alice/repo1" || repos[1] != "alice/repo2" {
		t.Fatalf("unexpected repos: %#v", repos)
	}
}
