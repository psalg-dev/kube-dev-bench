package app

import (
	"errors"
	"testing"
)

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
