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

	out := make([]IngressTLSSummary, 0, len(ing.Spec.TLS))
	for _, tls := range ing.Spec.TLS {
		sum := IngressTLSSummary{Hosts: tls.Hosts, SecretName: tls.SecretName, NotBefore: "-", NotAfter: "-", DaysRemaining: 0}
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

		// tls.crt is typically PEM. Parse first certificate.
		var block *pem.Block
		rest := crt
		for {
			block, rest = pem.Decode(rest)
			if block == nil {
				break
			}
			if block.Type == "CERTIFICATE" {
				cert, err := x509.ParseCertificate(block.Bytes)
				if err != nil {
					sum.Error = fmt.Sprintf("parse cert: %v", err)
					break
				}
				now := time.Now()
				sum.NotBefore = cert.NotBefore.Format(time.RFC3339)
				sum.NotAfter = cert.NotAfter.Format(time.RFC3339)
				sum.DaysRemaining = int(cert.NotAfter.Sub(now).Hours() / 24)
				sum.Error = ""
				break
			}
		}

		if sum.Error == "" && sum.NotAfter == "-" {
			sum.Error = "no certificate found"
		}

		out = append(out, sum)
	}

	return out, nil
}
