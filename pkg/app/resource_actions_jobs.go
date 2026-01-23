package app

import (
	"time"

	batchv1 "k8s.io/api/batch/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	types "k8s.io/apimachinery/pkg/types"
)

// App methods for Jobs and CronJobs

func (a *App) DeleteJob(namespace, name string) error {
	clientset, err := a.getKubernetesInterface()
	if err != nil {
		return err
	}
	opts := metav1.DeleteOptions{}
	return clientset.BatchV1().Jobs(namespace).Delete(a.ctx, name, opts)
}

func (a *App) DeleteCronJob(namespace, name string) error {
	clientset, err := a.getKubernetesInterface()
	if err != nil {
		return err
	}
	return clientset.BatchV1().CronJobs(namespace).Delete(a.ctx, name, metav1.DeleteOptions{})
}

func (a *App) SuspendCronJob(namespace, name string) error {
	clientset, err := a.getKubernetesInterface()
	if err != nil {
		return err
	}
	patch := []byte(`{"spec":{"suspend":true}}`)
	_, err = clientset.BatchV1().CronJobs(namespace).Patch(a.ctx, name, types.MergePatchType, patch, metav1.PatchOptions{})
	return err
}

func (a *App) ResumeCronJob(namespace, name string) error {
	clientset, err := a.getKubernetesInterface()
	if err != nil {
		return err
	}
	patch := []byte(`{"spec":{"suspend":false}}`)
	_, err = clientset.BatchV1().CronJobs(namespace).Patch(a.ctx, name, types.MergePatchType, patch, metav1.PatchOptions{})
	return err
}

func (a *App) StartJobFromCronJob(namespace, cronJobName string) error {
	clientset, err := a.getKubernetesInterface()
	if err != nil {
		return err
	}
	cronJob, err := clientset.BatchV1().CronJobs(namespace).Get(a.ctx, cronJobName, metav1.GetOptions{})
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
	_, err = clientset.BatchV1().Jobs(namespace).Create(a.ctx, newJob, metav1.CreateOptions{})
	if err != nil {
		return err
	}

	go func(ns string) {
		// Avoid racing the apiserver; ensure list includes the new Job.
		time.Sleep(500 * time.Millisecond)
		if a.ctx == nil {
			return
		}
		if jobs, e := a.GetJobs(ns); e == nil {
			emitEvent(a.ctx, "jobs:update", jobs)
		}
	}(namespace)

	return nil
}

func (a *App) StartJob(namespace, name string) error {
	clientset, err := a.getKubernetesInterface()
	if err != nil {
		return err
	}
	job, err := clientset.BatchV1().Jobs(namespace).Get(a.ctx, name, metav1.GetOptions{})
	if err != nil {
		return err
	}
	newJob := &batchv1.Job{
		ObjectMeta: metav1.ObjectMeta{
			GenerateName: job.Name + "-manual-",
			Namespace:    namespace,
		},
		Spec: job.Spec,
	}
	newJob.ResourceVersion = ""
	newJob.UID = ""
	newJob.CreationTimestamp = metav1.Time{}
	_, err = clientset.BatchV1().Jobs(namespace).Create(a.ctx, newJob, metav1.CreateOptions{})
	if err != nil {
		return err
	}

	go func(ns string) {
		// Avoid racing the apiserver; ensure list includes the new Job.
		time.Sleep(500 * time.Millisecond)
		if a.ctx == nil {
			return
		}
		if jobs, e := a.GetJobs(ns); e == nil {
			emitEvent(a.ctx, "jobs:update", jobs)
		}
	}(namespace)

	return nil
}
