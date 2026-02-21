package app

import (
	"testing"

	"k8s.io/client-go/kubernetes/fake"
)

func TestGetClient_WithTestClientset(t *testing.T) {
	app := &App{}
	fakeClient := fake.NewSimpleClientset()
	app.testClientset = fakeClient

	client, err := app.getClient()
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if client != fakeClient {
		t.Error("expected test clientset to be returned")
	}
}

func TestGetClient_WithoutTestClientset(t *testing.T) {
	app := &App{}
	// Without kubeconfig set up, this will return an error
	_, err := app.getClient()
	if err == nil {
		t.Error("expected error when no kubeconfig is configured")
	}
}
