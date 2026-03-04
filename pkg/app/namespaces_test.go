package app

import (
	"context"
	"os"
	"path/filepath"
	"testing"

	v1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes/fake"
)

// Tests for GetConnectionStatus
func TestGetConnectionStatus(t *testing.T) {
	tests := []struct {
		name                 string
		isInsecureConnection bool
		currentKubeContext   string
		expectedConnected    bool
	}{
		{
			name:                 "not connected, secure",
			isInsecureConnection: false,
			currentKubeContext:   "",
			expectedConnected:    false,
		},
		{
			name:                 "connected secure",
			isInsecureConnection: false,
			currentKubeContext:   "my-context",
			expectedConnected:    true,
		},
		{
			name:                 "connected insecure",
			isInsecureConnection: true,
			currentKubeContext:   "insecure-context",
			expectedConnected:    true,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			app := &App{
				isInsecureConnection: tc.isInsecureConnection,
				currentKubeContext:   tc.currentKubeContext,
			}

			result := app.GetConnectionStatus()

			if result["isInsecure"] != tc.isInsecureConnection {
				t.Errorf("expected isInsecure=%v, got %v", tc.isInsecureConnection, result["isInsecure"])
			}
			if result["connected"] != tc.expectedConnected {
				t.Errorf("expected connected=%v, got %v", tc.expectedConnected, result["connected"])
			}
		})
	}
}

// Tests for GetNamespaces
func TestGetNamespaces(t *testing.T) {
	tests := []struct {
		name       string
		namespaces []string
		expected   []string
	}{
		{
			name:       "empty namespaces",
			namespaces: []string{},
			expected:   nil,
		},
		{
			name:       "single namespace",
			namespaces: []string{"default"},
			expected:   []string{"default"},
		},
		{
			name:       "multiple namespaces sorted",
			namespaces: []string{"kube-system", "default", "apps"},
			expected:   []string{"apps", "default", "kube-system"},
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			clientset := fake.NewSimpleClientset()

			// Create namespaces
			for _, nsName := range tc.namespaces {
				ns := &v1.Namespace{
					ObjectMeta: metav1.ObjectMeta{Name: nsName},
				}
				_, err := clientset.CoreV1().Namespaces().Create(
					context.Background(), ns, metav1.CreateOptions{})
				if err != nil {
					t.Fatalf("failed to create namespace: %v", err)
				}
			}

			app := &App{
				ctx:           context.Background(),
				testClientset: clientset,
			}

			result, err := app.GetNamespaces()
			if err != nil {
				t.Fatalf("GetNamespaces failed: %v", err)
			}

			if len(result) != len(tc.expected) {
				t.Fatalf("expected %d namespaces, got %d", len(tc.expected), len(result))
			}

			for i, ns := range result {
				if ns != tc.expected[i] {
					t.Errorf("expected namespace[%d]=%s, got %s", i, tc.expected[i], ns)
				}
			}
		})
	}
}

// TestNamespaceFromKubeconfig verifies namespace extraction from kubeconfig.
func TestNamespaceFromKubeconfig(t *testing.T) {
	t.Run("returns namespace from context", func(t *testing.T) {
		dir := t.TempDir()
		kubeconfigContent := `apiVersion: v1
kind: Config
clusters:
- cluster:
    server: https://example.com
  name: my-cluster
contexts:
- context:
    cluster: my-cluster
    user: my-user
    namespace: custom-ns
  name: my-context
current-context: my-context
users:
- name: my-user
  user: {}
`
		path := filepath.Join(dir, "kubeconfig")
		if err := os.WriteFile(path, []byte(kubeconfigContent), 0600); err != nil {
			t.Fatalf("failed to write kubeconfig: %v", err)
		}

		a := &App{
			kubeConfig:         path,
			currentKubeContext: "my-context",
		}
		ns := a.namespaceFromKubeconfig()
		if ns != "custom-ns" {
			t.Errorf("namespaceFromKubeconfig() = %q, want %q", ns, "custom-ns")
		}
	})

	t.Run("returns empty when no namespace set", func(t *testing.T) {
		dir := t.TempDir()
		kubeconfigContent := `apiVersion: v1
kind: Config
clusters:
- cluster:
    server: https://example.com
  name: my-cluster
contexts:
- context:
    cluster: my-cluster
    user: my-user
  name: my-context
current-context: my-context
users:
- name: my-user
  user: {}
`
		path := filepath.Join(dir, "kubeconfig")
		if err := os.WriteFile(path, []byte(kubeconfigContent), 0600); err != nil {
			t.Fatalf("failed to write kubeconfig: %v", err)
		}

		a := &App{
			kubeConfig:         path,
			currentKubeContext: "my-context",
		}
		ns := a.namespaceFromKubeconfig()
		if ns != "" {
			t.Errorf("namespaceFromKubeconfig() = %q, want empty", ns)
		}
	})

	t.Run("returns empty for unknown context", func(t *testing.T) {
		dir := t.TempDir()
		kubeconfigContent := `apiVersion: v1
kind: Config
clusters: []
contexts: []
users: []
`
		path := filepath.Join(dir, "kubeconfig")
		if err := os.WriteFile(path, []byte(kubeconfigContent), 0600); err != nil {
			t.Fatalf("failed to write kubeconfig: %v", err)
		}

		a := &App{
			kubeConfig:         path,
			currentKubeContext: "nonexistent-context",
		}
		ns := a.namespaceFromKubeconfig()
		if ns != "" {
			t.Errorf("namespaceFromKubeconfig() = %q, want empty", ns)
		}
	})
}
