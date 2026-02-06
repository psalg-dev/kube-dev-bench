package app

import (
	"fmt"
	"strings"
	"time"

	appsv1 "k8s.io/api/apps/v1"
	autoscalingv1 "k8s.io/api/autoscaling/v1"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/labels"
	types "k8s.io/apimachinery/pkg/types"
	"k8s.io/client-go/kubernetes"
)

// --- Generic helpers ---

// Remove unused parameter warnings
func (a *App) patchControllerAnnotation(_kind, _namespace, _name string, patchFunc func() error) error {
	// reference parameters to avoid unused parameter warnings in static analysis
	_ = _kind
	_ = _namespace
	_ = _name
	return patchFunc()
}

// --- Deployments ---
func (a *App) RestartDeployment(namespace, name string) error {
	clientset, err := a.getKubernetesInterface()
	if err != nil {
		return err
	}
	patch := []byte(fmt.Sprintf(`{"spec":{"template":{"metadata":{"annotations":{"kube-dev-bench/restartedAt":"%s"}}}}}`, time.Now().Format(time.RFC3339)))
	_, err = clientset.AppsV1().Deployments(namespace).Patch(a.ctx, name, types.MergePatchType, patch, metav1.PatchOptions{})
	return err
}
func (a *App) DeleteDeployment(namespace, name string) error {
	clientset, err := a.getKubernetesInterface()
	if err != nil {
		return err
	}
	return clientset.AppsV1().Deployments(namespace).Delete(a.ctx, name, metav1.DeleteOptions{})
}

// RollbackDeploymentToRevision updates the Deployment's pod template to match a previous ReplicaSet revision.
// This is a best-effort rollback similar to kubectl rollout undo.
func (a *App) RollbackDeploymentToRevision(namespace, name string, revision int64) error {
	clientset, err := a.getKubernetesInterface()
	if err != nil {
		return err
	}
	dep, err := clientset.AppsV1().Deployments(namespace).Get(a.ctx, name, metav1.GetOptions{})
	if err != nil {
		return err
	}
	if dep.Spec.Selector == nil {
		return fmt.Errorf("deployment has no selector")
	}

	foundTemplate, err := a.findDeploymentRevisionTemplate(clientset, namespace, name, dep, revision)
	if err != nil {
		return err
	}

	dep.Spec.Template = *foundTemplate
	_, err = clientset.AppsV1().Deployments(namespace).Update(a.ctx, dep, metav1.UpdateOptions{})
	return err
}

func (a *App) findDeploymentRevisionTemplate(clientset kubernetes.Interface, namespace, name string, dep *appsv1.Deployment, revision int64) (*corev1.PodTemplateSpec, error) {
	selector := labels.SelectorFromSet(dep.Spec.Selector.MatchLabels)
	rsList, err := clientset.AppsV1().ReplicaSets(namespace).List(a.ctx, metav1.ListOptions{LabelSelector: selector.String()})
	if err != nil {
		return nil, err
	}

	for _, rs := range rsList.Items {
		if !isOwnedByDeployment(rs.OwnerReferences, name) {
			continue
		}
		if getReplicaSetRevision(rs.Annotations) == revision {
			tpl := rs.Spec.Template
			return &tpl, nil
		}
	}
	return nil, fmt.Errorf("revision %d not found", revision)
}

func isOwnedByDeployment(refs []metav1.OwnerReference, name string) bool {
	for _, ref := range refs {
		if ref.Kind == "Deployment" && ref.Name == name {
			return true
		}
	}
	return false
}

func getReplicaSetRevision(annotations map[string]string) int64 {
	if rev, ok := annotations["deployment.kubernetes.io/revision"]; ok {
		var rsRev int64
		if _, err := fmt.Sscanf(rev, "%d", &rsRev); err == nil {
			return rsRev
		}
		return rsRev
	}
	return 0
}

// --- StatefulSets ---
func (a *App) RestartStatefulSet(namespace, name string) error {
	clientset, err := a.getKubernetesInterface()
	if err != nil {
		return err
	}
	patch := []byte(fmt.Sprintf(`{"spec":{"template":{"metadata":{"annotations":{"kube-dev-bench/restartedAt":"%s"}}}}}`, time.Now().Format(time.RFC3339)))
	_, err = clientset.AppsV1().StatefulSets(namespace).Patch(a.ctx, name, types.MergePatchType, patch, metav1.PatchOptions{})
	return err
}
func (a *App) DeleteStatefulSet(namespace, name string) error {
	clientset, err := a.getKubernetesInterface()
	if err != nil {
		return err
	}
	return clientset.AppsV1().StatefulSets(namespace).Delete(a.ctx, name, metav1.DeleteOptions{})
}

// --- DaemonSets ---
func (a *App) RestartDaemonSet(namespace, name string) error {
	clientset, err := a.getKubernetesInterface()
	if err != nil {
		return err
	}
	patch := []byte(fmt.Sprintf(`{"spec":{"template":{"metadata":{"annotations":{"kube-dev-bench/restartedAt":"%s"}}}}}`, time.Now().Format(time.RFC3339)))
	_, err = clientset.AppsV1().DaemonSets(namespace).Patch(a.ctx, name, types.MergePatchType, patch, metav1.PatchOptions{})
	return err
}
func (a *App) DeleteDaemonSet(namespace, name string) error {
	clientset, err := a.getKubernetesInterface()
	if err != nil {
		return err
	}
	return clientset.AppsV1().DaemonSets(namespace).Delete(a.ctx, name, metav1.DeleteOptions{})
}

// --- ReplicaSets (restart not meaningful separately) ---
func (a *App) DeleteReplicaSet(namespace, name string) error {
	clientset, err := a.getKubernetesInterface()
	if err != nil {
		return err
	}
	return clientset.AppsV1().ReplicaSets(namespace).Delete(a.ctx, name, metav1.DeleteOptions{})
}

// --- ConfigMaps ---
func (a *App) DeleteConfigMap(namespace, name string) error {
	clientset, err := a.getKubernetesInterface()
	if err != nil {
		return err
	}
	return clientset.CoreV1().ConfigMaps(namespace).Delete(a.ctx, name, metav1.DeleteOptions{})
}

// --- Secrets ---
func (a *App) DeleteSecret(namespace, name string) error {
	clientset, err := a.getKubernetesInterface()
	if err != nil {
		return err
	}
	return clientset.CoreV1().Secrets(namespace).Delete(a.ctx, name, metav1.DeleteOptions{})
}

// --- Persistent Volume Claims ---
func (a *App) DeletePersistentVolumeClaim(namespace, name string) error {
	clientset, err := a.getKubernetesInterface()
	if err != nil {
		return err
	}
	return clientset.CoreV1().PersistentVolumeClaims(namespace).Delete(a.ctx, name, metav1.DeleteOptions{})
}

// --- Persistent Volumes ---
func (a *App) DeletePersistentVolume(name string) error {
	clientset, err := a.getKubernetesInterface()
	if err != nil {
		return err
	}
	return clientset.CoreV1().PersistentVolumes().Delete(a.ctx, name, metav1.DeleteOptions{})
}

// --- Ingresses ---
func (a *App) DeleteIngress(namespace, name string) error {
	clientset, err := a.getKubernetesInterface()
	if err != nil {
		return err
	}
	return clientset.NetworkingV1().Ingresses(namespace).Delete(a.ctx, name, metav1.DeleteOptions{})
}

// Job and CronJob App methods moved to resource_actions_jobs.go

// ScaleResource updates the replica count for supported workload controllers via the scale subresource.
func (a *App) ScaleResource(kind, namespace, name string, replicas int) error {
	if replicas < 0 {
		return fmt.Errorf("replicas must be non-negative")
	}
	maxInt32 := int(^uint32(0) >> 1)
	if replicas > maxInt32 {
		return fmt.Errorf("replicas must be <= %d", maxInt32)
	}
	clientset, err := a.getKubernetesInterface()
	if err != nil {
		return err
	}
	// #nosec G115 -- bounds checked above.
	desired := int32(replicas)
	switch strings.ToLower(kind) {
	case "deployment", "deployments":
		return a.updateScale(desired, func() (*autoscalingv1.Scale, error) {
			return clientset.AppsV1().Deployments(namespace).GetScale(a.ctx, name, metav1.GetOptions{})
		}, func(scale *autoscalingv1.Scale) error {
			_, err := clientset.AppsV1().Deployments(namespace).UpdateScale(a.ctx, name, scale, metav1.UpdateOptions{})
			return err
		})
	case "statefulset", "statefulsets":
		return a.updateScale(desired, func() (*autoscalingv1.Scale, error) {
			return clientset.AppsV1().StatefulSets(namespace).GetScale(a.ctx, name, metav1.GetOptions{})
		}, func(scale *autoscalingv1.Scale) error {
			_, err := clientset.AppsV1().StatefulSets(namespace).UpdateScale(a.ctx, name, scale, metav1.UpdateOptions{})
			return err
		})
	case "daemonset", "daemonsets":
		return fmt.Errorf("daemonsets do not support replica scaling; they run once per matching node")
	case "replicaset", "replicasets":
		return a.updateScale(desired, func() (*autoscalingv1.Scale, error) {
			return clientset.AppsV1().ReplicaSets(namespace).GetScale(a.ctx, name, metav1.GetOptions{})
		}, func(scale *autoscalingv1.Scale) error {
			_, err := clientset.AppsV1().ReplicaSets(namespace).UpdateScale(a.ctx, name, scale, metav1.UpdateOptions{})
			return err
		})
	default:
		return fmt.Errorf("scaling not supported for kind %s", kind)
	}
}

type scaleGetFunc func() (*autoscalingv1.Scale, error)
type scaleUpdateFunc func(*autoscalingv1.Scale) error

// updateScale fetches, mutates, and persists the scale subresource while preserving metadata like ResourceVersion.
func (a *App) updateScale(target int32, getFn scaleGetFunc, updateFn scaleUpdateFunc) error {
	if getFn == nil || updateFn == nil {
		return fmt.Errorf("invalid scale helper")
	}
	scaleObj, err := getFn()
	if err != nil {
		return err
	}
	scaleObj.Spec.Replicas = target
	return updateFn(scaleObj)
}
