package app

import (
	"context"
	"encoding/base64"
	"testing"

	v1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes/fake"
)

// Tests for GetSecretData function
func TestGetSecretData(t *testing.T) {
	clientset := fake.NewSimpleClientset()
	secret := &v1.Secret{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "test-secret",
			Namespace: "default",
		},
		Data: map[string][]byte{
			"username": []byte("admin"),
			"password": []byte("s3cr3t"),
			"empty":    []byte{},
		},
	}

	_, err := clientset.CoreV1().Secrets("default").Create(
		context.Background(), secret, metav1.CreateOptions{})
	if err != nil {
		t.Fatalf("failed to create secret: %v", err)
	}

	app := &App{
		ctx:              context.Background(),
		testClientset:    clientset,
		currentNamespace: "default",
	}

	result, err := app.GetSecretData("test-secret")
	if err != nil {
		t.Fatalf("GetSecretData failed: %v", err)
	}

	// Check base64 encoded values
	expectedUsername := base64.StdEncoding.EncodeToString([]byte("admin"))
	if result["username"] != expectedUsername {
		t.Errorf("expected username %q, got %q", expectedUsername, result["username"])
	}

	expectedPassword := base64.StdEncoding.EncodeToString([]byte("s3cr3t"))
	if result["password"] != expectedPassword {
		t.Errorf("expected password %q, got %q", expectedPassword, result["password"])
	}

	// Empty value should be empty string
	if result["empty"] != "" {
		t.Errorf("expected empty string for empty value, got %q", result["empty"])
	}
}

func TestGetSecretData_EmptyName(t *testing.T) {
	app := &App{
		ctx:              context.Background(),
		currentNamespace: "default",
	}

	_, err := app.GetSecretData("")
	if err == nil {
		t.Error("expected error for empty secret name")
	}
}

func TestGetSecretData_NoNamespace(t *testing.T) {
	app := &App{
		ctx:              context.Background(),
		currentNamespace: "",
	}

	_, err := app.GetSecretData("test-secret")
	if err == nil {
		t.Error("expected error for no namespace selected")
	}
}

// Tests for GetSecrets function
func TestGetSecrets(t *testing.T) {
	tests := []struct {
		name      string
		namespace string
		secrets   []v1.Secret
		expected  int
	}{
		{
			name:      "empty namespace",
			namespace: "default",
			secrets:   []v1.Secret{},
			expected:  0,
		},
		{
			name:      "single secret",
			namespace: "default",
			secrets: []v1.Secret{
				{
					ObjectMeta: metav1.ObjectMeta{
						Name:      "my-secret",
						Namespace: "default",
						Labels:    map[string]string{"app": "myapp"},
					},
					Type: v1.SecretTypeOpaque,
					Data: map[string][]byte{
						"key1": []byte("value1"),
					},
				},
			},
			expected: 1,
		},
		{
			name:      "multiple secrets",
			namespace: "default",
			secrets: []v1.Secret{
				{
					ObjectMeta: metav1.ObjectMeta{Name: "secret1", Namespace: "default"},
					Type:       v1.SecretTypeOpaque,
					Data:       map[string][]byte{"key1": []byte("value1")},
				},
				{
					ObjectMeta: metav1.ObjectMeta{Name: "secret2", Namespace: "default"},
					Type:       v1.SecretTypeDockerConfigJson,
					Data:       map[string][]byte{"key2": []byte("value2")},
				},
			},
			expected: 2,
		},
		{
			name:      "secrets in different namespaces",
			namespace: "target-ns",
			secrets: []v1.Secret{
				{
					ObjectMeta: metav1.ObjectMeta{Name: "secret1", Namespace: "target-ns"},
					Type:       v1.SecretTypeOpaque,
					Data:       map[string][]byte{"key1": []byte("value1")},
				},
				{
					ObjectMeta: metav1.ObjectMeta{Name: "secret2", Namespace: "other-ns"},
					Type:       v1.SecretTypeOpaque,
					Data:       map[string][]byte{"key2": []byte("value2")},
				},
			},
			expected: 1,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			clientset := fake.NewSimpleClientset()
			for _, s := range tc.secrets {
				_, err := clientset.CoreV1().Secrets(s.Namespace).Create(
					context.Background(), &s, metav1.CreateOptions{})
				if err != nil {
					t.Fatalf("failed to create secret: %v", err)
				}
			}

			app := &App{
				ctx:           context.Background(),
				testClientset: clientset,
			}

			result, err := app.GetSecrets(tc.namespace)
			if err != nil {
				t.Fatalf("GetSecrets failed: %v", err)
			}

			if len(result) != tc.expected {
				t.Errorf("GetSecrets(%q) returned %d secrets, want %d",
					tc.namespace, len(result), tc.expected)
			}
		})
	}
}

func TestGetSecrets_NoNamespace(t *testing.T) {
	app := &App{
		ctx:              context.Background(),
		currentNamespace: "",
	}

	_, err := app.GetSecrets("")
	if err == nil {
		t.Error("expected error for no namespace specified")
	}
}

func TestGetSecrets_UsesCurrentNamespace(t *testing.T) {
	clientset := fake.NewSimpleClientset()
	secret := &v1.Secret{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "test-secret",
			Namespace: "my-namespace",
		},
		Type: v1.SecretTypeOpaque,
		Data: map[string][]byte{"key1": []byte("value1")},
	}

	_, err := clientset.CoreV1().Secrets("my-namespace").Create(
		context.Background(), secret, metav1.CreateOptions{})
	if err != nil {
		t.Fatalf("failed to create secret: %v", err)
	}

	app := &App{
		ctx:              context.Background(),
		testClientset:    clientset,
		currentNamespace: "my-namespace",
	}

	// Pass empty namespace, should use currentNamespace
	result, err := app.GetSecrets("")
	if err != nil {
		t.Fatalf("GetSecrets failed: %v", err)
	}

	if len(result) != 1 {
		t.Errorf("expected 1 secret using current namespace, got %d", len(result))
	}
}

func TestGetSecrets_Details(t *testing.T) {
	clientset := fake.NewSimpleClientset()
	secret := &v1.Secret{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "db-credentials",
			Namespace: "default",
			Labels:    map[string]string{"app": "database"},
		},
		Type: v1.SecretTypeOpaque,
		Data: map[string][]byte{
			"username": []byte("admin"),
			"password": []byte("password123"),
		},
	}

	_, err := clientset.CoreV1().Secrets("default").Create(
		context.Background(), secret, metav1.CreateOptions{})
	if err != nil {
		t.Fatalf("failed to create secret: %v", err)
	}

	app := &App{
		ctx:           context.Background(),
		testClientset: clientset,
	}

	result, err := app.GetSecrets("default")
	if err != nil {
		t.Fatalf("GetSecrets failed: %v", err)
	}

	if len(result) != 1 {
		t.Fatalf("expected 1 secret, got %d", len(result))
	}

	s := result[0]
	if s["name"] != "db-credentials" {
		t.Errorf("expected name 'db-credentials', got %q", s["name"])
	}
	if s["namespace"] != "default" {
		t.Errorf("expected namespace 'default', got %q", s["namespace"])
	}
	if s["type"] != string(v1.SecretTypeOpaque) {
		t.Errorf("expected type 'Opaque', got %q", s["type"])
	}
	if s["keys"] != "2" {
		t.Errorf("expected 2 keys, got %q", s["keys"])
	}
}
