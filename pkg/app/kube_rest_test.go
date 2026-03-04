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

// Suppress unused import warnings
var _ = schema.GroupResource{}
