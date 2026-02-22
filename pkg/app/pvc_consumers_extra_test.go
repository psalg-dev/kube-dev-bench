package app

import (
	"context"
	"testing"

	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes/fake"
)

// ─── GetPVCConsumers — Deployment / StatefulSet / DaemonSet arms ─────────────

func TestGetPVCConsumers_DeploymentMountsPVC(t *testing.T) {
	ctx := context.Background()
	clientset := fake.NewSimpleClientset(&appsv1.Deployment{
		ObjectMeta: metav1.ObjectMeta{Name: "dep", Namespace: "default"},
		Spec: appsv1.DeploymentSpec{
			Selector: &metav1.LabelSelector{MatchLabels: map[string]string{"app": "dep"}},
			Template: corev1.PodTemplateSpec{
				ObjectMeta: metav1.ObjectMeta{Labels: map[string]string{"app": "dep"}},
				Spec: corev1.PodSpec{
					Volumes: []corev1.Volume{{
						Name: "storage",
						VolumeSource: corev1.VolumeSource{
							PersistentVolumeClaim: &corev1.PersistentVolumeClaimVolumeSource{ClaimName: "shared-pvc"},
						},
					}},
					Containers: []corev1.Container{{Name: "c", Image: "nginx"}},
				},
			},
		},
	})
	app := &App{ctx: ctx, testClientset: clientset}
	consumers, err := app.GetPVCConsumers("default", "shared-pvc")
	if err != nil {
		t.Fatalf("GetPVCConsumers failed: %v", err)
	}
	if len(consumers) != 1 {
		t.Fatalf("expected 1 consumer, got %d: %+v", len(consumers), consumers)
	}
	if consumers[0].Kind != "Deployment" {
		t.Errorf("expected kind Deployment, got %s", consumers[0].Kind)
	}
	if consumers[0].PodName != "dep" {
		t.Errorf("expected name dep, got %s", consumers[0].PodName)
	}
	if consumers[0].RefType != "volume:storage" {
		t.Errorf("expected refType volume:storage, got %s", consumers[0].RefType)
	}
}

func TestGetPVCConsumers_StatefulSetMountsPVC(t *testing.T) {
	ctx := context.Background()
	clientset := fake.NewSimpleClientset(&appsv1.StatefulSet{
		ObjectMeta: metav1.ObjectMeta{Name: "db-sts", Namespace: "default"},
		Spec: appsv1.StatefulSetSpec{
			Selector: &metav1.LabelSelector{MatchLabels: map[string]string{"app": "db"}},
			Template: corev1.PodTemplateSpec{
				ObjectMeta: metav1.ObjectMeta{Labels: map[string]string{"app": "db"}},
				Spec: corev1.PodSpec{
					Volumes: []corev1.Volume{{
						Name: "data",
						VolumeSource: corev1.VolumeSource{
							PersistentVolumeClaim: &corev1.PersistentVolumeClaimVolumeSource{ClaimName: "db-pvc"},
						},
					}},
					Containers: []corev1.Container{{Name: "db", Image: "postgres"}},
				},
			},
		},
	})
	app := &App{ctx: ctx, testClientset: clientset}
	consumers, err := app.GetPVCConsumers("default", "db-pvc")
	if err != nil {
		t.Fatalf("GetPVCConsumers failed: %v", err)
	}
	if len(consumers) != 1 {
		t.Fatalf("expected 1 consumer, got %d: %+v", len(consumers), consumers)
	}
	if consumers[0].Kind != "StatefulSet" {
		t.Errorf("expected kind StatefulSet, got %s", consumers[0].Kind)
	}
	if consumers[0].PodName != "db-sts" {
		t.Errorf("expected name db-sts, got %s", consumers[0].PodName)
	}
}

func TestGetPVCConsumers_DaemonSetMountsPVC(t *testing.T) {
	ctx := context.Background()
	clientset := fake.NewSimpleClientset(&appsv1.DaemonSet{
		ObjectMeta: metav1.ObjectMeta{Name: "agent-ds", Namespace: "monitoring"},
		Spec: appsv1.DaemonSetSpec{
			Selector: &metav1.LabelSelector{MatchLabels: map[string]string{"app": "agent"}},
			Template: corev1.PodTemplateSpec{
				ObjectMeta: metav1.ObjectMeta{Labels: map[string]string{"app": "agent"}},
				Spec: corev1.PodSpec{
					Volumes: []corev1.Volume{{
						Name: "logs",
						VolumeSource: corev1.VolumeSource{
							PersistentVolumeClaim: &corev1.PersistentVolumeClaimVolumeSource{ClaimName: "log-pvc"},
						},
					}},
					Containers: []corev1.Container{{Name: "agent", Image: "fluentd"}},
				},
			},
		},
	})
	app := &App{ctx: ctx, testClientset: clientset}
	consumers, err := app.GetPVCConsumers("monitoring", "log-pvc")
	if err != nil {
		t.Fatalf("GetPVCConsumers failed: %v", err)
	}
	if len(consumers) != 1 {
		t.Fatalf("expected 1 consumer, got %d: %+v", len(consumers), consumers)
	}
	if consumers[0].Kind != "DaemonSet" {
		t.Errorf("expected kind DaemonSet, got %s", consumers[0].Kind)
	}
	if consumers[0].PodName != "agent-ds" {
		t.Errorf("expected name agent-ds, got %s", consumers[0].PodName)
	}
	if consumers[0].RefType != "volume:logs" {
		t.Errorf("expected refType volume:logs, got %s", consumers[0].RefType)
	}
}

func TestGetPVCConsumers_DeploymentNoMatch(t *testing.T) {
	ctx := context.Background()
	clientset := fake.NewSimpleClientset(&appsv1.Deployment{
		ObjectMeta: metav1.ObjectMeta{Name: "dep-no-pvc", Namespace: "default"},
		Spec: appsv1.DeploymentSpec{
			Selector: &metav1.LabelSelector{MatchLabels: map[string]string{"app": "x"}},
			Template: corev1.PodTemplateSpec{
				ObjectMeta: metav1.ObjectMeta{Labels: map[string]string{"app": "x"}},
				Spec: corev1.PodSpec{
					Containers: []corev1.Container{{Name: "c", Image: "nginx"}},
				},
			},
		},
	})
	app := &App{ctx: ctx, testClientset: clientset}
	consumers, err := app.GetPVCConsumers("default", "some-pvc")
	if err != nil {
		t.Fatalf("GetPVCConsumers failed: %v", err)
	}
	if len(consumers) != 0 {
		t.Errorf("expected 0 consumers, got %d", len(consumers))
	}
}

// ─── UpdateSecretDataKey — nil Data branch ───────────────────────────────────

func TestUpdateSecretDataKey_NilData(t *testing.T) {
	ctx := context.Background()
	clientset := fake.NewSimpleClientset(&corev1.Secret{
		ObjectMeta: metav1.ObjectMeta{Name: "bare-secret", Namespace: "default"},
		// Data is intentionally nil
	})
	app := &App{ctx: ctx, testClientset: clientset}
	if err := app.UpdateSecretDataKey("default", "bare-secret", "newkey", "newval"); err != nil {
		t.Fatalf("UpdateSecretDataKey failed: %v", err)
	}
	sec, err := clientset.CoreV1().Secrets("default").Get(ctx, "bare-secret", metav1.GetOptions{})
	if err != nil {
		t.Fatalf("failed to get secret: %v", err)
	}
	if string(sec.Data["newkey"]) != "newval" {
		t.Errorf("expected newkey=newval, got %q", string(sec.Data["newkey"]))
	}
}

func TestUpdateSecretDataKey_NotFound(t *testing.T) {
	ctx := context.Background()
	clientset := fake.NewSimpleClientset()
	app := &App{ctx: ctx, testClientset: clientset}
	err := app.UpdateSecretDataKey("default", "nonexistent", "k", "v")
	if err == nil {
		t.Fatal("expected error for nonexistent secret")
	}
}
