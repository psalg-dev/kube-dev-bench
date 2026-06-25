package app

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"gowails/pkg/app/holmesgpt"

	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/kubernetes/fake"
	clientgotesting "k8s.io/client-go/testing"
)

func TestAskHolmes_NotConfigured(t *testing.T) {
	// Reset state
	holmesMu.Lock()
	holmesClient = nil
	holmesMu.Unlock()

	app := NewApp()
	_, err := app.AskHolmes("test question")
	if err == nil {
		t.Error("AskHolmes() expected error when not configured, got nil")
	}
	if err != holmesgpt.ErrNotConfigured {
		t.Errorf("AskHolmes() expected ErrNotConfigured, got %v", err)
	}
}

func TestAskHolmes_Configured(t *testing.T) {
	// Create fake Holmes server
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/api/chat" {
			json.NewEncoder(w).Encode(holmesgpt.HolmesResponse{
				Response: "Test response from Holmes",
				QueryID:  "test-query-123",
			})
		}
	}))
	defer server.Close()

	// Configure Holmes
	app := NewApp()
	app.holmesConfig = holmesgpt.HolmesConfigData{
		Enabled:  true,
		Endpoint: server.URL,
	}
	app.initHolmes()

	resp, err := app.AskHolmes("test question")
	if err != nil {
		t.Fatalf("AskHolmes() unexpected error: %v", err)
	}
	if resp.Response != "Test response from Holmes" {
		t.Errorf("AskHolmes() expected 'Test response from Holmes', got %q", resp.Response)
	}

	// Cleanup
	holmesMu.Lock()
	holmesClient = nil
	holmesMu.Unlock()
}

func TestGetHolmesConfig_MasksAPIKey(t *testing.T) {
	app := NewApp()
	app.holmesConfig = holmesgpt.HolmesConfigData{
		Enabled:  true,
		Endpoint: "http://localhost:8080",
		APIKey:   "super-secret-key",
	}

	config, err := app.GetHolmesConfig()
	if err != nil {
		t.Fatalf("GetHolmesConfig() unexpected error: %v", err)
	}

	if config.APIKey != "********" {
		t.Errorf("GetHolmesConfig() expected masked API key, got %q", config.APIKey)
	}
	if config.Endpoint != "http://localhost:8080" {
		t.Errorf("GetHolmesConfig() expected endpoint preserved, got %q", config.Endpoint)
	}
	if !config.Enabled {
		t.Error("GetHolmesConfig() expected Enabled to be true")
	}
}

func TestSetHolmesConfig_ValidationError(t *testing.T) {
	app := &App{
		configPath: filepath.Join(t.TempDir(), "config.json"),
	}

	// Enabled without endpoint should fail
	err := app.SetHolmesConfig(holmesgpt.HolmesConfigData{
		Enabled:  true,
		Endpoint: "",
	})
	if err == nil {
		t.Error("SetHolmesConfig() expected validation error, got nil")
	}
}

func TestSetHolmesConfig_Disabled(t *testing.T) {
	tmpDir := t.TempDir()
	app := &App{
		configPath: filepath.Join(tmpDir, "config.json"),
	}

	// Set to disabled should work
	err := app.SetHolmesConfig(holmesgpt.HolmesConfigData{
		Enabled: false,
	})
	if err != nil {
		t.Fatalf("SetHolmesConfig() unexpected error: %v", err)
	}

	// Client should be nil
	holmesMu.RLock()
	client := holmesClient
	holmesMu.RUnlock()
	if client != nil {
		t.Error("SetHolmesConfig() expected client to be nil when disabled")
	}
}

func TestSetHolmesConfig_PersistsToFile(t *testing.T) {
	tmpDir := t.TempDir()
	configPath := filepath.Join(tmpDir, "config.json")
	app := &App{
		configPath: configPath,
	}

	// Set config
	err := app.SetHolmesConfig(holmesgpt.HolmesConfigData{
		Enabled:  true,
		Endpoint: "http://holmes.test:8080",
		APIKey:   "test-key",
	})
	if err != nil {
		t.Fatalf("SetHolmesConfig() unexpected error: %v", err)
	}

	// Verify file was written
	data, err := os.ReadFile(configPath)
	if err != nil {
		t.Fatalf("Failed to read config file: %v", err)
	}

	var savedConfig AppConfig
	if err := json.Unmarshal(data, &savedConfig); err != nil {
		t.Fatalf("Failed to unmarshal config: %v", err)
	}

	if !savedConfig.HolmesConfig.Enabled {
		t.Error("Saved config should have Holmes enabled")
	}
	if savedConfig.HolmesConfig.Endpoint != "http://holmes.test:8080" {
		t.Errorf("Saved config endpoint = %q, want %q", savedConfig.HolmesConfig.Endpoint, "http://holmes.test:8080")
	}

	// Cleanup
	holmesMu.Lock()
	holmesClient = nil
	holmesMu.Unlock()
}

func TestTestHolmesConnection_NotConfigured(t *testing.T) {
	holmesMu.Lock()
	holmesClient = nil
	holmesMu.Unlock()

	app := NewApp()
	status, err := app.TestHolmesConnection()
	if err != nil {
		t.Fatalf("TestHolmesConnection() unexpected error: %v", err)
	}
	if status.Connected {
		t.Error("TestHolmesConnection() expected Connected=false when not configured")
	}
	if status.Error == "" {
		t.Error("TestHolmesConnection() expected error message when not configured")
	}
}

func TestTestHolmesConnection_Healthy(t *testing.T) {
	// Create fake Holmes server
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/healthz" {
			w.WriteHeader(http.StatusOK)
		}
	}))
	defer server.Close()

	// Configure Holmes
	app := NewApp()
	app.holmesConfig = holmesgpt.HolmesConfigData{
		Enabled:  true,
		Endpoint: server.URL,
	}
	app.initHolmes()

	status, err := app.TestHolmesConnection()
	if err != nil {
		t.Fatalf("TestHolmesConnection() unexpected error: %v", err)
	}
	if !status.Connected {
		t.Error("TestHolmesConnection() expected Connected=true")
	}
	if status.Endpoint != server.URL {
		t.Errorf("TestHolmesConnection() Endpoint = %q, want %q", status.Endpoint, server.URL)
	}

	// Cleanup
	holmesMu.Lock()
	holmesClient = nil
	holmesMu.Unlock()
}

func TestTestHolmesConnection_Unhealthy(t *testing.T) {
	// Create fake Holmes server that returns 500
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	}))
	defer server.Close()

	// Configure Holmes
	app := NewApp()
	app.holmesConfig = holmesgpt.HolmesConfigData{
		Enabled:  true,
		Endpoint: server.URL,
	}
	app.initHolmes()

	status, err := app.TestHolmesConnection()
	if err != nil {
		t.Fatalf("TestHolmesConnection() unexpected error: %v", err)
	}
	if status.Connected {
		t.Error("TestHolmesConnection() expected Connected=false for unhealthy server")
	}
	if status.Error == "" {
		t.Error("TestHolmesConnection() expected error message for unhealthy server")
	}

	// Cleanup
	holmesMu.Lock()
	holmesClient = nil
	holmesMu.Unlock()
}

func TestInitHolmes_CreatesClient(t *testing.T) {
	// Create fake Holmes server
	server := httptest.NewServer(http.HandlerFunc(func(_ http.ResponseWriter, _ *http.Request) {}))
	defer server.Close()

	app := NewApp()
	app.holmesConfig = holmesgpt.HolmesConfigData{
		Enabled:  true,
		Endpoint: server.URL,
	}
	app.initHolmes()

	holmesMu.RLock()
	client := holmesClient
	holmesMu.RUnlock()

	if client == nil {
		t.Error("initHolmes() expected client to be created")
	}

	// Cleanup
	holmesMu.Lock()
	holmesClient = nil
	holmesMu.Unlock()
}

func TestGetPodContext_BasicFields(t *testing.T) {
	clientset := fake.NewSimpleClientset(
		&corev1.Pod{
			ObjectMeta: metav1.ObjectMeta{Name: "test-pod", Namespace: "default"},
			Spec:       corev1.PodSpec{NodeName: "node-1"},
			Status: corev1.PodStatus{
				Phase: corev1.PodRunning,
				ContainerStatuses: []corev1.ContainerStatus{{
					Name:         "app",
					Ready:        true,
					RestartCount: 1,
				}},
				Conditions: []corev1.PodCondition{{
					Type:    corev1.PodReady,
					Status:  corev1.ConditionTrue,
					Message: "Ready",
				}},
			},
		},
		&corev1.Event{
			ObjectMeta: metav1.ObjectMeta{Name: "pod-event", Namespace: "default"},
			InvolvedObject: corev1.ObjectReference{
				Kind:      "Pod",
				Name:      "test-pod",
				Namespace: "default",
			},
			Reason:        "Scheduled",
			Message:       "Scheduled",
			LastTimestamp: metav1.NewTime(metav1.Now().Time),
		},
	)

	app := &App{ctx: context.Background(), testClientset: clientset}
	ctxText, err := app.getPodContext("default", "test-pod")
	if err != nil {
		t.Fatalf("getPodContext() unexpected error: %v", err)
	}
	if !strings.Contains(ctxText, "Pod: default/test-pod") {
		t.Errorf("expected pod header in context, got: %s", ctxText)
	}
	if !strings.Contains(ctxText, "Status: Running") {
		t.Errorf("expected status in context, got: %s", ctxText)
	}
	if !strings.Contains(ctxText, "Containers:") {
		t.Errorf("expected containers section in context, got: %s", ctxText)
	}
}

func TestGetPodContext_NotFound(t *testing.T) {
	clientset := fake.NewSimpleClientset()
	app := &App{ctx: context.Background(), testClientset: clientset}
	_, err := app.getPodContext("default", "missing")
	if err == nil {
		t.Error("getPodContext() expected error for missing pod, got nil")
	}
}

func TestGetPodContext_RBACError(t *testing.T) {
	clientset := fake.NewSimpleClientset()
	clientset.PrependReactor("get", "pods", func(_ clientgotesting.Action) (bool, runtime.Object, error) {
		return true, nil, apierrors.NewForbidden(schema.GroupResource{Group: "", Resource: "pods"}, "test-pod", fmt.Errorf("forbidden"))
	})

	app := &App{ctx: context.Background(), testClientset: clientset}
	_, err := app.getPodContext("default", "test-pod")
	if err == nil {
		t.Error("getPodContext() expected RBAC error, got nil")
	}
}

func TestGetDeploymentContext_BasicFields(t *testing.T) {
	clientset := fake.NewSimpleClientset(
		&appsv1.Deployment{
			ObjectMeta: metav1.ObjectMeta{Name: "deploy", Namespace: "default"},
			Spec: appsv1.DeploymentSpec{
				Replicas: int32Ptr(2),
				Selector: &metav1.LabelSelector{MatchLabels: map[string]string{"app": "demo"}},
				Strategy: appsv1.DeploymentStrategy{Type: appsv1.RollingUpdateDeploymentStrategyType},
			},
			Status: appsv1.DeploymentStatus{
				ReadyReplicas:     1,
				AvailableReplicas: 1,
			},
		},
		&corev1.Pod{
			ObjectMeta: metav1.ObjectMeta{Name: "deploy-pod", Namespace: "default", Labels: map[string]string{"app": "demo"}},
			Status:     corev1.PodStatus{Phase: corev1.PodRunning},
		},
	)

	app := &App{ctx: context.Background(), testClientset: clientset}
	ctxText, err := app.getDeploymentContext("default", "deploy")
	if err != nil {
		t.Fatalf("getDeploymentContext() unexpected error: %v", err)
	}
	if !strings.Contains(ctxText, "Deployment: default/deploy") {
		t.Errorf("expected deployment header in context, got: %s", ctxText)
	}
}

func TestAnalyzePod_WithFakeHolmes(t *testing.T) {
	clientset := fake.NewSimpleClientset(
		&corev1.Pod{
			ObjectMeta: metav1.ObjectMeta{Name: "test-pod", Namespace: "default"},
			Spec:       corev1.PodSpec{NodeName: "node-1"},
			Status:     corev1.PodStatus{Phase: corev1.PodRunning},
		},
	)

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/api/chat" {
			json.NewEncoder(w).Encode(holmesgpt.HolmesResponse{Response: "ok"})
			return
		}
		w.WriteHeader(http.StatusNotFound)
	}))
	defer server.Close()

	app := &App{ctx: context.Background(), testClientset: clientset}
	app.holmesConfig = holmesgpt.HolmesConfigData{Enabled: true, Endpoint: server.URL}
	app.initHolmes()

	resp, err := app.AnalyzePod("default", "test-pod")
	if err != nil {
		t.Fatalf("AnalyzePod() unexpected error: %v", err)
	}
	if resp.Response != "ok" {
		t.Errorf("AnalyzePod() expected response 'ok', got %q", resp.Response)
	}

	holmesMu.Lock()
	holmesClient = nil
	holmesMu.Unlock()
}

func TestAnalyzeDeployment_WithFakeHolmes(t *testing.T) {
	clientset := fake.NewSimpleClientset(
		&appsv1.Deployment{
			ObjectMeta: metav1.ObjectMeta{Name: "deploy", Namespace: "default"},
			Spec: appsv1.DeploymentSpec{
				Replicas: int32Ptr(1),
				Selector: &metav1.LabelSelector{MatchLabels: map[string]string{"app": "demo"}},
				Strategy: appsv1.DeploymentStrategy{Type: appsv1.RollingUpdateDeploymentStrategyType},
			},
			Status: appsv1.DeploymentStatus{ReadyReplicas: 1},
		},
		&corev1.Pod{
			ObjectMeta: metav1.ObjectMeta{Name: "deploy-pod", Namespace: "default", Labels: map[string]string{"app": "demo"}},
			Status:     corev1.PodStatus{Phase: corev1.PodRunning},
		},
	)

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/api/chat" {
			json.NewEncoder(w).Encode(holmesgpt.HolmesResponse{Response: "deployment ok"})
			return
		}
		w.WriteHeader(http.StatusNotFound)
	}))
	defer server.Close()

	app := &App{ctx: context.Background(), testClientset: clientset}
	app.holmesConfig = holmesgpt.HolmesConfigData{Enabled: true, Endpoint: server.URL}
	app.initHolmes()

	resp, err := app.AnalyzeDeployment("default", "deploy")
	if err != nil {
		t.Fatalf("AnalyzeDeployment() unexpected error: %v", err)
	}
	if resp.Response != "deployment ok" {
		t.Errorf("AnalyzeDeployment() expected response 'deployment ok', got %q", resp.Response)
	}

	holmesMu.Lock()
	holmesClient = nil
	holmesMu.Unlock()
}

func int32Ptr(i int32) *int32 {
	return &i
}

func TestInitHolmes_SkipsWhenDisabled(t *testing.T) {
	// Reset client first
	holmesMu.Lock()
	holmesClient = nil
	holmesMu.Unlock()

	app := NewApp()
	app.holmesConfig = holmesgpt.HolmesConfigData{
		Enabled: false,
	}
	app.initHolmes()

	holmesMu.RLock()
	client := holmesClient
	holmesMu.RUnlock()

	if client != nil {
		t.Error("initHolmes() expected client to be nil when disabled")
	}
}
