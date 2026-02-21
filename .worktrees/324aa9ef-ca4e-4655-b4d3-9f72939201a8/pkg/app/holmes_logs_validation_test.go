package app

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"gowails/pkg/app/holmesgpt"
)

func TestAnalyzeLogs_RequiresNamespaceAndPodName(t *testing.T) {
	app := &App{}
	if _, err := app.AnalyzeLogs("", "", "", 10); err == nil {
		t.Fatal("expected namespace required error")
	}

	app.currentNamespace = "kube-system"
	if _, err := app.AnalyzeLogs("", "", "", 10); err == nil {
		t.Fatal("expected pod name required error")
	}
}

func TestAnalyzeLogs_DefaultLines_Uses200(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/api/chat" {
			_ = json.NewEncoder(w).Encode(holmesgpt.HolmesResponse{Response: "ok"})
			return
		}
		w.WriteHeader(http.StatusNotFound)
	}))
	defer server.Close()

	holmesConfig = holmesgpt.HolmesConfigData{Enabled: true, Endpoint: server.URL}
	defer func() { holmesConfig = holmesgpt.DefaultConfig() }()

	captured := 0
	app := &App{ctx: context.Background()}
	app.testPodLogsFetcher = func(namespace, podName, containerName string, lines int) (string, error) {
		captured = lines
		return "log line", nil
	}
	app.initHolmes()

	_, err := app.AnalyzeLogs("default", "pod-a", "", -1)
	if err != nil {
		t.Fatalf("AnalyzeLogs failed: %v", err)
	}
	if captured != 200 {
		t.Fatalf("expected default lines=200, got %d", captured)
	}

	holmesMu.Lock()
	holmesClient = nil
	holmesMu.Unlock()
}
