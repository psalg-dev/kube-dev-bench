package registry

import (
	"context"
	"encoding/base64"
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

	_, _, err = cli.do(ctx, http.MethodGet, "/v2/", nil, map[string]string{"Accept": "application/json"})
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

	_, _, err = cli.do(ctx, http.MethodGet, "/v2/", nil, map[string]string{"Accept": "application/json"})
	if err != nil {
		t.Fatalf("expected token exchange to succeed, got: %v", err)
	}
}
