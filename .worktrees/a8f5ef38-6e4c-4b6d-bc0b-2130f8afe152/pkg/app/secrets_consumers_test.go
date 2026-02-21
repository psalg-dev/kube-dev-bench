package app

import (
	"context"
	"testing"

	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes/fake"
)

func TestGetSecretConsumers(t *testing.T) {
	clientset := fake.NewSimpleClientset()

	_, err := clientset.CoreV1().Secrets("default").Create(context.Background(), &corev1.Secret{
		ObjectMeta: metav1.ObjectMeta{Name: "s1", Namespace: "default"},
		Data:       map[string][]byte{"k": []byte("v")},
	}, metav1.CreateOptions{})
	if err != nil {
		t.Fatalf("failed to create secret: %v", err)
	}

	// Pod consumes via volume
	_, err = clientset.CoreV1().Pods("default").Create(context.Background(), &corev1.Pod{
		ObjectMeta: metav1.ObjectMeta{Name: "p1", Namespace: "default"},
		Spec: corev1.PodSpec{
			Volumes:    []corev1.Volume{{Name: "sec", VolumeSource: corev1.VolumeSource{Secret: &corev1.SecretVolumeSource{SecretName: "s1"}}}},
			Containers: []corev1.Container{{Name: "c", Image: "busybox"}},
		},
	}, metav1.CreateOptions{})
	if err != nil {
		t.Fatalf("failed to create pod: %v", err)
	}

	// Deployment consumes via envFrom
	_, err = clientset.AppsV1().Deployments("default").Create(context.Background(), &appsv1.Deployment{
		ObjectMeta: metav1.ObjectMeta{Name: "d1", Namespace: "default"},
		Spec: appsv1.DeploymentSpec{
			Selector: &metav1.LabelSelector{MatchLabels: map[string]string{"app": "d1"}},
			Template: corev1.PodTemplateSpec{
				ObjectMeta: metav1.ObjectMeta{Labels: map[string]string{"app": "d1"}},
				Spec: corev1.PodSpec{Containers: []corev1.Container{{
					Name:  "c",
					Image: "busybox",
					EnvFrom: []corev1.EnvFromSource{{
						SecretRef: &corev1.SecretEnvSource{LocalObjectReference: corev1.LocalObjectReference{Name: "s1"}},
					}},
				}}},
			},
		},
	}, metav1.CreateOptions{})
	if err != nil {
		t.Fatalf("failed to create deployment: %v", err)
	}

	app := &App{ctx: context.Background(), testClientset: clientset}
	consumers, err := app.GetSecretConsumers("default", "s1")
	if err != nil {
		t.Fatalf("GetSecretConsumers failed: %v", err)
	}
	if len(consumers) != 2 {
		t.Fatalf("expected 2 consumers, got %d: %+v", len(consumers), consumers)
	}

	var foundPod, foundDep bool
	for _, c := range consumers {
		if c.Kind == "Pod" && c.Name == "p1" {
			foundPod = true
		}
		if c.Kind == "Deployment" && c.Name == "d1" {
			foundDep = true
		}
	}
	if !foundPod || !foundDep {
		t.Fatalf("expected both pod and deployment consumers, got %+v", consumers)
	}
}

func TestUpdateSecretDataKey(t *testing.T) {
	clientset := fake.NewSimpleClientset()
	_, err := clientset.CoreV1().Secrets("default").Create(context.Background(), &corev1.Secret{
		ObjectMeta: metav1.ObjectMeta{Name: "s1", Namespace: "default"},
		Data:       map[string][]byte{"a": []byte("1")},
	}, metav1.CreateOptions{})
	if err != nil {
		t.Fatalf("failed to create secret: %v", err)
	}

	app := &App{ctx: context.Background(), testClientset: clientset}
	if err := app.UpdateSecretDataKey("default", "s1", "a", "2"); err != nil {
		t.Fatalf("UpdateSecretDataKey failed: %v", err)
	}
	sec, err := clientset.CoreV1().Secrets("default").Get(context.Background(), "s1", metav1.GetOptions{})
	if err != nil {
		t.Fatalf("failed to get secret: %v", err)
	}
	if string(sec.Data["a"]) != "2" {
		t.Fatalf("expected key updated to '2', got %q", string(sec.Data["a"]))
	}
}
