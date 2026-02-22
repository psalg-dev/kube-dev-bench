package registry

import (
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"
)

var ErrRegistryNotFound = errors.New("registry not found")

// Registries are stored in ~/KubeDevBench/registries.json.
// Credential material (password/token) is stored encrypted in the same file.
//
// Note: this intentionally avoids returning decrypted credentials from GetRegistries()
// to prevent leaking secrets to the frontend.

type registrySecret struct {
	Password string `json:"password,omitempty"`
	Token    string `json:"token,omitempty"`
}

type registryFile struct {
	Registries []registryFileEntry `json:"registries"`
}

type registryFileEntry struct {
	Name string       `json:"name"`
	URL  string       `json:"url"`
	Type RegistryType `json:"type"`

	Username string `json:"username,omitempty"`
	Region   string `json:"region,omitempty"`

	TimeoutSeconds         int  `json:"timeoutSeconds,omitempty"`
	InsecureSkipTLSVerify  bool `json:"insecureSkipTlsVerify,omitempty"`
	AllowInsecureHTTP      bool `json:"allowInsecureHttp,omitempty"`
	DisableTLSVerification bool `json:"disableTlsVerification,omitempty"`

	EncryptedSecret string `json:"encryptedSecret,omitempty"`
}

var registriesPathFunc = defaultRegistriesPath
var secretsKeyPathFunc = registrySecretsKeyPath

// SetStorageOverridesForTests overrides the storage locations used by this package.
// It returns a restore function that should be deferred by the caller.
//
// This is intended for unit/integration tests that need deterministic temp paths.
func SetStorageOverridesForTests(registriesPath, secretsKeyPath string) (restore func()) {
	oldRegistries := registriesPathFunc
	oldSecrets := secretsKeyPathFunc
	registriesPathFunc = func() (string, error) { return registriesPath, nil }
	secretsKeyPathFunc = func() (string, error) { return secretsKeyPath, nil }
	return func() {
		registriesPathFunc = oldRegistries
		secretsKeyPathFunc = oldSecrets
	}
}

func defaultRegistriesPath() (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(home, "KubeDevBench", "registries.json"), nil
}

func registrySecretsKeyPath() (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(home, "KubeDevBench", "registry-secrets.key"), nil
}

func getOrCreateSecretsKey() ([]byte, error) {
	keyPath, err := secretsKeyPathFunc()
	if err != nil {
		return nil, err
	}
	keyPath = filepath.Clean(keyPath)
	if err := os.MkdirAll(filepath.Dir(keyPath), 0o750); err != nil {
		return nil, err
	}

	// #nosec G304 -- key path is within the app data directory.
	b, err := os.ReadFile(keyPath)
	if err == nil {
		decoded, derr := base64.StdEncoding.DecodeString(strings.TrimSpace(string(b)))
		if derr != nil {
			return nil, fmt.Errorf("decode registry secrets key: %w", derr)
		}
		if len(decoded) != 32 {
			return nil, fmt.Errorf("registry secrets key has invalid length")
		}
		return decoded, nil
	}
	if !os.IsNotExist(err) {
		return nil, err
	}

	key := make([]byte, 32)
	if _, err := io.ReadFull(rand.Reader, key); err != nil {
		return nil, fmt.Errorf("generate registry secrets key: %w", err)
	}
	enc := base64.StdEncoding.EncodeToString(key)
	if err := os.WriteFile(keyPath, []byte(enc), 0o600); err != nil {
		return nil, err
	}
	return key, nil
}

func encryptSecret(s registrySecret) (string, error) {
	if strings.TrimSpace(s.Password) == "" && strings.TrimSpace(s.Token) == "" {
		return "", nil
	}

	key, err := getOrCreateSecretsKey()
	if err != nil {
		return "", err
	}

	pt, err := json.Marshal(s)
	if err != nil {
		return "", err
	}

	block, err := aes.NewCipher(key)
	if err != nil {
		return "", err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}

	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", err
	}
	ct := gcm.Seal(nil, nonce, pt, nil)

	combined := append(nonce, ct...)
	return base64.StdEncoding.EncodeToString(combined), nil
}

func decryptSecret(enc string) (registrySecret, error) {
	enc = strings.TrimSpace(enc)
	if enc == "" {
		return registrySecret{}, nil
	}

	key, err := getOrCreateSecretsKey()
	if err != nil {
		return registrySecret{}, err
	}

	combined, err := base64.StdEncoding.DecodeString(enc)
	if err != nil {
		return registrySecret{}, fmt.Errorf("decode registry secret: %w", err)
	}

	block, err := aes.NewCipher(key)
	if err != nil {
		return registrySecret{}, err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return registrySecret{}, err
	}
	if len(combined) < gcm.NonceSize() {
		return registrySecret{}, fmt.Errorf("invalid registry secret payload")
	}

	nonce := combined[:gcm.NonceSize()]
	ct := combined[gcm.NonceSize():]
	pt, err := gcm.Open(nil, nonce, ct, nil)
	if err != nil {
		return registrySecret{}, fmt.Errorf("decrypt registry secret: %w", err)
	}

	var s registrySecret
	if err := json.Unmarshal(pt, &s); err != nil {
		return registrySecret{}, fmt.Errorf("decode registry secret: %w", err)
	}
	return s, nil
}

func loadRegistryFile() (registryFile, string, error) {
	p, err := registriesPathFunc()
	if err != nil {
		return registryFile{Registries: []registryFileEntry{}}, "", err
	}
	p = filepath.Clean(p)

	// #nosec G304 -- registry file is stored under the app data directory.
	b, err := os.ReadFile(p)
	if err != nil {
		if os.IsNotExist(err) {
			return registryFile{Registries: []registryFileEntry{}}, p, nil
		}
		return registryFile{Registries: []registryFileEntry{}}, p, err
	}

	var f registryFile
	if err := json.Unmarshal(b, &f); err != nil {
		return registryFile{Registries: []registryFileEntry{}}, p, err
	}
	if f.Registries == nil {
		f.Registries = []registryFileEntry{}
	}
	return f, p, nil
}

func saveRegistryFile(f registryFile, p string) error {
	if f.Registries == nil {
		f.Registries = []registryFileEntry{}
	}
	sort.SliceStable(f.Registries, func(i, j int) bool {
		return strings.ToLower(f.Registries[i].Name) < strings.ToLower(f.Registries[j].Name)
	})

	p = filepath.Clean(p)
	if err := os.MkdirAll(filepath.Dir(p), 0o750); err != nil {
		return err
	}
	b, err := json.MarshalIndent(f, "", "  ")
	if err != nil {
		return err
	}
	// #nosec G306 -- registry file can include encrypted credentials.
	return os.WriteFile(p, b, 0o600)
}

func toEntry(cfg RegistryConfig) (registryFileEntry, error) {
	name := strings.TrimSpace(cfg.Name)
	if name == "" {
		return registryFileEntry{}, fmt.Errorf("registry name is required")
	}
	if strings.TrimSpace(cfg.URL) == "" {
		return registryFileEntry{}, fmt.Errorf("registry url is required")
	}

	enc, err := encryptSecret(registrySecret{Password: cfg.Credentials.Password, Token: cfg.Credentials.Token})
	if err != nil {
		return registryFileEntry{}, err
	}

	entry := registryFileEntry{
		Name:                   name,
		URL:                    strings.TrimSpace(cfg.URL),
		Type:                   cfg.Type,
		Username:               strings.TrimSpace(cfg.Credentials.Username),
		Region:                 strings.TrimSpace(cfg.Credentials.Region),
		TimeoutSeconds:         cfg.TimeoutSeconds,
		InsecureSkipTLSVerify:  cfg.InsecureSkipTLSVerify,
		AllowInsecureHTTP:      cfg.AllowInsecureHTTP,
		DisableTLSVerification: cfg.DisableTLSVerification,
		EncryptedSecret:        enc,
	}
	return entry, nil
}

func (e registryFileEntry) toPublicConfig() RegistryConfig {
	return RegistryConfig{
		Name: e.Name,
		URL:  e.URL,
		Type: e.Type,
		Credentials: RegistryCredentials{
			Username: e.Username,
			Region:   e.Region,
		},
		TimeoutSeconds:         e.TimeoutSeconds,
		InsecureSkipTLSVerify:  e.InsecureSkipTLSVerify,
		AllowInsecureHTTP:      e.AllowInsecureHTTP,
		DisableTLSVerification: e.DisableTLSVerification,
	}
}

func (e registryFileEntry) toConfigWithCredentials() (RegistryConfig, error) {
	cfg := e.toPublicConfig()
	sec, err := decryptSecret(e.EncryptedSecret)
	if err != nil {
		return RegistryConfig{}, err
	}
	cfg.Credentials.Password = sec.Password
	cfg.Credentials.Token = sec.Token
	return cfg, nil
}

// SaveRegistry creates or updates a registry by name.
func SaveRegistry(cfg RegistryConfig) error {
	f, p, err := loadRegistryFile()
	if err != nil {
		return err
	}

	entry, err := toEntry(cfg)
	if err != nil {
		return err
	}

	updated := false
	for i := range f.Registries {
		if strings.EqualFold(f.Registries[i].Name, entry.Name) {
			f.Registries[i] = entry
			updated = true
			break
		}
	}
	if !updated {
		f.Registries = append(f.Registries, entry)
	}
	return saveRegistryFile(f, p)
}

// GetRegistries returns configured registries without decrypted credentials.
func GetRegistries() ([]RegistryConfig, error) {
	f, _, err := loadRegistryFile()
	if err != nil {
		return nil, err
	}
	out := make([]RegistryConfig, 0, len(f.Registries))
	for _, r := range f.Registries {
		out = append(out, r.toPublicConfig())
	}
	return out, nil
}

// GetRegistryWithCredentials returns a single registry config with decrypted credentials.
// This is intended for backend use (e.g., ListTags/GetDigest), not for returning to the UI.
func GetRegistryWithCredentials(name string) (RegistryConfig, error) {
	name = strings.TrimSpace(name)
	if name == "" {
		return RegistryConfig{}, fmt.Errorf("registry name is required")
	}

	f, _, err := loadRegistryFile()
	if err != nil {
		return RegistryConfig{}, err
	}
	for _, r := range f.Registries {
		if strings.EqualFold(r.Name, name) {
			return r.toConfigWithCredentials()
		}
	}
	return RegistryConfig{}, ErrRegistryNotFound
}

// DeleteRegistry removes a registry configuration by name.
func DeleteRegistry(name string) error {
	name = strings.TrimSpace(name)
	if name == "" {
		return fmt.Errorf("registry name is required")
	}

	f, p, err := loadRegistryFile()
	if err != nil {
		return err
	}

	out := f.Registries[:0]
	removed := false
	for _, r := range f.Registries {
		if strings.EqualFold(r.Name, name) {
			removed = true
			continue
		}
		out = append(out, r)
	}
	f.Registries = out
	if !removed {
		return ErrRegistryNotFound
	}
	return saveRegistryFile(f, p)
}

// TestConnection validates that the registry is reachable and credentials (if provided) are accepted.
// For generic v2 registries, this prefers /v2/_catalog (auth-gated on many registries) and falls back
// to the /v2/ ping endpoint if catalog is unsupported.
func TestConnection(ctx context.Context, cfg RegistryConfig) error {
	if ctx == nil {
		ctx = context.Background()
	}

	timeout := 10 * time.Second
	if cfg.TimeoutSeconds > 0 {
		timeout = time.Duration(cfg.TimeoutSeconds) * time.Second
	}
	ctx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	// Ping /v2/ to validate basic reachability (independent of catalog support).
	v2, err := NewV2Client(cfg)
	if err != nil {
		return err
	}
	_, _, pingErr := v2.do(ctx, "/v2/", nil, map[string]string{"Accept": "application/json"})
	if pingErr != nil {
		return pingErr
	}

	// Docker Hub does not support /v2/_catalog and is picky about repository naming.
	// Use a known public repo to validate that the registry auth handshake works.
	if cfg.Type == RegistryTypeDockerHub {
		_, err := v2.ListTags(ctx, "library/hello-world")
		if err == nil {
			return nil
		}
		msg := strings.ToLower(err.Error())
		if strings.Contains(msg, "unauthorized") || strings.Contains(msg, "authentication required") {
			return fmt.Errorf("registry authentication failed: %v", err)
		}
		return err
	}

	client, err := NewClient(cfg)
	if err != nil {
		return err
	}

	// Prefer /v2/_catalog as a credentials validation (many registries gate it behind auth).
	_, catErr := client.ListRepositories(ctx)
	if catErr == nil {
		return nil
	}

	// If the registry is reachable but doesn't support catalog listing, do a best-effort auth check by probing
	// tags for a non-existent repo. 404 implies reachable/auth OK. 401 implies auth failure.
	_, tagErr := client.ListTags(ctx, "__kdb_nonexistent_repo__")
	msg := strings.ToLower(catErr.Error())
	if strings.Contains(msg, "unauthorized") || strings.Contains(msg, "authentication required") {
		return fmt.Errorf("registry authentication failed: %v", catErr)
	}
	if tagErr == nil {
		return nil
	}
	msg2 := strings.ToLower(tagErr.Error())
	if strings.Contains(msg2, "unauthorized") || strings.Contains(msg2, "authentication required") {
		return fmt.Errorf("registry authentication failed: %v", tagErr)
	}

	// If both catalog + tag probes fail in non-auth ways, surface the catalog error.
	return catErr
}
