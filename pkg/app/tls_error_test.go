package app

import (
	"errors"
	"testing"
)

func TestErrTLSCertVerification_ErrorMessage(t *testing.T) {
	innerErr := errors.New("x509: certificate signed by unknown authority")
	e := &ErrTLSCertVerification{Host: "api.prod.example.com", Err: innerErr}

	msg := e.Error()
	if msg == "" {
		t.Fatal("Error() should return a non-empty message")
	}
	if !errors.Is(e, innerErr) {
		t.Error("errors.Is should match inner error via Unwrap")
	}
	if e.Unwrap() != innerErr {
		t.Error("Unwrap() should return the inner error")
	}
}

func TestErrTLSCertVerification_Unwrap(t *testing.T) {
	inner := errors.New("cert error")
	e := &ErrTLSCertVerification{Host: "test", Err: inner}

	var target *ErrTLSCertVerification
	if !errors.As(e, &target) {
		t.Error("errors.As should match *ErrTLSCertVerification")
	}
	if target.Host != "test" {
		t.Errorf("Host = %q, want %q", target.Host, "test")
	}
}
