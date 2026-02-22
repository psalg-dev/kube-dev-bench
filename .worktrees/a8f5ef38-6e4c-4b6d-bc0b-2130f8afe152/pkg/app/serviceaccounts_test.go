package app

import (
	"context"
	"testing"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes/fake"
)

func TestGetServiceAccounts_ReturnsServiceAccounts(t *testing.T) {
	ctx := context.Background()
	clientset := fake.NewSimpleClientset(
		&corev1.ServiceAccount{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "my-sa",
				Namespace: "default",
				Labels: map[string]string{
					"app": "myapp",
				},
				Annotations: map[string]string{
					"description": "test service account",
				},
			},
			Secrets: []corev1.ObjectReference{
				{Name: "my-sa-token-abc123"},
				{Name: "my-sa-token-xyz789"},
			},
		},
		&corev1.ServiceAccount{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "default",
				Namespace: "default",
			},
		},
	)

	app := &App{ctx: ctx, testClientset: clientset}

	serviceAccounts, err := app.GetServiceAccounts("default")
	if err != nil {
		t.Fatalf("GetServiceAccounts failed: %v", err)
	}

	if len(serviceAccounts) != 2 {
		t.Fatalf("expected 2 service accounts, got %d", len(serviceAccounts))
	}

	// Find the service account by name
	var mySA *ServiceAccountInfo
	for i := range serviceAccounts {
		if serviceAccounts[i].Name == "my-sa" {
			mySA = &serviceAccounts[i]
			break
		}
	}

	if mySA == nil {
		t.Fatal("expected to find service account 'my-sa'")
	}

	// Verify service account details
	if mySA.Namespace != "default" {
		t.Errorf("expected namespace 'default', got '%s'", mySA.Namespace)
	}
	if len(mySA.Secrets) != 2 {
		t.Errorf("expected 2 secrets, got %d", len(mySA.Secrets))
	}
	if mySA.Labels["app"] != "myapp" {
		t.Errorf("expected label app=myapp, got %v", mySA.Labels)
	}
}

func TestGetServiceAccounts_NoServiceAccounts(t *testing.T) {
	ctx := context.Background()
	clientset := fake.NewSimpleClientset()

	app := &App{ctx: ctx, testClientset: clientset}

	serviceAccounts, err := app.GetServiceAccounts("default")
	if err != nil {
		t.Fatalf("GetServiceAccounts failed: %v", err)
	}

	if len(serviceAccounts) != 0 {
		t.Errorf("expected 0 service accounts, got %d", len(serviceAccounts))
	}
}

func TestGetServiceAccounts_EmptyNamespace(t *testing.T) {
	app := &App{ctx: context.Background()}

	_, err := app.GetServiceAccounts("")
	if err == nil {
		t.Fatal("expected error for empty namespace")
	}

	if err.Error() != "missing required parameter: namespace" {
		t.Errorf("unexpected error message: %v", err)
	}
}

func TestGetServiceAccountDetail_ReturnsServiceAccount(t *testing.T) {
	ctx := context.Background()
	clientset := fake.NewSimpleClientset(
		&corev1.ServiceAccount{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "my-sa",
				Namespace: "default",
				Labels: map[string]string{
					"app": "myapp",
				},
			},
			Secrets: []corev1.ObjectReference{
				{Name: "my-sa-token-abc123"},
			},
		},
	)

	app := &App{ctx: ctx, testClientset: clientset}

	sa, err := app.GetServiceAccountDetail("default", "my-sa")
	if err != nil {
		t.Fatalf("GetServiceAccountDetail failed: %v", err)
	}

	if sa.Name != "my-sa" {
		t.Errorf("expected service account name 'my-sa', got '%s'", sa.Name)
	}
	if len(sa.Secrets) != 1 {
		t.Errorf("expected 1 secret, got %d", len(sa.Secrets))
	}
	if sa.Secrets[0] != "my-sa-token-abc123" {
		t.Errorf("expected secret 'my-sa-token-abc123', got '%s'", sa.Secrets[0])
	}
}

func TestGetServiceAccountDetail_EmptyNamespace(t *testing.T) {
	app := &App{ctx: context.Background()}

	_, err := app.GetServiceAccountDetail("", "my-sa")
	if err == nil {
		t.Fatal("expected error for empty namespace")
	}

	if err.Error() != "missing required parameter: namespace" {
		t.Errorf("unexpected error message: %v", err)
	}
}

func TestGetServiceAccountDetail_EmptyName(t *testing.T) {
	app := &App{ctx: context.Background()}

	_, err := app.GetServiceAccountDetail("default", "")
	if err == nil {
		t.Fatal("expected error for empty name")
	}

	if err.Error() != "missing required parameter: name" {
		t.Errorf("unexpected error message: %v", err)
	}
}

func TestBuildServiceAccountInfo_NoSecrets(t *testing.T) {
	sa := &corev1.ServiceAccount{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "no-secrets-sa",
			Namespace: "default",
		},
	}

	info := buildServiceAccountInfo(sa, metav1.Now().Time)

	if len(info.Secrets) != 0 {
		t.Errorf("expected 0 secrets, got %d", len(info.Secrets))
	}
}
