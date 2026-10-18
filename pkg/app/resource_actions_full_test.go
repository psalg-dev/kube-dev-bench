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

// Verify deployment was deleted

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

	// Verify the annotation was actually set on the StatefulSet pod template
	updated, err := clientset.AppsV1().StatefulSets("default").Get(context.Background(), "test-sts", metav1.GetOptions{})
	if err != nil {
		t.Fatalf("failed to get statefulset after restart: %v", err)
	}
	if updated.Spec.Template.Annotations == nil {
		t.Error("expected pod template annotations to be set after restart")
	}
}

// Test for RestartStatefulSet with OnDelete strategy
func TestRestartStatefulSetOnDeleteStrategy(t *testing.T) {
	clientset := fake.NewSimpleClientset()

	sts := &appsv1.StatefulSet{
		ObjectMeta: metav1.ObjectMeta{Name: "test-sts-ondel", Namespace: "default"},
		Spec: appsv1.StatefulSetSpec{
			Replicas: int32Ptr(1),
			Selector: &metav1.LabelSelector{
				MatchLabels: map[string]string{"app": "test"},
			},
			Template: corev1.PodTemplateSpec{
				ObjectMeta: metav1.ObjectMeta{Labels: map[string]string{"app": "test"}},
				Spec:       corev1.PodSpec{Containers: []corev1.Container{{Name: "nginx", Image: "nginx"}}},
			},
			UpdateStrategy: appsv1.StatefulSetUpdateStrategy{
				Type: appsv1.OnDeleteStatefulSetStrategyType,
			},
		},
	}
	_, err := clientset.AppsV1().StatefulSets("default").Create(context.Background(), sts, metav1.CreateOptions{})
	if err != nil {
		t.Fatalf("failed to create statefulset: %v", err)
	}

	app := &App{ctx: context.Background(), testClientset: clientset}
	err = app.RestartStatefulSet("default", "test-sts-ondel")
	if err == nil {
		t.Error("expected error for StatefulSet with OnDelete update strategy, got nil")
	}
	if err != nil && !strings.Contains(err.Error(), "OnDelete") {
		t.Errorf("expected error message to mention OnDelete, got: %v", err)
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
