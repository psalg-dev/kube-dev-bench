package registry

import (
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/pem"
	"math/big"
	"net/http"
	"os"
	"path/filepath"
	"testing"
	"time"
)

// generateTestCAPEM creates a real self-signed CA certificate PEM for tests.
func generateTestCAPEM(t *testing.T) []byte {
	t.Helper()
	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		t.Fatalf("generate key: %v", err)
	}
	tmpl := &x509.Certificate{
		SerialNumber:          big.NewInt(1),
		Subject:               pkix.Name{CommonName: "Test CA"},
		NotBefore:             time.Now().Add(-time.Hour),
		NotAfter:              time.Now().Add(24 * time.Hour),
		KeyUsage:              x509.KeyUsageCertSign | x509.KeyUsageCRLSign,
		BasicConstraintsValid: true,
		IsCA:                  true,
	}
	der, err := x509.CreateCertificate(rand.Reader, tmpl, tmpl, &key.PublicKey, key)
	if err != nil {
		t.Fatalf("create certificate: %v", err)
	}
	return pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: der})
}

func TestNewV2Client_CustomCACert_ValidFile(t *testing.T) {
	dir := t.TempDir()
	caFile := filepath.Join(dir, "ca.crt")
	if err := os.WriteFile(caFile, generateTestCAPEM(t), 0o600); err != nil {
		t.Fatal(err)
	}

	cli, err := NewV2Client(RegistryConfig{
		URL:          "https://registry.example.com",
		Type:         RegistryTypeGenericV2,
		CustomCACert: caFile,
	})
	if err != nil {
		t.Fatalf("NewV2Client should succeed with valid custom CA, got: %v", err)
	}
	if cli == nil {
		t.Fatal("expected non-nil client")
	}
	// Verify the transport has custom TLS config with RootCAs set
	tr, ok := cli.httpClient.Transport.(*http.Transport)
	if !ok {
		t.Fatal("expected *http.Transport")
	}
	if tr.TLSClientConfig == nil || tr.TLSClientConfig.RootCAs == nil {
		t.Error("TLS RootCAs should be set when custom CA is provided")
	}
}

func TestNewV2Client_CustomCACert_FileNotFound(t *testing.T) {
	_, err := NewV2Client(RegistryConfig{
		URL:          "https://registry.example.com",
		Type:         RegistryTypeGenericV2,
		CustomCACert: "/nonexistent/ca.crt",
	})
	if err == nil {
		t.Fatal("NewV2Client should error for nonexistent custom CA file")
	}
}

func TestNewV2Client_CustomCACert_InvalidPEM(t *testing.T) {
	dir := t.TempDir()
	caFile := filepath.Join(dir, "bad.crt")
	if err := os.WriteFile(caFile, []byte("not-valid-pem"), 0o600); err != nil {
		t.Fatal(err)
	}

	_, err := NewV2Client(RegistryConfig{
		URL:          "https://registry.example.com",
		Type:         RegistryTypeGenericV2,
		CustomCACert: caFile,
	})
	if err == nil {
		t.Fatal("NewV2Client should error for invalid PEM content")
	}
}

func TestNewV2Client_CustomCACert_Empty(t *testing.T) {
	// When no custom CA is provided, client should still work fine
	cli, err := NewV2Client(RegistryConfig{
		URL:          "https://registry.example.com",
		Type:         RegistryTypeGenericV2,
		CustomCACert: "",
	})
	if err != nil {
		t.Fatalf("NewV2Client should succeed without custom CA, got: %v", err)
	}
	tr, ok := cli.httpClient.Transport.(*http.Transport)
	if !ok {
		t.Fatal("expected *http.Transport")
	}
	// RootCAs should be nil (using system default) when no custom CA
	if tr.TLSClientConfig != nil && tr.TLSClientConfig.RootCAs != nil {
		t.Error("RootCAs should be nil when no custom CA is provided")
	}
}
