// Package app: adapter between the App and the internal jobs package.
//
// This file was moved from pkg/app/jobs.go to make the purpose clearer:
// it provides the glue that adapts a kubernetes.Interface to the
// jobs.ResourceClient interface used by the pkg/app/jobs package.

package app

import (
	"context"

	jobs "gowails/pkg/app/jobs"

	batchv1 "k8s.io/api/batch/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	types "k8s.io/apimachinery/pkg/types"
	kubernetes "k8s.io/client-go/kubernetes"
	typedbatchv1 "k8s.io/client-go/kubernetes/typed/batch/v1"
)

// GetJobs returns all jobs in a namespace by delegating to the jobs package.
func (a *App) GetJobs(namespace string) ([]jobs.JobInfo, error) {
	clientset, err := a.getKubernetesClient()
	if err != nil {
		return nil, err
	}
	adapter := &clientAdapter{clientset: clientset}
	return jobs.GetJobs(adapter, namespace)
}

// clientAdapter adapts a kubernetes.Interface to jobs.ResourceClient
type clientAdapter struct {
	clientset kubernetes.Interface
}

func (c *clientAdapter) BatchV1() jobs.BatchV1Interface {
	return &batchV1Adapter{inner: c.clientset.BatchV1()}
}

type batchV1Adapter struct {
	inner typedbatchv1.BatchV1Interface
}

func (b *batchV1Adapter) Jobs(namespace string) jobs.JobInterface {
	return &jobInterfaceAdapter{inner: b.inner.Jobs(namespace)}
}
func (b *batchV1Adapter) CronJobs(namespace string) jobs.CronJobInterface {
	return &cronJobInterfaceAdapter{inner: b.inner.CronJobs(namespace)}
}

type jobInterfaceAdapter struct {
	inner typedbatchv1.JobInterface
}

func (j *jobInterfaceAdapter) List(ctx context.Context, opts metav1.ListOptions) (*batchv1.JobList, error) {
	return j.inner.List(ctx, opts)
}
func (j *jobInterfaceAdapter) Get(ctx context.Context, name string, opts metav1.GetOptions) (*batchv1.Job, error) {
	return j.inner.Get(ctx, name, opts)
}
func (j *jobInterfaceAdapter) Create(ctx context.Context, job *batchv1.Job, opts metav1.CreateOptions) (*batchv1.Job, error) {
	return j.inner.Create(ctx, job, opts)
}
func (j *jobInterfaceAdapter) Delete(ctx context.Context, name string, opts metav1.DeleteOptions) error {
	return j.inner.Delete(ctx, name, opts)
}

type cronJobInterfaceAdapter struct {
	inner typedbatchv1.CronJobInterface
}

func (c *cronJobInterfaceAdapter) Get(ctx context.Context, name string, opts metav1.GetOptions) (*batchv1.CronJob, error) {
	return c.inner.Get(ctx, name, opts)
}
func (c *cronJobInterfaceAdapter) Patch(ctx context.Context, name string, pt types.PatchType, data []byte, opts metav1.PatchOptions) (*batchv1.CronJob, error) {
	return c.inner.Patch(ctx, name, pt, data, opts)
}
func (c *cronJobInterfaceAdapter) Delete(ctx context.Context, name string, opts metav1.DeleteOptions) error {
	return c.inner.Delete(ctx, name, opts)
}
