package app

import (
	"errors"
	"fmt"
	"testing"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

func TestIsRBACForbidden(t *testing.T) {
	tests := []struct {
		name     string
		err      error
		expected bool
	}{
		{name: "nil", err: nil, expected: false},
		{name: "generic error", err: errors.New("connection refused"), expected: false},
		{name: "unauthorized is not forbidden", err: errors.New("Unauthorized"), expected: false},
		{name: "forbidden string", err: errors.New("namespaces is forbidden: User cannot list resource"), expected: true},
		{name: "Forbidden uppercase", err: errors.New("Forbidden"), expected: true},
		{name: "wrapped forbidden", err: fmt.Errorf("failed: %w", errors.New("forbidden access")), expected: true},
		{
			name: "API 403 StatusError",
			err: &apierrors.StatusError{
				ErrStatus: metav1.Status{
					Status: metav1.StatusFailure,
					Code:   403,
					Reason: metav1.StatusReasonForbidden,
				},
			},
			expected: true,
		},
		{
			name: "API 401 StatusError is not forbidden",
			err: &apierrors.StatusError{
				ErrStatus: metav1.Status{
					Status: metav1.StatusFailure,
					Code:   401,
					Reason: metav1.StatusReasonUnauthorized,
				},
			},
			expected: false,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got := isRBACForbidden(tc.err)
			if got != tc.expected {
				t.Errorf("isRBACForbidden(%v) = %v, want %v", tc.err, got, tc.expected)
			}
		})
	}
}

func TestIsUnauthenticated(t *testing.T) {
	tests := []struct {
		name     string
		err      error
		expected bool
	}{
		{name: "nil", err: nil, expected: false},
		{name: "generic error", err: errors.New("connection refused"), expected: false},
		{name: "forbidden is not unauthenticated", err: errors.New("Forbidden"), expected: false},
		{name: "unauthorized string", err: errors.New("Unauthorized"), expected: true},
		{name: "unauthenticated string", err: errors.New("unauthenticated request"), expected: true},
		{name: "wrapped unauthorized", err: fmt.Errorf("failed: %w", errors.New("unauthorized")), expected: true},
		{
			name: "API 401 StatusError",
			err: &apierrors.StatusError{
				ErrStatus: metav1.Status{
					Status: metav1.StatusFailure,
					Code:   401,
					Reason: metav1.StatusReasonUnauthorized,
				},
			},
			expected: true,
		},
		{
			name: "API 403 StatusError is not unauthenticated",
			err: &apierrors.StatusError{
				ErrStatus: metav1.Status{
					Status: metav1.StatusFailure,
					Code:   403,
					Reason: metav1.StatusReasonForbidden,
				},
			},
			expected: false,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got := isUnauthenticated(tc.err)
			if got != tc.expected {
				t.Errorf("isUnauthenticated(%v) = %v, want %v", tc.err, got, tc.expected)
			}
		})
	}
}

func TestErrAuthExpired_ErrorMessage(t *testing.T) {
	innerErr := errors.New("token expired")
	e := &ErrAuthExpired{Context: "prod-cluster", Err: innerErr}

	msg := e.Error()
	if msg == "" {
		t.Fatal("Error() should return a non-empty message")
	}
	if e.Unwrap() != innerErr {
		t.Error("Unwrap() should return the inner error")
	}
}

func TestErrExecBinaryNotFound_ErrorMessage(t *testing.T) {
	innerErr := errors.New("executable file not found")
	e := &ErrExecBinaryNotFound{Binary: "kubelogin", Err: innerErr}

	msg := e.Error()
	if msg == "" {
		t.Fatal("Error() should return a non-empty message")
	}
	if e.Unwrap() != innerErr {
		t.Error("Unwrap() should return the inner error")
	}
}

func TestHandleUnauthenticated_Debounce(t *testing.T) {
	// disableWailsEvents is already set to true by TestMain.
	// Do NOT reset it here — leaked goroutines from other tests depend on it.

	a := &App{}
	// First call should proceed
	a.handleUnauthenticated("test-context")

	// Second call within debounce window should be a no-op (no panic)
	a.handleUnauthenticated("test-context")
}
