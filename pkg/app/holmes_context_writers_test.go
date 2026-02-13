package app

import (
	"context"
	"fmt"
	"strings"
	"testing"
	"time"

	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	networkingv1 "k8s.io/api/networking/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes/fake"
)

func TestAppendRecentEvents_WritesLines(t *testing.T) {
	previous := disableWailsEvents
	disableWailsEvents = true
	t.Cleanup(func() { disableWailsEvents = previous })

	cs := fake.NewSimpleClientset(
		&corev1.Event{
			ObjectMeta:     metav1.ObjectMeta{Name: "e1", Namespace: "default"},
			InvolvedObject: corev1.ObjectReference{Kind: "Deployment", Name: "web"},
			Reason:         "Started",
			Message:        "pod created",
			LastTimestamp:  metav1.NewTime(time.Now().Add(-30 * time.Second)),
		},
		&corev1.Event{
			ObjectMeta:     metav1.ObjectMeta{Name: "e2", Namespace: "default"},
			InvolvedObject: corev1.ObjectReference{Kind: "Deployment", Name: "web"},
			Reason:         "Scaled",
			Message:        "replicas increased",
			EventTime:      metav1.MicroTime{Time: time.Now()},
		},
	)

	var sb strings.Builder
	ctx := context.Background()
	appendRecentEvents(ctx, &sb, cs.CoreV1().Events("default"), "web", "Deployment")
	out := sb.String()
	if !strings.Contains(out, "Recent Events (last 10)") {
		t.Fatalf("expected header, got: %s", out)
	}
	if !strings.Contains(out, "Started") || !strings.Contains(out, "Scaled") {
		t.Fatalf("expected reasons present, got: %s", out)
	}
}

func TestWriteConditionsHelpers_DeploymentStatefulDaemon(t *testing.T) {
	var sb strings.Builder
	writeDeploymentConditions(&sb, []appsv1.DeploymentCondition{{Type: "Available", Status: "True", Message: "ok"}})
	writeStatefulSetConditions(&sb, []appsv1.StatefulSetCondition{{Type: "Ready", Status: "True", Message: "ok"}})
	writeDaemonSetConditions(&sb, []appsv1.DaemonSetCondition{{Type: "Progressing", Status: "True", Message: "rolling"}})
	out := sb.String()
	for _, want := range []string{"Conditions:", "Available: True", "Ready: True", "Progressing: True"} {
		if !strings.Contains(out, want) {
			t.Fatalf("conditions output missing %q: %s", want, out)
		}
	}
}

func TestIngressContextWriters(t *testing.T) {
	var sb strings.Builder
	writeIngressTLSContext(&sb, []networkingv1.IngressTLS{{SecretName: "tls", Hosts: []string{"example.com"}}})
	rule := networkingv1.IngressRule{
		Host: "example.com",
		IngressRuleValue: networkingv1.IngressRuleValue{
			HTTP: &networkingv1.HTTPIngressRuleValue{
				Paths: []networkingv1.HTTPIngressPath{
					{
						Path: "/",
						Backend: networkingv1.IngressBackend{
							Service: &networkingv1.IngressServiceBackend{
								Name: "svc",
								Port: networkingv1.ServiceBackendPort{Number: 80},
							},
						},
					},
				},
			},
		},
	}
	writeIngressRuleContext(&sb, rule)
	writeIngressLoadBalancerContext(&sb, []networkingv1.IngressLoadBalancerIngress{{IP: "1.2.3.4"}, {Hostname: "lb.example"}})
	out := sb.String()
	for _, want := range []string{"TLS Configuration:", "Secret: tls", "Host: example.com", "-> svc:80", "Load Balancer Status:", "IP: 1.2.3.4", "Hostname: lb.example"} {
		if !strings.Contains(out, want) {
			t.Fatalf("ingress output missing %q: %s", want, out)
		}
	}
}

func TestGetRecentPodLogs_ErrorWrapped(t *testing.T) {
	app := &App{testPodLogsFetcher: func(ns, pod, c string, lines int) (string, error) { return "", fmt.Errorf("boom") }}
	out := app.getRecentPodLogs("default", "p1", 50)
	if !strings.HasPrefix(out, "(Failed to fetch logs:") {
		t.Fatalf("expected error wrapper, got: %s", out)
	}
}
