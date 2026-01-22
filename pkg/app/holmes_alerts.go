package app

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"sync"
	"time"

	"gowails/pkg/app/holmesgpt"
)

// PrometheusAlert represents a single alert from Prometheus.
type PrometheusAlert struct {
	Name        string            `json:"name"`
	State       string            `json:"state"`
	Value       string            `json:"value"`
	Labels      map[string]string `json:"labels"`
	Annotations map[string]string `json:"annotations"`
	ActiveAt    time.Time         `json:"activeAt"`
}

// AlertInvestigation stores an investigation run for an alert.
type AlertInvestigation struct {
	AlertName string    `json:"alertName"`
	Timestamp time.Time `json:"timestamp"`
	Analysis  string    `json:"analysis"`
}

type prometheusAlertsResponse struct {
	Status string `json:"status"`
	Data   struct {
		Alerts []struct {
			Labels      map[string]string `json:"labels"`
			Annotations map[string]string `json:"annotations"`
			State       string            `json:"state"`
			ActiveAt    string            `json:"activeAt"`
			Value       string            `json:"value"`
		} `json:"alerts"`
	} `json:"data"`
}

var alertHistoryMu sync.Mutex
var alertHistory []AlertInvestigation

// GetPrometheusAlerts fetches alerts from a Prometheus server.
func (a *App) GetPrometheusAlerts(prometheusURL string) ([]PrometheusAlert, error) {
	if prometheusURL == "" {
		return nil, fmt.Errorf("prometheusURL required")
	}
	base, err := url.Parse(prometheusURL)
	if err != nil {
		return nil, err
	}
	base.Path = "/api/v1/alerts"

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Get(base.String())
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("prometheus returned status %s", resp.Status)
	}

	var parsed prometheusAlertsResponse
	if err := json.NewDecoder(resp.Body).Decode(&parsed); err != nil {
		return nil, err
	}

	alerts := make([]PrometheusAlert, 0, len(parsed.Data.Alerts))
	for _, alert := range parsed.Data.Alerts {
		name := alert.Labels["alertname"]
		activeAt, _ := time.Parse(time.RFC3339, alert.ActiveAt)
		alerts = append(alerts, PrometheusAlert{
			Name:        name,
			State:       alert.State,
			Value:       alert.Value,
			Labels:      alert.Labels,
			Annotations: alert.Annotations,
			ActiveAt:    activeAt,
		})
	}

	return alerts, nil
}

// InvestigatePrometheusAlert sends a Holmes investigation for an alert.
func (a *App) InvestigatePrometheusAlert(alert PrometheusAlert) (*holmesgpt.HolmesResponse, error) {
	question := fmt.Sprintf("Investigate this Prometheus alert. Provide likely cause, impact, and remediation steps.\n\nAlert: %s\nState: %s\nValue: %s\nLabels: %v\nAnnotations: %v\nActiveAt: %s", alert.Name, alert.State, alert.Value, alert.Labels, alert.Annotations, alert.ActiveAt.Format(time.RFC3339))
	resp, err := a.AskHolmes(question)
	if err != nil {
		return nil, err
	}

	analysis := ""
	if resp != nil {
		analysis = resp.Response
		if analysis == "" {
			analysis = resp.Analysis
		}
	}

	alertHistoryMu.Lock()
	alertHistory = append(alertHistory, AlertInvestigation{
		AlertName: alert.Name,
		Timestamp: time.Now(),
		Analysis:  analysis,
	})
	alertHistoryMu.Unlock()

	return resp, nil
}

// GetAlertInvestigationHistory returns stored investigations.
func (a *App) GetAlertInvestigationHistory() ([]AlertInvestigation, error) {
	alertHistoryMu.Lock()
	defer alertHistoryMu.Unlock()
	result := make([]AlertInvestigation, len(alertHistory))
	copy(result, alertHistory)
	return result, nil
}
