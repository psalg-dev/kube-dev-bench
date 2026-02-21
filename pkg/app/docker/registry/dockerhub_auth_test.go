package registry

import (
	"encoding/base64"
	"net/http"
	"testing"
)

func TestSetListReposAuth_UsesJWTWhenProvided(t *testing.T) {
	c := &dockerHubClient{username: "alice", password: "pass"}
	req, _ := http.NewRequest(http.MethodGet, "http://example.com", nil)
	c.setListReposAuth(req, "myjwt")

	got := req.Header.Get("Authorization")
	if got != "JWT myjwt" {
		t.Fatalf("expected JWT auth, got %q", got)
	}
}

func TestSetListReposAuth_UsesBasicAuthWhenNoJWT(t *testing.T) {
	c := &dockerHubClient{username: "alice", password: "mypass"}
	req, _ := http.NewRequest(http.MethodGet, "http://example.com", nil)
	c.setListReposAuth(req, "")

	got := req.Header.Get("Authorization")
	want := "Basic " + base64.StdEncoding.EncodeToString([]byte("alice:mypass"))
	if got != want {
		t.Fatalf("expected Basic auth %q, got %q", want, got)
	}
}

func TestSetListReposAuth_NoAuthWhenBothEmpty(t *testing.T) {
	c := &dockerHubClient{username: "alice", password: ""}
	req, _ := http.NewRequest(http.MethodGet, "http://example.com", nil)
	c.setListReposAuth(req, "")

	got := req.Header.Get("Authorization")
	if got != "" {
		t.Fatalf("expected no auth header, got %q", got)
	}
}
