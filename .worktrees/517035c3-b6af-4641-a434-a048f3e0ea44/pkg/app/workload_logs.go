package app

import (
	"context"
	"fmt"
	"sort"
	"strings"
	"time"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/labels"
)

const defaultLogTailLines int64 = 200

func (a *App) getPodLogsInNamespace(namespace, podName string, tailLines int64) (string, error) {
	if tailLines <= 0 {
		tailLines = defaultLogTailLines
	}

	if a.testPodLogsFetcher != nil {
		logs, err := a.testPodLogsFetcher(namespace, podName, "", int(tailLines))
		if err != nil {
			return "", err
		}
		return logs, nil
	}

	clientset, err := a.getKubernetesInterface()
	if err != nil {
		return "", err
	}
	ctx := a.ctx
	if ctx == nil {
		ctx = context.Background()
	}
	logCtx, cancel := context.WithTimeout(ctx, 12*time.Second)
	defer cancel()
	opts := &corev1.PodLogOptions{TailLines: &tailLines}
	raw, err := clientset.CoreV1().Pods(namespace).GetLogs(podName, opts).DoRaw(logCtx)
	if err != nil {
		return "", err
	}
	return string(raw), nil
}

func (a *App) aggregatePodsLogs(namespace string, pods []corev1.Pod) (string, error) {
	if namespace == "" {
		return "", fmt.Errorf("namespace required")
	}
	if len(pods) == 0 {
		return "", nil
	}
	// Stable ordering for deterministic output
	sort.Slice(pods, func(i, j int) bool { return pods[i].Name < pods[j].Name })

	var b strings.Builder
	for idx, p := range pods {
		if idx > 0 {
			b.WriteString("\n")
		}
		b.WriteString("===== ")
		b.WriteString(p.Name)
		b.WriteString(" =====\n")
		content, err := a.getPodLogsInNamespace(namespace, p.Name, defaultLogTailLines)
		if err != nil {
			b.WriteString("[error] ")
			b.WriteString(err.Error())
			b.WriteString("\n")
			continue
		}
		b.WriteString(content)
		if len(content) > 0 && !strings.HasSuffix(content, "\n") {
			b.WriteString("\n")
		}
	}
	return b.String(), nil
}

// GetDeploymentLogs aggregates recent logs for all pods belonging to a Deployment.
func (a *App) GetDeploymentLogs(namespace, deploymentName string) (string, error) {
	clientset, err := a.getKubernetesInterface()
	if err != nil {
		return "", err
	}
	dep, err := clientset.AppsV1().Deployments(namespace).Get(a.ctx, deploymentName, metav1.GetOptions{})
	if err != nil {
		return "", err
	}
	if dep.Spec.Selector == nil {
		return "", fmt.Errorf("deployment has no selector")
	}
	selector := labels.SelectorFromSet(dep.Spec.Selector.MatchLabels)
	podList, err := clientset.CoreV1().Pods(namespace).List(a.ctx, metav1.ListOptions{LabelSelector: selector.String()})
	if err != nil {
		return "", err
	}
	return a.aggregatePodsLogs(namespace, podList.Items)
}

// GetStatefulSetLogs aggregates recent logs for all pods belonging to a StatefulSet.
func (a *App) GetStatefulSetLogs(namespace, statefulSetName string) (string, error) {
	clientset, err := a.getKubernetesInterface()
	if err != nil {
		return "", err
	}
	sts, err := clientset.AppsV1().StatefulSets(namespace).Get(a.ctx, statefulSetName, metav1.GetOptions{})
	if err != nil {
		return "", err
	}
	if sts.Spec.Selector == nil {
		return "", fmt.Errorf("statefulset has no selector")
	}
	selector := labels.SelectorFromSet(sts.Spec.Selector.MatchLabels)
	podList, err := clientset.CoreV1().Pods(namespace).List(a.ctx, metav1.ListOptions{LabelSelector: selector.String()})
	if err != nil {
		return "", err
	}
	return a.aggregatePodsLogs(namespace, podList.Items)
}

// GetDaemonSetLogs aggregates recent logs for all pods belonging to a DaemonSet.
func (a *App) GetDaemonSetLogs(namespace, daemonSetName string) (string, error) {
	clientset, err := a.getKubernetesInterface()
	if err != nil {
		return "", err
	}
	ds, err := clientset.AppsV1().DaemonSets(namespace).Get(a.ctx, daemonSetName, metav1.GetOptions{})
	if err != nil {
		return "", err
	}
	if ds.Spec.Selector == nil {
		return "", fmt.Errorf("daemonset has no selector")
	}
	selector := labels.SelectorFromSet(ds.Spec.Selector.MatchLabels)
	podList, err := clientset.CoreV1().Pods(namespace).List(a.ctx, metav1.ListOptions{LabelSelector: selector.String()})
	if err != nil {
		return "", err
	}
	return a.aggregatePodsLogs(namespace, podList.Items)
}

// GetJobLogs aggregates recent logs for all pods belonging to a Job.
func (a *App) GetJobLogs(namespace, jobName string) (string, error) {
	clientset, err := a.getKubernetesInterface()
	if err != nil {
		return "", err
	}
	job, err := clientset.BatchV1().Jobs(namespace).Get(a.ctx, jobName, metav1.GetOptions{})
	if err != nil {
		return "", err
	}
	if job.Spec.Selector == nil {
		return "", fmt.Errorf("job has no selector")
	}
	selector := labels.SelectorFromSet(job.Spec.Selector.MatchLabels)
	podList, err := clientset.CoreV1().Pods(namespace).List(a.ctx, metav1.ListOptions{LabelSelector: selector.String()})
	if err != nil {
		return "", err
	}
	return a.aggregatePodsLogs(namespace, podList.Items)
}

// GetReplicaSetLogs aggregates recent logs for all pods belonging to a ReplicaSet.
func (a *App) GetReplicaSetLogs(namespace, replicaSetName string) (string, error) {
	clientset, err := a.getKubernetesInterface()
	if err != nil {
		return "", err
	}
	rs, err := clientset.AppsV1().ReplicaSets(namespace).Get(a.ctx, replicaSetName, metav1.GetOptions{})
	if err != nil {
		return "", err
	}
	if rs.Spec.Selector == nil {
		return "", fmt.Errorf("replicaset has no selector")
	}
	selector := labels.SelectorFromSet(rs.Spec.Selector.MatchLabels)
	podList, err := clientset.CoreV1().Pods(namespace).List(a.ctx, metav1.ListOptions{LabelSelector: selector.String()})
	if err != nil {
		return "", err
	}
	return a.aggregatePodsLogs(namespace, podList.Items)
}
