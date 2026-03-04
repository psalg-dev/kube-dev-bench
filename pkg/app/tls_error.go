package app

import "fmt"

// ErrTLSCertVerification is returned when the cluster probe fails with a TLS
// certificate verification error. The frontend should present the user with
// options to add a CA certificate or explicitly opt into an insecure connection.
type ErrTLSCertVerification struct {
	Host string
	Err  error
}

func (e *ErrTLSCertVerification) Error() string {
	return fmt.Sprintf("TLS certificate verification failed for %s: %v", e.Host, e.Err)
}

func (e *ErrTLSCertVerification) Unwrap() error { return e.Err }
