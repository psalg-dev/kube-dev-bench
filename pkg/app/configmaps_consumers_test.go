package app

import (
	"context"
	"testing"

	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes/fake"
)

func TestGetConfigMapConsumers(t *testing.T) {
	clientset := fake.NewClientset()

	// ConfigMap
	_, err := clientset.CoreV1().ConfigMaps("default").Create(context.Background(), &corev1.ConfigMap{
		ObjectMeta: metav1.ObjectMeta{Name: "cm1", Namespace: "default"},
		Data:       map[string]string{"k": "v"},
	}, metav1.CreateOptions{})
	if err != nil {
		t.Fatalf("failed to create configmap: %v", err)
	}

	// Pod consumes via envFrom
	_, err = clientset.CoreV1().Pods("default").Create(context.Background(), &corev1.Pod{
		ObjectMeta: metav1.ObjectMeta{Name: "p1", Namespace: "default"},
		Spec: corev1.PodSpec{Containers: []corev1.Container{{
			Name:  "c",
			Image: "busybox",
			EnvFrom: []corev1.EnvFromSource{{
				ConfigMapRef: &corev1.ConfigMapEnvSource{LocalObjectReference: corev1.LocalObjectReference{Name: "cm1"}},
			}},
		}}},
	}, metav1.CreateOptions{})
	if err != nil {
		t.Fatalf("failed to create pod: %v", err)
	}

	// Deployment consumes via volume
	_, err = clientset.AppsV1().Deployments("default").Create(context.Background(), &appsv1.Deployment{
		ObjectMeta: metav1.ObjectMeta{Name: "d1", Namespace: "default"},
		Spec: appsv1.DeploymentSpec{
			Selector: &metav1.LabelSelector{MatchLabels: map[string]string{"app": "d1"}},
			Template: corev1.PodTemplateSpec{
				ObjectMeta: metav1.ObjectMeta{Labels: map[string]string{"app": "d1"}},
				Spec: corev1.PodSpec{
					Volumes:    []corev1.Volume{{Name: "cfg", VolumeSource: corev1.VolumeSource{ConfigMap: &corev1.ConfigMapVolumeSource{LocalObjectReference: corev1.LocalObjectReference{Name: "cm1"}}}}},
					Containers: []corev1.Container{{Name: "c", Image: "busybox"}},
				},
			},
		},
	}, metav1.CreateOptions{})
	if err != nil {
		t.Fatalf("failed to create deployment: %v", err)
	}

	app := &App{ctx: context.Background(), testClientset: clientset}
	consumers, err := app.GetConfigMapConsumers("default", "cm1")
	if err != nil {
		t.Fatalf("GetConfigMapConsumers failed: %v", err)
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

func TestUpdateConfigMapDataKey(t *testing.T) {
	clientset := fake.NewClientset()
	_, err := clientset.CoreV1().ConfigMaps("default").Create(context.Background(), &corev1.ConfigMap{
		ObjectMeta: metav1.ObjectMeta{Name: "cm1", Namespace: "default"},
		Data:       map[string]string{"a": "1"},
	}, metav1.CreateOptions{})
	if err != nil {
		t.Fatalf("failed to create configmap: %v", err)
	}

	app := &App{ctx: context.Background(), testClientset: clientset}
	if err := app.UpdateConfigMapDataKey("default", "cm1", "a", "2"); err != nil {
		t.Fatalf("UpdateConfigMapDataKey failed: %v", err)
	}
	cm, err := clientset.CoreV1().ConfigMaps("default").Get(context.Background(), "cm1", metav1.GetOptions{})
	if err != nil {
		t.Fatalf("failed to get configmap: %v", err)
	}
	if cm.Data["a"] != "2" {
		t.Fatalf("expected key updated to '2', got %q", cm.Data["a"])
	}
}
