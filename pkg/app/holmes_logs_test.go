package app

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"gowails/pkg/app/holmesgpt"
)

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

	app := &App{
		ctx: context.Background(),
		testPodLogsFetcher: func(namespace, podName, containerName string, lines int) (string, error) {
			return "error: connection refused", nil
		},
	}
	app.holmesConfig = holmesgpt.HolmesConfigData{
		Enabled:  true,
		Endpoint: server.URL,
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

func TestAnalyzeLogs_LogFetchError(t *testing.T) {
	app := &App{
		ctx: context.Background(),
		testPodLogsFetcher: func(namespace, podName, containerName string, lines int) (string, error) {
			return "", fmt.Errorf("log read failed")
		},
	}

	resp, err := app.AnalyzeLogs("default", "test-pod", "", 50)
	if err == nil {
		t.Fatal("expected error when log fetch fails")
	}
	if !strings.Contains(err.Error(), "failed to get logs") {
		t.Fatalf("expected wrapped error, got %v", err)
	}
	if resp != nil {
		t.Fatalf("expected nil response, got %+v", resp)
	}
}
