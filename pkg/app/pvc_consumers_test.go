package app

import (
	"context"
	"testing"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes/fake"
)

func TestGetPVCConsumers_ReturnsPodsMountingPVC(t *testing.T) {
	ctx := context.Background()
	clientset := fake.NewSimpleClientset(
		&corev1.Pod{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "pod-with-pvc",
				Namespace: "default",
			},
			Spec: corev1.PodSpec{
				NodeName: "node-1",
				Volumes: []corev1.Volume{
					{
						Name: "data",
						VolumeSource: corev1.VolumeSource{
							PersistentVolumeClaim: &corev1.PersistentVolumeClaimVolumeSource{
								ClaimName: "my-pvc",
							},
						},
					},
				},
			},
			Status: corev1.PodStatus{
				Phase: corev1.PodRunning,
			},
		},
		&corev1.Pod{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "pod-without-pvc",
				Namespace: "default",
			},
			Spec: corev1.PodSpec{},
		},
	)

	app := &App{ctx: ctx, testClientset: clientset}

	consumers, err := app.GetPVCConsumers("default", "my-pvc")
	if err != nil {
		t.Fatalf("GetPVCConsumers failed: %v", err)
	}

	if len(consumers) != 1 {
		t.Fatalf("expected 1 consumer, got %d", len(consumers))
	}

	if consumers[0].PodName != "pod-with-pvc" {
		t.Errorf("expected pod name pod-with-pvc, got %s", consumers[0].PodName)
	}
	if consumers[0].Node != "node-1" {
		t.Errorf("expected node node-1, got %s", consumers[0].Node)
	}
	if consumers[0].Status != "Running" {
		t.Errorf("expected status Running, got %s", consumers[0].Status)
	}
	if consumers[0].RefType != "volume:data" {
		t.Errorf("expected refType volume:data, got %s", consumers[0].RefType)
	}
}

func TestGetPVCConsumers_EmptyNamespace(t *testing.T) {
	app := &App{ctx: context.Background()}

	_, err := app.GetPVCConsumers("", "my-pvc")
	if err == nil {
		t.Fatal("expected error for empty namespace")
	}
}

func TestGetPVCConsumers_EmptyPVCName(t *testing.T) {
	app := &App{ctx: context.Background()}

	_, err := app.GetPVCConsumers("default", "")
	if err == nil {
		t.Fatal("expected error for empty PVC name")
	}
}

func TestGetPVCConsumers_NoConsumers(t *testing.T) {
	ctx := context.Background()
	clientset := fake.NewSimpleClientset(
		&corev1.Pod{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "pod",
				Namespace: "default",
			},
			Spec: corev1.PodSpec{
				Volumes: []corev1.Volume{
					{
						Name: "config",
						VolumeSource: corev1.VolumeSource{
							ConfigMap: &corev1.ConfigMapVolumeSource{
								LocalObjectReference: corev1.LocalObjectReference{
									Name: "my-config",
								},
							},
						},
					},
				},
			},
		},
	)

	app := &App{ctx: ctx, testClientset: clientset}

	consumers, err := app.GetPVCConsumers("default", "my-pvc")
	if err != nil {
		t.Fatalf("GetPVCConsumers failed: %v", err)
	}

	if len(consumers) != 0 {
		t.Errorf("expected 0 consumers, got %d", len(consumers))
	}
}

func TestGetPVCConsumers_SortedByPodName(t *testing.T) {
	ctx := context.Background()
	clientset := fake.NewSimpleClientset(
		&corev1.Pod{
			ObjectMeta: metav1.ObjectMeta{Name: "pod-c", Namespace: "default"},
			Spec: corev1.PodSpec{
				Volumes: []corev1.Volume{{
					Name: "data",
					VolumeSource: corev1.VolumeSource{
						PersistentVolumeClaim: &corev1.PersistentVolumeClaimVolumeSource{ClaimName: "my-pvc"},
					},
				}},
			},
		},
		&corev1.Pod{
			ObjectMeta: metav1.ObjectMeta{Name: "pod-a", Namespace: "default"},
			Spec: corev1.PodSpec{
				Volumes: []corev1.Volume{{
					Name: "data",
					VolumeSource: corev1.VolumeSource{
						PersistentVolumeClaim: &corev1.PersistentVolumeClaimVolumeSource{ClaimName: "my-pvc"},
					},
				}},
			},
		},
		&corev1.Pod{
			ObjectMeta: metav1.ObjectMeta{Name: "pod-b", Namespace: "default"},
			Spec: corev1.PodSpec{
				Volumes: []corev1.Volume{{
					Name: "data",
					VolumeSource: corev1.VolumeSource{
						PersistentVolumeClaim: &corev1.PersistentVolumeClaimVolumeSource{ClaimName: "my-pvc"},
					},
				}},
			},
		},
	)

	app := &App{ctx: ctx, testClientset: clientset}

	consumers, err := app.GetPVCConsumers("default", "my-pvc")
	if err != nil {
		t.Fatalf("GetPVCConsumers failed: %v", err)
	}

	if len(consumers) != 3 {
		t.Fatalf("expected 3 consumers, got %d", len(consumers))
	}

	// Verify sorted order
	if consumers[0].PodName != "pod-a" || consumers[1].PodName != "pod-b" || consumers[2].PodName != "pod-c" {
		t.Errorf("expected sorted order a,b,c, got %s,%s,%s", consumers[0].PodName, consumers[1].PodName, consumers[2].PodName)
	}
}
