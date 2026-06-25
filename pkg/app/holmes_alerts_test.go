package app

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"gowails/pkg/app/holmesgpt"
)

func TestGetPrometheusAlerts_ParsesResponse(t *testing.T) {
	now := time.Now().UTC()
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/v1/alerts" {
			w.WriteHeader(http.StatusNotFound)
			return
		}
		json.NewEncoder(w).Encode(map[string]interface{}{
			"status": "success",
			"data": map[string]interface{}{
				"alerts": []map[string]interface{}{
					{
						"labels":      map[string]string{"alertname": "HighCPU"},
						"annotations": map[string]string{"summary": "CPU high"},
						"state":       "firing",
						"activeAt":    now.Format(time.RFC3339),
						"value":       "1",
					},
				},
			},
		})
	}))
	defer server.Close()

	app := NewApp()
	alerts, err := app.GetPrometheusAlerts(server.URL)
	if err != nil {
		t.Fatalf("GetPrometheusAlerts failed: %v", err)
	}
	if len(alerts) != 1 {
		t.Fatalf("expected 1 alert, got %d", len(alerts))
	}
	if alerts[0].Name != "HighCPU" {
		t.Fatalf("expected HighCPU, got %s", alerts[0].Name)
	}
}

func TestInvestigatePrometheusAlert_AddsHistory(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/api/chat" {
			json.NewEncoder(w).Encode(holmesgpt.HolmesResponse{
				Response: "Investigation response",
				QueryID:  "alert-q1",
			})
			return
		}
		w.WriteHeader(http.StatusNotFound)
	}))
	defer server.Close()

	alertHistoryMu.Lock()
	alertHistory = nil
	alertHistoryMu.Unlock()

	app := NewApp()
	app.holmesConfig = holmesgpt.HolmesConfigData{
		Enabled:  true,
		Endpoint: server.URL,
	}
	app.initHolmes()

	alert := PrometheusAlert{Name: "DiskFull", State: "firing", Value: "1", ActiveAt: time.Now()}
	resp, err := app.InvestigatePrometheusAlert(alert)
	if err != nil {
		t.Fatalf("InvestigatePrometheusAlert failed: %v", err)
	}
	if resp == nil || resp.Response == "" {
		t.Fatalf("expected response body")
	}

	history, err := app.GetAlertInvestigationHistory()
	if err != nil {
		t.Fatalf("GetAlertInvestigationHistory failed: %v", err)
	}
	if len(history) == 0 {
		t.Fatalf("expected history entry")
	}
	if history[len(history)-1].AlertName != "DiskFull" {
		t.Fatalf("expected DiskFull history entry")
	}

	holmesMu.Lock()
	holmesClient = nil
	holmesMu.Unlock()
}
