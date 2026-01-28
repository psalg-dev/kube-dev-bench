package app

import (
	"context"
	"testing"
	"time"

	appsv1 "k8s.io/api/apps/v1"
	batchv1 "k8s.io/api/batch/v1"
	v1 "k8s.io/api/core/v1"
	networkingv1 "k8s.io/api/networking/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes/fake"
)

func TestResourceCountsEqual_BothEmpty(t *testing.T) {
	a := ResourceCounts{}
	b := ResourceCounts{}

	if !resourceCountsEqual(a, b) {
		t.Error("Expected empty counts to be equal")
	}
}

func TestResourceCountsEqual_SameValues(t *testing.T) {
	a := ResourceCounts{
		PodStatus: PodStatusCounts{
			Running:   5,
			Pending:   2,
			Failed:    1,
			Succeeded: 3,
			Unknown:   0,
			Total:     11,
		},
		Deployments:            10,
		Jobs:                   5,
		CronJobs:               3,
		DaemonSets:             2,
		StatefulSets:           1,
		ReplicaSets:            4,
		ConfigMaps:             8,
		Secrets:                6,
		Ingresses:              2,
		PersistentVolumeClaims: 3,
		PersistentVolumes:      4,
	}

	b := ResourceCounts{
		PodStatus: PodStatusCounts{
			Running:   5,
			Pending:   2,
			Failed:    1,
			Succeeded: 3,
			Unknown:   0,
			Total:     11,
		},
		Deployments:            10,
		Jobs:                   5,
		CronJobs:               3,
		DaemonSets:             2,
		StatefulSets:           1,
		ReplicaSets:            4,
		ConfigMaps:             8,
		Secrets:                6,
		Ingresses:              2,
		PersistentVolumeClaims: 3,
		PersistentVolumes:      4,
	}

	if !resourceCountsEqual(a, b) {
		t.Error("Expected identical counts to be equal")
	}
}

func TestResourceCountsEqual_DifferentPodStatus(t *testing.T) {
	a := ResourceCounts{
		PodStatus: PodStatusCounts{Running: 5},
	}
	b := ResourceCounts{
		PodStatus: PodStatusCounts{Running: 3},
	}

	if resourceCountsEqual(a, b) {
		t.Error("Expected counts with different pod status to be unequal")
	}
}

func TestResourceCountsEqual_DifferentDeployments(t *testing.T) {
	a := ResourceCounts{Deployments: 10}
	b := ResourceCounts{Deployments: 5}

	if resourceCountsEqual(a, b) {
		t.Error("Expected counts with different deployments to be unequal")
	}
}

func TestResourceCountsEqual_DifferentJobs(t *testing.T) {
	a := ResourceCounts{Jobs: 10}
	b := ResourceCounts{Jobs: 5}

	if resourceCountsEqual(a, b) {
		t.Error("Expected counts with different jobs to be unequal")
	}
}

func TestResourceCountsEqual_DifferentCronJobs(t *testing.T) {
	a := ResourceCounts{CronJobs: 10}
	b := ResourceCounts{CronJobs: 5}

	if resourceCountsEqual(a, b) {
		t.Error("Expected counts with different cronjobs to be unequal")
	}
}

func TestResourceCountsEqual_DifferentDaemonSets(t *testing.T) {
	a := ResourceCounts{DaemonSets: 10}
	b := ResourceCounts{DaemonSets: 5}

	if resourceCountsEqual(a, b) {
		t.Error("Expected counts with different daemonsets to be unequal")
	}
}

func TestResourceCountsEqual_DifferentStatefulSets(t *testing.T) {
	a := ResourceCounts{StatefulSets: 10}
	b := ResourceCounts{StatefulSets: 5}

	if resourceCountsEqual(a, b) {
		t.Error("Expected counts with different statefulsets to be unequal")
	}
}

func TestResourceCountsEqual_DifferentReplicaSets(t *testing.T) {
	a := ResourceCounts{ReplicaSets: 10}
	b := ResourceCounts{ReplicaSets: 5}

	if resourceCountsEqual(a, b) {
		t.Error("Expected counts with different replicasets to be unequal")
	}
}

func TestResourceCountsEqual_DifferentConfigMaps(t *testing.T) {
	a := ResourceCounts{ConfigMaps: 10}
	b := ResourceCounts{ConfigMaps: 5}

	if resourceCountsEqual(a, b) {
		t.Error("Expected counts with different configmaps to be unequal")
	}
}

func TestResourceCountsEqual_DifferentSecrets(t *testing.T) {
	a := ResourceCounts{Secrets: 10}
	b := ResourceCounts{Secrets: 5}

	if resourceCountsEqual(a, b) {
		t.Error("Expected counts with different secrets to be unequal")
	}
}

func TestResourceCountsEqual_DifferentIngresses(t *testing.T) {
	a := ResourceCounts{Ingresses: 10}
	b := ResourceCounts{Ingresses: 5}

	if resourceCountsEqual(a, b) {
		t.Error("Expected counts with different ingresses to be unequal")
	}
}

func TestResourceCountsEqual_DifferentPVCs(t *testing.T) {
	a := ResourceCounts{PersistentVolumeClaims: 10}
	b := ResourceCounts{PersistentVolumeClaims: 5}

	if resourceCountsEqual(a, b) {
		t.Error("Expected counts with different PVCs to be unequal")
	}
}

func TestResourceCountsEqual_DifferentPVs(t *testing.T) {
	a := ResourceCounts{PersistentVolumes: 10}
	b := ResourceCounts{PersistentVolumes: 5}

	if resourceCountsEqual(a, b) {
		t.Error("Expected counts with different PVs to be unequal")
	}
}

func TestResourceCountsEqual_AllPodStatusFields(t *testing.T) {
	tests := []struct {
		name string
		a    PodStatusCounts
		b    PodStatusCounts
	}{
		{"different Pending", PodStatusCounts{Pending: 1}, PodStatusCounts{Pending: 2}},
		{"different Failed", PodStatusCounts{Failed: 1}, PodStatusCounts{Failed: 2}},
		{"different Succeeded", PodStatusCounts{Succeeded: 1}, PodStatusCounts{Succeeded: 2}},
		{"different Unknown", PodStatusCounts{Unknown: 1}, PodStatusCounts{Unknown: 2}},
		{"different Total", PodStatusCounts{Total: 1}, PodStatusCounts{Total: 2}},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			a := ResourceCounts{PodStatus: tc.a}
			b := ResourceCounts{PodStatus: tc.b}
			if resourceCountsEqual(a, b) {
				t.Error("Expected counts with different pod status to be unequal")
			}
		})
	}
}

// Tests for GetResourceCounts function
func TestGetResourceCounts(t *testing.T) {
	app := &App{
		lastResourceCounts: ResourceCounts{
			PodStatus: PodStatusCounts{
				Running: 10,
				Pending: 2,
				Total:   12,
			},
			Deployments: 5,
			Jobs:        3,
		},
	}

	result := app.GetResourceCounts()

	if result.Deployments != 5 {
		t.Errorf("expected 5 deployments, got %d", result.Deployments)
	}
	if result.Jobs != 3 {
		t.Errorf("expected 3 jobs, got %d", result.Jobs)
	}
	if result.PodStatus.Running != 10 {
		t.Errorf("expected 10 running pods, got %d", result.PodStatus.Running)
	}
}

// Tests for GetResourceCounts concurrency safety
func TestGetResourceCounts_Concurrency(t *testing.T) {
	app := &App{
		lastResourceCounts: ResourceCounts{
			Deployments: 1,
		},
	}

	// Read from multiple goroutines
	done := make(chan bool, 10)
	for i := 0; i < 10; i++ {
		go func() {
			_ = app.GetResourceCounts()
			done <- true
		}()
	}

	// Wait for all goroutines
	for i := 0; i < 10; i++ {
		<-done
	}
}

func TestRefreshPodStatusOnly_UpdatesPodStatus(t *testing.T) {
	clientset := fake.NewSimpleClientset()
	_, err := clientset.CoreV1().Pods("default").Create(context.Background(), &v1.Pod{
		ObjectMeta: metav1.ObjectMeta{Name: "p1", Namespace: "default"},
		Status:     v1.PodStatus{Phase: v1.PodRunning},
	}, metav1.CreateOptions{})
	if err != nil {
		t.Fatalf("failed to create pod: %v", err)
	}
	_, err = clientset.CoreV1().Pods("default").Create(context.Background(), &v1.Pod{
		ObjectMeta: metav1.ObjectMeta{Name: "p2", Namespace: "default"},
		Status:     v1.PodStatus{Phase: v1.PodFailed},
	}, metav1.CreateOptions{})
	if err != nil {
		t.Fatalf("failed to create pod: %v", err)
	}

	app := &App{
		ctx:                context.Background(),
		currentKubeContext: "test",
		currentNamespace:   "default",
		testClientset:      clientset,
		lastResourceCounts: ResourceCounts{
			Deployments: 5,
			PodStatus:   PodStatusCounts{Running: 99, Total: 99},
		},
	}

	app.refreshPodStatusOnly()
	got := app.lastResourceCounts
	if got.PodStatus.Running != 1 || got.PodStatus.Failed != 1 || got.PodStatus.Total != 2 {
		t.Fatalf("unexpected pod status counts: %+v", got.PodStatus)
	}
	if got.Deployments != 5 {
		t.Fatalf("expected deployments to remain 5, got %d", got.Deployments)
	}
}

func TestRefreshResourceCounts_AggregatesResources(t *testing.T) {
	clientset := fake.NewSimpleClientset()

	_, err := clientset.CoreV1().Pods("default").Create(context.Background(), &v1.Pod{
		ObjectMeta: metav1.ObjectMeta{Name: "p1", Namespace: "default", CreationTimestamp: metav1.NewTime(time.Now())},
		Status:     v1.PodStatus{Phase: v1.PodRunning},
	}, metav1.CreateOptions{})
	if err != nil {
		t.Fatalf("failed to create pod: %v", err)
	}
	_, err = clientset.AppsV1().Deployments("default").Create(context.Background(), &appsv1.Deployment{
		ObjectMeta: metav1.ObjectMeta{Name: "d1", Namespace: "default"},
		Spec: appsv1.DeploymentSpec{
			Selector: &metav1.LabelSelector{MatchLabels: map[string]string{"app": "d1"}},
			Template: v1.PodTemplateSpec{ObjectMeta: metav1.ObjectMeta{Labels: map[string]string{"app": "d1"}}},
		},
	}, metav1.CreateOptions{})
	if err != nil {
		t.Fatalf("failed to create deployment: %v", err)
	}
	_, err = clientset.CoreV1().Services("default").Create(context.Background(), &v1.Service{
		ObjectMeta: metav1.ObjectMeta{Name: "s1", Namespace: "default"},
		Spec:       v1.ServiceSpec{Selector: map[string]string{"app": "d1"}},
	}, metav1.CreateOptions{})
	if err != nil {
		t.Fatalf("failed to create service: %v", err)
	}
	_, err = clientset.BatchV1().CronJobs("default").Create(context.Background(), &batchv1.CronJob{
		ObjectMeta: metav1.ObjectMeta{Name: "cj1", Namespace: "default"},
		Spec:       batchv1.CronJobSpec{Schedule: "* * * * *", JobTemplate: batchv1.JobTemplateSpec{Spec: batchv1.JobSpec{Template: v1.PodTemplateSpec{}}}},
	}, metav1.CreateOptions{})
	if err != nil {
		t.Fatalf("failed to create cronjob: %v", err)
	}
	_, err = clientset.BatchV1().Jobs("default").Create(context.Background(), &batchv1.Job{
		ObjectMeta: metav1.ObjectMeta{Name: "j1", Namespace: "default"},
		Spec:       batchv1.JobSpec{Template: v1.PodTemplateSpec{}},
	}, metav1.CreateOptions{})
	if err != nil {
		t.Fatalf("failed to create job: %v", err)
	}
	_, err = clientset.AppsV1().DaemonSets("default").Create(context.Background(), &appsv1.DaemonSet{
		ObjectMeta: metav1.ObjectMeta{Name: "ds1", Namespace: "default"},
		Spec: appsv1.DaemonSetSpec{
			Selector: &metav1.LabelSelector{MatchLabels: map[string]string{"app": "ds1"}},
			Template: v1.PodTemplateSpec{ObjectMeta: metav1.ObjectMeta{Labels: map[string]string{"app": "ds1"}}},
		},
	}, metav1.CreateOptions{})
	if err != nil {
		t.Fatalf("failed to create daemonset: %v", err)
	}
	_, err = clientset.AppsV1().StatefulSets("default").Create(context.Background(), &appsv1.StatefulSet{
		ObjectMeta: metav1.ObjectMeta{Name: "ss1", Namespace: "default"},
		Spec: appsv1.StatefulSetSpec{
			Selector:    &metav1.LabelSelector{MatchLabels: map[string]string{"app": "ss1"}},
			ServiceName: "svc",
			Template:    v1.PodTemplateSpec{ObjectMeta: metav1.ObjectMeta{Labels: map[string]string{"app": "ss1"}}},
		},
	}, metav1.CreateOptions{})
	if err != nil {
		t.Fatalf("failed to create statefulset: %v", err)
	}
	_, err = clientset.AppsV1().ReplicaSets("default").Create(context.Background(), &appsv1.ReplicaSet{
		ObjectMeta: metav1.ObjectMeta{Name: "rs1", Namespace: "default"},
		Spec: appsv1.ReplicaSetSpec{
			Selector: &metav1.LabelSelector{MatchLabels: map[string]string{"app": "rs1"}},
			Template: v1.PodTemplateSpec{ObjectMeta: metav1.ObjectMeta{Labels: map[string]string{"app": "rs1"}}},
		},
	}, metav1.CreateOptions{})
	if err != nil {
		t.Fatalf("failed to create replicaset: %v", err)
	}
	_, err = clientset.CoreV1().ConfigMaps("default").Create(context.Background(), &v1.ConfigMap{
		ObjectMeta: metav1.ObjectMeta{Name: "cm1", Namespace: "default"},
	}, metav1.CreateOptions{})
	if err != nil {
		t.Fatalf("failed to create configmap: %v", err)
	}
	_, err = clientset.CoreV1().Secrets("default").Create(context.Background(), &v1.Secret{
		ObjectMeta: metav1.ObjectMeta{Name: "sec1", Namespace: "default"},
	}, metav1.CreateOptions{})
	if err != nil {
		t.Fatalf("failed to create secret: %v", err)
	}
	_, err = clientset.NetworkingV1().Ingresses("default").Create(context.Background(), &networkingv1.Ingress{
		ObjectMeta: metav1.ObjectMeta{Name: "ing1", Namespace: "default"},
	}, metav1.CreateOptions{})
	if err != nil {
		t.Fatalf("failed to create ingress: %v", err)
	}
	_, err = clientset.CoreV1().PersistentVolumeClaims("default").Create(context.Background(), &v1.PersistentVolumeClaim{
		ObjectMeta: metav1.ObjectMeta{Name: "pvc1", Namespace: "default"},
	}, metav1.CreateOptions{})
	if err != nil {
		t.Fatalf("failed to create pvc: %v", err)
	}
	_, err = clientset.CoreV1().PersistentVolumes().Create(context.Background(), &v1.PersistentVolume{
		ObjectMeta: metav1.ObjectMeta{Name: "pv1"},
	}, metav1.CreateOptions{})
	if err != nil {
		t.Fatalf("failed to create pv: %v", err)
	}

	app := &App{
		ctx:                context.Background(),
		currentKubeContext: "test",
		currentNamespace:   "default",
		testClientset:      clientset,
	}

	app.refreshResourceCounts()
	got := app.lastResourceCounts
	if got.PodStatus.Running != 1 || got.PodStatus.Total != 1 {
		t.Fatalf("unexpected pod status counts: %+v", got.PodStatus)
	}
	if got.Deployments != 1 || got.Services != 1 || got.Jobs != 1 || got.CronJobs != 1 || got.DaemonSets != 1 || got.StatefulSets != 1 || got.ReplicaSets != 1 || got.ConfigMaps != 1 || got.Secrets != 1 || got.Ingresses != 1 || got.PersistentVolumeClaims != 1 || got.PersistentVolumes != 1 {
		t.Fatalf("unexpected resource counts: %+v", got)
	}
}

// Tests for GetResourceCounts returns copy
func TestGetResourceCounts_ReturnsCopy(t *testing.T) {
	app := &App{
		lastResourceCounts: ResourceCounts{
			Deployments: 5,
		},
	}

	result := app.GetResourceCounts()
	result.Deployments = 100 // Modify returned copy

	// Original should be unchanged
	if app.lastResourceCounts.Deployments != 5 {
		t.Error("GetResourceCounts should return a copy, not a reference")
	}
}
