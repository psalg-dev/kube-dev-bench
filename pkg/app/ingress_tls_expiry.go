package app

import (
	"crypto/x509"
	"encoding/pem"
	"fmt"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

type IngressTLSSummary struct {
	Hosts         []string `json:"hosts"`
	SecretName    string   `json:"secretName"`
	NotBefore     string   `json:"notBefore"`
	NotAfter      string   `json:"notAfter"`
	DaysRemaining int      `json:"daysRemaining"`
	Error         string   `json:"error,omitempty"`
}

// parseCertificateExpiry extracts certificate expiry info from PEM-encoded data
func parseCertificateExpiry(crt []byte, now time.Time) (notBefore, notAfter string, daysRemaining int, err string) {
	rest := crt
	for {
		block, remaining := pem.Decode(rest)
		if block == nil {
			break
		}
		rest = remaining
		if block.Type == "CERTIFICATE" {
			cert, parseErr := x509.ParseCertificate(block.Bytes)
			if parseErr != nil {
				return "-", "-", 0, fmt.Sprintf("parse cert: %v", parseErr)
			}
			return cert.NotBefore.Format(time.RFC3339), cert.NotAfter.Format(time.RFC3339),
				int(cert.NotAfter.Sub(now).Hours() / 24), ""
		}
	}
	return "-", "-", 0, "no certificate found"
}

// GetIngressTLSSummary returns TLS secret expiry info (best-effort) for an Ingress.
func (a *App) GetIngressTLSSummary(namespace, ingressName string) ([]IngressTLSSummary, error) {
	if namespace == "" {
		return nil, fmt.Errorf("namespace is required")
	}
	if ingressName == "" {
		return nil, fmt.Errorf("ingress name is required")
	}

	clientset, err := a.getKubernetesInterface()
	if err != nil {
		return nil, err
	}

	ing, err := clientset.NetworkingV1().Ingresses(namespace).Get(a.ctx, ingressName, metav1.GetOptions{})
	if err != nil {
		return nil, err
	}

	now := time.Now()
	out := make([]IngressTLSSummary, 0, len(ing.Spec.TLS))
	for _, tls := range ing.Spec.TLS {
		sum := IngressTLSSummary{Hosts: tls.Hosts, SecretName: tls.SecretName, NotBefore: "-", NotAfter: "-"}
		if tls.SecretName == "" {
			sum.Error = "no secretName"
			out = append(out, sum)
			continue
		}

		sec, err := clientset.CoreV1().Secrets(namespace).Get(a.ctx, tls.SecretName, metav1.GetOptions{})
		if err != nil {
			sum.Error = err.Error()
			out = append(out, sum)
			continue
		}

		crt := sec.Data["tls.crt"]
		if len(crt) == 0 {
			sum.Error = "secret missing tls.crt"
			out = append(out, sum)
			continue
		}

		sum.NotBefore, sum.NotAfter, sum.DaysRemaining, sum.Error = parseCertificateExpiry(crt, now)
		out = append(out, sum)
	}

	return out, nil
}
