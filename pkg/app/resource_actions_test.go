package app

import (
	"context"
	"errors"
	"testing"

	batchv1 "k8s.io/api/batch/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"
)

type mockResourceClient struct {
	batch BatchV1Interface
}

func (m *mockResourceClient) BatchV1() BatchV1Interface { return m.batch }

func TestStartJob_Success(t *testing.T) {
	jobName := "test-job"
	namespace := "default"
	mockJobs := &mockJobInterface{
		getFunc: func(ctx context.Context, name string, opts metav1.GetOptions) (*batchv1.Job, error) {
			return &batchv1.Job{ObjectMeta: metav1.ObjectMeta{Name: jobName}, Spec: batchv1.JobSpec{}}, nil
		},
		createFunc: func(ctx context.Context, job *batchv1.Job, opts metav1.CreateOptions) (*batchv1.Job, error) {
			if job.GenerateName == "test-job-manual-" {
				return job, nil
			}
			return nil, errors.New("unexpected job name")
		},
	}
	client := &mockResourceClient{batch: &mockBatchV1{jobs: mockJobs}}
	if err := StartJob(client, namespace, jobName); err != nil {
		t.Errorf("expected success, got error: %v", err)
	}
}

func TestSuspendCronJob_Success(t *testing.T) {
	cronJobName := "test-cronjob"
	namespace := "default"
	mockCronJobs := &mockCronJobInterface{
		patchFunc: func(ctx context.Context, name string, pt types.PatchType, data []byte, opts metav1.PatchOptions) (*batchv1.CronJob, error) {
			if string(data) == `{"spec":{"suspend":true}}` {
				return &batchv1.CronJob{}, nil
			}
			return nil, errors.New("patch data mismatch")
		},
	}
	client := &mockResourceClient{batch: &mockBatchV1{cronJobs: mockCronJobs}}
	if err := SuspendCronJob(client, namespace, cronJobName); err != nil {
		t.Errorf("expected success, got error: %v", err)
	}
}

func TestResumeCronJob_Success(t *testing.T) {
	cronJobName := "test-cronjob"
	namespace := "default"
	mockCronJobs := &mockCronJobInterface{
		patchFunc: func(ctx context.Context, name string, pt types.PatchType, data []byte, opts metav1.PatchOptions) (*batchv1.CronJob, error) {
			if string(data) == `{"spec":{"suspend":false}}` {
				return &batchv1.CronJob{}, nil
			}
			return nil, errors.New("patch data mismatch")
		},
	}
	client := &mockResourceClient{batch: &mockBatchV1{cronJobs: mockCronJobs}}
	if err := ResumeCronJob(client, namespace, cronJobName); err != nil {
		t.Errorf("expected success, got error: %v", err)
	}
}

func TestStartJobFromCronJob_Success(t *testing.T) {
	cronJobName := "test-cronjob"
	namespace := "default"
	mockCronJobs := &mockCronJobInterface{
		getFunc: func(ctx context.Context, name string, opts metav1.GetOptions) (*batchv1.CronJob, error) {
			return &batchv1.CronJob{ObjectMeta: metav1.ObjectMeta{Name: cronJobName}, Spec: batchv1.CronJobSpec{JobTemplate: batchv1.JobTemplateSpec{Spec: batchv1.JobSpec{}}}}, nil
		},
	}
	mockJobs := &mockJobInterface{
		createFunc: func(ctx context.Context, job *batchv1.Job, opts metav1.CreateOptions) (*batchv1.Job, error) {
			if job.GenerateName == "test-cronjob-manual-" {
				return job, nil
			}
			return nil, errors.New("unexpected job name")
		},
	}
	client := &mockResourceClient{batch: &mockBatchV1{jobs: mockJobs, cronJobs: mockCronJobs}}
	if err := StartJobFromCronJob(client, namespace, cronJobName); err != nil {
		t.Errorf("expected success, got error: %v", err)
	}
}

// Mock implementations

type mockBatchV1 struct {
	jobs     JobInterface
	cronJobs CronJobInterface
}

func (m *mockBatchV1) Jobs(namespace string) JobInterface         { return m.jobs }
func (m *mockBatchV1) CronJobs(namespace string) CronJobInterface { return m.cronJobs }

type mockJobInterface struct {
	getFunc    func(ctx context.Context, name string, opts metav1.GetOptions) (*batchv1.Job, error)
	createFunc func(ctx context.Context, job *batchv1.Job, opts metav1.CreateOptions) (*batchv1.Job, error)
	deleteFunc func(ctx context.Context, name string, opts metav1.DeleteOptions) error
}

func (m *mockJobInterface) Get(ctx context.Context, name string, opts metav1.GetOptions) (*batchv1.Job, error) {
	return m.getFunc(ctx, name, opts)
}
func (m *mockJobInterface) Create(ctx context.Context, job *batchv1.Job, opts metav1.CreateOptions) (*batchv1.Job, error) {
	return m.createFunc(ctx, job, opts)
}
func (m *mockJobInterface) Delete(ctx context.Context, name string, opts metav1.DeleteOptions) error {
	if m.deleteFunc != nil {
		return m.deleteFunc(ctx, name, opts)
	}
	return nil
}

type mockCronJobInterface struct {
	getFunc    func(ctx context.Context, name string, opts metav1.GetOptions) (*batchv1.CronJob, error)
	patchFunc  func(ctx context.Context, name string, pt types.PatchType, data []byte, opts metav1.PatchOptions) (*batchv1.CronJob, error)
	deleteFunc func(ctx context.Context, name string, opts metav1.DeleteOptions) error
}

func (m *mockCronJobInterface) Get(ctx context.Context, name string, opts metav1.GetOptions) (*batchv1.CronJob, error) {
	if m.getFunc != nil {
		return m.getFunc(ctx, name, opts)
	}
	return nil, nil
}
func (m *mockCronJobInterface) Patch(ctx context.Context, name string, pt types.PatchType, data []byte, opts metav1.PatchOptions) (*batchv1.CronJob, error) {
	if m.patchFunc != nil {
		return m.patchFunc(ctx, name, pt, data, opts)
	}
	return nil, nil
}
func (m *mockCronJobInterface) Delete(ctx context.Context, name string, opts metav1.DeleteOptions) error {
	if m.deleteFunc != nil {
		return m.deleteFunc(ctx, name, opts)
	}
	return nil
}
