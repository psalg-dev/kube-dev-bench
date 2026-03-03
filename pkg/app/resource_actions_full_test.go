package app

import (
	"context"
	"fmt"
	"strings"
	"testing"

	appsv1 "k8s.io/api/apps/v1"
	autoscalingv1 "k8s.io/api/autoscaling/v1"
	batchv1 "k8s.io/api/batch/v1"
	corev1 "k8s.io/api/core/v1"
	networkingv1 "k8s.io/api/networking/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes/fake"
)

// Tests for RestartDeployment
func TestRestartDeployment(t *testing.T) {
	clientset := fake.NewSimpleClientset()

	// Create a deployment
	deploy := &appsv1.Deployment{
		ObjectMeta: metav1.ObjectMeta{Name: "test-deploy", Namespace: "default"},
		Spec: appsv1.DeploymentSpec{
			Replicas: int32Ptr(1),
			Selector: &metav1.LabelSelector{
				MatchLabels: map[string]string{"app": "test"},
			},
			Template: corev1.PodTemplateSpec{
				ObjectMeta: metav1.ObjectMeta{
					Labels: map[string]string{"app": "test"},
				},
				Spec: corev1.PodSpec{
					Containers: []corev1.Container{{Name: "nginx", Image: "nginx"}},
				},
			},
		},
	}
	_, err := clientset.AppsV1().Deployments("default").Create(context.Background(), deploy, metav1.CreateOptions{})
	if err != nil {
		t.Fatalf("failed to create deployment: %v", err)
	}

	app := &App{ctx: context.Background(), testClientset: clientset}
	err = app.RestartDeployment("default", "test-deploy")
	if err != nil {
		t.Errorf("RestartDeployment failed: %v", err)
	}

	// Verify deployment was patched
	updated, err := clientset.AppsV1().Deployments("default").Get(context.Background(), "test-deploy", metav1.GetOptions{})
	if err != nil {
		t.Fatalf("failed to get deployment: %v", err)
	}
	if updated.Spec.Template.Annotations == nil {
		t.Error("expected annotations to be set")
	}
}

// Tests for DeleteDeployment
func TestDeleteDeployment(t *testing.T) {
	clientset := fake.NewSimpleClientset()

	deploy := &appsv1.Deployment{
		ObjectMeta: metav1.ObjectMeta{Name: "test-deploy", Namespace: "default"},
		Spec: appsv1.DeploymentSpec{
			Replicas: int32Ptr(1),
			Selector: &metav1.LabelSelector{
				MatchLabels: map[string]string{"app": "test"},
			},
			Template: corev1.PodTemplateSpec{
				ObjectMeta: metav1.ObjectMeta{Labels: map[string]string{"app": "test"}},
				Spec:       corev1.PodSpec{Containers: []corev1.Container{{Name: "nginx", Image: "nginx"}}},
			},
		},
	}
	_, err := clientset.AppsV1().Deployments("default").Create(context.Background(), deploy, metav1.CreateOptions{})
	if err != nil {
		t.Fatalf("failed to create deployment: %v", err)
	}

	app := &App{ctx: context.Background(), testClientset: clientset}
	err = app.DeleteDeployment("default", "test-deploy")
	if err != nil {
		t.Errorf("DeleteDeployment failed: %v", err)
	}

	// Verify deployment was deleted
	_, err = clientset.AppsV1().Deployments("default").Get(context.Background(), "test-deploy", metav1.GetOptions{})
	if err == nil {
		t.Error("expected deployment to be deleted")
	}
}

// Tests for RestartStatefulSet
func TestRestartStatefulSet(t *testing.T) {
	clientset := fake.NewSimpleClientset()

	sts := &appsv1.StatefulSet{
		ObjectMeta: metav1.ObjectMeta{Name: "test-sts", Namespace: "default"},
		Spec: appsv1.StatefulSetSpec{
			Replicas: int32Ptr(1),
			Selector: &metav1.LabelSelector{
				MatchLabels: map[string]string{"app": "test"},
			},
			Template: corev1.PodTemplateSpec{
				ObjectMeta: metav1.ObjectMeta{Labels: map[string]string{"app": "test"}},
				Spec:       corev1.PodSpec{Containers: []corev1.Container{{Name: "nginx", Image: "nginx"}}},
			},
		},
	}
	_, err := clientset.AppsV1().StatefulSets("default").Create(context.Background(), sts, metav1.CreateOptions{})
	if err != nil {
		t.Fatalf("failed to create statefulset: %v", err)
	}

	app := &App{ctx: context.Background(), testClientset: clientset}
	err = app.RestartStatefulSet("default", "test-sts")
	if err != nil {
		t.Errorf("RestartStatefulSet failed: %v", err)
	}
}

// Tests for DeleteStatefulSet
func TestDeleteStatefulSet(t *testing.T) {
	clientset := fake.NewSimpleClientset()

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
	_, _ = clientset.AppsV1().StatefulSets("default").Create(context.Background(), sts, metav1.CreateOptions{})

	app := &App{ctx: context.Background(), testClientset: clientset}
	err := app.DeleteStatefulSet("default", "test-sts")
	if err != nil {
		t.Errorf("DeleteStatefulSet failed: %v", err)
	}
}

// Tests for RestartDaemonSet
func TestRestartDaemonSet(t *testing.T) {
	clientset := fake.NewSimpleClientset()

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
	_, _ = clientset.AppsV1().DaemonSets("default").Create(context.Background(), ds, metav1.CreateOptions{})

	app := &App{ctx: context.Background(), testClientset: clientset}
	err := app.RestartDaemonSet("default", "test-ds")
	if err != nil {
		t.Errorf("RestartDaemonSet failed: %v", err)
	}
}

// Tests for DeleteDaemonSet
func TestDeleteDaemonSet(t *testing.T) {
	clientset := fake.NewSimpleClientset()

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
	_, _ = clientset.AppsV1().DaemonSets("default").Create(context.Background(), ds, metav1.CreateOptions{})

	app := &App{ctx: context.Background(), testClientset: clientset}
	err := app.DeleteDaemonSet("default", "test-ds")
	if err != nil {
		t.Errorf("DeleteDaemonSet failed: %v", err)
	}
}

// Tests for DeleteReplicaSet
func TestDeleteReplicaSet(t *testing.T) {
	clientset := fake.NewSimpleClientset()

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
	_, _ = clientset.AppsV1().ReplicaSets("default").Create(context.Background(), rs, metav1.CreateOptions{})

	app := &App{ctx: context.Background(), testClientset: clientset}
	err := app.DeleteReplicaSet("default", "test-rs")
	if err != nil {
		t.Errorf("DeleteReplicaSet failed: %v", err)
	}
}

// Tests for DeleteConfigMap
func TestDeleteConfigMap(t *testing.T) {
	clientset := fake.NewSimpleClientset()

	cm := &corev1.ConfigMap{
		ObjectMeta: metav1.ObjectMeta{Name: "test-cm", Namespace: "default"},
		Data:       map[string]string{"key": "value"},
	}
	_, _ = clientset.CoreV1().ConfigMaps("default").Create(context.Background(), cm, metav1.CreateOptions{})

	app := &App{ctx: context.Background(), testClientset: clientset}
	err := app.DeleteConfigMap("default", "test-cm")
	if err != nil {
		t.Errorf("DeleteConfigMap failed: %v", err)
	}
}

// Tests for DeleteSecret
func TestDeleteSecret(t *testing.T) {
	clientset := fake.NewSimpleClientset()

	secret := &corev1.Secret{
		ObjectMeta: metav1.ObjectMeta{Name: "test-secret", Namespace: "default"},
		Data:       map[string][]byte{"key": []byte("value")},
	}
	_, _ = clientset.CoreV1().Secrets("default").Create(context.Background(), secret, metav1.CreateOptions{})

	app := &App{ctx: context.Background(), testClientset: clientset}
	err := app.DeleteSecret("default", "test-secret")
	if err != nil {
		t.Errorf("DeleteSecret failed: %v", err)
	}
}

// Tests for DeletePersistentVolumeClaim
func TestDeletePersistentVolumeClaim(t *testing.T) {
	clientset := fake.NewSimpleClientset()

	pvc := &corev1.PersistentVolumeClaim{
		ObjectMeta: metav1.ObjectMeta{Name: "test-pvc", Namespace: "default"},
	}
	_, _ = clientset.CoreV1().PersistentVolumeClaims("default").Create(context.Background(), pvc, metav1.CreateOptions{})

	app := &App{ctx: context.Background(), testClientset: clientset}
	err := app.DeletePersistentVolumeClaim("default", "test-pvc")
	if err != nil {
		t.Errorf("DeletePersistentVolumeClaim failed: %v", err)
	}
}

// Tests for DeletePersistentVolume
func TestDeletePersistentVolume(t *testing.T) {
	clientset := fake.NewSimpleClientset()

	pv := &corev1.PersistentVolume{
		ObjectMeta: metav1.ObjectMeta{Name: "test-pv"},
	}
	_, _ = clientset.CoreV1().PersistentVolumes().Create(context.Background(), pv, metav1.CreateOptions{})

	app := &App{ctx: context.Background(), testClientset: clientset}
	err := app.DeletePersistentVolume("test-pv")
	if err != nil {
		t.Errorf("DeletePersistentVolume failed: %v", err)
	}
}

// Tests for DeleteIngress
func TestDeleteIngress(t *testing.T) {
	clientset := fake.NewSimpleClientset()

	ingress := &networkingv1.Ingress{
		ObjectMeta: metav1.ObjectMeta{Name: "test-ingress", Namespace: "default"},
	}
	_, _ = clientset.NetworkingV1().Ingresses("default").Create(context.Background(), ingress, metav1.CreateOptions{})

	app := &App{ctx: context.Background(), testClientset: clientset}
	err := app.DeleteIngress("default", "test-ingress")
	if err != nil {
		t.Errorf("DeleteIngress failed: %v", err)
	}
}

// Tests for ScaleResource
func TestScaleResource(t *testing.T) {
	tests := []struct {
		name          string
		kind          string
		resourceName  string
		replicas      int
		expectedError bool
	}{
		{
			name:          "negative replicas",
			kind:          "Deployment",
			resourceName:  "test",
			replicas:      -1,
			expectedError: true,
		},
		{
			name:          "unsupported kind",
			kind:          "Pod",
			resourceName:  "test",
			replicas:      1,
			expectedError: true,
		},
		{
			name:          "daemonset not scalable",
			kind:          "DaemonSet",
			resourceName:  "test",
			replicas:      2,
			expectedError: true,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			clientset := fake.NewSimpleClientset()
			app := &App{ctx: context.Background(), testClientset: clientset}

			err := app.ScaleResource(tc.kind, "default", tc.resourceName, tc.replicas)
			if tc.expectedError && err == nil {
				t.Error("expected error but got none")
			}
			if !tc.expectedError && err != nil {
				t.Errorf("unexpected error: %v", err)
			}
		})
	}
}

// Tests for DeleteJob
func TestDeleteJob(t *testing.T) {
	clientset := fake.NewSimpleClientset()

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
	_, _ = clientset.BatchV1().Jobs("default").Create(context.Background(), job, metav1.CreateOptions{})

	app := &App{ctx: context.Background(), testClientset: clientset}
	err := app.DeleteJob("default", "test-job")
	if err != nil {
		t.Errorf("DeleteJob failed: %v", err)
	}
}

// Tests for DeleteCronJob
func TestDeleteCronJob(t *testing.T) {
	clientset := fake.NewSimpleClientset()

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
	_, _ = clientset.BatchV1().CronJobs("default").Create(context.Background(), cronJob, metav1.CreateOptions{})

	app := &App{ctx: context.Background(), testClientset: clientset}
	err := app.DeleteCronJob("default", "test-cronjob")
	if err != nil {
		t.Errorf("DeleteCronJob failed: %v", err)
	}
}

// Tests for SuspendCronJob
func TestSuspendCronJob(t *testing.T) {
	clientset := fake.NewSimpleClientset()

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
	_, _ = clientset.BatchV1().CronJobs("default").Create(context.Background(), cronJob, metav1.CreateOptions{})

	app := &App{ctx: context.Background(), testClientset: clientset}
	err := app.SuspendCronJob("default", "test-cronjob")
	if err != nil {
		t.Errorf("SuspendCronJob failed: %v", err)
	}
}

// Tests for ResumeCronJob
func TestResumeCronJob(t *testing.T) {
	clientset := fake.NewSimpleClientset()

	trueVal := true
	cronJob := &batchv1.CronJob{
		ObjectMeta: metav1.ObjectMeta{Name: "test-cronjob", Namespace: "default"},
		Spec: batchv1.CronJobSpec{
			Schedule: "* * * * *",
			Suspend:  &trueVal,
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
	_, _ = clientset.BatchV1().CronJobs("default").Create(context.Background(), cronJob, metav1.CreateOptions{})

	app := &App{ctx: context.Background(), testClientset: clientset}
	err := app.ResumeCronJob("default", "test-cronjob")
	if err != nil {
		t.Errorf("ResumeCronJob failed: %v", err)
	}
}

// Tests for StartJobFromCronJob
func TestStartJobFromCronJob(t *testing.T) {
	clientset := fake.NewSimpleClientset()

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
	_, _ = clientset.BatchV1().CronJobs("default").Create(context.Background(), cronJob, metav1.CreateOptions{})

	app := &App{ctx: context.Background(), testClientset: clientset}
	err := app.StartJobFromCronJob("default", "test-cronjob")
	if err != nil {
		t.Errorf("StartJobFromCronJob failed: %v", err)
	}

	// Verify job was created
	jobs, _ := clientset.BatchV1().Jobs("default").List(context.Background(), metav1.ListOptions{})
	if len(jobs.Items) != 1 {
		t.Errorf("expected 1 job, got %d", len(jobs.Items))
	}
}

// Tests for StartJob
func TestStartJob(t *testing.T) {
	clientset := fake.NewSimpleClientset()

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
	_, _ = clientset.BatchV1().Jobs("default").Create(context.Background(), job, metav1.CreateOptions{})

	app := &App{ctx: context.Background(), testClientset: clientset}
	err := app.StartJob("default", "test-job")
	if err != nil {
		t.Errorf("StartJob failed: %v", err)
	}

	// Verify new job was created
	jobs, _ := clientset.BatchV1().Jobs("default").List(context.Background(), metav1.ListOptions{})
	if len(jobs.Items) != 2 {
		t.Errorf("expected 2 jobs, got %d", len(jobs.Items))
	}
}

// Tests for RestartWorkload (generic)
func TestRestartWorkload(t *testing.T) {
	tests := []struct {
		name        string
		kind        string
		setupFunc   func(*fake.Clientset)
		expectError bool
	}{
		{
			name: "restart deployment via RestartWorkload",
			kind: "deployment",
			setupFunc: func(cs *fake.Clientset) {
				deploy := &appsv1.Deployment{
					ObjectMeta: metav1.ObjectMeta{Name: "test-wl", Namespace: "default"},
					Spec: appsv1.DeploymentSpec{
						Replicas: int32Ptr(1),
						Selector: &metav1.LabelSelector{MatchLabels: map[string]string{"app": "test"}},
						Template: corev1.PodTemplateSpec{
							ObjectMeta: metav1.ObjectMeta{Labels: map[string]string{"app": "test"}},
							Spec:       corev1.PodSpec{Containers: []corev1.Container{{Name: "nginx", Image: "nginx"}}},
						},
					},
				}
				cs.AppsV1().Deployments("default").Create(context.Background(), deploy, metav1.CreateOptions{})
			},
		},
		{
			name: "restart statefulset via RestartWorkload",
			kind: "statefulset",
			setupFunc: func(cs *fake.Clientset) {
				sts := &appsv1.StatefulSet{
					ObjectMeta: metav1.ObjectMeta{Name: "test-wl", Namespace: "default"},
					Spec: appsv1.StatefulSetSpec{
						Replicas: int32Ptr(1),
						Selector: &metav1.LabelSelector{MatchLabels: map[string]string{"app": "test"}},
						Template: corev1.PodTemplateSpec{
							ObjectMeta: metav1.ObjectMeta{Labels: map[string]string{"app": "test"}},
							Spec:       corev1.PodSpec{Containers: []corev1.Container{{Name: "nginx", Image: "nginx"}}},
						},
					},
				}
				cs.AppsV1().StatefulSets("default").Create(context.Background(), sts, metav1.CreateOptions{})
			},
		},
		{
			name: "restart daemonset via RestartWorkload",
			kind: "daemonset",
			setupFunc: func(cs *fake.Clientset) {
				ds := &appsv1.DaemonSet{
					ObjectMeta: metav1.ObjectMeta{Name: "test-wl", Namespace: "default"},
					Spec: appsv1.DaemonSetSpec{
						Selector: &metav1.LabelSelector{MatchLabels: map[string]string{"app": "test"}},
						Template: corev1.PodTemplateSpec{
							ObjectMeta: metav1.ObjectMeta{Labels: map[string]string{"app": "test"}},
							Spec:       corev1.PodSpec{Containers: []corev1.Container{{Name: "nginx", Image: "nginx"}}},
						},
					},
				}
				cs.AppsV1().DaemonSets("default").Create(context.Background(), ds, metav1.CreateOptions{})
			},
		},
		{
			name:        "restart unsupported kind returns error",
			kind:        "configmap",
			setupFunc:   nil,
			expectError: true,
		},
		{
			name: "restart with plural kind",
			kind: "Deployments",
			setupFunc: func(cs *fake.Clientset) {
				deploy := &appsv1.Deployment{
					ObjectMeta: metav1.ObjectMeta{Name: "test-wl", Namespace: "default"},
					Spec: appsv1.DeploymentSpec{
						Replicas: int32Ptr(1),
						Selector: &metav1.LabelSelector{MatchLabels: map[string]string{"app": "test"}},
						Template: corev1.PodTemplateSpec{
							ObjectMeta: metav1.ObjectMeta{Labels: map[string]string{"app": "test"}},
							Spec:       corev1.PodSpec{Containers: []corev1.Container{{Name: "nginx", Image: "nginx"}}},
						},
					},
				}
				cs.AppsV1().Deployments("default").Create(context.Background(), deploy, metav1.CreateOptions{})
			},
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			clientset := fake.NewSimpleClientset()
			if tc.setupFunc != nil {
				tc.setupFunc(clientset)
			}

			app := &App{ctx: context.Background(), testClientset: clientset}
			err := app.RestartWorkload(tc.kind, "default", "test-wl")

			if tc.expectError && err == nil {
				t.Error("expected error but got none")
			}
			if !tc.expectError && err != nil {
				t.Errorf("unexpected error: %v", err)
			}
		})
	}
}

// Tests for updateScale helper
func TestUpdateScale(t *testing.T) {
	app := &App{ctx: context.Background()}

	// Test with nil get function
	err := app.updateScale(3, nil, func(s *autoscalingv1.Scale) error { return nil })
	if err == nil || !strings.Contains(err.Error(), "invalid scale helper") {
		t.Errorf("expected invalid scale helper error, got %v", err)
	}

	// Test with nil update function
	err = app.updateScale(3, func() (*autoscalingv1.Scale, error) { return nil, nil }, nil)
	if err == nil || !strings.Contains(err.Error(), "invalid scale helper") {
		t.Errorf("expected invalid scale helper error, got %v", err)
	}

	// Test with get function that returns error
	getErr := fmt.Errorf("get error")
	err = app.updateScale(3, func() (*autoscalingv1.Scale, error) {
		return nil, getErr
	}, func(s *autoscalingv1.Scale) error { return nil })
	if err != getErr {
		t.Errorf("expected get error, got %v", err)
	}

	// Test with successful scale update
	scale := &autoscalingv1.Scale{
		ObjectMeta: metav1.ObjectMeta{Name: "test", Namespace: "default"},
		Spec:       autoscalingv1.ScaleSpec{Replicas: 1},
	}
	var updatedReplicas int32
	err = app.updateScale(5, func() (*autoscalingv1.Scale, error) {
		return scale, nil
	}, func(s *autoscalingv1.Scale) error {
		updatedReplicas = s.Spec.Replicas
		return nil
	})
	if err != nil {
		t.Errorf("expected no error, got %v", err)
	}
	if updatedReplicas != 5 {
		t.Errorf("expected replicas to be 5, got %d", updatedReplicas)
	}

	// Test with update function that returns error
	updateErr := fmt.Errorf("update error")
	err = app.updateScale(3, func() (*autoscalingv1.Scale, error) {
		return scale, nil
	}, func(s *autoscalingv1.Scale) error {
		return updateErr
	})
	if err != updateErr {
		t.Errorf("expected update error, got %v", err)
	}
}

// TestStartJobFromCronJob_NotFound verifies that StartJobFromCronJob returns an
// error when the referenced CronJob does not exist.
func TestStartJobFromCronJob_NotFound(t *testing.T) {
	app := &App{ctx: context.Background(), testClientset: fake.NewSimpleClientset()}
	err := app.StartJobFromCronJob("default", "missing-cj")
	if err == nil {
		t.Error("expected error for missing cronjob")
	}
}

// TestStartJob_NotFound verifies that StartJob returns an error when the
// referenced Job does not exist.
func TestStartJob_NotFound(t *testing.T) {
	app := &App{ctx: context.Background(), testClientset: fake.NewSimpleClientset()}
	err := app.StartJob("default", "missing-job")
	if err == nil {
		t.Error("expected error for missing job")
	}
}
