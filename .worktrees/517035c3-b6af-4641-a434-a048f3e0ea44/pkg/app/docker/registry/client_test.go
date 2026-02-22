package registry

import (
	"context"
	"encoding/base64"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestV2Client_ListRepositories(t *testing.T) {
	ctx := context.Background()

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/v2/_catalog" {
			t.Fatalf("unexpected path: %s", r.URL.Path)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"repositories":["repo-a","repo-b"]}`))
	}))
	defer srv.Close()

	cli, err := NewV2Client(RegistryConfig{URL: srv.URL, Type: RegistryTypeGenericV2, AllowInsecureHTTP: true})
	if err != nil {
		t.Fatalf("NewV2Client: %v", err)
	}

	repos, err := cli.ListRepositories(ctx)
	if err != nil {
		t.Fatalf("ListRepositories: %v", err)
	}
	if len(repos) != 2 || repos[0] != "repo-a" || repos[1] != "repo-b" {
		t.Fatalf("unexpected repos: %#v", repos)
	}
}

func TestV2Client_ListTags_UsesBasicAuthWhenConfigured(t *testing.T) {
	ctx := context.Background()

	wantAuth := "Basic " + base64.StdEncoding.EncodeToString([]byte("u:p"))

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/v2/myrepo/tags/list" {
			t.Fatalf("unexpected path: %s", r.URL.Path)
		}
		if got := r.Header.Get("Authorization"); got != wantAuth {
			t.Fatalf("unexpected auth header: %q", got)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"name":"myrepo","tags":["1","2"]}`))
	}))
	defer srv.Close()

	cli, err := NewV2Client(RegistryConfig{
		URL:               srv.URL,
		Type:              RegistryTypeGenericV2,
		AllowInsecureHTTP: true,
		Credentials: RegistryCredentials{
			Username: "u",
			Password: "p",
		},
	})
	if err != nil {
		t.Fatalf("NewV2Client: %v", err)
	}

	tags, err := cli.ListTags(ctx, "myrepo")
	if err != nil {
		t.Fatalf("ListTags: %v", err)
	}
	if len(tags) != 2 || tags[0] != "1" || tags[1] != "2" {
		t.Fatalf("unexpected tags: %#v", tags)
	}
}

func TestV2Client_GetManifestDigest_SendsAcceptAndReadsDigestHeader(t *testing.T) {
	ctx := context.Background()

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/v2/myrepo/manifests/latest" {
			t.Fatalf("unexpected path: %s", r.URL.Path)
		}

		accept := r.Header.Get("Accept")
		if !strings.Contains(accept, "application/vnd.docker.distribution.manifest.v2+json") {
			t.Fatalf("expected docker v2 manifest accept, got: %q", accept)
		}

		w.Header().Set("Docker-Content-Digest", "sha256:deadbeef")
		w.Header().Set("Content-Type", "application/vnd.docker.distribution.manifest.v2+json")
		_, _ = w.Write([]byte(`{"schemaVersion":2}`))
	}))
	defer srv.Close()

	cli, err := NewV2Client(RegistryConfig{URL: srv.URL, Type: RegistryTypeGenericV2, AllowInsecureHTTP: true})
	if err != nil {
		t.Fatalf("NewV2Client: %v", err)
	}

	digest, err := cli.GetManifestDigest(ctx, "myrepo", "latest")
	if err != nil {
		t.Fatalf("GetManifestDigest: %v", err)
	}
	if digest != "sha256:deadbeef" {
		t.Fatalf("unexpected digest: %q", digest)
	}
}

func TestV2Client_Do_ExchangesBearerToken_Anonymous(t *testing.T) {
	ctx := context.Background()

	authSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/token" {
			t.Fatalf("unexpected auth path: %s", r.URL.Path)
		}
		if got := r.Header.Get("Authorization"); got != "" {
			t.Fatalf("unexpected auth header for anonymous token exchange: %q", got)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"token":"anon-token"}`))
	}))
	defer authSrv.Close()

	realm := authSrv.URL + "/token"
	regSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/v2" && r.URL.Path != "/v2/" {
			t.Fatalf("unexpected registry path: %s", r.URL.Path)
		}
		if got := r.Header.Get("Authorization"); got == "Bearer anon-token" {
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(`{}`))
			return
		}
		w.Header().Set("Www-Authenticate", fmt.Sprintf("Bearer realm=\"%s\",service=\"registry.test\"", realm))
		w.WriteHeader(http.StatusUnauthorized)
		_, _ = w.Write([]byte("UNAUTHORIZED"))
	}))
	defer regSrv.Close()

	cli, err := NewV2Client(RegistryConfig{URL: regSrv.URL, Type: RegistryTypeGenericV2, AllowInsecureHTTP: true})
	if err != nil {
		t.Fatalf("NewV2Client: %v", err)
	}

	_, _, err = cli.do(ctx, "/v2/", nil, map[string]string{"Accept": "application/json"})
	if err != nil {
		t.Fatalf("expected token exchange to succeed, got: %v", err)
	}
}

func TestV2Client_Do_ExchangesBearerToken_UsesBasicAuthWhenConfigured(t *testing.T) {
	ctx := context.Background()

	wantBasic := "Basic " + base64.StdEncoding.EncodeToString([]byte("u:p"))
	authSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/token" {
			t.Fatalf("unexpected auth path: %s", r.URL.Path)
		}
		if got := r.Header.Get("Authorization"); got != wantBasic {
			t.Fatalf("unexpected auth header for token exchange: %q", got)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"access_token":"basic-token"}`))
	}))
	defer authSrv.Close()

	realm := authSrv.URL + "/token"
	regSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/v2" && r.URL.Path != "/v2/" {
			t.Fatalf("unexpected registry path: %s", r.URL.Path)
		}
		if got := r.Header.Get("Authorization"); got == "Bearer basic-token" {
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(`{}`))
			return
		}
		// The initial request will include Basic auth; respond with Bearer challenge.
		w.Header().Set("Www-Authenticate", fmt.Sprintf("Bearer realm=\"%s\",service=\"registry.test\"", realm))
		w.WriteHeader(http.StatusUnauthorized)
		_, _ = w.Write([]byte("UNAUTHORIZED"))
	}))
	defer regSrv.Close()

	cli, err := NewV2Client(RegistryConfig{
		URL:               regSrv.URL,
		Type:              RegistryTypeGenericV2,
		AllowInsecureHTTP: true,
		Credentials: RegistryCredentials{
			Username: "u",
			Password: "p",
		},
	})
	if err != nil {
		t.Fatalf("NewV2Client: %v", err)
	}

	_, _, err = cli.do(ctx, "/v2/", nil, map[string]string{"Accept": "application/json"})
	if err != nil {
		t.Fatalf("expected token exchange to succeed, got: %v", err)
	}
}

func TestNewClient_SelectsImplementation(t *testing.T) {
	cfg := RegistryConfig{URL: "https://registry.example.com"}

	tests := []struct {
		name       string
		cfg        RegistryConfig
		wantV2     bool
		wantDocker bool
	}{
		{
			name:   "generic v2",
			cfg:    RegistryConfig{URL: cfg.URL, Type: RegistryTypeGenericV2},
			wantV2: true,
		},
		{
			name:   "artifactory uses v2 client",
			cfg:    RegistryConfig{URL: cfg.URL, Type: RegistryTypeArtifactory},
			wantV2: true,
		},
		{
			name:       "docker hub uses dockerHubClient",
			cfg:        RegistryConfig{URL: cfg.URL, Type: RegistryTypeDockerHub},
			wantDocker: true,
		},
	}

	for _, tt := range tests {
		tt := tt
		t.Run(tt.name, func(t *testing.T) {
			cli, err := NewClient(tt.cfg)
			if err != nil {
				t.Fatalf("NewClient unexpectedly failed: %v", err)
			}
			switch {
			case tt.wantV2:
				if _, ok := cli.(*v2Client); !ok {
					t.Fatalf("expected *v2Client, got %T", cli)
				}
			case tt.wantDocker:
				if _, ok := cli.(*dockerHubClient); !ok {
					t.Fatalf("expected *dockerHubClient, got %T", cli)
				}
			default:
				t.Fatalf("test case missing expectation")
			}
		})
	}

	_, err := NewClient(RegistryConfig{URL: cfg.URL, Type: RegistryType("unknown")})
	if err == nil || !errors.Is(err, ErrUnsupportedRegistryType) {
		t.Fatalf("expected unsupported registry error, got: %v", err)
	}
}

func TestNewV2Client_HTTPValidation(t *testing.T) {
	_, err := NewV2Client(RegistryConfig{URL: "http://registry.example.com"})
	if err == nil || !strings.Contains(err.Error(), "insecure http registry url not allowed") {
		t.Fatalf("expected insecure http error, got: %v", err)
	}

	cli, err := NewV2Client(RegistryConfig{
		URL:               "http://registry.example.com",
		AllowInsecureHTTP: true,
	})
	if err != nil {
		t.Fatalf("NewV2Client should allow http when configured: %v", err)
	}
	if cli == nil {
		t.Fatalf("expected client instance")
	}
}

func TestParseBearerChallenge(t *testing.T) {
	header := `Bearer realm="https://auth.example.com/token",service="registry.test",scope="repository:library/nginx:pull,push"`
	ch, ok := parseBearerChallenge(header)
	if !ok {
		t.Fatalf("expected challenge to parse")
	}
	if ch.realm != "https://auth.example.com/token" {
		t.Fatalf("unexpected realm: %q", ch.realm)
	}
	if ch.service != "registry.test" {
		t.Fatalf("unexpected service: %q", ch.service)
	}
	if ch.scope != "repository:library/nginx:pull,push" {
		t.Fatalf("unexpected scope: %q", ch.scope)
	}

	invalidHeaders := []string{
		"",
		"Basic realm=\"x\"",
		"Bearer service=\"missing realm\"",
	}
	for _, h := range invalidHeaders {
		if _, ok := parseBearerChallenge(h); ok {
			t.Fatalf("expected header %q to be rejected", h)
		}
	}
}

func TestV2Client_ExchangeBearerToken_ErrorOnMissingToken(t *testing.T) {
	ctx := context.Background()

	authSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/token" {
			t.Fatalf("unexpected auth path: %s", r.URL.Path)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"token":""}`))
	}))
	defer authSrv.Close()

	cli := &v2Client{
		httpClient:      authSrv.Client(),
		basicAuthHeader: "Basic abc",
	}

	_, err := cli.exchangeBearerToken(ctx, bearerChallenge{
		realm:   authSrv.URL + "/token",
		service: "registry.test",
		scope:   "repository:library/nginx:pull",
	})
	if err == nil || !strings.Contains(err.Error(), "missing token") {
		t.Fatalf("expected missing token error, got: %v", err)
	}
}

func TestV2Client_GetImageSizeBytes_ManifestListPrefersLinuxAmd64(t *testing.T) {
	ctx := context.Background()

	var hits int
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		hits++
		switch r.URL.Path {
		case "/v2/library/nginx/manifests/latest":
			w.Header().Set("Content-Type", "application/vnd.docker.distribution.manifest.list.v2+json")
			_, _ = w.Write([]byte(`{
				"schemaVersion": 2,
				"manifests": [
					{
						"digest": "sha256:armdigest",
						"platform": {"architecture":"arm64","os":"linux"}
					},
					{
						"digest": "sha256:amd64digest",
						"platform": {"architecture":"amd64","os":"linux"}
					}
				]
			}`))
		case "/v2/library/nginx/manifests/sha256:amd64digest":
			w.Header().Set("Content-Type", "application/vnd.docker.distribution.manifest.v2+json")
			_, _ = w.Write([]byte(`{
				"schemaVersion": 2,
				"layers": [
					{"size": 100},
					{"size": 200},
					{"size": 50}
				]
			}`))
		default:
			t.Fatalf("unexpected path: %s", r.URL.Path)
		}
	}))
	defer srv.Close()

	cli, err := NewV2Client(RegistryConfig{
		URL:               srv.URL,
		Type:              RegistryTypeGenericV2,
		AllowInsecureHTTP: true,
	})
	if err != nil {
		t.Fatalf("NewV2Client: %v", err)
	}

	size, err := cli.GetImageSizeBytes(ctx, "library/nginx", "latest")
	if err != nil {
		t.Fatalf("GetImageSizeBytes: %v", err)
	}
	if size != 350 {
		t.Fatalf("unexpected size: %d", size)
	}
	if hits != 2 {
		t.Fatalf("expected manifest list and manifest requests, got %d hits", hits)
	}
}

func TestV2Client_GetImageSizeBytes_ValidatesInput(t *testing.T) {
	var cli v2Client
	if _, err := cli.GetImageSizeBytes(context.Background(), "", "latest"); err == nil || !strings.Contains(err.Error(), "repository is required") {
		t.Fatalf("expected repository validation error, got: %v", err)
	}
	if _, err := cli.GetImageSizeBytes(context.Background(), "repo", ""); err == nil || !strings.Contains(err.Error(), "reference is required") {
		t.Fatalf("expected reference validation error, got: %v", err)
	}
}
