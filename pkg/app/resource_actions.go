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

// --- Generic restart helper ---

// restartWorkload patches the pod template annotation to trigger a rolling restart.
// Supported kinds: deployment, statefulset, daemonset.
func (a *App) restartWorkload(kind, namespace, name string) error {
	clientset, err := a.getKubernetesInterface()
	if err != nil {
		return err
	}
	patch := []byte(fmt.Sprintf(
		`{"spec":{"template":{"metadata":{"annotations":{"kube-dev-bench/restartedAt":"%s"}}}}}`,
		time.Now().Format(time.RFC3339),
	))
	switch strings.ToLower(kind) {
	case "deployment", "deployments":
		_, err = clientset.AppsV1().Deployments(namespace).Patch(a.ctx, name, types.MergePatchType, patch, metav1.PatchOptions{})
	case "statefulset", "statefulsets":
		_, err = clientset.AppsV1().StatefulSets(namespace).Patch(a.ctx, name, types.MergePatchType, patch, metav1.PatchOptions{})
	case "daemonset", "daemonsets":
		_, err = clientset.AppsV1().DaemonSets(namespace).Patch(a.ctx, name, types.MergePatchType, patch, metav1.PatchOptions{})
	default:
		return fmt.Errorf("restart not supported for kind %s", kind)
	}
	return err
}

// RestartWorkload restarts a workload by kind. Exposed to frontend via Wails.
// Supported kinds: deployment, statefulset, daemonset.
func (a *App) RestartWorkload(kind, namespace, name string) error {
	return a.restartWorkload(kind, namespace, name)
}

// --- Deployments ---

// RestartDeployment restarts a deployment by patching its pod template annotation.
// Delegates to restartWorkload for the common restart logic.
func (a *App) RestartDeployment(namespace, name string) error {
	return a.restartWorkload("deployment", namespace, name)
}

// DeleteDeployment deletes a deployment. Delegates to DeleteResource.
func (a *App) DeleteDeployment(namespace, name string) error {
	return a.DeleteResource("deployment", namespace, name)
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
		fmt.Sscanf(rev, "%d", &rsRev)
		return rsRev
	}
	return 0
}

// --- StatefulSets ---

// RestartStatefulSet restarts a statefulset. Delegates to restartWorkload.
func (a *App) RestartStatefulSet(namespace, name string) error {
	return a.restartWorkload("statefulset", namespace, name)
}

// DeleteStatefulSet deletes a statefulset. Delegates to DeleteResource.
func (a *App) DeleteStatefulSet(namespace, name string) error {
	return a.DeleteResource("statefulset", namespace, name)
}

// --- DaemonSets ---

// RestartDaemonSet restarts a daemonset. Delegates to restartWorkload.
func (a *App) RestartDaemonSet(namespace, name string) error {
	return a.restartWorkload("daemonset", namespace, name)
}

// DeleteDaemonSet deletes a daemonset. Delegates to DeleteResource.
func (a *App) DeleteDaemonSet(namespace, name string) error {
	return a.DeleteResource("daemonset", namespace, name)
}

// --- ReplicaSets (restart not meaningful separately) ---

// DeleteReplicaSet deletes a replicaset. Delegates to DeleteResource.
func (a *App) DeleteReplicaSet(namespace, name string) error {
	return a.DeleteResource("replicaset", namespace, name)
}

// --- ConfigMaps ---

// DeleteConfigMap deletes a configmap. Delegates to DeleteResource.
func (a *App) DeleteConfigMap(namespace, name string) error {
	return a.DeleteResource("configmap", namespace, name)
}

// --- Secrets ---

// DeleteSecret deletes a secret. Delegates to DeleteResource.
func (a *App) DeleteSecret(namespace, name string) error {
	return a.DeleteResource("secret", namespace, name)
}

// --- Persistent Volume Claims ---

// DeletePersistentVolumeClaim deletes a PVC. Delegates to DeleteResource.
func (a *App) DeletePersistentVolumeClaim(namespace, name string) error {
	return a.DeleteResource("pvc", namespace, name)
}

// --- Persistent Volumes ---

// DeletePersistentVolume deletes a PV. Delegates to DeleteResource.
func (a *App) DeletePersistentVolume(name string) error {
	return a.DeleteResource("pv", "", name)
}

// --- Ingresses ---

// DeleteIngress deletes an ingress. Delegates to DeleteResource.
func (a *App) DeleteIngress(namespace, name string) error {
	return a.DeleteResource("ingress", namespace, name)
}

// Job and CronJob App methods moved to resource_actions_jobs.go

// ScaleResource updates the replica count for supported workload controllers via the scale subresource.
func (a *App) ScaleResource(kind, namespace, name string, replicas int) error {
	if replicas < 0 {
		return fmt.Errorf("replicas must be non-negative")
	}
	clientset, err := a.getKubernetesInterface()
	if err != nil {
		return err
	}
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
