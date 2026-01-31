package app

import (
	"fmt"
	"strings"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	types "k8s.io/apimachinery/pkg/types"
)

// BulkOperationItem represents a single resource for bulk operations
type BulkOperationItem struct {
	Kind      string `json:"kind"`
	Name      string `json:"name"`
	Namespace string `json:"namespace"`
}

// BulkOperationResult represents the result of a single operation
type BulkOperationResult struct {
	Name      string `json:"name"`
	Namespace string `json:"namespace"`
	Success   bool   `json:"success"`
	Error     string `json:"error,omitempty"`
}

// BulkOperationResponse represents the response from a bulk operation
type BulkOperationResponse struct {
	Results      []BulkOperationResult `json:"results"`
	SuccessCount int                   `json:"successCount"`
	ErrorCount   int                   `json:"errorCount"`
}

// BulkDeleteResources deletes multiple Kubernetes resources
func (a *App) BulkDeleteResources(items []BulkOperationItem) BulkOperationResponse {
	response := BulkOperationResponse{
		Results: make([]BulkOperationResult, 0, len(items)),
	}

	if len(items) == 0 {
		return response
	}

	clientset, err := a.getKubernetesInterface()
	if err != nil {
		// Return all items as failed
		for _, item := range items {
			response.Results = append(response.Results, BulkOperationResult{
				Name:      item.Name,
				Namespace: item.Namespace,
				Success:   false,
				Error:     err.Error(),
			})
			response.ErrorCount++
		}
		return response
	}

	for _, item := range items {
		var deleteErr error
		kind := strings.ToLower(item.Kind)

		switch kind {
		case "pod", "pods":
			deleteErr = clientset.CoreV1().Pods(item.Namespace).Delete(a.ctx, item.Name, metav1.DeleteOptions{})
		case "deployment", "deployments":
			deleteErr = clientset.AppsV1().Deployments(item.Namespace).Delete(a.ctx, item.Name, metav1.DeleteOptions{})
		case "statefulset", "statefulsets":
			deleteErr = clientset.AppsV1().StatefulSets(item.Namespace).Delete(a.ctx, item.Name, metav1.DeleteOptions{})
		case "daemonset", "daemonsets":
			deleteErr = clientset.AppsV1().DaemonSets(item.Namespace).Delete(a.ctx, item.Name, metav1.DeleteOptions{})
		case "replicaset", "replicasets":
			deleteErr = clientset.AppsV1().ReplicaSets(item.Namespace).Delete(a.ctx, item.Name, metav1.DeleteOptions{})
		case "job", "jobs":
			propagation := metav1.DeletePropagationBackground
			deleteErr = clientset.BatchV1().Jobs(item.Namespace).Delete(a.ctx, item.Name, metav1.DeleteOptions{PropagationPolicy: &propagation})
		case "cronjob", "cronjobs":
			deleteErr = clientset.BatchV1().CronJobs(item.Namespace).Delete(a.ctx, item.Name, metav1.DeleteOptions{})
		case "configmap", "configmaps":
			deleteErr = clientset.CoreV1().ConfigMaps(item.Namespace).Delete(a.ctx, item.Name, metav1.DeleteOptions{})
		case "secret", "secrets":
			deleteErr = clientset.CoreV1().Secrets(item.Namespace).Delete(a.ctx, item.Name, metav1.DeleteOptions{})
		case "persistentvolumeclaim", "persistentvolumeclaims", "pvc":
			deleteErr = clientset.CoreV1().PersistentVolumeClaims(item.Namespace).Delete(a.ctx, item.Name, metav1.DeleteOptions{})
		case "persistentvolume", "persistentvolumes", "pv":
			deleteErr = clientset.CoreV1().PersistentVolumes().Delete(a.ctx, item.Name, metav1.DeleteOptions{})
		case "ingress", "ingresses":
			deleteErr = clientset.NetworkingV1().Ingresses(item.Namespace).Delete(a.ctx, item.Name, metav1.DeleteOptions{})
		case "service", "services":
			deleteErr = clientset.CoreV1().Services(item.Namespace).Delete(a.ctx, item.Name, metav1.DeleteOptions{})
		default:
			deleteErr = fmt.Errorf("unsupported resource kind: %s", item.Kind)
		}

		result := BulkOperationResult{
			Name:      item.Name,
			Namespace: item.Namespace,
			Success:   deleteErr == nil,
		}
		if deleteErr != nil {
			result.Error = deleteErr.Error()
			response.ErrorCount++
		} else {
			response.SuccessCount++
		}
		response.Results = append(response.Results, result)
	}

	return response
}

// BulkRestartResources restarts multiple Kubernetes workloads by patching their annotations
func (a *App) BulkRestartResources(items []BulkOperationItem) BulkOperationResponse {
	response := BulkOperationResponse{
		Results: make([]BulkOperationResult, 0, len(items)),
	}

	if len(items) == 0 {
		return response
	}

	clientset, err := a.getKubernetesInterface()
	if err != nil {
		for _, item := range items {
			response.Results = append(response.Results, BulkOperationResult{
				Name:      item.Name,
				Namespace: item.Namespace,
				Success:   false,
				Error:     err.Error(),
			})
			response.ErrorCount++
		}
		return response
	}

	restartPatch := []byte(fmt.Sprintf(`{"spec":{"template":{"metadata":{"annotations":{"kube-dev-bench/restartedAt":"%s"}}}}}`, time.Now().Format(time.RFC3339)))

	for _, item := range items {
		var restartErr error
		kind := strings.ToLower(item.Kind)

		switch kind {
		case "pod", "pods":
			// For pods, we delete them (assuming they're managed by a controller that will recreate them)
			restartErr = clientset.CoreV1().Pods(item.Namespace).Delete(a.ctx, item.Name, metav1.DeleteOptions{})
		case "deployment", "deployments":
			_, restartErr = clientset.AppsV1().Deployments(item.Namespace).Patch(a.ctx, item.Name, types.MergePatchType, restartPatch, metav1.PatchOptions{})
		case "statefulset", "statefulsets":
			_, restartErr = clientset.AppsV1().StatefulSets(item.Namespace).Patch(a.ctx, item.Name, types.MergePatchType, restartPatch, metav1.PatchOptions{})
		case "daemonset", "daemonsets":
			_, restartErr = clientset.AppsV1().DaemonSets(item.Namespace).Patch(a.ctx, item.Name, types.MergePatchType, restartPatch, metav1.PatchOptions{})
		default:
			restartErr = fmt.Errorf("restart not supported for kind: %s", item.Kind)
		}

		result := BulkOperationResult{
			Name:      item.Name,
			Namespace: item.Namespace,
			Success:   restartErr == nil,
		}
		if restartErr != nil {
			result.Error = restartErr.Error()
			response.ErrorCount++
		} else {
			response.SuccessCount++
		}
		response.Results = append(response.Results, result)
	}

	return response
}

// BulkScaleResources scales multiple Kubernetes workloads to the specified replica count
func (a *App) BulkScaleResources(items []BulkOperationItem, replicas int) BulkOperationResponse {
	response := BulkOperationResponse{
		Results: make([]BulkOperationResult, 0, len(items)),
	}

	if len(items) == 0 {
		return response
	}

	if replicas < 0 {
		for _, item := range items {
			response.Results = append(response.Results, BulkOperationResult{
				Name:      item.Name,
				Namespace: item.Namespace,
				Success:   false,
				Error:     "replicas must be non-negative",
			})
			response.ErrorCount++
		}
		return response
	}

	for _, item := range items {
		scaleErr := a.ScaleResource(item.Kind, item.Namespace, item.Name, replicas)

		result := BulkOperationResult{
			Name:      item.Name,
			Namespace: item.Namespace,
			Success:   scaleErr == nil,
		}
		if scaleErr != nil {
			result.Error = scaleErr.Error()
			response.ErrorCount++
		} else {
			response.SuccessCount++
		}
		response.Results = append(response.Results, result)
	}

	return response
}

// BulkSuspendCronJobs suspends multiple CronJobs
func (a *App) BulkSuspendCronJobs(items []BulkOperationItem) BulkOperationResponse {
	return a.bulkUpdateCronJobSuspend(items, true)
}

// BulkResumeCronJobs resumes multiple CronJobs
func (a *App) BulkResumeCronJobs(items []BulkOperationItem) BulkOperationResponse {
	return a.bulkUpdateCronJobSuspend(items, false)
}

func (a *App) bulkUpdateCronJobSuspend(items []BulkOperationItem, suspend bool) BulkOperationResponse {
	response := BulkOperationResponse{
		Results: make([]BulkOperationResult, 0, len(items)),
	}

	if len(items) == 0 {
		return response
	}

	clientset, err := a.getKubernetesInterface()
	if err != nil {
		for _, item := range items {
			response.Results = append(response.Results, BulkOperationResult{
				Name:      item.Name,
				Namespace: item.Namespace,
				Success:   false,
				Error:     err.Error(),
			})
			response.ErrorCount++
		}
		return response
	}

	suspendPatch := []byte(fmt.Sprintf(`{"spec":{"suspend":%t}}`, suspend))

	for _, item := range items {
		kind := strings.ToLower(item.Kind)
		if kind != "cronjob" && kind != "cronjobs" {
			response.Results = append(response.Results, BulkOperationResult{
				Name:      item.Name,
				Namespace: item.Namespace,
				Success:   false,
				Error:     fmt.Sprintf("suspend/resume not supported for kind: %s", item.Kind),
			})
			response.ErrorCount++
			continue
		}

		_, patchErr := clientset.BatchV1().CronJobs(item.Namespace).Patch(a.ctx, item.Name, types.MergePatchType, suspendPatch, metav1.PatchOptions{})

		result := BulkOperationResult{
			Name:      item.Name,
			Namespace: item.Namespace,
			Success:   patchErr == nil,
		}
		if patchErr != nil {
			result.Error = patchErr.Error()
			response.ErrorCount++
		} else {
			response.SuccessCount++
		}
		response.Results = append(response.Results, result)
	}

	return response
}
