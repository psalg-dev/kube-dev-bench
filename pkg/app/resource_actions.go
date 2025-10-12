package app

import (
	"context"
	"fmt"
	"time"

	batchv1 "k8s.io/api/batch/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	types "k8s.io/apimachinery/pkg/types"
)

// --- Generic helpers ---

// Remove unused parameter warnings
func (a *App) patchControllerAnnotation(_kind, _namespace, _name string, patchFunc func() error) error {
	return patchFunc()
}

// --- Deployments ---
func (a *App) RestartDeployment(namespace, name string) error {
	clientset, err := a.getKubernetesClient()
	if err != nil {
		return err
	}
	patch := []byte(fmt.Sprintf(`{"spec":{"template":{"metadata":{"annotations":{"kube-dev-bench/restartedAt":"%s"}}}}}`, time.Now().Format(time.RFC3339)))
	_, err = clientset.AppsV1().Deployments(namespace).Patch(a.ctx, name, types.MergePatchType, patch, metav1.PatchOptions{})
	return err
}
func (a *App) DeleteDeployment(namespace, name string) error {
	clientset, err := a.getKubernetesClient()
	if err != nil {
		return err
	}
	return clientset.AppsV1().Deployments(namespace).Delete(a.ctx, name, metav1.DeleteOptions{})
}

// --- StatefulSets ---
func (a *App) RestartStatefulSet(namespace, name string) error {
	clientset, err := a.getKubernetesClient()
	if err != nil {
		return err
	}
	patch := []byte(fmt.Sprintf(`{"spec":{"template":{"metadata":{"annotations":{"kube-dev-bench/restartedAt":"%s"}}}}}`, time.Now().Format(time.RFC3339)))
	_, err = clientset.AppsV1().StatefulSets(namespace).Patch(a.ctx, name, types.MergePatchType, patch, metav1.PatchOptions{})
	return err
}
func (a *App) DeleteStatefulSet(namespace, name string) error {
	clientset, err := a.getKubernetesClient()
	if err != nil {
		return err
	}
	return clientset.AppsV1().StatefulSets(namespace).Delete(a.ctx, name, metav1.DeleteOptions{})
}

// --- DaemonSets ---
func (a *App) RestartDaemonSet(namespace, name string) error {
	clientset, err := a.getKubernetesClient()
	if err != nil {
		return err
	}
	patch := []byte(fmt.Sprintf(`{"spec":{"template":{"metadata":{"annotations":{"kube-dev-bench/restartedAt":"%s"}}}}}`, time.Now().Format(time.RFC3339)))
	_, err = clientset.AppsV1().DaemonSets(namespace).Patch(a.ctx, name, types.MergePatchType, patch, metav1.PatchOptions{})
	return err
}
func (a *App) DeleteDaemonSet(namespace, name string) error {
	clientset, err := a.getKubernetesClient()
	if err != nil {
		return err
	}
	return clientset.AppsV1().DaemonSets(namespace).Delete(a.ctx, name, metav1.DeleteOptions{})
}

// --- ReplicaSets (restart not meaningful separately) ---
func (a *App) DeleteReplicaSet(namespace, name string) error {
	clientset, err := a.getKubernetesClient()
	if err != nil {
		return err
	}
	return clientset.AppsV1().ReplicaSets(namespace).Delete(a.ctx, name, metav1.DeleteOptions{})
}

// --- Jobs ---
func (a *App) DeleteJob(namespace, name string) error {
	clientset, err := a.getKubernetesClient()
	if err != nil {
		return err
	}
	opts := metav1.DeleteOptions{}
	return clientset.BatchV1().Jobs(namespace).Delete(a.ctx, name, opts)
}

// ResourceClient interface for dependency injection/testing
// Only relevant methods for resource actions are included

type ResourceClient interface {
	BatchV1() BatchV1Interface
}

type BatchV1Interface interface {
	Jobs(namespace string) JobInterface
	CronJobs(namespace string) CronJobInterface
}

type JobInterface interface {
	Get(ctx context.Context, name string, opts metav1.GetOptions) (*batchv1.Job, error)
	Create(ctx context.Context, job *batchv1.Job, opts metav1.CreateOptions) (*batchv1.Job, error)
	Delete(ctx context.Context, name string, opts metav1.DeleteOptions) error
}

type CronJobInterface interface {
	Get(ctx context.Context, name string, opts metav1.GetOptions) (*batchv1.CronJob, error)
	Patch(ctx context.Context, name string, pt types.PatchType, data []byte, opts metav1.PatchOptions) (*batchv1.CronJob, error)
	Delete(ctx context.Context, name string, opts metav1.DeleteOptions) error
}

// Refactored resource actions to accept ResourceClient
func StartJob(client ResourceClient, namespace, name string) error {
	job, err := client.BatchV1().Jobs(namespace).Get(context.Background(), name, metav1.GetOptions{})
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
	_, err = client.BatchV1().Jobs(namespace).Create(context.Background(), newJob, metav1.CreateOptions{})
	return err
}

func SuspendCronJob(client ResourceClient, namespace, name string) error {
	patch := []byte(`{"spec":{"suspend":true}}`)
	_, err := client.BatchV1().CronJobs(namespace).Patch(context.Background(), name, types.MergePatchType, patch, metav1.PatchOptions{})
	return err
}

func ResumeCronJob(client ResourceClient, namespace, name string) error {
	patch := []byte(`{"spec":{"suspend":false}}`)
	_, err := client.BatchV1().CronJobs(namespace).Patch(context.Background(), name, types.MergePatchType, patch, metav1.PatchOptions{})
	return err
}

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

// --- CronJobs ---
func (a *App) DeleteCronJob(namespace, name string) error {
	clientset, err := a.getKubernetesClient()
	if err != nil {
		return err
	}
	return clientset.BatchV1().CronJobs(namespace).Delete(a.ctx, name, metav1.DeleteOptions{})
}

// Patch CronJob .spec.suspend to true (Suspend)
func (a *App) SuspendCronJob(namespace, name string) error {
	clientset, err := a.getKubernetesClient()
	if err != nil {
		return err
	}
	patch := []byte(`{"spec":{"suspend":true}}`)
	_, err = clientset.BatchV1().CronJobs(namespace).Patch(a.ctx, name, types.MergePatchType, patch, metav1.PatchOptions{})
	return err
}

// Patch CronJob .spec.suspend to false (Resume)
func (a *App) ResumeCronJob(namespace, name string) error {
	clientset, err := a.getKubernetesClient()
	if err != nil {
		return err
	}
	patch := []byte(`{"spec":{"suspend":false}}`)
	_, err = clientset.BatchV1().CronJobs(namespace).Patch(a.ctx, name, types.MergePatchType, patch, metav1.PatchOptions{})
	return err
}

// Start a Job from a CronJob's template (manual trigger)
func (a *App) StartJobFromCronJob(namespace, cronJobName string) error {
	clientset, err := a.getKubernetesClient()
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
	return err
}

// --- ConfigMaps ---
func (a *App) DeleteConfigMap(namespace, name string) error {
	clientset, err := a.getKubernetesClient()
	if err != nil {
		return err
	}
	return clientset.CoreV1().ConfigMaps(namespace).Delete(a.ctx, name, metav1.DeleteOptions{})
}

// --- Secrets ---
func (a *App) DeleteSecret(namespace, name string) error {
	clientset, err := a.getKubernetesClient()
	if err != nil {
		return err
	}
	return clientset.CoreV1().Secrets(namespace).Delete(a.ctx, name, metav1.DeleteOptions{})
}

// --- Persistent Volume Claims ---
func (a *App) DeletePersistentVolumeClaim(namespace, name string) error {
	clientset, err := a.getKubernetesClient()
	if err != nil {
		return err
	}
	return clientset.CoreV1().PersistentVolumeClaims(namespace).Delete(a.ctx, name, metav1.DeleteOptions{})
}

// --- Persistent Volumes ---
func (a *App) DeletePersistentVolume(name string) error {
	clientset, err := a.getKubernetesClient()
	if err != nil {
		return err
	}
	return clientset.CoreV1().PersistentVolumes().Delete(a.ctx, name, metav1.DeleteOptions{})
}

// --- Ingresses ---
func (a *App) DeleteIngress(namespace, name string) error {
	clientset, err := a.getKubernetesClient()
	if err != nil {
		return err
	}
	return clientset.NetworkingV1().Ingresses(namespace).Delete(a.ctx, name, metav1.DeleteOptions{})
}

// Start a Job by copying an existing Job (exposed on App so Wails generates a binding)
func (a *App) StartJob(namespace, name string) error {
	clientset, err := a.getKubernetesClient()
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
	return err
}
