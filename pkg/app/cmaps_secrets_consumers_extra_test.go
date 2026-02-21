package app

import (
	"context"
	"testing"

	appsv1 "k8s.io/api/apps/v1"
	batchv1 "k8s.io/api/batch/v1"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes/fake"
)

// ─── GetConfigMapConsumers – extended resource types ──────────────────────────

// TestGetConfigMapConsumers_WithStatefulSet verifies a StatefulSet that uses a
// ConfigMap via EnvFrom is returned as a consumer.
func TestGetConfigMapConsumers_WithStatefulSet(t *testing.T) {
	cs := fake.NewSimpleClientset()
	ctx := context.Background()

	_, _ = cs.AppsV1().StatefulSets("default").Create(ctx, &appsv1.StatefulSet{
		ObjectMeta: metav1.ObjectMeta{Name: "sts1", Namespace: "default"},
		Spec: appsv1.StatefulSetSpec{
			Selector: &metav1.LabelSelector{MatchLabels: map[string]string{"app": "sts1"}},
			Template: corev1.PodTemplateSpec{
				ObjectMeta: metav1.ObjectMeta{Labels: map[string]string{"app": "sts1"}},
				Spec: corev1.PodSpec{Containers: []corev1.Container{{
					Name:  "c",
					Image: "busybox",
					EnvFrom: []corev1.EnvFromSource{{
						ConfigMapRef: &corev1.ConfigMapEnvSource{LocalObjectReference: corev1.LocalObjectReference{Name: "cm1"}},
					}},
				}}},
			},
			ServiceName: "sts1",
		},
	}, metav1.CreateOptions{})

	app := &App{ctx: ctx, testClientset: cs}
	consumers, err := app.GetConfigMapConsumers("default", "cm1")
	if err != nil {
		t.Fatalf("GetConfigMapConsumers() error = %v", err)
	}
	if len(consumers) != 1 || consumers[0].Kind != "StatefulSet" {
		t.Errorf("expected StatefulSet consumer, got %+v", consumers)
	}
}

// TestGetConfigMapConsumers_WithDaemonSet verifies a DaemonSet that uses a
// ConfigMap via volume mount is returned as a consumer.
func TestGetConfigMapConsumers_WithDaemonSet(t *testing.T) {
	cs := fake.NewSimpleClientset()
	ctx := context.Background()

	_, _ = cs.AppsV1().DaemonSets("default").Create(ctx, &appsv1.DaemonSet{
		ObjectMeta: metav1.ObjectMeta{Name: "ds1", Namespace: "default"},
		Spec: appsv1.DaemonSetSpec{
			Selector: &metav1.LabelSelector{MatchLabels: map[string]string{"app": "ds1"}},
			Template: corev1.PodTemplateSpec{
				ObjectMeta: metav1.ObjectMeta{Labels: map[string]string{"app": "ds1"}},
				Spec: corev1.PodSpec{
					Volumes: []corev1.Volume{{
						Name: "cfg-vol",
						VolumeSource: corev1.VolumeSource{
							ConfigMap: &corev1.ConfigMapVolumeSource{LocalObjectReference: corev1.LocalObjectReference{Name: "cm1"}},
						},
					}},
					Containers: []corev1.Container{{Name: "c", Image: "busybox"}},
				},
			},
		},
	}, metav1.CreateOptions{})

	app := &App{ctx: ctx, testClientset: cs}
	consumers, err := app.GetConfigMapConsumers("default", "cm1")
	if err != nil {
		t.Fatalf("GetConfigMapConsumers() error = %v", err)
	}
	if len(consumers) != 1 || consumers[0].Kind != "DaemonSet" {
		t.Errorf("expected DaemonSet consumer, got %+v", consumers)
	}
}

// TestGetConfigMapConsumers_WithJob verifies a Job that uses a ConfigMap is
// returned as a consumer.
func TestGetConfigMapConsumers_WithJob(t *testing.T) {
	cs := fake.NewSimpleClientset()
	ctx := context.Background()

	_, _ = cs.BatchV1().Jobs("default").Create(ctx, &batchv1.Job{
		ObjectMeta: metav1.ObjectMeta{Name: "job1", Namespace: "default"},
		Spec: batchv1.JobSpec{
			Template: corev1.PodTemplateSpec{
				Spec: corev1.PodSpec{
					Containers: []corev1.Container{{
						Name:  "c",
						Image: "busybox",
						EnvFrom: []corev1.EnvFromSource{{
							ConfigMapRef: &corev1.ConfigMapEnvSource{LocalObjectReference: corev1.LocalObjectReference{Name: "cm1"}},
						}},
					}},
					RestartPolicy: corev1.RestartPolicyNever,
				},
			},
		},
	}, metav1.CreateOptions{})

	app := &App{ctx: ctx, testClientset: cs}
	consumers, err := app.GetConfigMapConsumers("default", "cm1")
	if err != nil {
		t.Fatalf("GetConfigMapConsumers() error = %v", err)
	}
	if len(consumers) != 1 || consumers[0].Kind != "Job" {
		t.Errorf("expected Job consumer, got %+v", consumers)
	}
}

// TestGetConfigMapConsumers_WithCronJob verifies a CronJob that uses a
// ConfigMap is returned as a consumer.
func TestGetConfigMapConsumers_WithCronJob(t *testing.T) {
	cs := fake.NewSimpleClientset()
	ctx := context.Background()

	_, _ = cs.BatchV1().CronJobs("default").Create(ctx, &batchv1.CronJob{
		ObjectMeta: metav1.ObjectMeta{Name: "cj1", Namespace: "default"},
		Spec: batchv1.CronJobSpec{
			Schedule: "*/5 * * * *",
			JobTemplate: batchv1.JobTemplateSpec{
				Spec: batchv1.JobSpec{
					Template: corev1.PodTemplateSpec{
						Spec: corev1.PodSpec{
							Containers: []corev1.Container{{
								Name:  "c",
								Image: "busybox",
								EnvFrom: []corev1.EnvFromSource{{
									ConfigMapRef: &corev1.ConfigMapEnvSource{LocalObjectReference: corev1.LocalObjectReference{Name: "cm1"}},
								}},
							}},
							RestartPolicy: corev1.RestartPolicyNever,
						},
					},
				},
			},
		},
	}, metav1.CreateOptions{})

	app := &App{ctx: ctx, testClientset: cs}
	consumers, err := app.GetConfigMapConsumers("default", "cm1")
	if err != nil {
		t.Fatalf("GetConfigMapConsumers() error = %v", err)
	}
	if len(consumers) != 1 || consumers[0].Kind != "CronJob" {
		t.Errorf("expected CronJob consumer, got %+v", consumers)
	}
}

// TestGetConfigMapConsumers_EmptyNamespace verifies the empty-namespace error path.
func TestGetConfigMapConsumers_EmptyNamespace(t *testing.T) {
	app := &App{ctx: context.Background(), testClientset: fake.NewSimpleClientset()}
	_, err := app.GetConfigMapConsumers("", "cm1")
	if err == nil {
		t.Error("expected error for empty namespace")
	}
}

// TestGetConfigMapConsumers_EmptyConfigMapName verifies the empty-name error path.
func TestGetConfigMapConsumers_EmptyConfigMapName(t *testing.T) {
	app := &App{ctx: context.Background(), testClientset: fake.NewSimpleClientset()}
	_, err := app.GetConfigMapConsumers("default", "")
	if err == nil {
		t.Error("expected error for empty configMapName")
	}
}

// TestUpdateConfigMapDataKey_NilData verifies that a ConfigMap with nil Data
// has its Data map initialised before the key is set.
func TestUpdateConfigMapDataKey_NilData(t *testing.T) {
	cs := fake.NewSimpleClientset()
	ctx := context.Background()

	// Create a ConfigMap with no Data (nil map).
	_, _ = cs.CoreV1().ConfigMaps("default").Create(ctx, &corev1.ConfigMap{
		ObjectMeta: metav1.ObjectMeta{Name: "cm-nil", Namespace: "default"},
	}, metav1.CreateOptions{})

	app := &App{ctx: ctx, testClientset: cs}
	if err := app.UpdateConfigMapDataKey("default", "cm-nil", "newkey", "val"); err != nil {
		t.Fatalf("UpdateConfigMapDataKey() error = %v", err)
	}
	cm, err := cs.CoreV1().ConfigMaps("default").Get(ctx, "cm-nil", metav1.GetOptions{})
	if err != nil {
		t.Fatalf("Get() error = %v", err)
	}
	if cm.Data["newkey"] != "val" {
		t.Errorf("expected newkey=val, got %q", cm.Data["newkey"])
	}
}

// TestUpdateConfigMapDataKey_EmptyNamespace verifies the validation error path.
func TestUpdateConfigMapDataKey_EmptyNamespace(t *testing.T) {
	app := &App{ctx: context.Background(), testClientset: fake.NewSimpleClientset()}
	err := app.UpdateConfigMapDataKey("", "cm1", "k", "v")
	if err == nil {
		t.Error("expected error for empty namespace")
	}
}

// TestUpdateConfigMapDataKey_EmptyKey verifies the key validation error path.
func TestUpdateConfigMapDataKey_EmptyKey(t *testing.T) {
	app := &App{ctx: context.Background(), testClientset: fake.NewSimpleClientset()}
	err := app.UpdateConfigMapDataKey("default", "cm1", "", "v")
	if err == nil {
		t.Error("expected error for empty key")
	}
}

// ─── GetSecretConsumers – extended resource types ─────────────────────────────

// TestGetSecretConsumers_WithStatefulSet verifies a StatefulSet that uses a
// Secret via volume is returned as a consumer.
func TestGetSecretConsumers_WithStatefulSet(t *testing.T) {
	cs := fake.NewSimpleClientset()
	ctx := context.Background()

	_, _ = cs.AppsV1().StatefulSets("default").Create(ctx, &appsv1.StatefulSet{
		ObjectMeta: metav1.ObjectMeta{Name: "sts1", Namespace: "default"},
		Spec: appsv1.StatefulSetSpec{
			Selector: &metav1.LabelSelector{MatchLabels: map[string]string{"app": "sts1"}},
			Template: corev1.PodTemplateSpec{
				ObjectMeta: metav1.ObjectMeta{Labels: map[string]string{"app": "sts1"}},
				Spec: corev1.PodSpec{
					Volumes: []corev1.Volume{{
						Name: "sec-vol",
						VolumeSource: corev1.VolumeSource{
							Secret: &corev1.SecretVolumeSource{SecretName: "s1"},
						},
					}},
					Containers: []corev1.Container{{Name: "c", Image: "busybox"}},
				},
			},
			ServiceName: "sts1",
		},
	}, metav1.CreateOptions{})

	app := &App{ctx: ctx, testClientset: cs}
	consumers, err := app.GetSecretConsumers("default", "s1")
	if err != nil {
		t.Fatalf("GetSecretConsumers() error = %v", err)
	}
	if len(consumers) != 1 || consumers[0].Kind != "StatefulSet" {
		t.Errorf("expected StatefulSet consumer, got %+v", consumers)
	}
}

// TestGetSecretConsumers_WithDaemonSet verifies a DaemonSet that uses a
// Secret via EnvFrom is returned as a consumer.
func TestGetSecretConsumers_WithDaemonSet(t *testing.T) {
	cs := fake.NewSimpleClientset()
	ctx := context.Background()

	_, _ = cs.AppsV1().DaemonSets("default").Create(ctx, &appsv1.DaemonSet{
		ObjectMeta: metav1.ObjectMeta{Name: "ds1", Namespace: "default"},
		Spec: appsv1.DaemonSetSpec{
			Selector: &metav1.LabelSelector{MatchLabels: map[string]string{"app": "ds1"}},
			Template: corev1.PodTemplateSpec{
				ObjectMeta: metav1.ObjectMeta{Labels: map[string]string{"app": "ds1"}},
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

	app := &App{ctx: ctx, testClientset: cs}
	consumers, err := app.GetSecretConsumers("default", "s1")
	if err != nil {
		t.Fatalf("GetSecretConsumers() error = %v", err)
	}
	if len(consumers) != 1 || consumers[0].Kind != "DaemonSet" {
		t.Errorf("expected DaemonSet consumer, got %+v", consumers)
	}
}

// TestGetSecretConsumers_WithJob verifies a Job that uses a Secret is returned
// as a consumer.
func TestGetSecretConsumers_WithJob(t *testing.T) {
	cs := fake.NewSimpleClientset()
	ctx := context.Background()

	_, _ = cs.BatchV1().Jobs("default").Create(ctx, &batchv1.Job{
		ObjectMeta: metav1.ObjectMeta{Name: "job1", Namespace: "default"},
		Spec: batchv1.JobSpec{
			Template: corev1.PodTemplateSpec{
				Spec: corev1.PodSpec{
					Volumes: []corev1.Volume{{
						Name: "sec-vol",
						VolumeSource: corev1.VolumeSource{
							Secret: &corev1.SecretVolumeSource{SecretName: "s1"},
						},
					}},
					Containers:    []corev1.Container{{Name: "c", Image: "busybox"}},
					RestartPolicy: corev1.RestartPolicyNever,
				},
			},
		},
	}, metav1.CreateOptions{})

	app := &App{ctx: ctx, testClientset: cs}
	consumers, err := app.GetSecretConsumers("default", "s1")
	if err != nil {
		t.Fatalf("GetSecretConsumers() error = %v", err)
	}
	if len(consumers) != 1 || consumers[0].Kind != "Job" {
		t.Errorf("expected Job consumer, got %+v", consumers)
	}
}

// TestGetSecretConsumers_WithCronJob verifies a CronJob that uses a Secret is
// returned as a consumer.
func TestGetSecretConsumers_WithCronJob(t *testing.T) {
	cs := fake.NewSimpleClientset()
	ctx := context.Background()

	_, _ = cs.BatchV1().CronJobs("default").Create(ctx, &batchv1.CronJob{
		ObjectMeta: metav1.ObjectMeta{Name: "cj1", Namespace: "default"},
		Spec: batchv1.CronJobSpec{
			Schedule: "*/5 * * * *",
			JobTemplate: batchv1.JobTemplateSpec{
				Spec: batchv1.JobSpec{
					Template: corev1.PodTemplateSpec{
						Spec: corev1.PodSpec{
							Containers: []corev1.Container{{
								Name:  "c",
								Image: "busybox",
								EnvFrom: []corev1.EnvFromSource{{
									SecretRef: &corev1.SecretEnvSource{LocalObjectReference: corev1.LocalObjectReference{Name: "s1"}},
								}},
							}},
							RestartPolicy: corev1.RestartPolicyNever,
						},
					},
				},
			},
		},
	}, metav1.CreateOptions{})

	app := &App{ctx: ctx, testClientset: cs}
	consumers, err := app.GetSecretConsumers("default", "s1")
	if err != nil {
		t.Fatalf("GetSecretConsumers() error = %v", err)
	}
	if len(consumers) != 1 || consumers[0].Kind != "CronJob" {
		t.Errorf("expected CronJob consumer, got %+v", consumers)
	}
}

// TestGetSecretConsumers_EmptyNamespace verifies the empty namespace error path.
func TestGetSecretConsumers_EmptyNamespace(t *testing.T) {
	app := &App{ctx: context.Background(), testClientset: fake.NewSimpleClientset()}
	_, err := app.GetSecretConsumers("", "s1")
	if err == nil {
		t.Error("expected error for empty namespace")
	}
}

// TestGetSecretConsumers_EmptySecretName verifies the empty name error path.
func TestGetSecretConsumers_EmptySecretName(t *testing.T) {
	app := &App{ctx: context.Background(), testClientset: fake.NewSimpleClientset()}
	_, err := app.GetSecretConsumers("default", "")
	if err == nil {
		t.Error("expected error for empty secretName")
	}
}

// TestUpdateSecretDataKey_NilDataMap verifies that a Secret with nil Data has its
// Data map initialised before the key is set.
func TestUpdateSecretDataKey_NilDataMap(t *testing.T) {
	cs := fake.NewSimpleClientset()
	ctx := context.Background()

	_, _ = cs.CoreV1().Secrets("default").Create(ctx, &corev1.Secret{
		ObjectMeta: metav1.ObjectMeta{Name: "sec-nil", Namespace: "default"},
	}, metav1.CreateOptions{})

	app := &App{ctx: ctx, testClientset: cs}
	if err := app.UpdateSecretDataKey("default", "sec-nil", "newkey", "val"); err != nil {
		t.Fatalf("UpdateSecretDataKey() error = %v", err)
	}
	sec, err := cs.CoreV1().Secrets("default").Get(ctx, "sec-nil", metav1.GetOptions{})
	if err != nil {
		t.Fatalf("Get() error = %v", err)
	}
	if string(sec.Data["newkey"]) != "val" {
		t.Errorf("expected newkey=val, got %q", string(sec.Data["newkey"]))
	}
}

// TestUpdateSecretDataKey_EmptyNamespace verifies the empty namespace error path.
func TestUpdateSecretDataKey_EmptyNamespace(t *testing.T) {
	app := &App{ctx: context.Background(), testClientset: fake.NewSimpleClientset()}
	err := app.UpdateSecretDataKey("", "s1", "k", "v")
	if err == nil {
		t.Error("expected error for empty namespace")
	}
}
