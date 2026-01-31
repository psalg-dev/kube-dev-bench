package app

import (
	"encoding/base64"
	"fmt"
	"sort"
	"time"

	appsv1 "k8s.io/api/apps/v1"
	batchv1 "k8s.io/api/batch/v1"
	corev1 "k8s.io/api/core/v1"
	networkingv1 "k8s.io/api/networking/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/client-go/kubernetes"
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

// isPodOwnedBy checks if a pod is owned by the specified resource
func isPodOwnedBy(pod *corev1.Pod, ownerKind, ownerName string) bool {
	for _, ref := range pod.OwnerReferences {
		if ref.Kind == ownerKind && ref.Name == ownerName {
			return true
		}
	}
	return false
}

// buildResourcePodInfo creates a ResourcePodInfo from a pod
func buildResourcePodInfo(pod *corev1.Pod, now time.Time) ResourcePodInfo {
	total := len(pod.Spec.Containers)
	readyCount := 0
	var restarts int32

	for _, cs := range pod.Status.ContainerStatuses {
		if cs.Ready {
			readyCount++
		}
		restarts += cs.RestartCount
	}

	age := "-"
	if !pod.CreationTimestamp.Time.IsZero() {
		age = formatDuration(now.Sub(pod.CreationTimestamp.Time))
	}

	return ResourcePodInfo{
		Name:      pod.Name,
		Namespace: pod.Namespace,
		Status:    string(pod.Status.Phase),
		Ready:     fmt.Sprintf("%d/%d", readyCount, total),
		Restarts:  restarts,
		Age:       age,
		Node:      pod.Spec.NodeName,
		IP:        pod.Status.PodIP,
	}
}

// collectOwnedPods collects pods owned by a specific resource and returns ResourcePodInfo slice
func collectOwnedPods(pods []corev1.Pod, ownerKind, ownerName string) []ResourcePodInfo {
	now := time.Now()
	result := make([]ResourcePodInfo, 0)

	for i := range pods {
		pod := &pods[i]
		if !isPodOwnedBy(pod, ownerKind, ownerName) {
			continue
		}
		result = append(result, buildResourcePodInfo(pod, now))
	}

	return result
}

// buildJobConditions converts batch job conditions to JobCondition slice
func buildJobConditions(conditions []batchv1.JobCondition) []JobCondition {
	result := make([]JobCondition, 0, len(conditions))
	for _, cond := range conditions {
		lastTransition := "-"
		if !cond.LastTransitionTime.Time.IsZero() {
			lastTransition = cond.LastTransitionTime.Time.Format(time.RFC3339)
		}
		result = append(result, JobCondition{
			Type:           string(cond.Type),
			Status:         string(cond.Status),
			LastTransition: lastTransition,
			Reason:         cond.Reason,
			Message:        cond.Message,
		})
	}
	return result
}

// buildAllPodsInfo builds ResourcePodInfo slice from all pods (no ownership filter)
func buildAllPodsInfo(pods []corev1.Pod) []ResourcePodInfo {
	now := time.Now()
	result := make([]ResourcePodInfo, 0, len(pods))
	for i := range pods {
		result = append(result, buildResourcePodInfo(&pods[i], now))
	}
	return result
}

// buildDeploymentConditions converts deployment conditions to DeploymentCondition slice
func buildDeploymentConditions(conditions []appsv1.DeploymentCondition) []DeploymentCondition {
	result := make([]DeploymentCondition, 0, len(conditions))
	for _, cond := range conditions {
		lastTransition := "-"
		if !cond.LastTransitionTime.Time.IsZero() {
			lastTransition = cond.LastTransitionTime.Time.Format(time.RFC3339)
		}
		result = append(result, DeploymentCondition{
			Type:           string(cond.Type),
			Status:         string(cond.Status),
			LastTransition: lastTransition,
			Reason:         cond.Reason,
			Message:        cond.Message,
		})
	}
	return result
}

// buildDeploymentRevisions builds rollout revision info from replicasets
func buildDeploymentRevisions(replicaSets []appsv1.ReplicaSet, deploymentName string) []RolloutRevision {
	result := make([]RolloutRevision, 0)
	for i := range replicaSets {
		rs := &replicaSets[i]

		// Check if this RS is owned by this deployment
		if !isOwnedBy(rs.OwnerReferences, "Deployment", deploymentName) {
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
		if !rs.CreationTimestamp.Time.IsZero() {
			createdAt = rs.CreationTimestamp.Time.Format(time.RFC3339)
		}

		replicas := int32(0)
		if rs.Spec.Replicas != nil {
			replicas = *rs.Spec.Replicas
		}

		result = append(result, RolloutRevision{
			Revision:   revision,
			ReplicaSet: rs.Name,
			Image:      image,
			CreatedAt:  createdAt,
			Replicas:   replicas,
			IsCurrent:  replicas > 0,
		})
	}
	return result
}

// isOwnedBy checks if the owner references include a specific owner
func isOwnedBy(refs []metav1.OwnerReference, kind, name string) bool {
	for _, ref := range refs {
		if ref.Kind == kind && ref.Name == name {
			return true
		}
	}
	return false
}

// collectStatefulSetPVCs collects PVCs that match statefulset naming pattern
func collectStatefulSetPVCs(pvcs []corev1.PersistentVolumeClaim, volumeClaimTemplates []corev1.PersistentVolumeClaim, statefulSetName string) []StatefulSetPVCInfo {
	now := time.Now()
	result := make([]StatefulSetPVCInfo, 0)

	for i := range pvcs {
		pvc := &pvcs[i]
		// Check if PVC name matches any statefulset naming pattern
		// StatefulSet PVCs are named: {volumeClaimTemplateName}-{statefulSetName}-{ordinal}
		for _, vct := range volumeClaimTemplates {
			prefix := fmt.Sprintf("%s-%s-", vct.Name, statefulSetName)
			if len(pvc.Name) <= len(prefix) || pvc.Name[:len(prefix)] != prefix {
				continue
			}

			info := buildPVCInfo(pvc, now)
			info.PodName = pvc.Name[len(vct.Name)+1:]
			result = append(result, info)
		}
	}

	return result
}

// buildPVCInfo creates a StatefulSetPVCInfo from a PVC
func buildPVCInfo(pvc *corev1.PersistentVolumeClaim, now time.Time) StatefulSetPVCInfo {
	age := "-"
	if !pvc.CreationTimestamp.Time.IsZero() {
		age = formatDuration(now.Sub(pvc.CreationTimestamp.Time))
	}

	capacity := "-"
	if pvc.Status.Capacity != nil {
		if qty, ok := pvc.Status.Capacity["storage"]; ok {
			capacity = qty.String()
		}
	}

	accessModes := formatAccessModes(pvc.Spec.AccessModes)

	storageClass := ""
	if pvc.Spec.StorageClassName != nil {
		storageClass = *pvc.Spec.StorageClassName
	}

	return StatefulSetPVCInfo{
		Name:         pvc.Name,
		Namespace:    pvc.Namespace,
		Status:       string(pvc.Status.Phase),
		Capacity:     capacity,
		AccessModes:  accessModes,
		StorageClass: storageClass,
		Age:          age,
	}
}

// formatAccessModes converts access modes to a comma-separated string
func formatAccessModes(modes []corev1.PersistentVolumeAccessMode) string {
	if len(modes) == 0 {
		return ""
	}
	result := string(modes[0])
	for i := 1; i < len(modes); i++ {
		result += ", " + string(modes[i])
	}
	return result
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
		detail.Pods = collectOwnedPods(pods.Items, "Job", jobName)
	}

	// Get job conditions
	detail.Conditions = buildJobConditions(job.Status.Conditions)

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
	detail.NextRuns = a.computeCronJobNextRuns(clientset, namespace, cronJobName)

	// Get all jobs in the namespace and filter by owner
	jobs, err := clientset.BatchV1().Jobs(namespace).List(a.ctx, metav1.ListOptions{})
	if err != nil {
		return nil, err
	}

	detail.Jobs = collectCronJobJobs(jobs.Items, cronJobName)

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

// computeCronJobNextRuns computes the next scheduled runs for a cronjob
func (a *App) computeCronJobNextRuns(clientset kubernetes.Interface, namespace, cronJobName string) []string {
	if cronJobName == "" {
		return []string{}
	}

	cj, err := clientset.BatchV1().CronJobs(namespace).Get(a.ctx, cronJobName, metav1.GetOptions{})
	if err != nil {
		return []string{}
	}

	suspend := cj.Spec.Suspend != nil && *cj.Spec.Suspend
	if suspend || cj.Spec.Schedule == "" {
		return []string{}
	}

	return computeNextRuns(cj.Spec.Schedule, time.Now(), 5)
}

// collectCronJobJobs collects job info for jobs owned by a cronjob
func collectCronJobJobs(jobs []batchv1.Job, cronJobName string) []CronJobJobInfo {
	result := make([]CronJobJobInfo, 0)

	for i := range jobs {
		job := &jobs[i]

		// Check if this job is owned by the cronjob
		if !isOwnedBy(job.OwnerReferences, "CronJob", cronJobName) {
			continue
		}

		result = append(result, buildCronJobJobInfo(job))
	}

	return result
}

// buildCronJobJobInfo builds a CronJobJobInfo from a job
func buildCronJobJobInfo(job *batchv1.Job) CronJobJobInfo {
	status := determineJobStatus(job)

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

	return CronJobJobInfo{
		Name:      job.Name,
		Namespace: job.Namespace,
		Status:    status,
		StartTime: startTime,
		EndTime:   endTime,
		Duration:  duration,
		Succeeded: job.Status.Succeeded,
		Failed:    job.Status.Failed,
		Active:    job.Status.Active,
	}
}

// determineJobStatus determines the status string for a job
func determineJobStatus(job *batchv1.Job) string {
	if job.Status.Succeeded > 0 {
		return "Succeeded"
	}
	if job.Status.Failed > 0 {
		return "Failed"
	}
	return "Running"
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
		detail.Pods = buildAllPodsInfo(pods.Items)
	}

	// Get deployment conditions
	detail.Conditions = buildDeploymentConditions(deployment.Status.Conditions)

	// Get replicasets owned by this deployment for rollout history
	replicaSets, err := clientset.AppsV1().ReplicaSets(namespace).List(a.ctx, metav1.ListOptions{
		LabelSelector: selector.String(),
	})
	if err == nil {
		detail.Revisions = buildDeploymentRevisions(replicaSets.Items, deploymentName)
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
		detail.Pods = collectOwnedPods(pods.Items, "StatefulSet", statefulSetName)
		// Sort pods by name (to maintain statefulset ordering)
		sort.Slice(detail.Pods, func(i, j int) bool {
			return detail.Pods[i].Name < detail.Pods[j].Name
		})
	}

	// Get PVCs owned by this statefulset's pods
	pvcs, err := clientset.CoreV1().PersistentVolumeClaims(namespace).List(a.ctx, metav1.ListOptions{})
	if err == nil {
		detail.PVCs = collectStatefulSetPVCs(pvcs.Items, ss.Spec.VolumeClaimTemplates, statefulSetName)
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
		detail.Pods = collectOwnedPods(pods.Items, "DaemonSet", daemonSetName)
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
		detail.Pods = collectOwnedPods(pods.Items, "ReplicaSet", replicaSetName)
	}

	return detail, nil
}

// getIngressPathType returns the path type as a string
func getIngressPathType(pathType *networkingv1.PathType) string {
	if pathType != nil {
		return string(*pathType)
	}
	return "Prefix"
}

// getIngressBackendInfo extracts service name and port from a backend
func getIngressBackendInfo(backend networkingv1.IngressBackend) (serviceName, servicePort string) {
	if backend.Service == nil {
		return "", ""
	}
	serviceName = backend.Service.Name
	if backend.Service.Port.Name != "" {
		servicePort = backend.Service.Port.Name
	} else {
		servicePort = fmt.Sprintf("%d", backend.Service.Port.Number)
	}
	return
}

// buildIngressRulesFromSpec extracts rules from ingress spec
func buildIngressRulesFromSpec(ing *networkingv1.Ingress) []IngressRule {
	rules := []IngressRule{}
	for _, rule := range ing.Spec.Rules {
		if rule.HTTP == nil {
			continue
		}
		for _, path := range rule.HTTP.Paths {
			serviceName, servicePort := getIngressBackendInfo(path.Backend)
			rules = append(rules, IngressRule{
				Host:        rule.Host,
				Path:        path.Path,
				PathType:    getIngressPathType(path.PathType),
				ServiceName: serviceName,
				ServicePort: servicePort,
			})
		}
	}
	return rules
}

// buildIngressTLSFromSpec extracts TLS info from ingress spec
func buildIngressTLSFromSpec(ing *networkingv1.Ingress) []IngressTLSInfo {
	tlsList := make([]IngressTLSInfo, 0, len(ing.Spec.TLS))
	for _, tls := range ing.Spec.TLS {
		tlsList = append(tlsList, IngressTLSInfo{
			Hosts:      tls.Hosts,
			SecretName: tls.SecretName,
		})
	}
	return tlsList
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

	return &IngressDetail{
		Rules: buildIngressRulesFromSpec(ing),
		TLS:   buildIngressTLSFromSpec(ing),
	}, nil
}
