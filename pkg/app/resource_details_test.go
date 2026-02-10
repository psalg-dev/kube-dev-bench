package app

import (
	"context"
	"fmt"
	"testing"
	"time"

	appsv1 "k8s.io/api/apps/v1"
	batchv1 "k8s.io/api/batch/v1"
	corev1 "k8s.io/api/core/v1"
	networkingv1 "k8s.io/api/networking/v1"
	"k8s.io/apimachinery/pkg/api/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes/fake"
)

func int32PtrTest(i int32) *int32 { return &i }

// Tests for GetJobDetail
func TestGetJobDetail(t *testing.T) {
	clientset := fake.NewSimpleClientset()

	// Create a job
	job := &batchv1.Job{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "test-job",
			Namespace: "default",
			UID:       "job-uid-123",
		},
		Spec: batchv1.JobSpec{
			Selector: &metav1.LabelSelector{
				MatchLabels: map[string]string{"job-name": "test-job"},
			},
			Template: corev1.PodTemplateSpec{
				ObjectMeta: metav1.ObjectMeta{
					Labels: map[string]string{"job-name": "test-job"},
				},
				Spec: corev1.PodSpec{
					Containers:    []corev1.Container{{Name: "test", Image: "busybox"}},
					RestartPolicy: corev1.RestartPolicyNever,
				},
			},
		},
		Status: batchv1.JobStatus{
			Conditions: []batchv1.JobCondition{
				{
					Type:               batchv1.JobComplete,
					Status:             corev1.ConditionTrue,
					LastTransitionTime: metav1.Now(),
					Reason:             "Job completed",
					Message:            "Job completed successfully",
				},
			},
		},
	}
	_, _ = clientset.BatchV1().Jobs("default").Create(context.Background(), job, metav1.CreateOptions{})

	// Create a pod owned by the job
	pod := &corev1.Pod{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "test-job-pod",
			Namespace: "default",
			Labels:    map[string]string{"job-name": "test-job"},
			OwnerReferences: []metav1.OwnerReference{
				{
					Kind: "Job",
					Name: "test-job",
				},
			},
		},
		Spec: corev1.PodSpec{
			Containers: []corev1.Container{{Name: "test", Image: "busybox"}},
		},
		Status: corev1.PodStatus{
			Phase: corev1.PodSucceeded,
		},
	}
	_, _ = clientset.CoreV1().Pods("default").Create(context.Background(), pod, metav1.CreateOptions{})

	app := &App{ctx: context.Background(), testClientset: clientset}
	detail, err := app.GetJobDetail("default", "test-job")
	if err != nil {
		t.Fatalf("GetJobDetail failed: %v", err)
	}

	if len(detail.Pods) != 1 {
		t.Errorf("expected 1 pod, got %d", len(detail.Pods))
	}
	if len(detail.Conditions) != 1 {
		t.Errorf("expected 1 condition, got %d", len(detail.Conditions))
	}
}

// Tests for GetCronJobDetail
func TestGetCronJobDetail(t *testing.T) {
	clientset := fake.NewSimpleClientset()

	cronJob := &batchv1.CronJob{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "test-cronjob",
			Namespace: "default",
			UID:       "cronjob-uid-123",
		},
		Spec: batchv1.CronJobSpec{
			Schedule: "* * * * *",
			JobTemplate: batchv1.JobTemplateSpec{
				Spec: batchv1.JobSpec{
					Template: corev1.PodTemplateSpec{
						Spec: corev1.PodSpec{
							Containers:    []corev1.Container{{Name: "test", Image: "busybox"}},
							RestartPolicy: corev1.RestartPolicyNever,
						},
					},
				},
			},
		},
		Status: batchv1.CronJobStatus{
			LastScheduleTime: &metav1.Time{Time: time.Now().Add(-1 * time.Hour)},
		},
	}
	_, _ = clientset.BatchV1().CronJobs("default").Create(context.Background(), cronJob, metav1.CreateOptions{})

	// Create some jobs owned by the cronjob with various statuses
	now := time.Now()

	// Succeeded job
	succeededJob := &batchv1.Job{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "test-cronjob-job-1",
			Namespace: "default",
			OwnerReferences: []metav1.OwnerReference{
				{Kind: "CronJob", Name: "test-cronjob"},
			},
		},
		Status: batchv1.JobStatus{
			Succeeded:      1,
			StartTime:      &metav1.Time{Time: now.Add(-10 * time.Minute)},
			CompletionTime: &metav1.Time{Time: now.Add(-5 * time.Minute)},
		},
	}
	_, _ = clientset.BatchV1().Jobs("default").Create(context.Background(), succeededJob, metav1.CreateOptions{})

	// Failed job
	failedJob := &batchv1.Job{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "test-cronjob-job-2",
			Namespace: "default",
			OwnerReferences: []metav1.OwnerReference{
				{Kind: "CronJob", Name: "test-cronjob"},
			},
		},
		Status: batchv1.JobStatus{
			Failed:    1,
			StartTime: &metav1.Time{Time: now.Add(-20 * time.Minute)},
		},
	}
	_, _ = clientset.BatchV1().Jobs("default").Create(context.Background(), failedJob, metav1.CreateOptions{})

	// Running job
	runningJob := &batchv1.Job{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "test-cronjob-job-3",
			Namespace: "default",
			OwnerReferences: []metav1.OwnerReference{
				{Kind: "CronJob", Name: "test-cronjob"},
			},
		},
		Status: batchv1.JobStatus{
			Active:    1,
			StartTime: &metav1.Time{Time: now.Add(-1 * time.Minute)},
		},
	}
	_, _ = clientset.BatchV1().Jobs("default").Create(context.Background(), runningJob, metav1.CreateOptions{})

	// Unrelated job (not owned by cronjob)
	unrelatedJob := &batchv1.Job{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "unrelated-job",
			Namespace: "default",
		},
		Status: batchv1.JobStatus{Succeeded: 1},
	}
	_, _ = clientset.BatchV1().Jobs("default").Create(context.Background(), unrelatedJob, metav1.CreateOptions{})

	app := &App{ctx: context.Background(), testClientset: clientset}
	detail, err := app.GetCronJobDetail("default", "test-cronjob")
	if err != nil {
		t.Fatalf("GetCronJobDetail failed: %v", err)
	}

	if detail == nil {
		t.Fatal("expected non-nil detail")
	}

	// Should have 3 jobs (not counting unrelated job)
	if len(detail.Jobs) != 3 {
		t.Errorf("expected 3 jobs, got %d", len(detail.Jobs))
	}

	// Verify job statuses
	statuses := map[string]bool{}
	for _, job := range detail.Jobs {
		statuses[job.Status] = true
	}
	if !statuses["Succeeded"] {
		t.Error("expected a Succeeded job")
	}
	if !statuses["Failed"] {
		t.Error("expected a Failed job")
	}
	if !statuses["Running"] {
		t.Error("expected a Running job")
	}
}

// Tests for GetConfigMapDataByName
func TestGetConfigMapDataByName(t *testing.T) {
	clientset := fake.NewSimpleClientset()

	cm := &corev1.ConfigMap{
		ObjectMeta: metav1.ObjectMeta{Name: "test-cm", Namespace: "default"},
		Data: map[string]string{
			"config.yaml": "key: value",
			"app.json":    `{"enabled": true}`,
		},
	}
	_, _ = clientset.CoreV1().ConfigMaps("default").Create(context.Background(), cm, metav1.CreateOptions{})

	app := &App{ctx: context.Background(), testClientset: clientset}
	data, err := app.GetConfigMapDataByName("default", "test-cm")
	if err != nil {
		t.Fatalf("GetConfigMapDataByName failed: %v", err)
	}

	if len(data) != 2 {
		t.Errorf("expected 2 entries, got %d", len(data))
	}
}

// Tests for GetSecretDataByName
func TestGetSecretDataByName(t *testing.T) {
	clientset := fake.NewSimpleClientset()

	secret := &corev1.Secret{
		ObjectMeta: metav1.ObjectMeta{Name: "test-secret", Namespace: "default"},
		Type:       corev1.SecretTypeOpaque,
		Data: map[string][]byte{
			"username": []byte("admin"),
			"password": []byte("secret123"),
		},
	}
	_, _ = clientset.CoreV1().Secrets("default").Create(context.Background(), secret, metav1.CreateOptions{})

	app := &App{ctx: context.Background(), testClientset: clientset}
	data, err := app.GetSecretDataByName("default", "test-secret")
	if err != nil {
		t.Fatalf("GetSecretDataByName failed: %v", err)
	}

	if len(data) != 2 {
		t.Errorf("expected 2 entries, got %d", len(data))
	}
}

// Tests for GetDeploymentDetail
func TestGetDeploymentDetail(t *testing.T) {
	clientset := fake.NewSimpleClientset()

	deploy := &appsv1.Deployment{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "test-deploy",
			Namespace: "default",
			UID:       "deploy-uid-123",
		},
		Spec: appsv1.DeploymentSpec{
			Replicas: int32PtrTest(2),
			Selector: &metav1.LabelSelector{
				MatchLabels: map[string]string{"app": "test"},
			},
			Template: corev1.PodTemplateSpec{
				ObjectMeta: metav1.ObjectMeta{Labels: map[string]string{"app": "test"}},
				Spec:       corev1.PodSpec{Containers: []corev1.Container{{Name: "nginx", Image: "nginx"}}},
			},
		},
	}
	_, _ = clientset.AppsV1().Deployments("default").Create(context.Background(), deploy, metav1.CreateOptions{})

	// Create owned pods
	pod := &corev1.Pod{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "test-deploy-pod",
			Namespace: "default",
			Labels:    map[string]string{"app": "test"},
			OwnerReferences: []metav1.OwnerReference{
				{Kind: "ReplicaSet", Name: "test-deploy-rs"},
			},
		},
		Status: corev1.PodStatus{Phase: corev1.PodRunning},
	}
	_, _ = clientset.CoreV1().Pods("default").Create(context.Background(), pod, metav1.CreateOptions{})

	// Create owned replicaset
	rs := &appsv1.ReplicaSet{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "test-deploy-rs",
			Namespace: "default",
			Labels:    map[string]string{"app": "test"},
			OwnerReferences: []metav1.OwnerReference{
				{Kind: "Deployment", Name: "test-deploy"},
			},
		},
	}
	_, _ = clientset.AppsV1().ReplicaSets("default").Create(context.Background(), rs, metav1.CreateOptions{})

	app := &App{ctx: context.Background(), testClientset: clientset}
	detail, err := app.GetDeploymentDetail("default", "test-deploy")
	if err != nil {
		t.Fatalf("GetDeploymentDetail failed: %v", err)
	}

	if detail == nil {
		t.Fatal("expected non-nil detail")
	}
}

// Tests for GetStatefulSetDetail
func TestGetStatefulSetDetail(t *testing.T) {
	clientset := fake.NewSimpleClientset()

	sts := &appsv1.StatefulSet{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "test-sts",
			Namespace: "default",
			UID:       "sts-uid-123",
		},
		Spec: appsv1.StatefulSetSpec{
			Replicas: int32PtrTest(2),
			Selector: &metav1.LabelSelector{
				MatchLabels: map[string]string{"app": "test"},
			},
			Template: corev1.PodTemplateSpec{
				ObjectMeta: metav1.ObjectMeta{Labels: map[string]string{"app": "test"}},
				Spec:       corev1.PodSpec{Containers: []corev1.Container{{Name: "nginx", Image: "nginx"}}},
			},
			VolumeClaimTemplates: []corev1.PersistentVolumeClaim{
				{
					ObjectMeta: metav1.ObjectMeta{Name: "data"},
					Spec: corev1.PersistentVolumeClaimSpec{
						AccessModes: []corev1.PersistentVolumeAccessMode{corev1.ReadWriteOnce},
					},
				},
			},
		},
	}
	_, _ = clientset.AppsV1().StatefulSets("default").Create(context.Background(), sts, metav1.CreateOptions{})

	// Create pods owned by the statefulset
	for i := 0; i < 2; i++ {
		pod := &corev1.Pod{
			ObjectMeta: metav1.ObjectMeta{
				Name:      fmt.Sprintf("test-sts-%d", i),
				Namespace: "default",
				Labels:    map[string]string{"app": "test"},
				OwnerReferences: []metav1.OwnerReference{
					{Kind: "StatefulSet", Name: "test-sts"},
				},
			},
			Spec: corev1.PodSpec{
				NodeName:   "node-1",
				Containers: []corev1.Container{{Name: "nginx", Image: "nginx"}},
			},
			Status: corev1.PodStatus{
				Phase: corev1.PodRunning,
				PodIP: fmt.Sprintf("10.0.0.%d", i+1),
				ContainerStatuses: []corev1.ContainerStatus{
					{Name: "nginx", Ready: true, RestartCount: int32(i)},
				},
			},
		}
		_, _ = clientset.CoreV1().Pods("default").Create(context.Background(), pod, metav1.CreateOptions{})
	}

	// Create PVCs matching statefulset naming pattern
	storageClass := "standard"
	for i := 0; i < 2; i++ {
		pvc := &corev1.PersistentVolumeClaim{
			ObjectMeta: metav1.ObjectMeta{
				Name:      fmt.Sprintf("data-test-sts-%d", i),
				Namespace: "default",
			},
			Spec: corev1.PersistentVolumeClaimSpec{
				AccessModes:      []corev1.PersistentVolumeAccessMode{corev1.ReadWriteOnce},
				StorageClassName: &storageClass,
			},
			Status: corev1.PersistentVolumeClaimStatus{
				Phase:    corev1.ClaimBound,
				Capacity: corev1.ResourceList{"storage": resource.MustParse("1Gi")},
			},
		}
		_, _ = clientset.CoreV1().PersistentVolumeClaims("default").Create(context.Background(), pvc, metav1.CreateOptions{})
	}

	app := &App{ctx: context.Background(), testClientset: clientset}
	detail, err := app.GetStatefulSetDetail("default", "test-sts")
	if err != nil {
		t.Fatalf("GetStatefulSetDetail failed: %v", err)
	}

	if detail == nil {
		t.Fatal("expected non-nil detail")
	}

	if len(detail.Pods) != 2 {
		t.Errorf("expected 2 pods, got %d", len(detail.Pods))
	}

	if len(detail.PVCs) != 2 {
		t.Errorf("expected 2 PVCs, got %d", len(detail.PVCs))
	}

	// Verify pod details
	for _, pod := range detail.Pods {
		if pod.Status != "Running" {
			t.Errorf("expected pod status Running, got %s", pod.Status)
		}
		if pod.Ready != "1/1" {
			t.Errorf("expected ready 1/1, got %s", pod.Ready)
		}
	}

	// Verify PVC details
	for _, pvc := range detail.PVCs {
		if pvc.Status != "Bound" {
			t.Errorf("expected PVC status Bound, got %s", pvc.Status)
		}
		if pvc.StorageClass != "standard" {
			t.Errorf("expected storage class standard, got %s", pvc.StorageClass)
		}
	}
}

// Tests for GetDaemonSetDetail
func TestGetDaemonSetDetail(t *testing.T) {
	clientset := fake.NewSimpleClientset()

	ds := &appsv1.DaemonSet{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "test-ds",
			Namespace: "default",
			UID:       "ds-uid-123",
		},
		Spec: appsv1.DaemonSetSpec{
			Selector: &metav1.LabelSelector{
				MatchLabels: map[string]string{"app": "test"},
			},
			Template: corev1.PodTemplateSpec{
				ObjectMeta: metav1.ObjectMeta{Labels: map[string]string{"app": "test"}},
				Spec:       corev1.PodSpec{Containers: []corev1.Container{{Name: "nginx", Image: "nginx"}}},
			},
		},
		Status: appsv1.DaemonSetStatus{
			DesiredNumberScheduled: 3,
			CurrentNumberScheduled: 3,
			NumberReady:            2,
			NumberAvailable:        2,
		},
	}
	_, _ = clientset.AppsV1().DaemonSets("default").Create(context.Background(), ds, metav1.CreateOptions{})

	// Create pods owned by the daemonset
	nodes := []string{"node-1", "node-2", "node-3"}
	for i, node := range nodes {
		pod := &corev1.Pod{
			ObjectMeta: metav1.ObjectMeta{
				Name:      fmt.Sprintf("test-ds-pod-%d", i),
				Namespace: "default",
				Labels:    map[string]string{"app": "test"},
				OwnerReferences: []metav1.OwnerReference{
					{Kind: "DaemonSet", Name: "test-ds"},
				},
			},
			Spec: corev1.PodSpec{
				NodeName:   node,
				Containers: []corev1.Container{{Name: "nginx", Image: "nginx"}},
			},
			Status: corev1.PodStatus{
				Phase: corev1.PodRunning,
				PodIP: fmt.Sprintf("10.0.0.%d", i+1),
				ContainerStatuses: []corev1.ContainerStatus{
					{Name: "nginx", Ready: i < 2, RestartCount: int32(i)},
				},
			},
		}
		_, _ = clientset.CoreV1().Pods("default").Create(context.Background(), pod, metav1.CreateOptions{})
	}

	app := &App{ctx: context.Background(), testClientset: clientset}
	detail, err := app.GetDaemonSetDetail("default", "test-ds")
	if err != nil {
		t.Fatalf("GetDaemonSetDetail failed: %v", err)
	}

	if detail == nil {
		t.Error("expected non-nil detail")
	}

	if len(detail.Pods) != 3 {
		t.Errorf("expected 3 pods, got %d", len(detail.Pods))
	}

	// Verify pods are on different nodes
	nodesSeen := map[string]bool{}
	for _, pod := range detail.Pods {
		nodesSeen[pod.Node] = true
	}
	if len(nodesSeen) != 3 {
		t.Errorf("expected 3 different nodes, got %d", len(nodesSeen))
	}
}

// Tests for GetReplicaSetDetail
func TestGetReplicaSetDetail(t *testing.T) {
	clientset := fake.NewSimpleClientset()

	rs := &appsv1.ReplicaSet{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "test-rs",
			Namespace: "default",
			UID:       "rs-uid-123",
		},
		Spec: appsv1.ReplicaSetSpec{
			Replicas: int32PtrTest(2),
			Selector: &metav1.LabelSelector{
				MatchLabels: map[string]string{"app": "test"},
			},
			Template: corev1.PodTemplateSpec{
				ObjectMeta: metav1.ObjectMeta{Labels: map[string]string{"app": "test"}},
				Spec:       corev1.PodSpec{Containers: []corev1.Container{{Name: "nginx", Image: "nginx"}}},
			},
		},
		Status: appsv1.ReplicaSetStatus{
			Replicas:          2,
			ReadyReplicas:     2,
			AvailableReplicas: 2,
		},
	}
	_, _ = clientset.AppsV1().ReplicaSets("default").Create(context.Background(), rs, metav1.CreateOptions{})

	// Create pods owned by the replicaset
	for i := 0; i < 2; i++ {
		pod := &corev1.Pod{
			ObjectMeta: metav1.ObjectMeta{
				Name:      fmt.Sprintf("test-rs-pod-%d", i),
				Namespace: "default",
				Labels:    map[string]string{"app": "test"},
				OwnerReferences: []metav1.OwnerReference{
					{Kind: "ReplicaSet", Name: "test-rs"},
				},
			},
			Spec: corev1.PodSpec{
				NodeName:   "node-1",
				Containers: []corev1.Container{{Name: "nginx", Image: "nginx"}},
			},
			Status: corev1.PodStatus{
				Phase: corev1.PodRunning,
				PodIP: fmt.Sprintf("10.0.0.%d", i+1),
				ContainerStatuses: []corev1.ContainerStatus{
					{Name: "nginx", Ready: true, RestartCount: int32(i)},
				},
			},
		}
		_, _ = clientset.CoreV1().Pods("default").Create(context.Background(), pod, metav1.CreateOptions{})
	}

	app := &App{ctx: context.Background(), testClientset: clientset}
	detail, err := app.GetReplicaSetDetail("default", "test-rs")
	if err != nil {
		t.Fatalf("GetReplicaSetDetail failed: %v", err)
	}

	if detail == nil {
		t.Error("expected non-nil detail")
	}

	if len(detail.Pods) != 2 {
		t.Errorf("expected 2 pods, got %d", len(detail.Pods))
	}

	// Verify pod details
	for _, pod := range detail.Pods {
		if pod.Status != "Running" {
			t.Errorf("expected pod status Running, got %s", pod.Status)
		}
	}
}

// Tests for GetIngressDetail
func TestGetIngressDetail(t *testing.T) {
	clientset := fake.NewSimpleClientset()

	pathType := networkingv1.PathTypePrefix
	ingress := &networkingv1.Ingress{
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
	}
	_, _ = clientset.NetworkingV1().Ingresses("default").Create(context.Background(), ingress, metav1.CreateOptions{})

	app := &App{ctx: context.Background(), testClientset: clientset}
	detail, err := app.GetIngressDetail("default", "test-ingress")
	if err != nil {
		t.Fatalf("GetIngressDetail failed: %v", err)
	}

	if detail == nil {
		t.Error("expected non-nil detail")
	}
	if len(detail.Rules) != 1 {
		t.Errorf("expected 1 rule, got %d", len(detail.Rules))
	}
}

func TestGetDeploymentDetail_NotFound(t *testing.T) {
	cs := fake.NewSimpleClientset()
	app := &App{ctx: context.Background(), testClientset: cs}
	_, err := app.GetDeploymentDetail("default", "missing-deploy")
	if err == nil {
		t.Fatal("expected error for missing deployment")
	}
}

func TestGetDeploymentDetail_EmptySelectorPods(t *testing.T) {
	cs := fake.NewSimpleClientset()
	dep := &appsv1.Deployment{ObjectMeta: metav1.ObjectMeta{Name: "no-pods", Namespace: "default"}, Spec: appsv1.DeploymentSpec{Selector: &metav1.LabelSelector{MatchLabels: map[string]string{"app": "no-match"}}}}
	_, _ = cs.AppsV1().Deployments("default").Create(context.Background(), dep, metav1.CreateOptions{})
	app := &App{ctx: context.Background(), testClientset: cs}
	d, err := app.GetDeploymentDetail("default", "no-pods")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(d.Pods) != 0 {
		t.Errorf("expected 0 pods, got %d", len(d.Pods))
	}
}

func TestGetStatefulSetDetail_NotFound(t *testing.T) {
	cs := fake.NewSimpleClientset()
	app := &App{ctx: context.Background(), testClientset: cs}
	_, err := app.GetStatefulSetDetail("default", "missing-sts")
	if err == nil {
		t.Fatal("expected error for missing statefulset")
	}
}

func TestGetStatefulSetDetail_EmptySelectorPods(t *testing.T) {
	cs := fake.NewSimpleClientset()
	sts := &appsv1.StatefulSet{ObjectMeta: metav1.ObjectMeta{Name: "no-pods", Namespace: "default"}, Spec: appsv1.StatefulSetSpec{Selector: &metav1.LabelSelector{MatchLabels: map[string]string{"app": "no-match"}}}}
	_, _ = cs.AppsV1().StatefulSets("default").Create(context.Background(), sts, metav1.CreateOptions{})
	app := &App{ctx: context.Background(), testClientset: cs}
	d, err := app.GetStatefulSetDetail("default", "no-pods")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(d.Pods) != 0 {
		t.Errorf("expected 0 pods, got %d", len(d.Pods))
	}
}

func TestGetDaemonSetDetail_NotFound(t *testing.T) {
	cs := fake.NewSimpleClientset()
	app := &App{ctx: context.Background(), testClientset: cs}
	_, err := app.GetDaemonSetDetail("default", "missing-ds")
	if err == nil {
		t.Fatal("expected error for missing daemonset")
	}
}

func TestGetJobDetail_NotFound(t *testing.T) {
	cs := fake.NewSimpleClientset()
	app := &App{ctx: context.Background(), testClientset: cs}
	_, err := app.GetJobDetail("default", "missing-job")
	if err == nil {
		t.Fatal("expected error for missing job")
	}
}
