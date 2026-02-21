package app

import (
	"context"
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/pem"
	"math/big"
	"testing"
	"time"

	corev1 "k8s.io/api/core/v1"
	networkingv1 "k8s.io/api/networking/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes/fake"
)

func generateTestCertificate(notBefore, notAfter time.Time) []byte {
	priv, _ := rsa.GenerateKey(rand.Reader, 2048)

	template := x509.Certificate{
		SerialNumber: big.NewInt(1),
		Subject: pkix.Name{
			Organization: []string{"Test Org"},
		},
		NotBefore:             notBefore,
		NotAfter:              notAfter,
		KeyUsage:              x509.KeyUsageKeyEncipherment | x509.KeyUsageDigitalSignature,
		ExtKeyUsage:           []x509.ExtKeyUsage{x509.ExtKeyUsageServerAuth},
		BasicConstraintsValid: true,
	}

	derBytes, _ := x509.CreateCertificate(rand.Reader, &template, &template, &priv.PublicKey, priv)

	return pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: derBytes})
}

func TestGetIngressTLSSummary_ReturnsCertInfo(t *testing.T) {
	ctx := context.Background()
	notBefore := time.Now().Add(-24 * time.Hour)
	notAfter := time.Now().Add(30 * 24 * time.Hour) // 30 days from now

	certPEM := generateTestCertificate(notBefore, notAfter)

	clientset := fake.NewSimpleClientset(
		&networkingv1.Ingress{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "my-ingress",
				Namespace: "default",
			},
			Spec: networkingv1.IngressSpec{
				TLS: []networkingv1.IngressTLS{
					{
						Hosts:      []string{"example.com"},
						SecretName: "tls-secret",
					},
				},
			},
		},
		&corev1.Secret{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "tls-secret",
				Namespace: "default",
			},
			Type: corev1.SecretTypeTLS,
			Data: map[string][]byte{
				"tls.crt": certPEM,
				"tls.key": []byte("fake-key"),
			},
		},
	)

	app := &App{ctx: ctx, testClientset: clientset}

	summaries, err := app.GetIngressTLSSummary("default", "my-ingress")
	if err != nil {
		t.Fatalf("GetIngressTLSSummary failed: %v", err)
	}

	if len(summaries) != 1 {
		t.Fatalf("expected 1 summary, got %d", len(summaries))
	}

	sum := summaries[0]
	if len(sum.Hosts) != 1 || sum.Hosts[0] != "example.com" {
		t.Errorf("expected hosts [example.com], got %v", sum.Hosts)
	}
	if sum.SecretName != "tls-secret" {
		t.Errorf("expected secret name tls-secret, got %s", sum.SecretName)
	}
	if sum.DaysRemaining < 29 || sum.DaysRemaining > 31 {
		t.Errorf("expected days remaining ~30, got %d", sum.DaysRemaining)
	}
	if sum.Error != "" {
		t.Errorf("expected no error, got %s", sum.Error)
	}
}

func TestGetIngressTLSSummary_EmptyNamespace(t *testing.T) {
	app := &App{ctx: context.Background()}

	_, err := app.GetIngressTLSSummary("", "my-ingress")
	if err == nil {
		t.Fatal("expected error for empty namespace")
	}
}

func TestGetIngressTLSSummary_EmptyIngressName(t *testing.T) {
	app := &App{ctx: context.Background()}

	_, err := app.GetIngressTLSSummary("default", "")
	if err == nil {
		t.Fatal("expected error for empty ingress name")
	}
}

func TestGetIngressTLSSummary_IngressNotFound(t *testing.T) {
	ctx := context.Background()
	clientset := fake.NewSimpleClientset()

	app := &App{ctx: ctx, testClientset: clientset}

	_, err := app.GetIngressTLSSummary("default", "nonexistent")
	if err == nil {
		t.Fatal("expected error for nonexistent ingress")
	}
}

func TestGetIngressTLSSummary_NoSecretName(t *testing.T) {
	ctx := context.Background()
	clientset := fake.NewSimpleClientset(
		&networkingv1.Ingress{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "my-ingress",
				Namespace: "default",
			},
			Spec: networkingv1.IngressSpec{
				TLS: []networkingv1.IngressTLS{
					{
						Hosts: []string{"example.com"},
						// No SecretName
					},
				},
			},
		},
	)

	app := &App{ctx: ctx, testClientset: clientset}

	summaries, err := app.GetIngressTLSSummary("default", "my-ingress")
	if err != nil {
		t.Fatalf("GetIngressTLSSummary failed: %v", err)
	}

	if len(summaries) != 1 {
		t.Fatalf("expected 1 summary, got %d", len(summaries))
	}

	if summaries[0].Error != "no secretName" {
		t.Errorf("expected error 'no secretName', got '%s'", summaries[0].Error)
	}
}

func TestGetIngressTLSSummary_SecretNotFound(t *testing.T) {
	ctx := context.Background()
	clientset := fake.NewSimpleClientset(
		&networkingv1.Ingress{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "my-ingress",
				Namespace: "default",
			},
			Spec: networkingv1.IngressSpec{
				TLS: []networkingv1.IngressTLS{
					{
						Hosts:      []string{"example.com"},
						SecretName: "missing-secret",
					},
				},
			},
		},
	)

	app := &App{ctx: ctx, testClientset: clientset}

	summaries, err := app.GetIngressTLSSummary("default", "my-ingress")
	if err != nil {
		t.Fatalf("GetIngressTLSSummary failed: %v", err)
	}

	if len(summaries) != 1 {
		t.Fatalf("expected 1 summary, got %d", len(summaries))
	}

	if summaries[0].Error == "" {
		t.Error("expected error for missing secret")
	}
}

func TestGetIngressTLSSummary_MissingTLSCrt(t *testing.T) {
	ctx := context.Background()
	clientset := fake.NewSimpleClientset(
		&networkingv1.Ingress{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "my-ingress",
				Namespace: "default",
			},
			Spec: networkingv1.IngressSpec{
				TLS: []networkingv1.IngressTLS{
					{
						Hosts:      []string{"example.com"},
						SecretName: "bad-secret",
					},
				},
			},
		},
		&corev1.Secret{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "bad-secret",
				Namespace: "default",
			},
			Data: map[string][]byte{
				"tls.key": []byte("key"),
				// No tls.crt
			},
		},
	)

	app := &App{ctx: ctx, testClientset: clientset}

	summaries, err := app.GetIngressTLSSummary("default", "my-ingress")
	if err != nil {
		t.Fatalf("GetIngressTLSSummary failed: %v", err)
	}

	if len(summaries) != 1 {
		t.Fatalf("expected 1 summary, got %d", len(summaries))
	}

	if summaries[0].Error != "secret missing tls.crt" {
		t.Errorf("expected error 'secret missing tls.crt', got '%s'", summaries[0].Error)
	}
}

func TestGetIngressTLSSummary_NoTLS(t *testing.T) {
	ctx := context.Background()
	clientset := fake.NewSimpleClientset(
		&networkingv1.Ingress{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "my-ingress",
				Namespace: "default",
			},
			Spec: networkingv1.IngressSpec{
				// No TLS
			},
		},
	)

	app := &App{ctx: ctx, testClientset: clientset}

	summaries, err := app.GetIngressTLSSummary("default", "my-ingress")
	if err != nil {
		t.Fatalf("GetIngressTLSSummary failed: %v", err)
	}

	if len(summaries) != 0 {
		t.Errorf("expected 0 summaries for ingress without TLS, got %d", len(summaries))
	}
}
