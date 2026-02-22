package registry

import (
	"path/filepath"
	"strings"
	"testing"
)

func TestSetStorageOverridesForTests_RestoresOnDefer(t *testing.T) {
	tmp := t.TempDir()
	regPath := filepath.Join(tmp, "reg.json")
	keyPath := filepath.Join(tmp, "key")

	origReg := registriesPathFunc
	origKey := secretsKeyPathFunc

	restore := SetStorageOverridesForTests(regPath, keyPath)
	got, err := registriesPathFunc()
	if err != nil || got != regPath {
		t.Fatalf("expected registriesPathFunc to return %q, got %q (err=%v)", regPath, got, err)
	}
	gotKey, err := secretsKeyPathFunc()
	if err != nil || gotKey != keyPath {
		t.Fatalf("expected secretsKeyPathFunc to return %q, got %q (err=%v)", keyPath, gotKey, err)
	}

	restore()

	// After restore the functions should be the originals (same pointer).
	// We verify by confirming the values are no longer our overrides.
	afterReg, _ := registriesPathFunc()
	if strings.HasPrefix(afterReg, tmp) {
		t.Fatalf("after restore, registriesPathFunc should not point to tmp dir, got %q", afterReg)
	}
	// Sanity: originals are unchanged
	_ = origReg
	_ = origKey
}

func TestDefaultRegistriesPath_ContainsAppDir(t *testing.T) {
	p, err := defaultRegistriesPath()
	if err != nil {
		t.Fatalf("defaultRegistriesPath returned error: %v", err)
	}
	if !strings.Contains(p, "KubeDevBench") {
		t.Fatalf("expected path to contain KubeDevBench, got %q", p)
	}
	if !strings.HasSuffix(p, "registries.json") {
		t.Fatalf("expected path to end with registries.json, got %q", p)
	}
}

func TestRegistrySecretsKeyPath_ContainsAppDir(t *testing.T) {
	p, err := registrySecretsKeyPath()
	if err != nil {
		t.Fatalf("registrySecretsKeyPath returned error: %v", err)
	}
	if !strings.Contains(p, "KubeDevBench") {
		t.Fatalf("expected path to contain KubeDevBench, got %q", p)
	}
	if !strings.HasSuffix(p, "registry-secrets.key") {
		t.Fatalf("expected path to end with registry-secrets.key, got %q", p)
	}
}

func TestToEntry_EmptyName(t *testing.T) {
	_, err := toEntry(RegistryConfig{Name: "", URL: "https://registry.example.com"})
	if err == nil {
		t.Fatal("expected error for empty name, got nil")
	}
}

func TestToEntry_EmptyURL(t *testing.T) {
	tmp := t.TempDir()
	restore := SetStorageOverridesForTests(
		filepath.Join(tmp, "registries.json"),
		filepath.Join(tmp, "registry-secrets.key"),
	)
	defer restore()

	_, err := toEntry(RegistryConfig{Name: "myregistry", URL: ""})
	if err == nil {
		t.Fatal("expected error for empty URL, got nil")
	}
}

func TestToEntry_ValidConfig(t *testing.T) {
	tmp := t.TempDir()
	restore := SetStorageOverridesForTests(
		filepath.Join(tmp, "registries.json"),
		filepath.Join(tmp, "registry-secrets.key"),
	)
	defer restore()

	entry, err := toEntry(RegistryConfig{
		Name: "MyRegistry",
		URL:  "https://registry.example.com",
		Type: RegistryTypeGenericV2,
		Credentials: RegistryCredentials{
			Username: "bob",
			Password: "secret",
		},
		TimeoutSeconds: 5,
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if entry.Name != "MyRegistry" {
		t.Fatalf("expected Name=MyRegistry, got %q", entry.Name)
	}
	if entry.Username != "bob" {
		t.Fatalf("expected Username=bob, got %q", entry.Username)
	}
	if entry.EncryptedSecret == "" {
		t.Fatal("expected EncryptedSecret to be non-empty")
	}
}

func TestToPublicConfig_StripsCredentials(t *testing.T) {
	tmp := t.TempDir()
	restore := SetStorageOverridesForTests(
		filepath.Join(tmp, "registries.json"),
		filepath.Join(tmp, "registry-secrets.key"),
	)
	defer restore()

	entry, err := toEntry(RegistryConfig{
		Name: "PubRegistry",
		URL:  "https://pub.example.com",
		Type: RegistryTypeGenericV2,
		Credentials: RegistryCredentials{
			Username: "alice",
			Password: "topsecret",
			Token:    "mytoken",
		},
	})
	if err != nil {
		t.Fatalf("toEntry: %v", err)
	}

	pub := entry.toPublicConfig()
	if pub.Credentials.Password != "" {
		t.Fatalf("expected Password to be stripped, got %q", pub.Credentials.Password)
	}
	if pub.Credentials.Token != "" {
		t.Fatalf("expected Token to be stripped, got %q", pub.Credentials.Token)
	}
	if pub.Credentials.Username != "alice" {
		t.Fatalf("expected Username preserved, got %q", pub.Credentials.Username)
	}
}

func TestSaveRegistry_UpdateExisting(t *testing.T) {
	tmp := t.TempDir()
	restore := SetStorageOverridesForTests(
		filepath.Join(tmp, "registries.json"),
		filepath.Join(tmp, "registry-secrets.key"),
	)
	defer restore()

	cfg := RegistryConfig{
		Name: "UpdateMe",
		URL:  "https://update.example.com",
		Type: RegistryTypeGenericV2,
		Credentials: RegistryCredentials{
			Username: "user1",
			Password: "pass1",
		},
	}

	if err := SaveRegistry(cfg); err != nil {
		t.Fatalf("SaveRegistry (create): %v", err)
	}

	// Update with new URL.
	cfg.URL = "https://updated.example.com"
	if err := SaveRegistry(cfg); err != nil {
		t.Fatalf("SaveRegistry (update): %v", err)
	}

	regs, err := GetRegistries()
	if err != nil {
		t.Fatalf("GetRegistries: %v", err)
	}
	if len(regs) != 1 {
		t.Fatalf("expected exactly 1 registry after update, got %d", len(regs))
	}
	if regs[0].URL != "https://updated.example.com" {
		t.Fatalf("expected URL updated, got %q", regs[0].URL)
	}
}

func TestDeleteRegistry_EmptyName(t *testing.T) {
	err := DeleteRegistry("")
	if err == nil {
		t.Fatal("expected error for empty name, got nil")
	}
}

func TestDeleteRegistry_NotFound(t *testing.T) {
	tmp := t.TempDir()
	restore := SetStorageOverridesForTests(
		filepath.Join(tmp, "registries.json"),
		filepath.Join(tmp, "registry-secrets.key"),
	)
	defer restore()

	err := DeleteRegistry("nonexistent")
	if err != ErrRegistryNotFound {
		t.Fatalf("expected ErrRegistryNotFound, got %v", err)
	}
}

func TestDeleteRegistry_RemovesExisting(t *testing.T) {
	tmp := t.TempDir()
	restore := SetStorageOverridesForTests(
		filepath.Join(tmp, "registries.json"),
		filepath.Join(tmp, "registry-secrets.key"),
	)
	defer restore()

	cfg := RegistryConfig{
		Name: "ToDelete",
		URL:  "https://delete.example.com",
		Type: RegistryTypeGenericV2,
	}
	if err := SaveRegistry(cfg); err != nil {
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
		t.Fatalf("expected no registries after delete, got %d", len(regs))
	}
}

func TestGetRegistryWithCredentials_NotFound(t *testing.T) {
	tmp := t.TempDir()
	restore := SetStorageOverridesForTests(
		filepath.Join(tmp, "registries.json"),
		filepath.Join(tmp, "registry-secrets.key"),
	)
	defer restore()

	_, err := GetRegistryWithCredentials("phantom")
	if err != ErrRegistryNotFound {
		t.Fatalf("expected ErrRegistryNotFound, got %v", err)
	}
}

func TestGetRegistryWithCredentials_EmptyName(t *testing.T) {
	_, err := GetRegistryWithCredentials("")
	if err == nil {
		t.Fatal("expected error for empty name, got nil")
	}
}
