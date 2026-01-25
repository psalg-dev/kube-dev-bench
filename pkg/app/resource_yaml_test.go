package app

import (
	"context"
	"strings"
	"testing"

	batchv1 "k8s.io/api/batch/v1"
	corev1 "k8s.io/api/core/v1"
	networkingv1 "k8s.io/api/networking/v1"
	"k8s.io/apimachinery/pkg/api/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/util/intstr"
	"k8s.io/client-go/kubernetes/fake"
)

func TestGetServiceYAML(t *testing.T) {
	clientset := fake.NewSimpleClientset()

	svc := &corev1.Service{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "test-service",
			Namespace: "default",
		},
		Spec: corev1.ServiceSpec{
			Type: corev1.ServiceTypeClusterIP,
			Ports: []corev1.ServicePort{
				{Port: 8080, TargetPort: intstr.FromInt(80)},
			},
		},
	}
	_, _ = clientset.CoreV1().Services("default").Create(context.Background(), svc, metav1.CreateOptions{})

	app := &App{
		ctx:           context.Background(),
		testClientset: clientset,
	}

	yaml, err := app.GetServiceYAML("default", "test-service")
	if err != nil {
		t.Fatalf("GetServiceYAML failed: %v", err)
	}

	if yaml == "" {
		t.Error("expected non-empty YAML")
	}

	if !strings.Contains(yaml, "test-service") {
		t.Error("YAML should contain service name")
	}
}

func TestGetServiceYAML_NoNamespace(t *testing.T) {
	app := &App{
		ctx: context.Background(),
	}

	_, err := app.GetServiceYAML("", "test-service")
	if err == nil {
		t.Error("expected error when no namespace provided")
	}
}

func TestGetIngressYAML(t *testing.T) {
	clientset := fake.NewSimpleClientset()

	pathType := networkingv1.PathTypePrefix
	ing := &networkingv1.Ingress{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "test-ingress",
			Namespace: "default",
		},
		Spec: networkingv1.IngressSpec{
			Rules: []networkingv1.IngressRule{
				{
					Host: "example.com",
					IngressRuleValue: networkingv1.IngressRuleValue{
						HTTP: &networkingv1.HTTPIngressRuleValue{
							Paths: []networkingv1.HTTPIngressPath{
								{
									Path:     "/",
									PathType: &pathType,
									Backend: networkingv1.IngressBackend{
										Service: &networkingv1.IngressServiceBackend{
											Name: "test-service",
											Port: networkingv1.ServiceBackendPort{Number: 80},
										},
									},
								},
							},
						},
					},
				},
			},
		},
	}
	_, _ = clientset.NetworkingV1().Ingresses("default").Create(context.Background(), ing, metav1.CreateOptions{})

	app := &App{
		ctx:           context.Background(),
		testClientset: clientset,
	}

	yaml, err := app.GetIngressYAML("default", "test-ingress")
	if err != nil {
		t.Fatalf("GetIngressYAML failed: %v", err)
	}

	if !strings.Contains(yaml, "test-ingress") {
		t.Error("YAML should contain ingress name")
	}
}

func TestGetJobYAML(t *testing.T) {
	clientset := fake.NewSimpleClientset()

	job := &batchv1.Job{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "test-job",
			Namespace: "default",
		},
		Spec: batchv1.JobSpec{
			Template: corev1.PodTemplateSpec{
				Spec: corev1.PodSpec{
					Containers: []corev1.Container{
						{Name: "main", Image: "busybox"},
					},
					RestartPolicy: corev1.RestartPolicyNever,
				},
			},
		},
	}
	_, _ = clientset.BatchV1().Jobs("default").Create(context.Background(), job, metav1.CreateOptions{})

	app := &App{
		ctx:           context.Background(),
		testClientset: clientset,
	}

	yaml, err := app.GetJobYAML("default", "test-job")
	if err != nil {
		t.Fatalf("GetJobYAML failed: %v", err)
	}

	if !strings.Contains(yaml, "test-job") {
		t.Error("YAML should contain job name")
	}
}

func TestGetCronJobYAML(t *testing.T) {
	clientset := fake.NewSimpleClientset()

	cronJob := &batchv1.CronJob{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "test-cronjob",
			Namespace: "default",
		},
		Spec: batchv1.CronJobSpec{
			Schedule: "*/5 * * * *",
			JobTemplate: batchv1.JobTemplateSpec{
				Spec: batchv1.JobSpec{
					Template: corev1.PodTemplateSpec{
						Spec: corev1.PodSpec{
							Containers: []corev1.Container{
								{Name: "main", Image: "busybox"},
							},
							RestartPolicy: corev1.RestartPolicyNever,
						},
					},
				},
			},
		},
	}
	_, _ = clientset.BatchV1().CronJobs("default").Create(context.Background(), cronJob, metav1.CreateOptions{})

	app := &App{
		ctx:           context.Background(),
		testClientset: clientset,
	}

	yaml, err := app.GetCronJobYAML("default", "test-cronjob")
	if err != nil {
		t.Fatalf("GetCronJobYAML failed: %v", err)
	}

	if !strings.Contains(yaml, "test-cronjob") {
		t.Error("YAML should contain cronjob name")
	}
}

func TestGetConfigMapYAML(t *testing.T) {
	clientset := fake.NewSimpleClientset()

	cm := &corev1.ConfigMap{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "test-configmap",
			Namespace: "default",
		},
		Data: map[string]string{
			"key1": "value1",
			"key2": "value2",
		},
	}
	_, _ = clientset.CoreV1().ConfigMaps("default").Create(context.Background(), cm, metav1.CreateOptions{})

	app := &App{
		ctx:           context.Background(),
		testClientset: clientset,
	}

	yaml, err := app.GetConfigMapYAML("default", "test-configmap")
	if err != nil {
		t.Fatalf("GetConfigMapYAML failed: %v", err)
	}

	if !strings.Contains(yaml, "test-configmap") {
		t.Error("YAML should contain configmap name")
	}
	if !strings.Contains(yaml, "key1") {
		t.Error("YAML should contain data keys")
	}
}

func TestGetSecretYAML(t *testing.T) {
	clientset := fake.NewSimpleClientset()

	secret := &corev1.Secret{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "test-secret",
			Namespace: "default",
		},
		Type: corev1.SecretTypeOpaque,
		Data: map[string][]byte{
			"username": []byte("admin"),
			"password": []byte("secret123"),
		},
	}
	_, _ = clientset.CoreV1().Secrets("default").Create(context.Background(), secret, metav1.CreateOptions{})

	app := &App{
		ctx:           context.Background(),
		testClientset: clientset,
	}

	yaml, err := app.GetSecretYAML("default", "test-secret")
	if err != nil {
		t.Fatalf("GetSecretYAML failed: %v", err)
	}

	if !strings.Contains(yaml, "test-secret") {
		t.Error("YAML should contain secret name")
	}
}

func TestGetPersistentVolumeYAML(t *testing.T) {
	clientset := fake.NewSimpleClientset()

	pv := &corev1.PersistentVolume{
		ObjectMeta: metav1.ObjectMeta{
			Name: "test-pv",
		},
		Spec: corev1.PersistentVolumeSpec{
			Capacity: corev1.ResourceList{
				corev1.ResourceStorage: resource.MustParse("1Gi"),
			},
			AccessModes: []corev1.PersistentVolumeAccessMode{corev1.ReadWriteOnce},
			PersistentVolumeSource: corev1.PersistentVolumeSource{
				HostPath: &corev1.HostPathVolumeSource{Path: "/mnt/data"},
			},
		},
	}
	_, _ = clientset.CoreV1().PersistentVolumes().Create(context.Background(), pv, metav1.CreateOptions{})

	app := &App{
		ctx:           context.Background(),
		testClientset: clientset,
	}

	yaml, err := app.GetPersistentVolumeYAML("test-pv")
	if err != nil {
		t.Fatalf("GetPersistentVolumeYAML failed: %v", err)
	}

	if !strings.Contains(yaml, "test-pv") {
		t.Error("YAML should contain PV name")
	}
}

func TestGetPersistentVolumeClaimYAML(t *testing.T) {
	clientset := fake.NewSimpleClientset()

	pvc := &corev1.PersistentVolumeClaim{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "test-pvc",
			Namespace: "default",
		},
		Spec: corev1.PersistentVolumeClaimSpec{
			AccessModes: []corev1.PersistentVolumeAccessMode{corev1.ReadWriteOnce},
			Resources: corev1.VolumeResourceRequirements{
				Requests: corev1.ResourceList{
					corev1.ResourceStorage: resource.MustParse("1Gi"),
				},
			},
		},
	}
	_, _ = clientset.CoreV1().PersistentVolumeClaims("default").Create(context.Background(), pvc, metav1.CreateOptions{})

	app := &App{
		ctx:           context.Background(),
		testClientset: clientset,
	}

	yaml, err := app.GetPersistentVolumeClaimYAML("default", "test-pvc")
	if err != nil {
		t.Fatalf("GetPersistentVolumeClaimYAML failed: %v", err)
	}

	if !strings.Contains(yaml, "test-pvc") {
		t.Error("YAML should contain PVC name")
	}
}

func TestGetPersistentVolumeClaimYAML_NoNamespace(t *testing.T) {
	app := &App{
		ctx: context.Background(),
	}

	_, err := app.GetPersistentVolumeClaimYAML("", "test-pvc")
	if err == nil {
		t.Error("expected error when no namespace provided")
	}
}
