package app

import (
	"context"
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
