package docker

import (
	"path/filepath"
	"testing"

	"gowails/pkg/app/docker/registry"
)

func TestResolveRegistryConfigForImage_DockerHubNotConfigured(t *testing.T) {
	tmp := t.TempDir()
	restore := registry.SetStorageOverridesForTests(
		filepath.Join(tmp, "registries.json"),
		filepath.Join(tmp, "registry-secrets.key"),
	)
	defer restore()

	ref := parsedImageRef{registryHost: "docker.io", repository: "library/nginx", tag: "1.25"}
	_, err := resolveRegistryConfigForImage(ref)
	if err == nil {
		t.Fatal("expected error when docker hub registry not configured, got nil")
	}
}

func TestResolveRegistryConfigForImage_PrivateRegistryNotConfigured(t *testing.T) {
	tmp := t.TempDir()
	restore := registry.SetStorageOverridesForTests(
		filepath.Join(tmp, "registries.json"),
		filepath.Join(tmp, "registry-secrets.key"),
	)
	defer restore()

	ref := parsedImageRef{registryHost: "myregistry.example.com", repository: "myimage", tag: "latest"}
	_, err := resolveRegistryConfigForImage(ref)
	if err == nil {
		t.Fatal("expected error when private registry not configured, got nil")
	}
}

func TestResolveRegistryConfigForImage_DockerHubConfigured(t *testing.T) {
	tmp := t.TempDir()
	restore := registry.SetStorageOverridesForTests(
		filepath.Join(tmp, "registries.json"),
		filepath.Join(tmp, "registry-secrets.key"),
	)
	defer restore()

	// Save a docker hub registry configuration.
	cfg := registry.RegistryConfig{
		Name: "dockerhub",
		URL:  "https://registry-1.docker.io",
		Type: registry.RegistryTypeDockerHub,
		Credentials: registry.RegistryCredentials{
			Username: "alice",
			Password: "mypass",
		},
	}
	if err := registry.SaveRegistry(cfg); err != nil {
		t.Fatalf("SaveRegistry: %v", err)
	}

	ref := parsedImageRef{registryHost: "docker.io", repository: "library/nginx", tag: "latest"}
	result, err := resolveRegistryConfigForImage(ref)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.Type != registry.RegistryTypeDockerHub {
		t.Fatalf("expected DockerHub registry, got %q", result.Type)
	}
}
