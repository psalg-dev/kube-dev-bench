package app

import (
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/pem"
	"errors"
	"fmt"
	"math/big"
	"os"
	"path/filepath"
	"testing"
	"time"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/rest"
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

// Tests for isCertError function
func TestIsCertError_Nil(t *testing.T) {
	result := isCertError(nil)
	if result {
		t.Error("isCertError(nil) should return false")
	}
}

func TestIsCertError_X509Error(t *testing.T) {
	tests := []struct {
		name     string
		errMsg   string
		expected bool
	}{
		{"x509 error", "x509: certificate signed by unknown authority", true},
		{"x509 expired", "x509: certificate has expired", true},
		{"x509 invalid", "x509: certificate is not valid", true},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			err := errors.New(tc.errMsg)
			result := isCertError(err)
			if result != tc.expected {
				t.Errorf("isCertError(%q) = %v, want %v", tc.errMsg, result, tc.expected)
			}
		})
	}
}

func TestIsCertError_CertificateKeyword(t *testing.T) {
	tests := []struct {
		name     string
		errMsg   string
		expected bool
	}{
		{"certificate in message", "the certificate is invalid", true},
		{"Certificate uppercase", "Certificate verification failed", true},
		{"CERTIFICATE uppercase", "CERTIFICATE error", true},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			err := errors.New(tc.errMsg)
			result := isCertError(err)
			if result != tc.expected {
				t.Errorf("isCertError(%q) = %v, want %v", tc.errMsg, result, tc.expected)
			}
		})
	}
}

func TestIsCertError_UnknownAuthority(t *testing.T) {
	tests := []struct {
		name     string
		errMsg   string
		expected bool
	}{
		{"unknown authority", "signed by unknown authority", true},
		{"unknown CA", "unknown authority for cert", true},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			err := errors.New(tc.errMsg)
			result := isCertError(err)
			if result != tc.expected {
				t.Errorf("isCertError(%q) = %v, want %v", tc.errMsg, result, tc.expected)
			}
		})
	}
}

func TestIsCertError_NonCertErrors(t *testing.T) {
	tests := []struct {
		name   string
		errMsg string
	}{
		{"connection refused", "connection refused"},
		{"timeout", "context deadline exceeded"},
		{"not found", "resource not found"},
		{"unauthorized", "unauthorized"},
		{"forbidden", "forbidden"},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			err := errors.New(tc.errMsg)
			result := isCertError(err)
			if result {
				t.Errorf("isCertError(%q) = true, want false", tc.errMsg)
			}
		})
	}
}

// Tests for isPermissionError function
func TestIsPermissionError(t *testing.T) {
	tests := []struct {
		name     string
		err      error
		expected bool
	}{
		{
			name:     "nil error",
			err:      nil,
			expected: false,
		},
		{
			name:     "generic error",
			err:      errors.New("connection refused"),
			expected: false,
		},
		{
			name:     "cert error is not permission",
			err:      errors.New("x509: certificate signed by unknown authority"),
			expected: false,
		},
		{
			name:     "forbidden string in error",
			err:      errors.New("namespaces is forbidden: User cannot list resource"),
			expected: true,
		},
		{
			name:     "unauthorized string",
			err:      errors.New("Unauthorized"),
			expected: true,
		},
		{
			name:     "Forbidden uppercase",
			err:      errors.New("Forbidden"),
			expected: true,
		},
		{
			name:     "wrapped forbidden",
			err:      fmt.Errorf("failed: %w", errors.New("forbidden access")),
			expected: true,
		},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got := isPermissionError(tc.err)
			if got != tc.expected {
				t.Errorf("isPermissionError(%v) = %v, want %v", tc.err, got, tc.expected)
			}
		})
	}
}

func TestIsPermissionError_StatusError(t *testing.T) {
	// k8s.io/apimachinery StatusError implements error interface
	statusErr := &apierrors.StatusError{
		ErrStatus: metav1.Status{
			Status:  metav1.StatusFailure,
			Code:    403,
			Reason:  metav1.StatusReasonForbidden,
			Message: "namespaces is forbidden: User cannot list resource",
		},
	}
	if !isPermissionError(statusErr) {
		t.Error("isPermissionError should return true for Forbidden StatusError")
	}

	unauthorizedErr := &apierrors.StatusError{
		ErrStatus: metav1.Status{
			Status:  metav1.StatusFailure,
			Code:    401,
			Reason:  metav1.StatusReasonUnauthorized,
			Message: "Unauthorized",
		},
	}
	if !isPermissionError(unauthorizedErr) {
		t.Error("isPermissionError should return true for Unauthorized StatusError")
	}
}

func TestIsAuthDiscoveryRecoverableError(t *testing.T) {
	tests := []struct {
		name     string
		err      error
		expected bool
	}{
		{name: "nil", err: nil, expected: false},
		{name: "generic network error", err: errors.New("connection refused"), expected: false},
		{name: "auth provider missing", err: errors.New("No Auth Provider found for name oidc"), expected: true},
		{name: "oidc refresh token missing", err: errors.New("oidc: no valid id-token, and cannot refresh without refresh token"), expected: true},
		{name: "k8s logged in prompt", err: errors.New("You must be logged in to the server"), expected: true},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got := isAuthDiscoveryRecoverableError(tc.err)
			if got != tc.expected {
				t.Errorf("isAuthDiscoveryRecoverableError(%v) = %v, want %v", tc.err, got, tc.expected)
			}
		})
	}
}

func TestApplyCustomCA_NoPath(t *testing.T) {
	a := &App{customCAPath: ""}
	rc := &rest.Config{}
	if err := a.applyCustomCA(rc); err != nil {
		t.Fatalf("applyCustomCA with empty path should not error, got: %v", err)
	}
	if len(rc.TLSClientConfig.CAData) != 0 {
		t.Error("CAData should remain empty when no custom CA path is set")
	}
}

func TestApplyCustomCA_ValidFile(t *testing.T) {
	dir := t.TempDir()
	caFile := filepath.Join(dir, "ca.crt")
	if err := os.WriteFile(caFile, generateTestCAPEM(t), 0o600); err != nil {
		t.Fatal(err)
	}

	a := &App{customCAPath: caFile}
	rc := &rest.Config{}
	if err := a.applyCustomCA(rc); err != nil {
		t.Fatalf("applyCustomCA should succeed with valid PEM, got: %v", err)
	}
	if len(rc.TLSClientConfig.CAData) == 0 {
		t.Error("CAData should be populated after applyCustomCA")
	}
	if rc.TLSClientConfig.CAFile != "" {
		t.Error("CAFile should be cleared after applyCustomCA")
	}
}

func TestApplyCustomCA_MergesExistingCAData(t *testing.T) {
	dir := t.TempDir()
	caFile := filepath.Join(dir, "ca.crt")
	if err := os.WriteFile(caFile, generateTestCAPEM(t), 0o600); err != nil {
		t.Fatal(err)
	}

	existingCA := []byte("-----BEGIN CERTIFICATE-----\nexisting\n-----END CERTIFICATE-----\n")
	a := &App{customCAPath: caFile}
	rc := &rest.Config{
		TLSClientConfig: rest.TLSClientConfig{
			CAData: existingCA,
		},
	}
	if err := a.applyCustomCA(rc); err != nil {
		t.Fatalf("applyCustomCA should succeed, got: %v", err)
	}
	if len(rc.TLSClientConfig.CAData) <= len(existingCA) {
		t.Error("CAData should contain merged data (existing + custom)")
	}
}

func TestApplyCustomCA_MergesExistingCAFile(t *testing.T) {
	dir := t.TempDir()
	customCAFile := filepath.Join(dir, "custom-ca.crt")
	existingCAFile := filepath.Join(dir, "existing-ca.crt")
	if err := os.WriteFile(customCAFile, generateTestCAPEM(t), 0o600); err != nil {
		t.Fatal(err)
	}
	existingContent := []byte("-----BEGIN CERTIFICATE-----\nexistingfile\n-----END CERTIFICATE-----\n")
	if err := os.WriteFile(existingCAFile, existingContent, 0o600); err != nil {
		t.Fatal(err)
	}

	a := &App{customCAPath: customCAFile}
	rc := &rest.Config{
		TLSClientConfig: rest.TLSClientConfig{
			CAFile: existingCAFile,
		},
	}
	if err := a.applyCustomCA(rc); err != nil {
		t.Fatalf("applyCustomCA should succeed, got: %v", err)
	}
	if rc.TLSClientConfig.CAFile != "" {
		t.Error("CAFile should be cleared after merge")
	}
	if len(rc.TLSClientConfig.CAData) == 0 {
		t.Error("CAData should be populated with merged content")
	}
}

func TestApplyCustomCA_FileNotFound(t *testing.T) {
	a := &App{customCAPath: "/nonexistent/ca.crt"}
	rc := &rest.Config{}
	err := a.applyCustomCA(rc)
	if err == nil {
		t.Fatal("applyCustomCA should error for nonexistent file")
	}
}

func TestApplyCustomCA_InvalidPEM(t *testing.T) {
	dir := t.TempDir()
	caFile := filepath.Join(dir, "bad.crt")
	if err := os.WriteFile(caFile, []byte("not a valid PEM file"), 0o600); err != nil {
		t.Fatal(err)
	}

	a := &App{customCAPath: caFile}
	rc := &rest.Config{}
	err := a.applyCustomCA(rc)
	if err == nil {
		t.Fatal("applyCustomCA should error for invalid PEM content")
	}
}

func TestSetCustomCAPath_Empty(t *testing.T) {
	dir := t.TempDir()
	a := &App{
		configPath: filepath.Join(dir, "config.json"),
	}
	if err := a.SetCustomCAPath(""); err != nil {
		t.Fatalf("SetCustomCAPath('') should succeed, got: %v", err)
	}
	if a.customCAPath != "" {
		t.Error("customCAPath should be empty after clearing")
	}
}

func TestSetCustomCAPath_ValidFile(t *testing.T) {
	dir := t.TempDir()
	caFile := filepath.Join(dir, "ca.crt")
	if err := os.WriteFile(caFile, generateTestCAPEM(t), 0o600); err != nil {
		t.Fatal(err)
	}

	a := &App{
		configPath: filepath.Join(dir, "config.json"),
	}
	if err := a.SetCustomCAPath(caFile); err != nil {
		t.Fatalf("SetCustomCAPath should succeed, got: %v", err)
	}
	if a.customCAPath != caFile {
		t.Errorf("customCAPath = %q, want %q", a.customCAPath, caFile)
	}
}

func TestSetCustomCAPath_FileNotFound(t *testing.T) {
	dir := t.TempDir()
	a := &App{
		configPath: filepath.Join(dir, "config.json"),
	}
	err := a.SetCustomCAPath("/nonexistent/ca.crt")
	if err == nil {
		t.Fatal("SetCustomCAPath should error for nonexistent file")
	}
}

// --- Gap 2/5: extractExecBinaryFromError ---

func TestExtractExecBinaryFromError_ExecFileNotFound(t *testing.T) {
	tests := []struct {
		name     string
		err      error
		expected string
	}{
		{
			name:     "kubelogin not found",
			err:      errors.New(`exec: "kubelogin": executable file not found in $PATH`),
			expected: "kubelogin",
		},
		{
			name:     "aws-iam-authenticator not found",
			err:      errors.New(`"aws-iam-authenticator": executable file not found in %PATH%`),
			expected: "aws-iam-authenticator",
		},
		{
			name:     "gke-gcloud-auth-plugin not found",
			err:      errors.New(`exec: "gke-gcloud-auth-plugin": executable file not found`),
			expected: "gke-gcloud-auth-plugin",
		},
		{
			name:     "non-exec error",
			err:      errors.New("connection refused"),
			expected: "",
		},
		{
			name:     "nil error",
			err:      nil,
			expected: "",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got := extractExecBinaryFromError(tc.err)
			if got != tc.expected {
				t.Errorf("extractExecBinaryFromError(%v) = %q, want %q", tc.err, got, tc.expected)
			}
		})
	}
}

// --- Gap 6: isProxyAuthRequired ---

func TestIsProxyAuthRequired(t *testing.T) {
	tests := []struct {
		name     string
		err      error
		expected bool
	}{
		{name: "nil error", err: nil, expected: false},
		{name: "407 status code", err: errors.New("proxyconnect tcp: dial tcp: lookup proxy: 407 Proxy Authentication Required"), expected: true},
		{name: "proxy authentication required", err: errors.New("proxy authentication required"), expected: true},
		{name: "proxy-authenticate header", err: errors.New("server returned Proxy-Authenticate: NTLM"), expected: true},
		{name: "normal error", err: errors.New("connection refused"), expected: false},
		{name: "403 forbidden is not proxy auth", err: errors.New("forbidden"), expected: false},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got := isProxyAuthRequired(tc.err)
			if got != tc.expected {
				t.Errorf("isProxyAuthRequired(%v) = %v, want %v", tc.err, got, tc.expected)
			}
		})
	}
}

// --- Gap 2: extractHostFromRESTConfig ---

func TestExtractHostFromRESTConfig(t *testing.T) {
	tests := []struct {
		name     string
		host     string
		expected string
	}{
		{name: "https URL", host: "https://api.prod.example.com:6443", expected: "api.prod.example.com"},
		{name: "http URL", host: "http://localhost:8080", expected: "localhost"},
		{name: "plain host", host: "api.example.com", expected: "api.example.com"},
		{name: "nil config", host: "", expected: "unknown"},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			var got string
			if tc.host == "" && tc.name == "nil config" {
				got = extractHostFromRESTConfig(nil)
			} else {
				got = extractHostFromRESTConfig(&rest.Config{Host: tc.host})
			}
			if got != tc.expected {
				t.Errorf("extractHostFromRESTConfig(Host=%q) = %q, want %q", tc.host, got, tc.expected)
			}
		})
	}
}

// --- Gap 4: loadKubeconfig with multiple paths ---

func TestLoadKubeconfig_MergesMultiplePaths(t *testing.T) {
	dir := t.TempDir()

	// Create two kubeconfig files with different contexts
	kc1 := filepath.Join(dir, "kc1.yaml")
	kc2 := filepath.Join(dir, "kc2.yaml")

	kc1Content := `apiVersion: v1
kind: Config
contexts:
- name: cluster-a
  context:
    cluster: cluster-a
    user: user-a
clusters:
- name: cluster-a
  cluster:
    server: https://a.example.com:6443
users:
- name: user-a
  user:
    token: fake-token-a
current-context: cluster-a
`
	kc2Content := `apiVersion: v1
kind: Config
contexts:
- name: cluster-b
  context:
    cluster: cluster-b
    user: user-b
clusters:
- name: cluster-b
  cluster:
    server: https://b.example.com:6443
users:
- name: user-b
  user:
    token: fake-token-b
current-context: cluster-b
`
	if err := os.WriteFile(kc1, []byte(kc1Content), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(kc2, []byte(kc2Content), 0o600); err != nil {
		t.Fatal(err)
	}

	a := &App{
		kubeconfigPaths: []string{kc1, kc2},
	}

	cfg, err := a.loadKubeconfig()
	if err != nil {
		t.Fatalf("loadKubeconfig with merged paths should succeed, got: %v", err)
	}

	if len(cfg.Contexts) != 2 {
		t.Errorf("expected 2 contexts, got %d", len(cfg.Contexts))
	}
	if _, ok := cfg.Contexts["cluster-a"]; !ok {
		t.Error("expected context 'cluster-a' in merged config")
	}
	if _, ok := cfg.Contexts["cluster-b"]; !ok {
		t.Error("expected context 'cluster-b' in merged config")
	}
}

func TestLoadKubeconfig_SingleFile(t *testing.T) {
	dir := t.TempDir()
	kc := filepath.Join(dir, "config")
	kcContent := `apiVersion: v1
kind: Config
contexts:
- name: test
  context:
    cluster: test
    user: test
clusters:
- name: test
  cluster:
    server: https://test.example.com:6443
users:
- name: test
  user:
    token: fake
current-context: test
`
	if err := os.WriteFile(kc, []byte(kcContent), 0o600); err != nil {
		t.Fatal(err)
	}

	a := &App{kubeConfig: kc}

	cfg, err := a.loadKubeconfig()
	if err != nil {
		t.Fatalf("loadKubeconfig single file should succeed, got: %v", err)
	}
	if len(cfg.Contexts) != 1 {
		t.Errorf("expected 1 context, got %d", len(cfg.Contexts))
	}
}

// Suppress unused import warnings
var _ = schema.GroupResource{}
