package app

import (
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// DeleteResource deletes a resource of the given type, namespace, and name.
// Supported types: pod, deployment, statefulset, daemonset, replicaset, job,
// cronjob, configmap, secret, pvc, persistentvolumeclaim, pv, ingress, service, serviceaccount.
func (a *App) DeleteResource(resourceType, namespace, name string) error {
	a.auditf("delete", resourceType+"/"+name, "namespace=%s", namespace)
	clientset, err := a.getKubernetesInterface()
	if err != nil {
		return err
	}
	switch resourceType {
	case "pod":
		return clientset.CoreV1().Pods(namespace).Delete(a.ctx, name, metav1.DeleteOptions{})
	case "deployment":
		return clientset.AppsV1().Deployments(namespace).Delete(a.ctx, name, metav1.DeleteOptions{})
	case "statefulset":
		return clientset.AppsV1().StatefulSets(namespace).Delete(a.ctx, name, metav1.DeleteOptions{})
	case "daemonset":
		return clientset.AppsV1().DaemonSets(namespace).Delete(a.ctx, name, metav1.DeleteOptions{})
	case "replicaset":
		return clientset.AppsV1().ReplicaSets(namespace).Delete(a.ctx, name, metav1.DeleteOptions{})
	case "job":
		propagation := metav1.DeletePropagationBackground
		opts := metav1.DeleteOptions{PropagationPolicy: &propagation}
		return clientset.BatchV1().Jobs(namespace).Delete(a.ctx, name, opts)
	case "cronjob":
		return clientset.BatchV1().CronJobs(namespace).Delete(a.ctx, name, metav1.DeleteOptions{})
	case "configmap":
		return clientset.CoreV1().ConfigMaps(namespace).Delete(a.ctx, name, metav1.DeleteOptions{})
	case "secret":
		return clientset.CoreV1().Secrets(namespace).Delete(a.ctx, name, metav1.DeleteOptions{})
	case "pvc", "persistentvolumeclaim":
		return clientset.CoreV1().PersistentVolumeClaims(namespace).Delete(a.ctx, name, metav1.DeleteOptions{})
	case "pv":
		return clientset.CoreV1().PersistentVolumes().Delete(a.ctx, name, metav1.DeleteOptions{})
	case "ingress":
		return clientset.NetworkingV1().Ingresses(namespace).Delete(a.ctx, name, metav1.DeleteOptions{})
	case "service":
		return clientset.CoreV1().Services(namespace).Delete(a.ctx, name, metav1.DeleteOptions{})
	case "serviceaccount":
		return clientset.CoreV1().ServiceAccounts(namespace).Delete(a.ctx, name, metav1.DeleteOptions{})
	case "role":
		return clientset.RbacV1().Roles(namespace).Delete(a.ctx, name, metav1.DeleteOptions{})
	case "clusterrole":
		return clientset.RbacV1().ClusterRoles().Delete(a.ctx, name, metav1.DeleteOptions{})
	case "rolebinding":
		return clientset.RbacV1().RoleBindings(namespace).Delete(a.ctx, name, metav1.DeleteOptions{})
	case "clusterrolebinding":
		return clientset.RbacV1().ClusterRoleBindings().Delete(a.ctx, name, metav1.DeleteOptions{})
	default:
		return ErrUnsupportedResourceType(resourceType)
	}
}

// ErrUnsupportedResourceType is returned when a resource type is not supported
func ErrUnsupportedResourceType(t string) error {
	return &ResourceTypeError{Type: t}
}

type ResourceTypeError struct {
	Type string
}

func (e *ResourceTypeError) Error() string {
	return "unsupported resource type: " + e.Type
}
