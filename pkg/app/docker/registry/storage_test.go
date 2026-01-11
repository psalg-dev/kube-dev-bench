package registry

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestRegistryStorage_SaveLoadRedactionAndDecrypt(t *testing.T) {
	tmp := t.TempDir()
	registriesPath := filepath.Join(tmp, "registries.json")
	keyPath := filepath.Join(tmp, "registry-secrets.key")

	oldPathFunc := registriesPathFunc
	oldKeyFunc := secretsKeyPathFunc
	registriesPathFunc = func() (string, error) { return registriesPath, nil }
	secretsKeyPathFunc = func() (string, error) { return keyPath, nil }
	defer func() {
		registriesPathFunc = oldPathFunc
		secretsKeyPathFunc = oldKeyFunc
	}()

	cfg := RegistryConfig{
		Name: "TestRegistry",
		URL:  "https://registry.example.com",
		Type: RegistryTypeGenericV2,
		Credentials: RegistryCredentials{
			Username: "alice",
			Password: "supersecret",
			Token:    "",
			Region:   "",
		},
		TimeoutSeconds:        7,
		AllowInsecureHTTP:     false,
		InsecureSkipTLSVerify: true,
	}

	if err := SaveRegistry(cfg); err != nil {
		t.Fatalf("SaveRegistry: %v", err)
	}

	public, err := GetRegistries()
	if err != nil {
		t.Fatalf("GetRegistries: %v", err)
	}
	if len(public) != 1 {
		t.Fatalf("expected 1 registry, got %d", len(public))
	}
	if public[0].Credentials.Password != "" || public[0].Credentials.Token != "" {
		t.Fatalf("expected credentials redacted in GetRegistries")
	}
	if public[0].Credentials.Username != "alice" {
		t.Fatalf("expected username preserved")
	}

	full, err := GetRegistryWithCredentials("testregistry")
	if err != nil {
		t.Fatalf("GetRegistryWithCredentials: %v", err)
	}
	if full.Credentials.Password != "supersecret" {
		t.Fatalf("expected decrypted password")
	}
	if full.Credentials.Username != "alice" {
		t.Fatalf("expected username preserved")
	}

	// Ensure secrets are not stored in plaintext in the registry file.
	b, err := os.ReadFile(registriesPath)
	if err != nil {
		t.Fatalf("read registries file: %v", err)
	}
	s := string(b)
	if strings.Contains(s, "supersecret") {
		t.Fatalf("expected password not stored in plaintext")
	}
	if !strings.Contains(s, "encryptedSecret") {
		t.Fatalf("expected encryptedSecret field to exist")
	}

	// Ensure the file is valid JSON.
	var decoded any
	if err := json.Unmarshal(b, &decoded); err != nil {
		t.Fatalf("registries file not valid json: %v", err)
	}
}

func TestRegistryStorage_DeleteRegistry(t *testing.T) {
	tmp := t.TempDir()
	registriesPath := filepath.Join(tmp, "registries.json")
	keyPath := filepath.Join(tmp, "registry-secrets.key")

	oldPathFunc := registriesPathFunc
	oldKeyFunc := secretsKeyPathFunc
	registriesPathFunc = func() (string, error) { return registriesPath, nil }
	secretsKeyPathFunc = func() (string, error) { return keyPath, nil }
	defer func() {
		registriesPathFunc = oldPathFunc
		secretsKeyPathFunc = oldKeyFunc
	}()

	if err := SaveRegistry(RegistryConfig{
		Name: "ToDelete",
		URL:  "https://registry.example.com",
		Type: RegistryTypeGenericV2,
	}); err != nil {
		t.Fatalf("SaveRegistry: %v", err)
	}

	if err := DeleteRegistry("ToDelete"); err != nil {
		t.Fatalf("DeleteRegistry: %v", err)
	}

	regs, err := GetRegistries()
	if err != nil {
		t.Fatalf("GetRegistries: %v", err)
	}
	if len(regs) != 0 {
		t.Fatalf("expected 0 registries, got %d", len(regs))
	}
}
