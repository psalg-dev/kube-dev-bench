package app

import (
	"context"
	"testing"

	batchv1 "k8s.io/api/batch/v1"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	types "k8s.io/apimachinery/pkg/types"
	"k8s.io/client-go/kubernetes/fake"
)

// Tests for clientAdapter.BatchV1
func TestClientAdapterBatchV1(t *testing.T) {
	clientset := fake.NewSimpleClientset()
	adapter := &clientAdapter{clientset: clientset}

	batchV1 := adapter.BatchV1()
	if batchV1 == nil {
		t.Error("BatchV1 returned nil")
	}
}

// Tests for batchV1Adapter.Jobs
func TestBatchV1AdapterJobs(t *testing.T) {
	clientset := fake.NewSimpleClientset()
	adapter := &clientAdapter{clientset: clientset}

	jobIface := adapter.BatchV1().Jobs("default")
	if jobIface == nil {
		t.Error("Jobs returned nil")
	}
}

// Tests for batchV1Adapter.CronJobs
func TestBatchV1AdapterCronJobs(t *testing.T) {
	clientset := fake.NewSimpleClientset()
	adapter := &clientAdapter{clientset: clientset}

	cronJobIface := adapter.BatchV1().CronJobs("default")
	if cronJobIface == nil {
		t.Error("CronJobs returned nil")
	}
}

// Tests for jobInterfaceAdapter
func TestJobInterfaceAdapter(t *testing.T) {
	clientset := fake.NewSimpleClientset()

	// Create a job
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
	_, err := clientset.BatchV1().Jobs("default").Create(context.Background(), job, metav1.CreateOptions{})
	if err != nil {
		t.Fatalf("failed to create job: %v", err)
	}

	adapter := &clientAdapter{clientset: clientset}
	jobIface := adapter.BatchV1().Jobs("default")

	// Test List
	list, err := jobIface.List(context.Background(), metav1.ListOptions{})
	if err != nil {
		t.Errorf("List failed: %v", err)
	}
	if len(list.Items) != 1 {
		t.Errorf("expected 1 job, got %d", len(list.Items))
	}

	// Test Get
	got, err := jobIface.Get(context.Background(), "test-job", metav1.GetOptions{})
	if err != nil {
		t.Errorf("Get failed: %v", err)
	}
	if got.Name != "test-job" {
		t.Errorf("expected job name test-job, got %s", got.Name)
	}

	// Test Create
	newJob := &batchv1.Job{
		ObjectMeta: metav1.ObjectMeta{Name: "test-job-2", Namespace: "default"},
		Spec: batchv1.JobSpec{
			Template: corev1.PodTemplateSpec{
				Spec: corev1.PodSpec{
					Containers:    []corev1.Container{{Name: "test", Image: "busybox"}},
					RestartPolicy: corev1.RestartPolicyNever,
				},
			},
		},
	}
	created, err := jobIface.Create(context.Background(), newJob, metav1.CreateOptions{})
	if err != nil {
		t.Errorf("Create failed: %v", err)
	}
	if created.Name != "test-job-2" {
		t.Errorf("expected created job name test-job-2, got %s", created.Name)
	}

	// Test Delete
	err = jobIface.Delete(context.Background(), "test-job-2", metav1.DeleteOptions{})
	if err != nil {
		t.Errorf("Delete failed: %v", err)
	}
}

// Tests for cronJobInterfaceAdapter
func TestCronJobInterfaceAdapter(t *testing.T) {
	clientset := fake.NewSimpleClientset()

	// Create a cronjob
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
	_, err := clientset.BatchV1().CronJobs("default").Create(context.Background(), cronJob, metav1.CreateOptions{})
	if err != nil {
		t.Fatalf("failed to create cronjob: %v", err)
	}

	adapter := &clientAdapter{clientset: clientset}
	cronJobIface := adapter.BatchV1().CronJobs("default")

	// Test Get
	got, err := cronJobIface.Get(context.Background(), "test-cronjob", metav1.GetOptions{})
	if err != nil {
		t.Errorf("Get failed: %v", err)
	}
	if got.Name != "test-cronjob" {
		t.Errorf("expected cronjob name test-cronjob, got %s", got.Name)
	}

	// Test Patch
	patchData := []byte(`{"metadata":{"labels":{"test":"true"}}}`)
	patched, err := cronJobIface.Patch(context.Background(), "test-cronjob", types.MergePatchType, patchData, metav1.PatchOptions{})
	if err != nil {
		t.Errorf("Patch failed: %v", err)
	}
	if patched.Labels["test"] != "true" {
		t.Error("expected patch to set label")
	}

	// Test Delete
	err = cronJobIface.Delete(context.Background(), "test-cronjob", metav1.DeleteOptions{})
	if err != nil {
		t.Errorf("Delete failed: %v", err)
	}
}
