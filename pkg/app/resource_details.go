package app

import (
	"encoding/base64"
	"fmt"
	"sort"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/labels"
)

// ResourcePodInfo provides pod information for resource detail views
type ResourcePodInfo struct {
	Name      string `json:"name"`
	Namespace string `json:"namespace"`
	Status    string `json:"status"`
	Ready     string `json:"ready"`
	Restarts  int32  `json:"restarts"`
	Age       string `json:"age"`
	Node      string `json:"node"`
	IP        string `json:"ip"`
}

// JobCondition represents a job condition
type JobCondition struct {
	Type           string `json:"type"`
	Status         string `json:"status"`
	LastTransition string `json:"lastTransition"`
	Reason         string `json:"reason"`
	Message        string `json:"message"`
}

// JobDetail provides detailed job information including pods and conditions
type JobDetail struct {
	Pods       []ResourcePodInfo `json:"pods"`
	Conditions []JobCondition    `json:"conditions"`
}

// CronJobJobInfo represents a job created by a cronjob
type CronJobJobInfo struct {
	Name      string `json:"name"`
	Namespace string `json:"namespace"`
	Status    string `json:"status"`
	StartTime string `json:"startTime"`
	EndTime   string `json:"endTime"`
	Duration  string `json:"duration"`
	Succeeded int32  `json:"succeeded"`
	Failed    int32  `json:"failed"`
	Active    int32  `json:"active"`
}

// CronJobDetail provides detailed cronjob information
type CronJobDetail struct {
	Jobs     []CronJobJobInfo `json:"jobs"`
	NextRuns []string         `json:"nextRuns"`
}

// ConfigMapDataInfo provides configmap data with key-value pairs
type ConfigMapDataInfo struct {
	Key      string `json:"key"`
	Value    string `json:"value"`
	Size     int    `json:"size"`
	IsBinary bool   `json:"isBinary"`
}

// SecretDataInfo provides secret data with key-value pairs (base64 encoded)
type SecretDataInfo struct {
	Key      string `json:"key"`
	Value    string `json:"value"` // base64 encoded
	Size     int    `json:"size"`
	IsBinary bool   `json:"isBinary"`
}

// DeploymentCondition represents a deployment condition
type DeploymentCondition struct {
	Type           string `json:"type"`
	Status         string `json:"status"`
	LastTransition string `json:"lastTransition"`
	Reason         string `json:"reason"`
	Message        string `json:"message"`
}

// RolloutRevision represents a deployment revision
type RolloutRevision struct {
	Revision   int64  `json:"revision"`
	ReplicaSet string `json:"replicaSet"`
	Image      string `json:"image"`
	CreatedAt  string `json:"createdAt"`
	Replicas   int32  `json:"replicas"`
	IsCurrent  bool   `json:"isCurrent"`
}

// DeploymentDetail provides detailed deployment information
type DeploymentDetail struct {
	Pods       []ResourcePodInfo     `json:"pods"`
	Conditions []DeploymentCondition `json:"conditions"`
	Revisions  []RolloutRevision     `json:"revisions"`
}

// StatefulSetPVCInfo represents a PVC owned by a statefulset
type StatefulSetPVCInfo struct {
	Name         string `json:"name"`
	Namespace    string `json:"namespace"`
	Status       string `json:"status"`
	Capacity     string `json:"capacity"`
	AccessModes  string `json:"accessModes"`
	StorageClass string `json:"storageClass"`
	Age          string `json:"age"`
	PodName      string `json:"podName"`
}

// StatefulSetDetail provides detailed statefulset information
type StatefulSetDetail struct {
	Pods []ResourcePodInfo    `json:"pods"`
	PVCs []StatefulSetPVCInfo `json:"pvcs"`
}

// IngressRule represents an ingress routing rule
type IngressRule struct {
	Host        string `json:"host"`
	Path        string `json:"path"`
	PathType    string `json:"pathType"`
	ServiceName string `json:"serviceName"`
	ServicePort string `json:"servicePort"`
}

// IngressTLSInfo represents TLS configuration for an ingress
type IngressTLSInfo struct {
	Hosts      []string `json:"hosts"`
	SecretName string   `json:"secretName"`
}

// IngressDetail provides detailed ingress information
type IngressDetail struct {
	Rules []IngressRule    `json:"rules"`
	TLS   []IngressTLSInfo `json:"tls"`
}

// ReplicaSetDetail provides detailed replicaset information
type ReplicaSetDetail struct {
	Pods      []ResourcePodInfo `json:"pods"`
	OwnerName string            `json:"ownerName"`
	OwnerKind string            `json:"ownerKind"`
}

// DaemonSetDetail provides detailed daemonset information
type DaemonSetDetail struct {
	Pods []ResourcePodInfo `json:"pods"`
}

// GetJobDetail returns detailed information about a job including its pods and conditions
func (a *App) GetJobDetail(namespace, jobName string) (*JobDetail, error) {
	clientset, err := a.getKubernetesInterface()
	if err != nil {
		return nil, err
	}

	// Get the job
	job, err := clientset.BatchV1().Jobs(namespace).Get(a.ctx, jobName, metav1.GetOptions{})
	if err != nil {
		return nil, err
	}

	detail := &JobDetail{
		Pods:       []ResourcePodInfo{},
		Conditions: []JobCondition{},
	}

	// Get pods owned by this job using label selector
	selector := labels.SelectorFromSet(job.Spec.Selector.MatchLabels)
	pods, err := clientset.CoreV1().Pods(namespace).List(a.ctx, metav1.ListOptions{
		LabelSelector: selector.String(),
	})
	if err == nil {
		now := time.Now()
		for _, pod := range pods.Items {
			// Verify this pod is owned by this job
			isOwnedByJob := false
			for _, ref := range pod.OwnerReferences {
				if ref.Kind == "Job" && ref.Name == jobName {
					isOwnedByJob = true
					break
				}
			}
			if !isOwnedByJob {
				continue
			}

			ready := "0/0"
			total := len(pod.Spec.Containers)
			readyCount := 0
			var restarts int32
			for _, cs := range pod.Status.ContainerStatuses {
				if cs.Ready {
					readyCount++
				}
				restarts += cs.RestartCount
			}
			ready = fmt.Sprintf("%d/%d", readyCount, total)

			age := "-"
			if pod.CreationTimestamp.Time != (time.Time{}) {
				age = formatDuration(now.Sub(pod.CreationTimestamp.Time))
			}

			detail.Pods = append(detail.Pods, ResourcePodInfo{
				Name:      pod.Name,
				Namespace: pod.Namespace,
				Status:    string(pod.Status.Phase),
				Ready:     ready,
				Restarts:  restarts,
				Age:       age,
				Node:      pod.Spec.NodeName,
				IP:        pod.Status.PodIP,
			})
		}
	}

	// Get job conditions
	for _, cond := range job.Status.Conditions {
		lastTransition := "-"
		if cond.LastTransitionTime.Time != (time.Time{}) {
			lastTransition = cond.LastTransitionTime.Time.Format(time.RFC3339)
		}
		detail.Conditions = append(detail.Conditions, JobCondition{
			Type:           string(cond.Type),
			Status:         string(cond.Status),
			LastTransition: lastTransition,
			Reason:         cond.Reason,
			Message:        cond.Message,
		})
	}

	return detail, nil
}

// GetCronJobDetail returns detailed information about a cronjob including job history
func (a *App) GetCronJobDetail(namespace, cronJobName string) (*CronJobDetail, error) {
	clientset, err := a.getKubernetesInterface()
	if err != nil {
		return nil, err
	}

	detail := &CronJobDetail{
		Jobs:     []CronJobJobInfo{},
		NextRuns: []string{},
	}

	// Compute next scheduled runs (best-effort)
	if cronJobName != "" {
		cj, err := clientset.BatchV1().CronJobs(namespace).Get(a.ctx, cronJobName, metav1.GetOptions{})
		if err == nil {
			suspend := false
			if cj.Spec.Suspend != nil {
				suspend = *cj.Spec.Suspend
			}
			if !suspend && cj.Spec.Schedule != "" {
				detail.NextRuns = computeNextRuns(cj.Spec.Schedule, time.Now(), 5)
			}
		}
	}

	// Get all jobs in the namespace and filter by owner
	jobs, err := clientset.BatchV1().Jobs(namespace).List(a.ctx, metav1.ListOptions{})
	if err != nil {
		return nil, err
	}

	for _, job := range jobs.Items {
		// Check if this job is owned by the cronjob
		isOwnedByCronJob := false
		for _, ref := range job.OwnerReferences {
			if ref.Kind == "CronJob" && ref.Name == cronJobName {
				isOwnedByCronJob = true
				break
			}
		}
		if !isOwnedByCronJob {
			continue
		}

		status := "Running"
		if job.Status.Succeeded > 0 {
			status = "Succeeded"
		} else if job.Status.Failed > 0 {
			status = "Failed"
		}

		startTime := "-"
		endTime := "-"
		duration := "-"

		if job.Status.StartTime != nil {
			startTime = job.Status.StartTime.Time.Format(time.RFC3339)
			if job.Status.CompletionTime != nil {
				endTime = job.Status.CompletionTime.Time.Format(time.RFC3339)
				dur := job.Status.CompletionTime.Time.Sub(job.Status.StartTime.Time)
				duration = formatDuration(dur)
			}
		}

		detail.Jobs = append(detail.Jobs, CronJobJobInfo{
			Name:      job.Name,
			Namespace: job.Namespace,
			Status:    status,
			StartTime: startTime,
			EndTime:   endTime,
			Duration:  duration,
			Succeeded: job.Status.Succeeded,
			Failed:    job.Status.Failed,
			Active:    job.Status.Active,
		})
	}

	// Sort jobs by start time (most recent first)
	sort.Slice(detail.Jobs, func(i, j int) bool {
		return detail.Jobs[i].StartTime > detail.Jobs[j].StartTime
	})

	// Limit to last 10 jobs
	if len(detail.Jobs) > 10 {
		detail.Jobs = detail.Jobs[:10]
	}

	return detail, nil
}

// GetConfigMapDataByName returns the data of a configmap
func (a *App) GetConfigMapDataByName(namespace, name string) ([]ConfigMapDataInfo, error) {
	clientset, err := a.getKubernetesInterface()
	if err != nil {
		return nil, err
	}

	cm, err := clientset.CoreV1().ConfigMaps(namespace).Get(a.ctx, name, metav1.GetOptions{})
	if err != nil {
		return nil, err
	}

	var result []ConfigMapDataInfo

	// Add string data
	for k, v := range cm.Data {
		result = append(result, ConfigMapDataInfo{
			Key:      k,
			Value:    v,
			Size:     len(v),
			IsBinary: false,
		})
	}

	// Add binary data (base64 encoded)
	for k, v := range cm.BinaryData {
		result = append(result, ConfigMapDataInfo{
			Key:      k,
			Value:    base64.StdEncoding.EncodeToString(v),
			Size:     len(v),
			IsBinary: true,
		})
	}

	// Sort by key
	sort.Slice(result, func(i, j int) bool {
		return result[i].Key < result[j].Key
	})

	return result, nil
}

// GetSecretDataByName returns the data of a secret (values are base64 encoded)
func (a *App) GetSecretDataByName(namespace, name string) ([]SecretDataInfo, error) {
	clientset, err := a.getKubernetesInterface()
	if err != nil {
		return nil, err
	}

	secret, err := clientset.CoreV1().Secrets(namespace).Get(a.ctx, name, metav1.GetOptions{})
	if err != nil {
		return nil, err
	}

	var result []SecretDataInfo

	for k, v := range secret.Data {
		// Check if value looks like binary data
		isBinary := false
		for _, b := range v {
			if b < 32 && b != '\n' && b != '\r' && b != '\t' {
				isBinary = true
				break
			}
		}

		result = append(result, SecretDataInfo{
			Key:      k,
			Value:    base64.StdEncoding.EncodeToString(v),
			Size:     len(v),
			IsBinary: isBinary,
		})
	}

	// Sort by key
	sort.Slice(result, func(i, j int) bool {
		return result[i].Key < result[j].Key
	})

	return result, nil
}

// GetDeploymentDetail returns detailed information about a deployment
func (a *App) GetDeploymentDetail(namespace, deploymentName string) (*DeploymentDetail, error) {
	clientset, err := a.getKubernetesInterface()
	if err != nil {
		return nil, err
	}

	deployment, err := clientset.AppsV1().Deployments(namespace).Get(a.ctx, deploymentName, metav1.GetOptions{})
	if err != nil {
		return nil, err
	}

	detail := &DeploymentDetail{
		Pods:       []ResourcePodInfo{},
		Conditions: []DeploymentCondition{},
		Revisions:  []RolloutRevision{},
	}

	// Get pods matching deployment's selector
	selector := labels.SelectorFromSet(deployment.Spec.Selector.MatchLabels)
	pods, err := clientset.CoreV1().Pods(namespace).List(a.ctx, metav1.ListOptions{
		LabelSelector: selector.String(),
	})
	if err == nil {
		now := time.Now()
		for _, pod := range pods.Items {
			ready := "0/0"
			total := len(pod.Spec.Containers)
			readyCount := 0
			var restarts int32
			for _, cs := range pod.Status.ContainerStatuses {
				if cs.Ready {
					readyCount++
				}
				restarts += cs.RestartCount
			}
			ready = fmt.Sprintf("%d/%d", readyCount, total)

			age := "-"
			if pod.CreationTimestamp.Time != (time.Time{}) {
				age = formatDuration(now.Sub(pod.CreationTimestamp.Time))
			}

			detail.Pods = append(detail.Pods, ResourcePodInfo{
				Name:      pod.Name,
				Namespace: pod.Namespace,
				Status:    string(pod.Status.Phase),
				Ready:     ready,
				Restarts:  restarts,
				Age:       age,
				Node:      pod.Spec.NodeName,
				IP:        pod.Status.PodIP,
			})
		}
	}

	// Get deployment conditions
	for _, cond := range deployment.Status.Conditions {
		lastTransition := "-"
		if cond.LastTransitionTime.Time != (time.Time{}) {
			lastTransition = cond.LastTransitionTime.Time.Format(time.RFC3339)
		}
		detail.Conditions = append(detail.Conditions, DeploymentCondition{
			Type:           string(cond.Type),
			Status:         string(cond.Status),
			LastTransition: lastTransition,
			Reason:         cond.Reason,
			Message:        cond.Message,
		})
	}

	// Get replicasets owned by this deployment for rollout history
	replicaSets, err := clientset.AppsV1().ReplicaSets(namespace).List(a.ctx, metav1.ListOptions{
		LabelSelector: selector.String(),
	})
	if err == nil {
		for _, rs := range replicaSets.Items {
			// Check if this RS is owned by this deployment
			isOwned := false
			for _, ref := range rs.OwnerReferences {
				if ref.Kind == "Deployment" && ref.Name == deploymentName {
					isOwned = true
					break
				}
			}
			if !isOwned {
				continue
			}

			revision := int64(0)
			if rev, ok := rs.Annotations["deployment.kubernetes.io/revision"]; ok {
				fmt.Sscanf(rev, "%d", &revision)
			}

			image := ""
			if len(rs.Spec.Template.Spec.Containers) > 0 {
				image = rs.Spec.Template.Spec.Containers[0].Image
			}

			createdAt := "-"
			if rs.CreationTimestamp.Time != (time.Time{}) {
				createdAt = rs.CreationTimestamp.Time.Format(time.RFC3339)
			}

			replicas := int32(0)
			if rs.Spec.Replicas != nil {
				replicas = *rs.Spec.Replicas
			}

			detail.Revisions = append(detail.Revisions, RolloutRevision{
				Revision:   revision,
				ReplicaSet: rs.Name,
				Image:      image,
				CreatedAt:  createdAt,
				Replicas:   replicas,
				IsCurrent:  replicas > 0,
			})
		}

		// Sort revisions by revision number (descending)
		sort.Slice(detail.Revisions, func(i, j int) bool {
			return detail.Revisions[i].Revision > detail.Revisions[j].Revision
		})
	}

	return detail, nil
}

// GetStatefulSetDetail returns detailed information about a statefulset
func (a *App) GetStatefulSetDetail(namespace, statefulSetName string) (*StatefulSetDetail, error) {
	clientset, err := a.getKubernetesInterface()
	if err != nil {
		return nil, err
	}

	ss, err := clientset.AppsV1().StatefulSets(namespace).Get(a.ctx, statefulSetName, metav1.GetOptions{})
	if err != nil {
		return nil, err
	}

	detail := &StatefulSetDetail{
		Pods: []ResourcePodInfo{},
		PVCs: []StatefulSetPVCInfo{},
	}

	// Get pods matching statefulset's selector
	selector := labels.SelectorFromSet(ss.Spec.Selector.MatchLabels)
	pods, err := clientset.CoreV1().Pods(namespace).List(a.ctx, metav1.ListOptions{
		LabelSelector: selector.String(),
	})
	if err == nil {
		now := time.Now()
		for _, pod := range pods.Items {
			// Verify ownership
			isOwned := false
			for _, ref := range pod.OwnerReferences {
				if ref.Kind == "StatefulSet" && ref.Name == statefulSetName {
					isOwned = true
					break
				}
			}
			if !isOwned {
				continue
			}

			ready := "0/0"
			total := len(pod.Spec.Containers)
			readyCount := 0
			var restarts int32
			for _, cs := range pod.Status.ContainerStatuses {
				if cs.Ready {
					readyCount++
				}
				restarts += cs.RestartCount
			}
			ready = fmt.Sprintf("%d/%d", readyCount, total)

			age := "-"
			if pod.CreationTimestamp.Time != (time.Time{}) {
				age = formatDuration(now.Sub(pod.CreationTimestamp.Time))
			}

			detail.Pods = append(detail.Pods, ResourcePodInfo{
				Name:      pod.Name,
				Namespace: pod.Namespace,
				Status:    string(pod.Status.Phase),
				Ready:     ready,
				Restarts:  restarts,
				Age:       age,
				Node:      pod.Spec.NodeName,
				IP:        pod.Status.PodIP,
			})
		}

		// Sort pods by name (to maintain statefulset ordering)
		sort.Slice(detail.Pods, func(i, j int) bool {
			return detail.Pods[i].Name < detail.Pods[j].Name
		})
	}

	// Get PVCs owned by this statefulset's pods
	pvcs, err := clientset.CoreV1().PersistentVolumeClaims(namespace).List(a.ctx, metav1.ListOptions{})
	if err == nil {
		now := time.Now()
		for _, pvc := range pvcs.Items {
			// Check if PVC name matches statefulset naming pattern
			// StatefulSet PVCs are named: {volumeClaimTemplateName}-{statefulSetName}-{ordinal}
			for _, vct := range ss.Spec.VolumeClaimTemplates {
				prefix := fmt.Sprintf("%s-%s-", vct.Name, statefulSetName)
				if len(pvc.Name) > len(prefix) && pvc.Name[:len(prefix)] == prefix {
					age := "-"
					if pvc.CreationTimestamp.Time != (time.Time{}) {
						age = formatDuration(now.Sub(pvc.CreationTimestamp.Time))
					}

					capacity := "-"
					if pvc.Status.Capacity != nil {
						if qty, ok := pvc.Status.Capacity["storage"]; ok {
							capacity = qty.String()
						}
					}

					accessModes := ""
					for i, mode := range pvc.Spec.AccessModes {
						if i > 0 {
							accessModes += ", "
						}
						accessModes += string(mode)
					}

					storageClass := ""
					if pvc.Spec.StorageClassName != nil {
						storageClass = *pvc.Spec.StorageClassName
					}

					// Extract pod name from PVC name
					podName := pvc.Name[len(vct.Name)+1:]

					detail.PVCs = append(detail.PVCs, StatefulSetPVCInfo{
						Name:         pvc.Name,
						Namespace:    pvc.Namespace,
						Status:       string(pvc.Status.Phase),
						Capacity:     capacity,
						AccessModes:  accessModes,
						StorageClass: storageClass,
						Age:          age,
						PodName:      podName,
					})
				}
			}
		}

		// Sort PVCs by name
		sort.Slice(detail.PVCs, func(i, j int) bool {
			return detail.PVCs[i].Name < detail.PVCs[j].Name
		})
	}

	return detail, nil
}

// GetDaemonSetDetail returns detailed information about a daemonset
func (a *App) GetDaemonSetDetail(namespace, daemonSetName string) (*DaemonSetDetail, error) {
	clientset, err := a.getKubernetesInterface()
	if err != nil {
		return nil, err
	}

	ds, err := clientset.AppsV1().DaemonSets(namespace).Get(a.ctx, daemonSetName, metav1.GetOptions{})
	if err != nil {
		return nil, err
	}

	detail := &DaemonSetDetail{
		Pods: []ResourcePodInfo{},
	}

	// Get pods matching daemonset's selector
	selector := labels.SelectorFromSet(ds.Spec.Selector.MatchLabels)
	pods, err := clientset.CoreV1().Pods(namespace).List(a.ctx, metav1.ListOptions{
		LabelSelector: selector.String(),
	})
	if err == nil {
		now := time.Now()
		for _, pod := range pods.Items {
			// Verify ownership
			isOwned := false
			for _, ref := range pod.OwnerReferences {
				if ref.Kind == "DaemonSet" && ref.Name == daemonSetName {
					isOwned = true
					break
				}
			}
			if !isOwned {
				continue
			}

			ready := "0/0"
			total := len(pod.Spec.Containers)
			readyCount := 0
			var restarts int32
			for _, cs := range pod.Status.ContainerStatuses {
				if cs.Ready {
					readyCount++
				}
				restarts += cs.RestartCount
			}
			ready = fmt.Sprintf("%d/%d", readyCount, total)

			age := "-"
			if pod.CreationTimestamp.Time != (time.Time{}) {
				age = formatDuration(now.Sub(pod.CreationTimestamp.Time))
			}

			detail.Pods = append(detail.Pods, ResourcePodInfo{
				Name:      pod.Name,
				Namespace: pod.Namespace,
				Status:    string(pod.Status.Phase),
				Ready:     ready,
				Restarts:  restarts,
				Age:       age,
				Node:      pod.Spec.NodeName,
				IP:        pod.Status.PodIP,
			})
		}

		// Sort pods by node name
		sort.Slice(detail.Pods, func(i, j int) bool {
			return detail.Pods[i].Node < detail.Pods[j].Node
		})
	}

	return detail, nil
}

// GetReplicaSetDetail returns detailed information about a replicaset
func (a *App) GetReplicaSetDetail(namespace, replicaSetName string) (*ReplicaSetDetail, error) {
	clientset, err := a.getKubernetesInterface()
	if err != nil {
		return nil, err
	}

	rs, err := clientset.AppsV1().ReplicaSets(namespace).Get(a.ctx, replicaSetName, metav1.GetOptions{})
	if err != nil {
		return nil, err
	}

	detail := &ReplicaSetDetail{
		Pods: []ResourcePodInfo{},
	}

	// Get owner info
	for _, ref := range rs.OwnerReferences {
		if ref.Controller != nil && *ref.Controller {
			detail.OwnerName = ref.Name
			detail.OwnerKind = ref.Kind
			break
		}
	}

	// Get pods matching replicaset's selector
	selector := labels.SelectorFromSet(rs.Spec.Selector.MatchLabels)
	pods, err := clientset.CoreV1().Pods(namespace).List(a.ctx, metav1.ListOptions{
		LabelSelector: selector.String(),
	})
	if err == nil {
		now := time.Now()
		for _, pod := range pods.Items {
			// Verify ownership
			isOwned := false
			for _, ref := range pod.OwnerReferences {
				if ref.Kind == "ReplicaSet" && ref.Name == replicaSetName {
					isOwned = true
					break
				}
			}
			if !isOwned {
				continue
			}

			ready := "0/0"
			total := len(pod.Spec.Containers)
			readyCount := 0
			var restarts int32
			for _, cs := range pod.Status.ContainerStatuses {
				if cs.Ready {
					readyCount++
				}
				restarts += cs.RestartCount
			}
			ready = fmt.Sprintf("%d/%d", readyCount, total)

			age := "-"
			if pod.CreationTimestamp.Time != (time.Time{}) {
				age = formatDuration(now.Sub(pod.CreationTimestamp.Time))
			}

			detail.Pods = append(detail.Pods, ResourcePodInfo{
				Name:      pod.Name,
				Namespace: pod.Namespace,
				Status:    string(pod.Status.Phase),
				Ready:     ready,
				Restarts:  restarts,
				Age:       age,
				Node:      pod.Spec.NodeName,
				IP:        pod.Status.PodIP,
			})
		}
	}

	return detail, nil
}

// GetIngressDetail returns detailed information about an ingress
func (a *App) GetIngressDetail(namespace, ingressName string) (*IngressDetail, error) {
	clientset, err := a.getKubernetesInterface()
	if err != nil {
		return nil, err
	}

	ing, err := clientset.NetworkingV1().Ingresses(namespace).Get(a.ctx, ingressName, metav1.GetOptions{})
	if err != nil {
		return nil, err
	}

	detail := &IngressDetail{
		Rules: []IngressRule{},
		TLS:   []IngressTLSInfo{},
	}

	// Get rules
	for _, rule := range ing.Spec.Rules {
		if rule.HTTP == nil {
			continue
		}
		for _, path := range rule.HTTP.Paths {
			pathType := "Prefix"
			if path.PathType != nil {
				pathType = string(*path.PathType)
			}

			servicePort := ""
			if path.Backend.Service != nil {
				if path.Backend.Service.Port.Name != "" {
					servicePort = path.Backend.Service.Port.Name
				} else {
					servicePort = fmt.Sprintf("%d", path.Backend.Service.Port.Number)
				}
			}

			serviceName := ""
			if path.Backend.Service != nil {
				serviceName = path.Backend.Service.Name
			}

			detail.Rules = append(detail.Rules, IngressRule{
				Host:        rule.Host,
				Path:        path.Path,
				PathType:    pathType,
				ServiceName: serviceName,
				ServicePort: servicePort,
			})
		}
	}

	// Get TLS info
	for _, tls := range ing.Spec.TLS {
		detail.TLS = append(detail.TLS, IngressTLSInfo{
			Hosts:      tls.Hosts,
			SecretName: tls.SecretName,
		})
	}

	return detail, nil
}
