package jobs

import (
	"context"

	batchv1 "k8s.io/api/batch/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	types "k8s.io/apimachinery/pkg/types"
)

// StartJob creates a new Job from an existing Job
func StartJob(client ResourceClient, namespace, name string) error {
	job, err := client.BatchV1().Jobs(namespace).Get(context.Background(), name, metav1.GetOptions{})
	if err != nil {
		return err
	}
	// Clone the spec and remove fields that must be auto-generated for new jobs.
	newJob := &batchv1.Job{
		ObjectMeta: metav1.ObjectMeta{
			GenerateName: job.Name + "-manual-",
			Namespace:    namespace,
		},
		Spec: job.Spec,
	}
	newJob.Spec.Selector = nil
	newJob.Spec.ManualSelector = nil
	if newJob.Spec.Template.ObjectMeta.Labels != nil {
		for _, key := range []string{
			"controller-uid",
			"batch.kubernetes.io/controller-uid",
			"job-name",
			"batch.kubernetes.io/job-name",
		} {
			delete(newJob.Spec.Template.ObjectMeta.Labels, key)
		}
	}
	newJob.ResourceVersion = ""
	newJob.UID = ""
	newJob.CreationTimestamp = metav1.Time{}
	_, err = client.BatchV1().Jobs(namespace).Create(context.Background(), newJob, metav1.CreateOptions{})
	return err
}

// SuspendCronJob patches a CronJob to suspend it
func SuspendCronJob(client ResourceClient, namespace, name string) error {
	patch := []byte(`{"spec":{"suspend":true}}`)
	_, err := client.BatchV1().CronJobs(namespace).Patch(context.Background(), name, types.MergePatchType, patch, metav1.PatchOptions{})
	return err
}

// ResumeCronJob patches a CronJob to resume it
func ResumeCronJob(client ResourceClient, namespace, name string) error {
	patch := []byte(`{"spec":{"suspend":false}}`)
	_, err := client.BatchV1().CronJobs(namespace).Patch(context.Background(), name, types.MergePatchType, patch, metav1.PatchOptions{})
	return err
}

// StartJobFromCronJob creates a Job from a CronJob's template
func StartJobFromCronJob(client ResourceClient, namespace, cronJobName string) error {
	cronJob, err := client.BatchV1().CronJobs(namespace).Get(context.Background(), cronJobName, metav1.GetOptions{})
	if err != nil {
		return err
	}
	newJob := &batchv1.Job{
		ObjectMeta: metav1.ObjectMeta{
			GenerateName: cronJob.Name + "-manual-",
			Namespace:    namespace,
		},
		Spec: cronJob.Spec.JobTemplate.Spec,
	}
	_, err = client.BatchV1().Jobs(namespace).Create(context.Background(), newJob, metav1.CreateOptions{})
	return err
}
