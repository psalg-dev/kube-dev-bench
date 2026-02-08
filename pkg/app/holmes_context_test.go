package app

import (
	"context"
	"fmt"
	"strings"
	"testing"
	"time"

	appsv1 "k8s.io/api/apps/v1"
	batchv1 "k8s.io/api/batch/v1"
	corev1 "k8s.io/api/core/v1"
	networkingv1 "k8s.io/api/networking/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	runtime "k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/util/intstr"
	"k8s.io/client-go/kubernetes/fake"
)

func TestGetPodContext_ReturnsPodInfo(t *testing.T) {
	ctx := context.Background()
	clientset := fake.NewSimpleClientset(
		&corev1.Pod{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "my-pod",
				Namespace: "default",
			},
			Spec: corev1.PodSpec{
				NodeName: "node-1",
			},
			Status: corev1.PodStatus{
				Phase: corev1.PodRunning,
				ContainerStatuses: []corev1.ContainerStatus{
					{
						Name:         "main",
						Ready:        true,
						RestartCount: 0,
					},
				},
				Conditions: []corev1.PodCondition{
					{
						Type:   corev1.PodReady,
						Status: corev1.ConditionTrue,
					},
				},
			},
		},
	)

	app := &App{ctx: ctx, testClientset: clientset}

	result, err := app.getPodContext("default", "my-pod")
	if err != nil {
		t.Fatalf("getPodContext failed: %v", err)
	}

	if !strings.Contains(result, "Pod: default/my-pod") {
		t.Error("expected pod name in result")
	}
	if !strings.Contains(result, "Status: Running") {
		t.Error("expected status in result")
	}
	if !strings.Contains(result, "Node: node-1") {
		t.Error("expected node name in result")
	}
	if !strings.Contains(result, "main: Ready=true") {
		t.Error("expected container status in result")
	}
}

func TestGetPodContext_PodNotFound(t *testing.T) {
	ctx := context.Background()
	clientset := fake.NewSimpleClientset()

	app := &App{ctx: ctx, testClientset: clientset}

	_, err := app.getPodContext("default", "nonexistent")
	if err == nil {
		t.Fatal("expected error for nonexistent pod")
	}
}

func TestGetPodContext_WaitingContainer(t *testing.T) {
	ctx := context.Background()
	clientset := fake.NewSimpleClientset(
		&corev1.Pod{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "my-pod",
				Namespace: "default",
			},
			Status: corev1.PodStatus{
				Phase: corev1.PodPending,
				ContainerStatuses: []corev1.ContainerStatus{
					{
						Name: "main",
						State: corev1.ContainerState{
							Waiting: &corev1.ContainerStateWaiting{
								Reason:  "ImagePullBackOff",
								Message: "Failed to pull image",
							},
						},
					},
				},
			},
		},
	)

	app := &App{ctx: ctx, testClientset: clientset}

	result, err := app.getPodContext("default", "my-pod")
	if err != nil {
		t.Fatalf("getPodContext failed: %v", err)
	}

	if !strings.Contains(result, "Waiting: ImagePullBackOff") {
		t.Error("expected waiting reason in result")
	}
}

func TestGetPodContext_TerminatedContainer(t *testing.T) {
	ctx := context.Background()
	clientset := fake.NewSimpleClientset(
		&corev1.Pod{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "my-pod",
				Namespace: "default",
			},
			Status: corev1.PodStatus{
				Phase: corev1.PodFailed,
				ContainerStatuses: []corev1.ContainerStatus{
					{
						Name: "main",
						State: corev1.ContainerState{
							Terminated: &corev1.ContainerStateTerminated{
								Reason:   "OOMKilled",
								ExitCode: 137,
								Message:  "Container killed due to OOM",
							},
						},
					},
				},
			},
		},
	)

	app := &App{ctx: ctx, testClientset: clientset}

	result, err := app.getPodContext("default", "my-pod")
	if err != nil {
		t.Fatalf("getPodContext failed: %v", err)
	}

	if !strings.Contains(result, "Terminated: OOMKilled") {
		t.Error("expected terminated reason in result")
	}
	if !strings.Contains(result, "exit code 137") {
		t.Error("expected exit code in result")
	}
}

func TestGetDeploymentContext_ReturnsDeploymentInfo(t *testing.T) {
	ctx := context.Background()
	replicas := int32(3)
	clientset := fake.NewSimpleClientset(
		&appsv1.Deployment{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "my-deployment",
				Namespace: "default",
			},
			Spec: appsv1.DeploymentSpec{
				Replicas: &replicas,
				Selector: &metav1.LabelSelector{
					MatchLabels: map[string]string{"app": "myapp"},
				},
				Strategy: appsv1.DeploymentStrategy{
					Type: appsv1.RollingUpdateDeploymentStrategyType,
				},
			},
			Status: appsv1.DeploymentStatus{
				ReadyReplicas:     2,
				AvailableReplicas: 2,
			},
		},
		&corev1.Pod{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "my-deployment-abc123",
				Namespace: "default",
				Labels:    map[string]string{"app": "myapp"},
			},
			Status: corev1.PodStatus{
				Phase: corev1.PodRunning,
			},
		},
	)

	app := &App{ctx: ctx, testClientset: clientset}

	result, err := app.getDeploymentContext("default", "my-deployment")
	if err != nil {
		t.Fatalf("getDeploymentContext failed: %v", err)
	}

	if !strings.Contains(result, "Deployment: default/my-deployment") {
		t.Error("expected deployment name in result")
	}
	if !strings.Contains(result, "desired=3") {
		t.Error("expected desired replicas in result")
	}
	if !strings.Contains(result, "ready=2") {
		t.Error("expected ready replicas in result")
	}
	if !strings.Contains(result, "RollingUpdate") {
		t.Error("expected strategy in result")
	}
}

func TestGetDeploymentContext_DeploymentNotFound(t *testing.T) {
	ctx := context.Background()
	clientset := fake.NewSimpleClientset()

	app := &App{ctx: ctx, testClientset: clientset}

	result, err := app.getDeploymentContext("default", "nonexistent")
	if err == nil {
		t.Fatal("expected error for nonexistent deployment")
	}
	if !strings.Contains(err.Error(), "failed to get deployment") {
		t.Fatalf("expected wrapped deployment error, got %v", err)
	}
	if result != "" {
		t.Errorf("expected empty result, got %q", result)
	}
}

func TestGetDeploymentContext_NilSelector(t *testing.T) {
	ctx := context.Background()
	clientset := fake.NewSimpleClientset(
		&appsv1.Deployment{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "my-deployment",
				Namespace: "default",
			},
		},
	)

	app := &App{ctx: ctx, testClientset: clientset}

	result, err := app.getDeploymentContext("default", "my-deployment")
	if err == nil {
		t.Fatal("expected error for deployment without selector")
	}
	if !strings.Contains(err.Error(), "deployment has no selector") {
		t.Fatalf("expected selector error, got %v", err)
	}
	if result != "" {
		t.Errorf("expected empty result, got %q", result)
	}
}

func TestGetStatefulSetContext_ReturnsStatefulSetInfo(t *testing.T) {
	ctx := context.Background()
	replicas := int32(3)
	clientset := fake.NewSimpleClientset(
		&appsv1.StatefulSet{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "my-statefulset",
				Namespace: "default",
			},
			Spec: appsv1.StatefulSetSpec{
				Replicas:    &replicas,
				ServiceName: "my-svc",
				Selector: &metav1.LabelSelector{
					MatchLabels: map[string]string{"app": "myapp"},
				},
			},
			Status: appsv1.StatefulSetStatus{
				ReadyReplicas:   2,
				CurrentReplicas: 2,
			},
		},
	)

	app := &App{ctx: ctx, testClientset: clientset}

	result, err := app.getStatefulSetContext("default", "my-statefulset")
	if err != nil {
		t.Fatalf("getStatefulSetContext failed: %v", err)
	}

	if !strings.Contains(result, "StatefulSet: default/my-statefulset") {
		t.Error("expected statefulset name in result")
	}
	if !strings.Contains(result, "desired=3") {
		t.Error("expected desired replicas in result")
	}
	if !strings.Contains(result, "Service: my-svc") {
		t.Error("expected service name in result")
	}
}

func TestGetStatefulSetContext_StatefulSetNotFound(t *testing.T) {
	ctx := context.Background()
	clientset := fake.NewSimpleClientset()

	app := &App{ctx: ctx, testClientset: clientset}

	result, err := app.getStatefulSetContext("default", "nonexistent")
	if err == nil {
		t.Fatal("expected error for nonexistent statefulset")
	}
	if !strings.Contains(err.Error(), "failed to get statefulset") {
		t.Fatalf("expected wrapped statefulset error, got %v", err)
	}
	if result != "" {
		t.Errorf("expected empty result, got %q", result)
	}
}

func TestGetStatefulSetContext_NilSelector(t *testing.T) {
	ctx := context.Background()
	clientset := fake.NewSimpleClientset(
		&appsv1.StatefulSet{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "my-statefulset",
				Namespace: "default",
			},
		},
	)

	app := &App{ctx: ctx, testClientset: clientset}

	result, err := app.getStatefulSetContext("default", "my-statefulset")
	if err == nil {
		t.Fatal("expected error for statefulset without selector")
	}
	if !strings.Contains(err.Error(), "statefulset has no selector") {
		t.Fatalf("expected selector error, got %v", err)
	}
	if result != "" {
		t.Errorf("expected empty result, got %q", result)
	}
}

func TestGetDaemonSetContext_ReturnsDaemonSetInfo(t *testing.T) {
	ctx := context.Background()
	clientset := fake.NewSimpleClientset(
		&appsv1.DaemonSet{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "my-daemonset",
				Namespace: "default",
			},
			Spec: appsv1.DaemonSetSpec{
				Selector: &metav1.LabelSelector{
					MatchLabels: map[string]string{"app": "myapp"},
				},
			},
			Status: appsv1.DaemonSetStatus{
				DesiredNumberScheduled: 3,
				CurrentNumberScheduled: 3,
				NumberReady:            2,
			},
		},
	)

	app := &App{ctx: ctx, testClientset: clientset}

	result, err := app.getDaemonSetContext("default", "my-daemonset")
	if err != nil {
		t.Fatalf("getDaemonSetContext failed: %v", err)
	}

	if !strings.Contains(result, "DaemonSet: default/my-daemonset") {
		t.Error("expected daemonset name in result")
	}
	if !strings.Contains(result, "Desired: 3") {
		t.Error("expected desired replicas in result")
	}
}

func TestGetDaemonSetContext_DaemonSetNotFound(t *testing.T) {
	ctx := context.Background()
	clientset := fake.NewSimpleClientset()

	app := &App{ctx: ctx, testClientset: clientset}

	result, err := app.getDaemonSetContext("default", "nonexistent")
	if err == nil {
		t.Fatal("expected error for nonexistent daemonset")
	}
	if !strings.Contains(err.Error(), "failed to get daemonset") {
		t.Fatalf("expected wrapped daemonset error, got %v", err)
	}
	if result != "" {
		t.Errorf("expected empty result, got %q", result)
	}
}

func TestGetDaemonSetContext_NilSelector(t *testing.T) {
	ctx := context.Background()
	clientset := fake.NewSimpleClientset(
		&appsv1.DaemonSet{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "my-daemonset",
				Namespace: "default",
			},
		},
	)

	app := &App{ctx: ctx, testClientset: clientset}

	result, err := app.getDaemonSetContext("default", "my-daemonset")
	if err == nil {
		t.Fatal("expected error for daemonset without selector")
	}
	if !strings.Contains(err.Error(), "daemonset has no selector") {
		t.Fatalf("expected selector error, got %v", err)
	}
	if result != "" {
		t.Errorf("expected empty result, got %q", result)
	}
}

func TestGetJobContext_ReturnsJobInfo(t *testing.T) {
	ctx := context.Background()
	clientset := fake.NewSimpleClientset(
		&batchv1.Job{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "my-job",
				Namespace: "default",
			},
			Spec: batchv1.JobSpec{
				Selector: &metav1.LabelSelector{
					MatchLabels: map[string]string{"job-name": "my-job"},
				},
			},
			Status: batchv1.JobStatus{
				Active:    1,
				Succeeded: 0,
				Failed:    0,
			},
		},
	)

	app := &App{ctx: ctx, testClientset: clientset}

	result, err := app.getJobContext("default", "my-job")
	if err != nil {
		t.Fatalf("getJobContext failed: %v", err)
	}

	if !strings.Contains(result, "Job: default/my-job") {
		t.Error("expected job name in result")
	}
	if !strings.Contains(result, "Active: 1") {
		t.Error("expected active count in result")
	}
}

func TestGetJobContext_JobNotFound(t *testing.T) {
	ctx := context.Background()
	clientset := fake.NewSimpleClientset()

	app := &App{ctx: ctx, testClientset: clientset}

	result, err := app.getJobContext("default", "nonexistent")
	if err == nil {
		t.Fatal("expected error for nonexistent job")
	}
	if !strings.Contains(err.Error(), "failed to get job") {
		t.Fatalf("expected wrapped job error, got %v", err)
	}
	if result != "" {
		t.Errorf("expected empty result, got %q", result)
	}
}

func TestGetJobContext_NilSelector(t *testing.T) {
	ctx := context.Background()
	clientset := fake.NewSimpleClientset(
		&batchv1.Job{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "my-job",
				Namespace: "default",
			},
		},
	)

	app := &App{ctx: ctx, testClientset: clientset}

	result, err := app.getJobContext("default", "my-job")
	if err == nil {
		t.Fatal("expected error for job without selector")
	}
	if !strings.Contains(err.Error(), "job has no selector") {
		t.Fatalf("expected selector error, got %v", err)
	}
	if result != "" {
		t.Errorf("expected empty result, got %q", result)
	}
}

func TestGetCronJobContext_ReturnsCronJobInfo(t *testing.T) {
	ctx := context.Background()
	suspend := false
	clientset := fake.NewSimpleClientset(
		&batchv1.CronJob{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "my-cronjob",
				Namespace: "default",
			},
			Spec: batchv1.CronJobSpec{
				Schedule: "*/5 * * * *",
				Suspend:  &suspend,
			},
		},
	)

	app := &App{ctx: ctx, testClientset: clientset}

	result, err := app.getCronJobContext("default", "my-cronjob")
	if err != nil {
		t.Fatalf("getCronJobContext failed: %v", err)
	}

	if !strings.Contains(result, "CronJob: default/my-cronjob") {
		t.Error("expected cronjob name in result")
	}
	if !strings.Contains(result, "*/5 * * * *") {
		t.Error("expected schedule in result")
	}
	if !strings.Contains(result, "Status: Active") {
		t.Error("expected status Active in result")
	}
}

func TestGetCronJobContext_CronJobNotFound(t *testing.T) {
	ctx := context.Background()
	clientset := fake.NewSimpleClientset()

	app := &App{ctx: ctx, testClientset: clientset}

	_, err := app.getCronJobContext("default", "nonexistent")
	if err == nil {
		t.Fatal("expected error for nonexistent cronjob")
	}
}

func TestGetServiceContext_ReturnsServiceInfo(t *testing.T) {
	ctx := context.Background()
	clientset := fake.NewSimpleClientset(
		&corev1.Service{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "my-service",
				Namespace: "default",
			},
			Spec: corev1.ServiceSpec{
				Type:      corev1.ServiceTypeClusterIP,
				ClusterIP: "10.0.0.1",
				Ports: []corev1.ServicePort{
					{Name: "http", Port: 80},
				},
			},
		},
	)

	app := &App{ctx: ctx, testClientset: clientset}

	result, err := app.getServiceContext("default", "my-service")
	if err != nil {
		t.Fatalf("getServiceContext failed: %v", err)
	}

	if !strings.Contains(result, "Service: default/my-service") {
		t.Error("expected service name in result")
	}
	if !strings.Contains(result, "Type: ClusterIP") {
		t.Error("expected type in result")
	}
	if !strings.Contains(result, "10.0.0.1") {
		t.Error("expected ClusterIP in result")
	}
}

func TestGetServiceContext_PortsAndEndpoints(t *testing.T) {
	ctx := context.Background()
	clientset := fake.NewSimpleClientset(
		&corev1.Service{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "my-service",
				Namespace: "default",
			},
			Spec: corev1.ServiceSpec{
				Type:      corev1.ServiceTypeClusterIP,
				ClusterIP: "10.0.0.1",
				Ports: []corev1.ServicePort{
					{Name: "http", Port: 80, TargetPort: intstr.FromInt(8080)},
					{Port: 443, TargetPort: intstr.FromInt(8443)},
				},
			},
		},
		&corev1.Endpoints{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "my-service",
				Namespace: "default",
			},
			Subsets: []corev1.EndpointSubset{
				{
					Addresses: []corev1.EndpointAddress{
						{IP: "10.0.0.2"},
						{IP: "10.0.0.3"},
					},
				},
			},
		},
	)

	app := &App{ctx: ctx, testClientset: clientset}

	result, err := app.getServiceContext("default", "my-service")
	if err != nil {
		t.Fatalf("getServiceContext failed: %v", err)
	}
	if !strings.Contains(result, "Ports:") {
		t.Error("expected Ports section in result")
	}
	if !strings.Contains(result, "http: 80 -> 8080") {
		t.Error("expected named port formatting in result")
	}
	if !strings.Contains(result, "port: 443 -> 8443") {
		t.Error("expected default port formatting in result")
	}
	if !strings.Contains(result, "Endpoints: 2 ready") {
		t.Error("expected endpoints count in result")
	}
}

func TestGetServiceContext_ServiceNotFound(t *testing.T) {
	ctx := context.Background()
	clientset := fake.NewSimpleClientset()

	app := &App{ctx: ctx, testClientset: clientset}

	_, err := app.getServiceContext("default", "nonexistent")
	if err == nil {
		t.Fatal("expected error for nonexistent service")
	}
}

func TestGetConfigMapContext_ReturnsConfigMapInfo(t *testing.T) {
	ctx := context.Background()
	clientset := fake.NewSimpleClientset(
		&corev1.ConfigMap{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "my-configmap",
				Namespace: "default",
			},
			Data: map[string]string{
				"config.yml": "key: value",
			},
		},
	)

	app := &App{ctx: ctx, testClientset: clientset}

	result, err := app.getConfigMapContext("default", "my-configmap")
	if err != nil {
		t.Fatalf("getConfigMapContext failed: %v", err)
	}

	if !strings.Contains(result, "ConfigMap: default/my-configmap") {
		t.Error("expected configmap name in result")
	}
	if !strings.Contains(result, "Data Keys: 1") {
		t.Error("expected data keys count in result")
	}
	if !strings.Contains(result, "config.yml") {
		t.Error("expected data key name in result")
	}
}

func TestGetConfigMapContext_ConfigMapNotFound(t *testing.T) {
	ctx := context.Background()
	clientset := fake.NewSimpleClientset()

	app := &App{ctx: ctx, testClientset: clientset}

	_, err := app.getConfigMapContext("default", "nonexistent")
	if err == nil {
		t.Fatal("expected error for nonexistent configmap")
	}
}

func TestGetSecretContext_ReturnsSecretInfo(t *testing.T) {
	ctx := context.Background()
	clientset := fake.NewSimpleClientset(
		&corev1.Secret{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "my-secret",
				Namespace: "default",
			},
			Type: corev1.SecretTypeOpaque,
			Data: map[string][]byte{
				"password": []byte("secret"),
			},
		},
	)

	app := &App{ctx: ctx, testClientset: clientset}

	result, err := app.getSecretContext("default", "my-secret")
	if err != nil {
		t.Fatalf("getSecretContext failed: %v", err)
	}

	if !strings.Contains(result, "Secret: default/my-secret") {
		t.Error("expected secret name in result")
	}
	if !strings.Contains(result, "Type: Opaque") {
		t.Error("expected type in result")
	}
	if !strings.Contains(result, "password") {
		t.Error("expected data key name in result")
	}
}

func TestGetSecretContext_SecretNotFound(t *testing.T) {
	ctx := context.Background()
	clientset := fake.NewSimpleClientset()

	app := &App{ctx: ctx, testClientset: clientset}

	_, err := app.getSecretContext("default", "nonexistent")
	if err == nil {
		t.Fatal("expected error for nonexistent secret")
	}
}

func TestGetPersistentVolumeContext_ReturnsPVInfo(t *testing.T) {
	ctx := context.Background()
	clientset := fake.NewSimpleClientset(
		&corev1.PersistentVolume{
			ObjectMeta: metav1.ObjectMeta{
				Name: "my-pv",
			},
			Spec: corev1.PersistentVolumeSpec{
				AccessModes: []corev1.PersistentVolumeAccessMode{corev1.ReadWriteOnce},
			},
			Status: corev1.PersistentVolumeStatus{
				Phase: corev1.VolumeBound,
			},
		},
	)

	app := &App{ctx: ctx, testClientset: clientset}

	result, err := app.getPersistentVolumeContext("my-pv")
	if err != nil {
		t.Fatalf("getPersistentVolumeContext failed: %v", err)
	}

	if !strings.Contains(result, "PersistentVolume: my-pv") {
		t.Error("expected PV name in result")
	}
	if !strings.Contains(result, "Status: Bound") {
		t.Error("expected status in result")
	}
}

func TestGetPersistentVolumeContext_PVNotFound(t *testing.T) {
	ctx := context.Background()
	clientset := fake.NewSimpleClientset()

	app := &App{ctx: ctx, testClientset: clientset}

	_, err := app.getPersistentVolumeContext("nonexistent")
	if err == nil {
		t.Fatal("expected error for nonexistent PV")
	}
}

func TestGetPersistentVolumeClaimContext_ReturnsPVCInfo(t *testing.T) {
	ctx := context.Background()
	clientset := fake.NewSimpleClientset(
		&corev1.PersistentVolumeClaim{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "my-pvc",
				Namespace: "default",
			},
			Spec: corev1.PersistentVolumeClaimSpec{
				AccessModes: []corev1.PersistentVolumeAccessMode{corev1.ReadWriteOnce},
			},
			Status: corev1.PersistentVolumeClaimStatus{
				Phase: corev1.ClaimBound,
			},
		},
	)

	app := &App{ctx: ctx, testClientset: clientset}

	result, err := app.getPersistentVolumeClaimContext("default", "my-pvc")
	if err != nil {
		t.Fatalf("getPersistentVolumeClaimContext failed: %v", err)
	}

	if !strings.Contains(result, "PersistentVolumeClaim: default/my-pvc") {
		t.Error("expected PVC name in result")
	}
	if !strings.Contains(result, "Status: Bound") {
		t.Error("expected status in result")
	}
}

func TestGetPersistentVolumeClaimContext_PVCNotFound(t *testing.T) {
	ctx := context.Background()
	clientset := fake.NewSimpleClientset()

	app := &App{ctx: ctx, testClientset: clientset}

	_, err := app.getPersistentVolumeClaimContext("default", "nonexistent")
	if err == nil {
		t.Fatal("expected error for nonexistent PVC")
	}
}

func TestGetIngressContext_ReturnsIngressInfo(t *testing.T) {
	ctx := context.Background()
	ingressClassName := "nginx"
	pathType := networkingv1.PathTypePrefix
	clientset := fake.NewSimpleClientset(
		&networkingv1.Ingress{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "my-ingress",
				Namespace: "default",
			},
			Spec: networkingv1.IngressSpec{
				IngressClassName: &ingressClassName,
				TLS: []networkingv1.IngressTLS{
					{SecretName: "tls-secret", Hosts: []string{"example.com"}},
				},
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
												Name: "my-service",
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
		},
	)

	app := &App{ctx: ctx, testClientset: clientset}

	result, err := app.getIngressContext("default", "my-ingress")
	if err != nil {
		t.Fatalf("getIngressContext failed: %v", err)
	}

	if !strings.Contains(result, "Ingress: default/my-ingress") {
		t.Error("expected ingress name in result")
	}
	if !strings.Contains(result, "IngressClass: nginx") {
		t.Error("expected ingress class in result")
	}
	if !strings.Contains(result, "example.com") {
		t.Error("expected host in result")
	}
	if !strings.Contains(result, "my-service") {
		t.Error("expected service name in result")
	}
}

func TestGetIngressContext_IngressNotFound(t *testing.T) {
	ctx := context.Background()
	clientset := fake.NewSimpleClientset()

	app := &App{ctx: ctx, testClientset: clientset}

	_, err := app.getIngressContext("default", "nonexistent")
	if err == nil {
		t.Fatal("expected error for nonexistent ingress")
	}
}

func TestAppendRecentEvents_EventTimeFallbackAndLimit(t *testing.T) {
	ctx := context.Background()
	eventTime := time.Date(2026, time.February, 8, 1, 2, 3, 0, time.UTC)

	objects := make([]runtime.Object, 0, 11)
	for i := 0; i < 11; i++ {
		event := &corev1.Event{
			ObjectMeta: metav1.ObjectMeta{
				Name:      fmt.Sprintf("event-%d", i),
				Namespace: "default",
			},
			InvolvedObject: corev1.ObjectReference{
				Kind: "Pod",
				Name: "my-pod",
			},
			Reason:  fmt.Sprintf("Reason-%d", i),
			Message: "event message",
		}
		if i == 10 {
			event.EventTime = metav1.MicroTime{Time: eventTime}
		} else {
			event.LastTimestamp = metav1.NewTime(eventTime.Add(time.Duration(i) * time.Minute))
		}
		objects = append(objects, event)
	}

	clientset := fake.NewSimpleClientset(objects...)
	var sb strings.Builder
	appendRecentEvents(ctx, &sb, clientset.CoreV1().Events("default"), "my-pod", "Pod")

	result := sb.String()
	if !strings.Contains(result, "Recent Events (last 10):") {
		t.Fatalf("expected recent events header, got %q", result)
	}
	if !strings.Contains(result, eventTime.Format("15:04:05")) {
		t.Fatalf("expected event time fallback in result, got %q", result)
	}
	if strings.Count(result, "\n  [") != 10 {
		t.Fatalf("expected 10 events in output, got %d", strings.Count(result, "\n  ["))
	}
}

func TestGetRecentPodLogs_ErrorFormatting(t *testing.T) {
	app := &App{
		testPodLogsFetcher: func(namespace, podName, containerName string, lines int) (string, error) {
			return "", fmt.Errorf("read failed")
		},
	}

	result := app.getRecentPodLogs("default", "my-pod", 10)
	if !strings.Contains(result, "(Failed to fetch logs: read failed)") {
		t.Fatalf("unexpected log error formatting: %q", result)
	}
}
