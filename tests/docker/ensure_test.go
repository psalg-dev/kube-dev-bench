package docker_test

import (
	"testing"

	"gowails/pkg/app"
)

func TestEnsureImageHasRegistryHost_AddsHostWhenMissing(t *testing.T) {
	in := "my-image"
	url := "https://registry.example.com"
	out := app.EnsureImageHasRegistryHost(in, url)
	if out != "registry.example.com/my-image" {
		t.Fatalf("unexpected: %s", out)
	}
}

func TestEnsureImageHasRegistryHost_NoChangeIfHasHost(t *testing.T) {
	in := "registry.example.com/my-image:latest"
	url := "https://registry.example.com"
	out := app.EnsureImageHasRegistryHost(in, url)
	if out != in {
		t.Fatalf("expected unchanged, got %s", out)
	}
}

func TestEnsureImageHasRegistryHost_HandlesLocalhost(t *testing.T) {
	in := "my-image"
	url := "http://localhost:5000"
	out := app.EnsureImageHasRegistryHost(in, url)
	if out != "localhost:5000/my-image" {
		t.Fatalf("unexpected: %s", out)
	}
}
