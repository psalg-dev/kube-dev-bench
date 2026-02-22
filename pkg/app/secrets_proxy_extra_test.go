package app

import (
	"context"
	"os"
	"testing"

	appsv1 "k8s.io/api/apps/v1"
	batchv1 "k8s.io/api/batch/v1"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes/fake"
)

// ─── podSpecUsesSecret extra branches ────────────────────────────────────────

func TestPodSpecUsesSecret_ImagePullSecret(t *testing.T) {
	spec := corev1.PodSpec{
		ImagePullSecrets: []corev1.LocalObjectReference{{Name: "my-pull-secret"}},
		Containers:       []corev1.Container{{Name: "c", Image: "busybox"}},
	}
	ok, why := podSpecUsesSecret(spec, "my-pull-secret")
	if !ok {
		t.Errorf("expected podSpec to use secret via imagePullSecret")
	}
	if why != "imagePullSecret" {
		t.Errorf("expected why=imagePullSecret, got %s", why)
	}
}

func TestPodSpecUsesSecret_ImagePullSecret_NoMatch(t *testing.T) {
	spec := corev1.PodSpec{
		ImagePullSecrets: []corev1.LocalObjectReference{{Name: "other-secret"}},
		Containers:       []corev1.Container{{Name: "c", Image: "busybox"}},
	}
	ok, why := podSpecUsesSecret(spec, "my-pull-secret")
	if ok {
		t.Errorf("expected podSpec NOT to use secret, got why=%s", why)
	}
}

func TestPodSpecUsesSecret_NoMatch_EmptySpec(t *testing.T) {
	spec := corev1.PodSpec{
		Containers: []corev1.Container{{Name: "c", Image: "busybox"}},
	}
	ok, _ := podSpecUsesSecret(spec, "nonexistent-secret")
	if ok {
		t.Errorf("expected podSpec not to use secret when there are no references")
	}
}

func TestPodSpecUsesSecret_InitContainerEnvFrom(t *testing.T) {
	spec := corev1.PodSpec{
		InitContainers: []corev1.Container{{
			Name:  "init",
			Image: "busybox",
			EnvFrom: []corev1.EnvFromSource{{
				SecretRef: &corev1.SecretEnvSource{
					LocalObjectReference: corev1.LocalObjectReference{Name: "init-secret"},
				},
			}},
		}},
		Containers: []corev1.Container{{Name: "c", Image: "busybox"}},
	}
	ok, why := podSpecUsesSecret(spec, "init-secret")
	if !ok {
		t.Errorf("expected init container envFrom to match; got ok=false, why=%s", why)
	}
	if why != "init:envFrom:init" {
		t.Errorf("unexpected why value: %s", why)
	}
}

func TestPodSpecUsesSecret_EnvKeyRef(t *testing.T) {
	spec := corev1.PodSpec{
		Containers: []corev1.Container{{
			Name:  "app",
			Image: "busybox",
			Env: []corev1.EnvVar{{
				Name: "DB_PASS",
				ValueFrom: &corev1.EnvVarSource{
					SecretKeyRef: &corev1.SecretKeySelector{
						LocalObjectReference: corev1.LocalObjectReference{Name: "db-secret"},
						Key:                  "password",
					},
				},
			}},
		}},
	}
	ok, why := podSpecUsesSecret(spec, "db-secret")
	if !ok {
		t.Errorf("expected env secretKeyRef to match; got ok=false")
	}
	if why != "env:app" {
		t.Errorf("unexpected why value: %s", why)
	}
}

// ─── collectSecretConsumers — StatefulSet / DaemonSet / Job / CronJob ────────

func TestCollectSecretConsumers_StatefulSet(t *testing.T) {
	clientset := fake.NewSimpleClientset(&appsv1.StatefulSet{
		ObjectMeta: metav1.ObjectMeta{Name: "db-sts", Namespace: "default"},
		Spec: appsv1.StatefulSetSpec{
			Selector: &metav1.LabelSelector{MatchLabels: map[string]string{"app": "db"}},
			Template: corev1.PodTemplateSpec{
				ObjectMeta: metav1.ObjectMeta{Labels: map[string]string{"app": "db"}},
				Spec: corev1.PodSpec{
					Volumes: []corev1.Volume{{
						Name: "sec",
						VolumeSource: corev1.VolumeSource{
							Secret: &corev1.SecretVolumeSource{SecretName: "db-creds"},
						},
					}},
					Containers: []corev1.Container{{Name: "db", Image: "postgres"}},
				},
			},
		},
	})
	app := &App{ctx: context.Background()}
	consumers, err := app.collectSecretConsumers(clientset, "default", "db-creds")
	if err != nil {
		t.Fatalf("collectSecretConsumers failed: %v", err)
	}
	if len(consumers) != 1 {
		t.Fatalf("expected 1 consumer, got %d: %+v", len(consumers), consumers)
	}
	if consumers[0].Kind != "StatefulSet" || consumers[0].Name != "db-sts" {
		t.Errorf("unexpected consumer: %+v", consumers[0])
	}
}

func TestCollectSecretConsumers_DaemonSet(t *testing.T) {
	clientset := fake.NewSimpleClientset(&appsv1.DaemonSet{
		ObjectMeta: metav1.ObjectMeta{Name: "log-ds", Namespace: "kube-system"},
		Spec: appsv1.DaemonSetSpec{
			Selector: &metav1.LabelSelector{MatchLabels: map[string]string{"app": "log"}},
			Template: corev1.PodTemplateSpec{
				ObjectMeta: metav1.ObjectMeta{Labels: map[string]string{"app": "log"}},
				Spec: corev1.PodSpec{
					Containers: []corev1.Container{{
						Name:  "logger",
						Image: "fluentd",
						EnvFrom: []corev1.EnvFromSource{{
							SecretRef: &corev1.SecretEnvSource{
								LocalObjectReference: corev1.LocalObjectReference{Name: "log-secret"},
							},
						}},
					}},
				},
			},
		},
	})
	app := &App{ctx: context.Background()}
	consumers, err := app.collectSecretConsumers(clientset, "kube-system", "log-secret")
	if err != nil {
		t.Fatalf("collectSecretConsumers failed: %v", err)
	}
	if len(consumers) != 1 {
		t.Fatalf("expected 1 consumer, got %d: %+v", len(consumers), consumers)
	}
	if consumers[0].Kind != "DaemonSet" || consumers[0].Name != "log-ds" {
		t.Errorf("unexpected consumer: %+v", consumers[0])
	}
}

func TestCollectSecretConsumers_Job(t *testing.T) {
	clientset := fake.NewSimpleClientset(&batchv1.Job{
		ObjectMeta: metav1.ObjectMeta{Name: "backup-job", Namespace: "default"},
		Spec: batchv1.JobSpec{
			Template: corev1.PodTemplateSpec{
				Spec: corev1.PodSpec{
					Containers: []corev1.Container{{
						Name:  "backup",
						Image: "alpine",
						Env: []corev1.EnvVar{{
							Name: "S3_KEY",
							ValueFrom: &corev1.EnvVarSource{
								SecretKeyRef: &corev1.SecretKeySelector{
									LocalObjectReference: corev1.LocalObjectReference{Name: "s3-creds"},
									Key:                  "access-key",
								},
							},
						}},
					}},
					RestartPolicy: corev1.RestartPolicyNever,
				},
			},
		},
	})
	app := &App{ctx: context.Background()}
	consumers, err := app.collectSecretConsumers(clientset, "default", "s3-creds")
	if err != nil {
		t.Fatalf("collectSecretConsumers failed: %v", err)
	}
	if len(consumers) != 1 {
		t.Fatalf("expected 1 consumer (Job), got %d: %+v", len(consumers), consumers)
	}
	if consumers[0].Kind != "Job" || consumers[0].Name != "backup-job" {
		t.Errorf("unexpected consumer: %+v", consumers[0])
	}
}

func TestCollectSecretConsumers_CronJob(t *testing.T) {
	clientset := fake.NewSimpleClientset(&batchv1.CronJob{
		ObjectMeta: metav1.ObjectMeta{Name: "nightly-cj", Namespace: "default"},
		Spec: batchv1.CronJobSpec{
			Schedule: "0 0 * * *",
			JobTemplate: batchv1.JobTemplateSpec{
				Spec: batchv1.JobSpec{
					Template: corev1.PodTemplateSpec{
						Spec: corev1.PodSpec{
							Containers: []corev1.Container{{
								Name:  "runner",
								Image: "alpine",
								EnvFrom: []corev1.EnvFromSource{{
									SecretRef: &corev1.SecretEnvSource{
										LocalObjectReference: corev1.LocalObjectReference{Name: "cj-creds"},
									},
								}},
							}},
							RestartPolicy: corev1.RestartPolicyOnFailure,
						},
					},
				},
			},
		},
	})
	app := &App{ctx: context.Background()}
	consumers, err := app.collectSecretConsumers(clientset, "default", "cj-creds")
	if err != nil {
		t.Fatalf("collectSecretConsumers failed: %v", err)
	}
	if len(consumers) != 1 {
		t.Fatalf("expected 1 consumer (CronJob), got %d: %+v", len(consumers), consumers)
	}
	if consumers[0].Kind != "CronJob" || consumers[0].Name != "nightly-cj" {
		t.Errorf("unexpected consumer: %+v", consumers[0])
	}
}

func TestCollectSecretConsumers_NoConsumers(t *testing.T) {
	clientset := fake.NewSimpleClientset()
	app := &App{ctx: context.Background()}
	consumers, err := app.collectSecretConsumers(clientset, "default", "unused-secret")
	if err != nil {
		t.Fatalf("collectSecretConsumers failed: %v", err)
	}
	if len(consumers) != 0 {
		t.Errorf("expected 0 consumers, got %d", len(consumers))
	}
}

// ─── GetProxyDisplayURL ───────────────────────────────────────────────────────

func TestGetProxyDisplayURL_SystemProxy_HTTPS(t *testing.T) {
	if err := os.Setenv("HTTPS_PROXY", "http://proxy.corp.com:3128"); err != nil {
		t.Fatalf("setenv: %v", err)
	}
	defer os.Unsetenv("HTTPS_PROXY")
	defer os.Unsetenv("HTTP_PROXY")

	app := &App{proxyAuthType: "system"}
	got := app.GetProxyDisplayURL()
	if got != "http://proxy.corp.com:3128" {
		t.Errorf("expected HTTPS_PROXY display URL, got %q", got)
	}
}

func TestGetProxyDisplayURL_SystemProxy_HTTP_Only(t *testing.T) {
	os.Unsetenv("HTTPS_PROXY")
	if err := os.Setenv("HTTP_PROXY", "http://fallback.proxy:8080"); err != nil {
		t.Fatalf("setenv: %v", err)
	}
	defer os.Unsetenv("HTTP_PROXY")

	app := &App{proxyAuthType: "system"}
	got := app.GetProxyDisplayURL()
	if got != "http://fallback.proxy:8080" {
		t.Errorf("expected HTTP_PROXY display URL, got %q", got)
	}
}

func TestGetProxyDisplayURL_SystemProxy_NoProxy(t *testing.T) {
	os.Unsetenv("HTTPS_PROXY")
	os.Unsetenv("HTTP_PROXY")

	app := &App{proxyAuthType: "system"}
	got := app.GetProxyDisplayURL()
	if got != "" {
		t.Errorf("expected empty string when no system proxy vars, got %q", got)
	}
}

func TestGetProxyDisplayURL_BasicAuth(t *testing.T) {
	app := &App{
		proxyAuthType: "basic",
		proxyURL:      "http://user:pass@proxy:3128",
	}
	got := app.GetProxyDisplayURL()
	if got == "" {
		t.Errorf("expected non-empty display URL for basic proxy")
	}
	// Should mask the password
	if len(got) == 0 {
		t.Errorf("expected sanitized display URL, got empty string")
	}
}

func TestGetProxyDisplayURL_NoProxy(t *testing.T) {
	app := &App{proxyAuthType: "none", proxyURL: ""}
	got := app.GetProxyDisplayURL()
	if got != "" {
		t.Errorf("expected empty string for no proxy, got %q", got)
	}
}
