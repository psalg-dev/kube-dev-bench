package app

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"gowails/pkg/app/holmesgpt"
)

func TestDetectLogPatterns(t *testing.T) {
	app := &App{}
	logs := "error connecting\nwarning: slow\npanic: boom\nerror: retry"

	patterns, err := app.DetectLogPatterns(logs)
	if err != nil {
		t.Fatalf("DetectLogPatterns failed: %v", err)
	}

	if len(patterns) != 3 {
		t.Fatalf("expected 3 pattern types, got %d", len(patterns))
	}

	counts := map[string]int{}
	for _, p := range patterns {
		counts[p.Type] = p.Occurrences
	}

	if counts["error"] != 2 {
		t.Fatalf("expected error occurrences=2, got %d", counts["error"])
	}
	if counts["warning"] != 1 {
		t.Fatalf("expected warning occurrences=1, got %d", counts["warning"])
	}
	if counts["panic"] != 1 {
		t.Fatalf("expected panic occurrences=1, got %d", counts["panic"])
	}
}

func TestAnalyzeLogs_WithPodLogs(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/api/chat" {
			json.NewEncoder(w).Encode(holmesgpt.HolmesResponse{
				Response: "Found error in logs",
				QueryID:  "log-q1",
			})
			return
		}
		w.WriteHeader(http.StatusNotFound)
	}))
	defer server.Close()

	// Configure Holmes
	holmesConfig = holmesgpt.HolmesConfigData{
		Enabled:  true,
		Endpoint: server.URL,
	}
	defer func() { holmesConfig = holmesgpt.DefaultConfig() }()

	app := &App{
		ctx: context.Background(),
		testPodLogsFetcher: func(namespace, podName, containerName string, lines int) (string, error) {
			return "error: connection refused", nil
		},
	}
	app.initHolmes()

	resp, err := app.AnalyzeLogs("default", "test-pod", "", 50)
	if err != nil {
		t.Fatalf("AnalyzeLogs failed: %v", err)
	}
	if resp == nil || resp.Response == "" {
		t.Fatalf("expected Holmes response, got nil/empty")
	}

	// Cleanup Holmes client
	holmesMu.Lock()
	holmesClient = nil
	holmesMu.Unlock()
}
