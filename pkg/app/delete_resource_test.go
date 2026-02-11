package app

import (
	"context"
	"testing"

	appsv1 "k8s.io/api/apps/v1"
	batchv1 "k8s.io/api/batch/v1"
	corev1 "k8s.io/api/core/v1"
	networkingv1 "k8s.io/api/networking/v1"
	rbacv1 "k8s.io/api/rbac/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes/fake"
)

func TestErrUnsupportedResourceType(t *testing.T) {
	err := ErrUnsupportedResourceType("unknown")
	if err == nil {
		t.Fatal("Expected error, got nil")
	}

	resErr, ok := err.(*ResourceTypeError)
	if !ok {
		t.Fatalf("Expected *ResourceTypeError, got %T", err)
	}

	if resErr.Type != "unknown" {
		t.Errorf("Expected type 'unknown', got %q", resErr.Type)
	}
}

func TestResourceTypeError_Error(t *testing.T) {
	tests := []struct {
		name         string
		resourceType string
		expected     string
	}{
		{"unknown type", "unknown", "unsupported resource type: unknown"},
		{"custom type", "customresource", "unsupported resource type: customresource"},
		{"empty type", "", "unsupported resource type: "},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			err := &ResourceTypeError{Type: tc.resourceType}
			result := err.Error()
			if result != tc.expected {
				t.Errorf("Error() = %q, want %q", result, tc.expected)
			}
		})
	}
}

func TestErrUnsupportedResourceType_AsError(t *testing.T) {
	// Verify that ErrUnsupportedResourceType returns something that implements error
	var err error = ErrUnsupportedResourceType("test")
	if err == nil {
		t.Fatal("Expected non-nil error")
	}

	msg := err.Error()
	expected := "unsupported resource type: test"
	if msg != expected {
		t.Errorf("Error message = %q, want %q", msg, expected)
	}
}

// Tests for DeleteResource function
func TestDeleteResource(t *testing.T) {
	int32Ptr := func(i int32) *int32 { return &i }

	tests := []struct {
		name         string
		resourceType string
		namespace    string
		resourceName string
		setupFunc    func(clientset *fake.Clientset)
		expectError  bool
	}{
		{
			name:         "delete pod",
			resourceType: "pod",
			namespace:    "default",
			resourceName: "test-pod",
			setupFunc: func(clientset *fake.Clientset) {
				pod := &corev1.Pod{ObjectMeta: metav1.ObjectMeta{Name: "test-pod", Namespace: "default"}}
				clientset.CoreV1().Pods("default").Create(context.Background(), pod, metav1.CreateOptions{})
			},
			expectError: false,
		},
		{
			name:         "delete deployment",
			resourceType: "deployment",
			namespace:    "default",
			resourceName: "test-deploy",
			setupFunc: func(clientset *fake.Clientset) {
				deploy := &appsv1.Deployment{
					ObjectMeta: metav1.ObjectMeta{Name: "test-deploy", Namespace: "default"},
					Spec: appsv1.DeploymentSpec{
						Replicas: int32Ptr(1),
						Selector: &metav1.LabelSelector{MatchLabels: map[string]string{"app": "test"}},
						Template: corev1.PodTemplateSpec{
							ObjectMeta: metav1.ObjectMeta{Labels: map[string]string{"app": "test"}},
							Spec:       corev1.PodSpec{Containers: []corev1.Container{{Name: "nginx", Image: "nginx"}}},
						},
					},
				}
				clientset.AppsV1().Deployments("default").Create(context.Background(), deploy, metav1.CreateOptions{})
			},
			expectError: false,
		},
		{
			name:         "delete statefulset",
			resourceType: "statefulset",
			namespace:    "default",
			resourceName: "test-sts",
			setupFunc: func(clientset *fake.Clientset) {
				sts := &appsv1.StatefulSet{
					ObjectMeta: metav1.ObjectMeta{Name: "test-sts", Namespace: "default"},
					Spec: appsv1.StatefulSetSpec{
						Replicas: int32Ptr(1),
						Selector: &metav1.LabelSelector{MatchLabels: map[string]string{"app": "test"}},
						Template: corev1.PodTemplateSpec{
							ObjectMeta: metav1.ObjectMeta{Labels: map[string]string{"app": "test"}},
							Spec:       corev1.PodSpec{Containers: []corev1.Container{{Name: "nginx", Image: "nginx"}}},
						},
					},
				}
				clientset.AppsV1().StatefulSets("default").Create(context.Background(), sts, metav1.CreateOptions{})
			},
			expectError: false,
		},
		{
			name:         "delete daemonset",
			resourceType: "daemonset",
			namespace:    "default",
			resourceName: "test-ds",
			setupFunc: func(clientset *fake.Clientset) {
				ds := &appsv1.DaemonSet{
					ObjectMeta: metav1.ObjectMeta{Name: "test-ds", Namespace: "default"},
					Spec: appsv1.DaemonSetSpec{
						Selector: &metav1.LabelSelector{MatchLabels: map[string]string{"app": "test"}},
						Template: corev1.PodTemplateSpec{
							ObjectMeta: metav1.ObjectMeta{Labels: map[string]string{"app": "test"}},
							Spec:       corev1.PodSpec{Containers: []corev1.Container{{Name: "nginx", Image: "nginx"}}},
						},
					},
				}
				clientset.AppsV1().DaemonSets("default").Create(context.Background(), ds, metav1.CreateOptions{})
			},
			expectError: false,
		},
		{
			name:         "delete replicaset",
			resourceType: "replicaset",
			namespace:    "default",
			resourceName: "test-rs",
			setupFunc: func(clientset *fake.Clientset) {
				rs := &appsv1.ReplicaSet{
					ObjectMeta: metav1.ObjectMeta{Name: "test-rs", Namespace: "default"},
					Spec: appsv1.ReplicaSetSpec{
						Replicas: int32Ptr(1),
						Selector: &metav1.LabelSelector{MatchLabels: map[string]string{"app": "test"}},
						Template: corev1.PodTemplateSpec{
							ObjectMeta: metav1.ObjectMeta{Labels: map[string]string{"app": "test"}},
							Spec:       corev1.PodSpec{Containers: []corev1.Container{{Name: "nginx", Image: "nginx"}}},
						},
					},
				}
				clientset.AppsV1().ReplicaSets("default").Create(context.Background(), rs, metav1.CreateOptions{})
			},
			expectError: false,
		},
		{
			name:         "delete job",
			resourceType: "job",
			namespace:    "default",
			resourceName: "test-job",
			setupFunc: func(clientset *fake.Clientset) {
				job := &batchv1.Job{
					ObjectMeta: metav1.ObjectMeta{Name: "test-job", Namespace: "default"},
					Spec: batchv1.JobSpec{
						Template: corev1.PodTemplateSpec{
							Spec: corev1.PodSpec{
								Containers:    []corev1.Container{{Name: "test", Image: "busybox"}},
								RestartPolicy: corev1.RestartPolicyNever,
							},
						},
					},
				}
				clientset.BatchV1().Jobs("default").Create(context.Background(), job, metav1.CreateOptions{})
			},
			expectError: false,
		},
		{
			name:         "delete cronjob",
			resourceType: "cronjob",
			namespace:    "default",
			resourceName: "test-cronjob",
			setupFunc: func(clientset *fake.Clientset) {
				cronJob := &batchv1.CronJob{
					ObjectMeta: metav1.ObjectMeta{Name: "test-cronjob", Namespace: "default"},
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
				}
				clientset.BatchV1().CronJobs("default").Create(context.Background(), cronJob, metav1.CreateOptions{})
			},
			expectError: false,
		},
		{
			name:         "delete configmap",
			resourceType: "configmap",
			namespace:    "default",
			resourceName: "test-cm",
			setupFunc: func(clientset *fake.Clientset) {
				cm := &corev1.ConfigMap{
					ObjectMeta: metav1.ObjectMeta{Name: "test-cm", Namespace: "default"},
					Data:       map[string]string{"key": "value"},
				}
				clientset.CoreV1().ConfigMaps("default").Create(context.Background(), cm, metav1.CreateOptions{})
			},
			expectError: false,
		},
		{
			name:         "delete secret",
			resourceType: "secret",
			namespace:    "default",
			resourceName: "test-secret",
			setupFunc: func(clientset *fake.Clientset) {
				secret := &corev1.Secret{
					ObjectMeta: metav1.ObjectMeta{Name: "test-secret", Namespace: "default"},
					Data:       map[string][]byte{"key": []byte("value")},
				}
				clientset.CoreV1().Secrets("default").Create(context.Background(), secret, metav1.CreateOptions{})
			},
			expectError: false,
		},
		{
			name:         "delete pvc",
			resourceType: "pvc",
			namespace:    "default",
			resourceName: "test-pvc",
			setupFunc: func(clientset *fake.Clientset) {
				pvc := &corev1.PersistentVolumeClaim{
					ObjectMeta: metav1.ObjectMeta{Name: "test-pvc", Namespace: "default"},
				}
				clientset.CoreV1().PersistentVolumeClaims("default").Create(context.Background(), pvc, metav1.CreateOptions{})
			},
			expectError: false,
		},
		{
			name:         "delete pv",
			resourceType: "pv",
			namespace:    "",
			resourceName: "test-pv",
			setupFunc: func(clientset *fake.Clientset) {
				pv := &corev1.PersistentVolume{
					ObjectMeta: metav1.ObjectMeta{Name: "test-pv"},
				}
				clientset.CoreV1().PersistentVolumes().Create(context.Background(), pv, metav1.CreateOptions{})
			},
			expectError: false,
		},
		{
			name:         "delete ingress",
			resourceType: "ingress",
			namespace:    "default",
			resourceName: "test-ingress",
			setupFunc: func(clientset *fake.Clientset) {
				ingress := &networkingv1.Ingress{
					ObjectMeta: metav1.ObjectMeta{Name: "test-ingress", Namespace: "default"},
				}
				clientset.NetworkingV1().Ingresses("default").Create(context.Background(), ingress, metav1.CreateOptions{})
			},
			expectError: false,
		},
		{
			name:         "delete service",
			resourceType: "service",
			namespace:    "default",
			resourceName: "test-svc",
			setupFunc: func(clientset *fake.Clientset) {
				svc := &corev1.Service{
					ObjectMeta: metav1.ObjectMeta{Name: "test-svc", Namespace: "default"},
					Spec:       corev1.ServiceSpec{Ports: []corev1.ServicePort{{Port: 80}}},
				}
				clientset.CoreV1().Services("default").Create(context.Background(), svc, metav1.CreateOptions{})
			},
			expectError: false,
		},
		{
			name:         "delete serviceaccount",
			resourceType: "serviceaccount",
			namespace:    "default",
			resourceName: "test-sa",
			setupFunc: func(clientset *fake.Clientset) {
				sa := &corev1.ServiceAccount{
					ObjectMeta: metav1.ObjectMeta{Name: "test-sa", Namespace: "default"},
				}
				clientset.CoreV1().ServiceAccounts("default").Create(context.Background(), sa, metav1.CreateOptions{})
			},
			expectError: false,
		},
		{
			name:         "delete role",
			resourceType: "role",
			namespace:    "default",
			resourceName: "test-role",
			setupFunc: func(clientset *fake.Clientset) {
				role := &rbacv1.Role{ObjectMeta: metav1.ObjectMeta{Name: "test-role", Namespace: "default"}}
				clientset.RbacV1().Roles("default").Create(context.Background(), role, metav1.CreateOptions{})
			},
			expectError: false,
		},
		{
			name:         "delete clusterrole",
			resourceType: "clusterrole",
			namespace:    "",
			resourceName: "test-cr",
			setupFunc: func(clientset *fake.Clientset) {
				cr := &rbacv1.ClusterRole{ObjectMeta: metav1.ObjectMeta{Name: "test-cr"}}
				clientset.RbacV1().ClusterRoles().Create(context.Background(), cr, metav1.CreateOptions{})
			},
			expectError: false,
		},
		{
			name:         "delete rolebinding",
			resourceType: "rolebinding",
			namespace:    "default",
			resourceName: "test-rb",
			setupFunc: func(clientset *fake.Clientset) {
				rb := &rbacv1.RoleBinding{
					ObjectMeta: metav1.ObjectMeta{Name: "test-rb", Namespace: "default"},
					RoleRef:    rbacv1.RoleRef{Kind: "Role", Name: "test-role", APIGroup: "rbac.authorization.k8s.io"},
				}
				clientset.RbacV1().RoleBindings("default").Create(context.Background(), rb, metav1.CreateOptions{})
			},
			expectError: false,
		},
		{
			name:         "delete clusterrolebinding",
			resourceType: "clusterrolebinding",
			namespace:    "",
			resourceName: "test-crb",
			setupFunc: func(clientset *fake.Clientset) {
				crb := &rbacv1.ClusterRoleBinding{
					ObjectMeta: metav1.ObjectMeta{Name: "test-crb"},
					RoleRef:    rbacv1.RoleRef{Kind: "ClusterRole", Name: "test-cr", APIGroup: "rbac.authorization.k8s.io"},
				}
				clientset.RbacV1().ClusterRoleBindings().Create(context.Background(), crb, metav1.CreateOptions{})
			},
			expectError: false,
		},
		{
			name:         "delete persistentvolumeclaim (full name)",
			resourceType: "persistentvolumeclaim",
			namespace:    "default",
			resourceName: "test-pvc-full",
			setupFunc: func(clientset *fake.Clientset) {
				pvc := &corev1.PersistentVolumeClaim{
					ObjectMeta: metav1.ObjectMeta{Name: "test-pvc-full", Namespace: "default"},
				}
				clientset.CoreV1().PersistentVolumeClaims("default").Create(context.Background(), pvc, metav1.CreateOptions{})
			},
			expectError: false,
		},
		{
			name:         "unsupported resource type",
			resourceType: "unsupported",
			namespace:    "default",
			resourceName: "test",
			setupFunc:    nil,
			expectError:  true,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			clientset := fake.NewSimpleClientset()
			if tc.setupFunc != nil {
				tc.setupFunc(clientset)
			}

			app := &App{ctx: context.Background(), testClientset: clientset}
			err := app.DeleteResource(tc.resourceType, tc.namespace, tc.resourceName)

			if tc.expectError && err == nil {
				t.Error("expected error but got none")
			}
			if !tc.expectError && err != nil {
				t.Errorf("unexpected error: %v", err)
			}
		})
	}
}
