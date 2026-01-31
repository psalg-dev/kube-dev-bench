package app

import (
	"context"
	"testing"

	appsv1 "k8s.io/api/apps/v1"
	batchv1 "k8s.io/api/batch/v1"
	corev1 "k8s.io/api/core/v1"
	networkingv1 "k8s.io/api/networking/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes/fake"
)

func TestBulkDeleteResources(t *testing.T) {
	tests := []struct {
		name         string
		items        []BulkOperationItem
		setupFunc    func(*fake.Clientset)
		wantSuccess  int
		wantError    int
	}{
		{
			name:        "empty items returns empty response",
			items:       []BulkOperationItem{},
			wantSuccess: 0,
			wantError:   0,
		},
		{
			name: "delete single pod",
			items: []BulkOperationItem{
				{Kind: "pod", Name: "test-pod", Namespace: "default"},
			},
			setupFunc: func(cs *fake.Clientset) {
				cs.CoreV1().Pods("default").Create(context.Background(), &corev1.Pod{
					ObjectMeta: metav1.ObjectMeta{Name: "test-pod", Namespace: "default"},
				}, metav1.CreateOptions{})
			},
			wantSuccess: 1,
			wantError:   0,
		},
		{
			name: "delete multiple pods",
			items: []BulkOperationItem{
				{Kind: "pod", Name: "pod-1", Namespace: "default"},
				{Kind: "pod", Name: "pod-2", Namespace: "default"},
				{Kind: "pod", Name: "pod-3", Namespace: "test"},
			},
			setupFunc: func(cs *fake.Clientset) {
				cs.CoreV1().Pods("default").Create(context.Background(), &corev1.Pod{
					ObjectMeta: metav1.ObjectMeta{Name: "pod-1", Namespace: "default"},
				}, metav1.CreateOptions{})
				cs.CoreV1().Pods("default").Create(context.Background(), &corev1.Pod{
					ObjectMeta: metav1.ObjectMeta{Name: "pod-2", Namespace: "default"},
				}, metav1.CreateOptions{})
				cs.CoreV1().Pods("test").Create(context.Background(), &corev1.Pod{
					ObjectMeta: metav1.ObjectMeta{Name: "pod-3", Namespace: "test"},
				}, metav1.CreateOptions{})
			},
			wantSuccess: 3,
			wantError:   0,
		},
		{
			name: "partial failure - some pods don't exist",
			items: []BulkOperationItem{
				{Kind: "pod", Name: "exists", Namespace: "default"},
				{Kind: "pod", Name: "missing", Namespace: "default"},
			},
			setupFunc: func(cs *fake.Clientset) {
				cs.CoreV1().Pods("default").Create(context.Background(), &corev1.Pod{
					ObjectMeta: metav1.ObjectMeta{Name: "exists", Namespace: "default"},
				}, metav1.CreateOptions{})
			},
			wantSuccess: 1,
			wantError:   1,
		},
		{
			name: "delete deployment",
			items: []BulkOperationItem{
				{Kind: "deployment", Name: "test-deploy", Namespace: "default"},
			},
			setupFunc: func(cs *fake.Clientset) {
				cs.AppsV1().Deployments("default").Create(context.Background(), &appsv1.Deployment{
					ObjectMeta: metav1.ObjectMeta{Name: "test-deploy", Namespace: "default"},
				}, metav1.CreateOptions{})
			},
			wantSuccess: 1,
			wantError:   0,
		},
		{
			name: "delete configmap",
			items: []BulkOperationItem{
				{Kind: "configmap", Name: "test-cm", Namespace: "default"},
			},
			setupFunc: func(cs *fake.Clientset) {
				cs.CoreV1().ConfigMaps("default").Create(context.Background(), &corev1.ConfigMap{
					ObjectMeta: metav1.ObjectMeta{Name: "test-cm", Namespace: "default"},
				}, metav1.CreateOptions{})
			},
			wantSuccess: 1,
			wantError:   0,
		},
		{
			name: "delete secret",
			items: []BulkOperationItem{
				{Kind: "secret", Name: "test-secret", Namespace: "default"},
			},
			setupFunc: func(cs *fake.Clientset) {
				cs.CoreV1().Secrets("default").Create(context.Background(), &corev1.Secret{
					ObjectMeta: metav1.ObjectMeta{Name: "test-secret", Namespace: "default"},
				}, metav1.CreateOptions{})
			},
			wantSuccess: 1,
			wantError:   0,
		},
		{
			name: "unsupported resource kind",
			items: []BulkOperationItem{
				{Kind: "unsupported", Name: "test", Namespace: "default"},
			},
			wantSuccess: 0,
			wantError:   1,
		},
		{
			name: "mixed resource types",
			items: []BulkOperationItem{
				{Kind: "pod", Name: "test-pod", Namespace: "default"},
				{Kind: "deployment", Name: "test-deploy", Namespace: "default"},
				{Kind: "configmap", Name: "test-cm", Namespace: "default"},
			},
			setupFunc: func(cs *fake.Clientset) {
				cs.CoreV1().Pods("default").Create(context.Background(), &corev1.Pod{
					ObjectMeta: metav1.ObjectMeta{Name: "test-pod", Namespace: "default"},
				}, metav1.CreateOptions{})
				cs.AppsV1().Deployments("default").Create(context.Background(), &appsv1.Deployment{
					ObjectMeta: metav1.ObjectMeta{Name: "test-deploy", Namespace: "default"},
				}, metav1.CreateOptions{})
				cs.CoreV1().ConfigMaps("default").Create(context.Background(), &corev1.ConfigMap{
					ObjectMeta: metav1.ObjectMeta{Name: "test-cm", Namespace: "default"},
				}, metav1.CreateOptions{})
			},
			wantSuccess: 3,
			wantError:   0,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			clientset := fake.NewSimpleClientset()
			if tt.setupFunc != nil {
				tt.setupFunc(clientset)
			}

			app := &App{
				ctx:           context.Background(),
				testClientset: clientset,
			}

			result := app.BulkDeleteResources(tt.items)

			if result.SuccessCount != tt.wantSuccess {
				t.Errorf("BulkDeleteResources() successCount = %d, want %d", result.SuccessCount, tt.wantSuccess)
			}
			if result.ErrorCount != tt.wantError {
				t.Errorf("BulkDeleteResources() errorCount = %d, want %d", result.ErrorCount, tt.wantError)
			}
			if len(result.Results) != len(tt.items) {
				t.Errorf("BulkDeleteResources() results length = %d, want %d", len(result.Results), len(tt.items))
			}
		})
	}
}

func TestBulkRestartResources(t *testing.T) {
	tests := []struct {
		name        string
		items       []BulkOperationItem
		setupFunc   func(*fake.Clientset)
		wantSuccess int
		wantError   int
	}{
		{
			name:        "empty items",
			items:       []BulkOperationItem{},
			wantSuccess: 0,
			wantError:   0,
		},
		{
			name: "restart deployment",
			items: []BulkOperationItem{
				{Kind: "deployment", Name: "test-deploy", Namespace: "default"},
			},
			setupFunc: func(cs *fake.Clientset) {
				cs.AppsV1().Deployments("default").Create(context.Background(), &appsv1.Deployment{
					ObjectMeta: metav1.ObjectMeta{Name: "test-deploy", Namespace: "default"},
					Spec: appsv1.DeploymentSpec{
						Template: corev1.PodTemplateSpec{
							ObjectMeta: metav1.ObjectMeta{},
						},
					},
				}, metav1.CreateOptions{})
			},
			wantSuccess: 1,
			wantError:   0,
		},
		{
			name: "restart pod (deletes it)",
			items: []BulkOperationItem{
				{Kind: "pod", Name: "test-pod", Namespace: "default"},
			},
			setupFunc: func(cs *fake.Clientset) {
				cs.CoreV1().Pods("default").Create(context.Background(), &corev1.Pod{
					ObjectMeta: metav1.ObjectMeta{Name: "test-pod", Namespace: "default"},
				}, metav1.CreateOptions{})
			},
			wantSuccess: 1,
			wantError:   0,
		},
		{
			name: "restart statefulset",
			items: []BulkOperationItem{
				{Kind: "statefulset", Name: "test-sts", Namespace: "default"},
			},
			setupFunc: func(cs *fake.Clientset) {
				cs.AppsV1().StatefulSets("default").Create(context.Background(), &appsv1.StatefulSet{
					ObjectMeta: metav1.ObjectMeta{Name: "test-sts", Namespace: "default"},
					Spec: appsv1.StatefulSetSpec{
						Template: corev1.PodTemplateSpec{
							ObjectMeta: metav1.ObjectMeta{},
						},
					},
				}, metav1.CreateOptions{})
			},
			wantSuccess: 1,
			wantError:   0,
		},
		{
			name: "restart daemonset",
			items: []BulkOperationItem{
				{Kind: "daemonset", Name: "test-ds", Namespace: "default"},
			},
			setupFunc: func(cs *fake.Clientset) {
				cs.AppsV1().DaemonSets("default").Create(context.Background(), &appsv1.DaemonSet{
					ObjectMeta: metav1.ObjectMeta{Name: "test-ds", Namespace: "default"},
					Spec: appsv1.DaemonSetSpec{
						Template: corev1.PodTemplateSpec{
							ObjectMeta: metav1.ObjectMeta{},
						},
					},
				}, metav1.CreateOptions{})
			},
			wantSuccess: 1,
			wantError:   0,
		},
		{
			name: "restart unsupported kind fails",
			items: []BulkOperationItem{
				{Kind: "configmap", Name: "test-cm", Namespace: "default"},
			},
			wantSuccess: 0,
			wantError:   1,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			clientset := fake.NewSimpleClientset()
			if tt.setupFunc != nil {
				tt.setupFunc(clientset)
			}

			app := &App{
				ctx:           context.Background(),
				testClientset: clientset,
			}

			result := app.BulkRestartResources(tt.items)

			if result.SuccessCount != tt.wantSuccess {
				t.Errorf("BulkRestartResources() successCount = %d, want %d", result.SuccessCount, tt.wantSuccess)
			}
			if result.ErrorCount != tt.wantError {
				t.Errorf("BulkRestartResources() errorCount = %d, want %d", result.ErrorCount, tt.wantError)
			}
		})
	}
}

func TestBulkScaleResources(t *testing.T) {
	tests := []struct {
		name        string
		items       []BulkOperationItem
		replicas    int
		wantSuccess int
		wantError   int
	}{
		{
			name:        "empty items",
			items:       []BulkOperationItem{},
			replicas:    3,
			wantSuccess: 0,
			wantError:   0,
		},
		{
			name: "negative replicas fails all",
			items: []BulkOperationItem{
				{Kind: "deployment", Name: "test", Namespace: "default"},
			},
			replicas:    -1,
			wantSuccess: 0,
			wantError:   1,
		},
		// Note: Positive scale tests are skipped because fake clientset doesn't support scale subresources properly.
		// These are tested via E2E tests.
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			clientset := fake.NewSimpleClientset()

			app := &App{
				ctx:           context.Background(),
				testClientset: clientset,
			}

			result := app.BulkScaleResources(tt.items, tt.replicas)

			if result.SuccessCount != tt.wantSuccess {
				t.Errorf("BulkScaleResources() successCount = %d, want %d", result.SuccessCount, tt.wantSuccess)
			}
			if result.ErrorCount != tt.wantError {
				t.Errorf("BulkScaleResources() errorCount = %d, want %d", result.ErrorCount, tt.wantError)
			}
		})
	}
}

func TestBulkSuspendCronJobs(t *testing.T) {
	tests := []struct {
		name        string
		items       []BulkOperationItem
		setupFunc   func(*fake.Clientset)
		wantSuccess int
		wantError   int
	}{
		{
			name:        "empty items",
			items:       []BulkOperationItem{},
			wantSuccess: 0,
			wantError:   0,
		},
		{
			name: "suspend cronjob",
			items: []BulkOperationItem{
				{Kind: "cronjob", Name: "test-cj", Namespace: "default"},
			},
			setupFunc: func(cs *fake.Clientset) {
				cs.BatchV1().CronJobs("default").Create(context.Background(), &batchv1.CronJob{
					ObjectMeta: metav1.ObjectMeta{Name: "test-cj", Namespace: "default"},
					Spec:       batchv1.CronJobSpec{Schedule: "* * * * *"},
				}, metav1.CreateOptions{})
			},
			wantSuccess: 1,
			wantError:   0,
		},
		{
			name: "suspend non-cronjob fails",
			items: []BulkOperationItem{
				{Kind: "deployment", Name: "test", Namespace: "default"},
			},
			wantSuccess: 0,
			wantError:   1,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			clientset := fake.NewSimpleClientset()
			if tt.setupFunc != nil {
				tt.setupFunc(clientset)
			}

			app := &App{
				ctx:           context.Background(),
				testClientset: clientset,
			}

			result := app.BulkSuspendCronJobs(tt.items)

			if result.SuccessCount != tt.wantSuccess {
				t.Errorf("BulkSuspendCronJobs() successCount = %d, want %d", result.SuccessCount, tt.wantSuccess)
			}
			if result.ErrorCount != tt.wantError {
				t.Errorf("BulkSuspendCronJobs() errorCount = %d, want %d", result.ErrorCount, tt.wantError)
			}
		})
	}
}

func TestBulkResumeCronJobs(t *testing.T) {
	tests := []struct {
		name        string
		items       []BulkOperationItem
		setupFunc   func(*fake.Clientset)
		wantSuccess int
		wantError   int
	}{
		{
			name:        "empty items",
			items:       []BulkOperationItem{},
			wantSuccess: 0,
			wantError:   0,
		},
		{
			name: "resume cronjob",
			items: []BulkOperationItem{
				{Kind: "cronjob", Name: "test-cj", Namespace: "default"},
			},
			setupFunc: func(cs *fake.Clientset) {
				suspend := true
				cs.BatchV1().CronJobs("default").Create(context.Background(), &batchv1.CronJob{
					ObjectMeta: metav1.ObjectMeta{Name: "test-cj", Namespace: "default"},
					Spec:       batchv1.CronJobSpec{Schedule: "* * * * *", Suspend: &suspend},
				}, metav1.CreateOptions{})
			},
			wantSuccess: 1,
			wantError:   0,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			clientset := fake.NewSimpleClientset()
			if tt.setupFunc != nil {
				tt.setupFunc(clientset)
			}

			app := &App{
				ctx:           context.Background(),
				testClientset: clientset,
			}

			result := app.BulkResumeCronJobs(tt.items)

			if result.SuccessCount != tt.wantSuccess {
				t.Errorf("BulkResumeCronJobs() successCount = %d, want %d", result.SuccessCount, tt.wantSuccess)
			}
			if result.ErrorCount != tt.wantError {
				t.Errorf("BulkResumeCronJobs() errorCount = %d, want %d", result.ErrorCount, tt.wantError)
			}
		})
	}
}

// Test that delete supports all documented resource types
func TestBulkDeleteResourceTypes(t *testing.T) {
	resourceTests := []struct {
		kind      string
		setupFunc func(*fake.Clientset)
	}{
		{
			kind: "pod",
			setupFunc: func(cs *fake.Clientset) {
				cs.CoreV1().Pods("default").Create(context.Background(), &corev1.Pod{
					ObjectMeta: metav1.ObjectMeta{Name: "test", Namespace: "default"},
				}, metav1.CreateOptions{})
			},
		},
		{
			kind: "deployment",
			setupFunc: func(cs *fake.Clientset) {
				cs.AppsV1().Deployments("default").Create(context.Background(), &appsv1.Deployment{
					ObjectMeta: metav1.ObjectMeta{Name: "test", Namespace: "default"},
				}, metav1.CreateOptions{})
			},
		},
		{
			kind: "statefulset",
			setupFunc: func(cs *fake.Clientset) {
				cs.AppsV1().StatefulSets("default").Create(context.Background(), &appsv1.StatefulSet{
					ObjectMeta: metav1.ObjectMeta{Name: "test", Namespace: "default"},
				}, metav1.CreateOptions{})
			},
		},
		{
			kind: "daemonset",
			setupFunc: func(cs *fake.Clientset) {
				cs.AppsV1().DaemonSets("default").Create(context.Background(), &appsv1.DaemonSet{
					ObjectMeta: metav1.ObjectMeta{Name: "test", Namespace: "default"},
				}, metav1.CreateOptions{})
			},
		},
		{
			kind: "replicaset",
			setupFunc: func(cs *fake.Clientset) {
				cs.AppsV1().ReplicaSets("default").Create(context.Background(), &appsv1.ReplicaSet{
					ObjectMeta: metav1.ObjectMeta{Name: "test", Namespace: "default"},
				}, metav1.CreateOptions{})
			},
		},
		{
			kind: "job",
			setupFunc: func(cs *fake.Clientset) {
				cs.BatchV1().Jobs("default").Create(context.Background(), &batchv1.Job{
					ObjectMeta: metav1.ObjectMeta{Name: "test", Namespace: "default"},
				}, metav1.CreateOptions{})
			},
		},
		{
			kind: "cronjob",
			setupFunc: func(cs *fake.Clientset) {
				cs.BatchV1().CronJobs("default").Create(context.Background(), &batchv1.CronJob{
					ObjectMeta: metav1.ObjectMeta{Name: "test", Namespace: "default"},
					Spec:       batchv1.CronJobSpec{Schedule: "* * * * *"},
				}, metav1.CreateOptions{})
			},
		},
		{
			kind: "configmap",
			setupFunc: func(cs *fake.Clientset) {
				cs.CoreV1().ConfigMaps("default").Create(context.Background(), &corev1.ConfigMap{
					ObjectMeta: metav1.ObjectMeta{Name: "test", Namespace: "default"},
				}, metav1.CreateOptions{})
			},
		},
		{
			kind: "secret",
			setupFunc: func(cs *fake.Clientset) {
				cs.CoreV1().Secrets("default").Create(context.Background(), &corev1.Secret{
					ObjectMeta: metav1.ObjectMeta{Name: "test", Namespace: "default"},
				}, metav1.CreateOptions{})
			},
		},
		{
			kind: "persistentvolumeclaim",
			setupFunc: func(cs *fake.Clientset) {
				cs.CoreV1().PersistentVolumeClaims("default").Create(context.Background(), &corev1.PersistentVolumeClaim{
					ObjectMeta: metav1.ObjectMeta{Name: "test", Namespace: "default"},
				}, metav1.CreateOptions{})
			},
		},
		{
			kind: "persistentvolume",
			setupFunc: func(cs *fake.Clientset) {
				cs.CoreV1().PersistentVolumes().Create(context.Background(), &corev1.PersistentVolume{
					ObjectMeta: metav1.ObjectMeta{Name: "test"},
				}, metav1.CreateOptions{})
			},
		},
		{
			kind: "ingress",
			setupFunc: func(cs *fake.Clientset) {
				cs.NetworkingV1().Ingresses("default").Create(context.Background(), &networkingv1.Ingress{
					ObjectMeta: metav1.ObjectMeta{Name: "test", Namespace: "default"},
				}, metav1.CreateOptions{})
			},
		},
		{
			kind: "service",
			setupFunc: func(cs *fake.Clientset) {
				cs.CoreV1().Services("default").Create(context.Background(), &corev1.Service{
					ObjectMeta: metav1.ObjectMeta{Name: "test", Namespace: "default"},
				}, metav1.CreateOptions{})
			},
		},
	}

	for _, tt := range resourceTests {
		t.Run(tt.kind, func(t *testing.T) {
			clientset := fake.NewSimpleClientset()
			tt.setupFunc(clientset)

			app := &App{
				ctx:           context.Background(),
				testClientset: clientset,
			}

			items := []BulkOperationItem{{Kind: tt.kind, Name: "test", Namespace: "default"}}
			result := app.BulkDeleteResources(items)

			if result.SuccessCount != 1 {
				t.Errorf("BulkDeleteResources(%s) successCount = %d, want 1", tt.kind, result.SuccessCount)
			}
			if result.ErrorCount != 0 {
				t.Errorf("BulkDeleteResources(%s) errorCount = %d, want 0. Error: %s", tt.kind, result.ErrorCount, result.Results[0].Error)
			}
		})
	}
}
