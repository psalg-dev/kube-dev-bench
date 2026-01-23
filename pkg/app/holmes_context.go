package app

import (
	"context"
	"fmt"
	"strings"
	"time"

	appsv1 "k8s.io/api/apps/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	corev1client "k8s.io/client-go/kubernetes/typed/core/v1" // This import is still needed for EventInterface
)

func (a *App) emitHolmesContextProgress(kind, namespace, name, step, status, detail string) {
	if a == nil || a.ctx == nil {
		return
	}
	key := fmt.Sprintf("%s/%s", namespace, name)
	payload := map[string]string{
		"key":       key,
		"kind":      kind,
		"namespace": namespace,
		"name":      name,
		"step":      step,
		"status":    status,
		"detail":    detail,
	}
	emitEvent(a.ctx, "holmes:context:progress", payload)
}

func (a *App) getPodContext(namespace, name string) (string, error) {
	clientset, err := a.getKubernetesInterface()
	if err != nil {
		return "", err
	}

	ctx := a.ctx
	if ctx == nil {
		ctx = context.Background()
	}

	var sb strings.Builder

	a.emitHolmesContextProgress("Pod", namespace, name, "Fetching pod details", "running", "")
	podCtx, podCancel := context.WithTimeout(ctx, 10*time.Second)
	defer podCancel()
	pod, err := clientset.CoreV1().Pods(namespace).Get(podCtx, name, metav1.GetOptions{})
	if err != nil {
		return "", fmt.Errorf("failed to get pod: %w", err)
	}
	a.emitHolmesContextProgress("Pod", namespace, name, "Fetching pod details", "done", "")

	sb.WriteString(fmt.Sprintf("Pod: %s/%s\n", namespace, name))
	sb.WriteString(fmt.Sprintf("Status: %s\n", pod.Status.Phase))
	sb.WriteString(fmt.Sprintf("Node: %s\n", pod.Spec.NodeName))

	sb.WriteString("\nContainers:\n")
	for _, cs := range pod.Status.ContainerStatuses {
		sb.WriteString(fmt.Sprintf("  %s: Ready=%v, RestartCount=%d\n", cs.Name, cs.Ready, cs.RestartCount))
		if cs.State.Waiting != nil {
			sb.WriteString(fmt.Sprintf("    Waiting: %s - %s\n", cs.State.Waiting.Reason, cs.State.Waiting.Message))
		}
		if cs.State.Terminated != nil {
			sb.WriteString(fmt.Sprintf("    Terminated: %s (exit code %d) - %s\n",
				cs.State.Terminated.Reason, cs.State.Terminated.ExitCode, cs.State.Terminated.Message))
		}
	}

	sb.WriteString("\nConditions:\n")
	for _, cond := range pod.Status.Conditions {
		sb.WriteString(fmt.Sprintf("  %s: %s\n", cond.Type, cond.Status))
		if cond.Message != "" {
			sb.WriteString(fmt.Sprintf("    Message: %s\n", cond.Message))
		}
	}

	a.emitHolmesContextProgress("Pod", namespace, name, "Collecting recent events", "running", "")
	eventsCtx, eventsCancel := context.WithTimeout(ctx, 8*time.Second)
	appendRecentEvents(eventsCtx, &sb, clientset.CoreV1().Events(namespace), name, "Pod")
	eventsCancel()
	a.emitHolmesContextProgress("Pod", namespace, name, "Collecting recent events", "done", "")

	a.emitHolmesContextProgress("Pod", namespace, name, "Collecting recent logs", "running", "")
	logs := a.getRecentPodLogs(namespace, name, 50)
	a.emitHolmesContextProgress("Pod", namespace, name, "Collecting recent logs", "done", "")
	if logs != "" {
		sb.WriteString("\nRecent Logs (last 50 lines):\n")
		sb.WriteString(logs)
		if !strings.HasSuffix(logs, "\n") {
			sb.WriteString("\n")
		}
	}

	return sb.String(), nil
}

func (a *App) getDeploymentContext(namespace, name string) (string, error) {
	clientset, err := a.getKubernetesInterface()
	if err != nil {
		return "", err
	}

	ctx := a.ctx
	if ctx == nil {
		ctx = context.Background()
	}

	var sb strings.Builder

	a.emitHolmesContextProgress("Deployment", namespace, name, "Fetching deployment details", "running", "")
	deployCtx, deployCancel := context.WithTimeout(ctx, 10*time.Second)
	defer deployCancel()
	deploy, err := clientset.AppsV1().Deployments(namespace).Get(deployCtx, name, metav1.GetOptions{})
	if err != nil {
		return "", fmt.Errorf("failed to get deployment: %w", err)
	}
	a.emitHolmesContextProgress("Deployment", namespace, name, "Fetching deployment details", "done", "")

	var desired int32 = 0
	if deploy.Spec.Replicas != nil {
		desired = *deploy.Spec.Replicas
	}

	sb.WriteString(fmt.Sprintf("Deployment: %s/%s\n", namespace, name))
	sb.WriteString(fmt.Sprintf("Replicas: desired=%d, ready=%d, available=%d\n",
		desired, deploy.Status.ReadyReplicas, deploy.Status.AvailableReplicas))
	sb.WriteString(fmt.Sprintf("Strategy: %s\n", deploy.Spec.Strategy.Type))

	writeDeploymentConditions(&sb, deploy.Status.Conditions)

	a.emitHolmesContextProgress("Deployment", namespace, name, "Listing related pods", "running", "")
	podsCtx, podsCancel := context.WithTimeout(ctx, 8*time.Second)
	pods, err := clientset.CoreV1().Pods(namespace).List(podsCtx, metav1.ListOptions{
		LabelSelector: metav1.FormatLabelSelector(deploy.Spec.Selector),
	})
	podsCancel()
	if err == nil {
		sb.WriteString(fmt.Sprintf("\nPods (%d):\n", len(pods.Items)))
		for _, pod := range pods.Items {
			sb.WriteString(fmt.Sprintf("  %s: %s\n", pod.Name, pod.Status.Phase))
		}
	}
	a.emitHolmesContextProgress("Deployment", namespace, name, "Listing related pods", "done", "")

	a.emitHolmesContextProgress("Deployment", namespace, name, "Collecting recent events", "running", "")
	eventsCtx, eventsCancel := context.WithTimeout(ctx, 8*time.Second)
	appendRecentEvents(eventsCtx, &sb, clientset.CoreV1().Events(namespace), name, "Deployment")
	eventsCancel()
	a.emitHolmesContextProgress("Deployment", namespace, name, "Collecting recent events", "done", "")

	return sb.String(), nil
}

func (a *App) getStatefulSetContext(namespace, name string) (string, error) {
	clientset, err := a.getKubernetesInterface()
	if err != nil {
		return "", err
	}

	ctx := a.ctx
	if ctx == nil {
		ctx = context.Background()
	}

	var sb strings.Builder

	a.emitHolmesContextProgress("StatefulSet", namespace, name, "Fetching statefulset details", "running", "")
	stsCtx, stsCancel := context.WithTimeout(ctx, 10*time.Second)
	defer stsCancel()
	sts, err := clientset.AppsV1().StatefulSets(namespace).Get(stsCtx, name, metav1.GetOptions{})
	if err != nil {
		return "", fmt.Errorf("failed to get statefulset: %w", err)
	}
	a.emitHolmesContextProgress("StatefulSet", namespace, name, "Fetching statefulset details", "done", "")

	var desired int32 = 0
	if sts.Spec.Replicas != nil {
		desired = *sts.Spec.Replicas
	}

	sb.WriteString(fmt.Sprintf("StatefulSet: %s/%s\n", namespace, name))
	sb.WriteString(fmt.Sprintf("Replicas: desired=%d, ready=%d, current=%d\n",
		desired, sts.Status.ReadyReplicas, sts.Status.CurrentReplicas))
	sb.WriteString(fmt.Sprintf("Service: %s\n", sts.Spec.ServiceName))

	writeStatefulSetConditions(&sb, sts.Status.Conditions)

	a.emitHolmesContextProgress("StatefulSet", namespace, name, "Listing related pods", "running", "")
	podsCtx, podsCancel := context.WithTimeout(ctx, 8*time.Second)
	pods, err := clientset.CoreV1().Pods(namespace).List(podsCtx, metav1.ListOptions{
		LabelSelector: metav1.FormatLabelSelector(sts.Spec.Selector),
	})
	podsCancel()
	if err == nil {
		sb.WriteString(fmt.Sprintf("\nPods (%d):\n", len(pods.Items)))
		for _, pod := range pods.Items {
			sb.WriteString(fmt.Sprintf("  %s: %s\n", pod.Name, pod.Status.Phase))
		}
	}
	a.emitHolmesContextProgress("StatefulSet", namespace, name, "Listing related pods", "done", "")

	a.emitHolmesContextProgress("StatefulSet", namespace, name, "Collecting recent events", "running", "")
	eventsCtx, eventsCancel := context.WithTimeout(ctx, 8*time.Second)
	appendRecentEvents(eventsCtx, &sb, clientset.CoreV1().Events(namespace), name, "StatefulSet")
	eventsCancel()
	a.emitHolmesContextProgress("StatefulSet", namespace, name, "Collecting recent events", "done", "")

	return sb.String(), nil
}

func (a *App) getDaemonSetContext(namespace, name string) (string, error) {
	clientset, err := a.getKubernetesInterface()
	if err != nil {
		return "", err
	}

	ctx := a.ctx
	if ctx == nil {
		ctx = context.Background()
	}

	var sb strings.Builder

	a.emitHolmesContextProgress("DaemonSet", namespace, name, "Fetching daemonset details", "running", "")
	dsCtx, dsCancel := context.WithTimeout(ctx, 10*time.Second)
	defer dsCancel()
	ds, err := clientset.AppsV1().DaemonSets(namespace).Get(dsCtx, name, metav1.GetOptions{})
	if err != nil {
		return "", fmt.Errorf("failed to get daemonset: %w", err)
	}
	a.emitHolmesContextProgress("DaemonSet", namespace, name, "Fetching daemonset details", "done", "")

	sb.WriteString(fmt.Sprintf("DaemonSet: %s/%s\n", namespace, name))
	sb.WriteString(fmt.Sprintf("Desired: %d, Current: %d, Ready: %d\n",
		ds.Status.DesiredNumberScheduled, ds.Status.CurrentNumberScheduled, ds.Status.NumberReady))
	if ds.Spec.UpdateStrategy.Type != "" {
		sb.WriteString(fmt.Sprintf("Update Strategy: %s\n", ds.Spec.UpdateStrategy.Type))
	}

	writeDaemonSetConditions(&sb, ds.Status.Conditions)

	a.emitHolmesContextProgress("DaemonSet", namespace, name, "Listing related pods", "running", "")
	podsCtx, podsCancel := context.WithTimeout(ctx, 8*time.Second)
	pods, err := clientset.CoreV1().Pods(namespace).List(podsCtx, metav1.ListOptions{
		LabelSelector: metav1.FormatLabelSelector(ds.Spec.Selector),
	})
	podsCancel()
	if err == nil {
		sb.WriteString(fmt.Sprintf("\nPods (%d):\n", len(pods.Items)))
		for _, pod := range pods.Items {
			sb.WriteString(fmt.Sprintf("  %s: %s\n", pod.Name, pod.Status.Phase))
		}
	}
	a.emitHolmesContextProgress("DaemonSet", namespace, name, "Listing related pods", "done", "")

	a.emitHolmesContextProgress("DaemonSet", namespace, name, "Collecting recent events", "running", "")
	eventsCtx, eventsCancel := context.WithTimeout(ctx, 8*time.Second)
	appendRecentEvents(eventsCtx, &sb, clientset.CoreV1().Events(namespace), name, "DaemonSet")
	eventsCancel()
	a.emitHolmesContextProgress("DaemonSet", namespace, name, "Collecting recent events", "done", "")

	return sb.String(), nil
}

func (a *App) getServiceContext(namespace, name string) (string, error) {
	clientset, err := a.getKubernetesInterface()
	if err != nil {
		return "", err
	}

	ctx := a.ctx
	if ctx == nil {
		ctx = context.Background()
	}

	var sb strings.Builder

	a.emitHolmesContextProgress("Service", namespace, name, "Fetching service details", "running", "")
	svcCtx, svcCancel := context.WithTimeout(ctx, 10*time.Second)
	defer svcCancel()
	svc, err := clientset.CoreV1().Services(namespace).Get(svcCtx, name, metav1.GetOptions{})
	if err != nil {
		return "", fmt.Errorf("failed to get service: %w", err)
	}
	a.emitHolmesContextProgress("Service", namespace, name, "Fetching service details", "done", "")

	sb.WriteString(fmt.Sprintf("Service: %s/%s\n", namespace, name))
	sb.WriteString(fmt.Sprintf("Type: %s\n", svc.Spec.Type))
	sb.WriteString(fmt.Sprintf("ClusterIP: %s\n", svc.Spec.ClusterIP))

	if len(svc.Spec.Ports) > 0 {
		sb.WriteString("\nPorts:\n")
		for _, port := range svc.Spec.Ports {
			nameLabel := port.Name
			if nameLabel == "" {
				nameLabel = "port"
			}
			sb.WriteString(fmt.Sprintf("  %s: %d -> %s\n", nameLabel, port.Port, port.TargetPort.String()))
		}
	}

	a.emitHolmesContextProgress("Service", namespace, name, "Collecting endpoints", "running", "")
	endpointsCtx, endpointsCancel := context.WithTimeout(ctx, 8*time.Second)
	endpoints, err := clientset.CoreV1().Endpoints(namespace).Get(endpointsCtx, name, metav1.GetOptions{})
	endpointsCancel()
	if err == nil {
		totalAddresses := 0
		for _, subset := range endpoints.Subsets {
			totalAddresses += len(subset.Addresses)
		}
		sb.WriteString(fmt.Sprintf("\nEndpoints: %d ready\n", totalAddresses))
	}
	a.emitHolmesContextProgress("Service", namespace, name, "Collecting endpoints", "done", "")

	a.emitHolmesContextProgress("Service", namespace, name, "Collecting recent events", "running", "")
	eventsCtx, eventsCancel := context.WithTimeout(ctx, 8*time.Second)
	appendRecentEvents(eventsCtx, &sb, clientset.CoreV1().Events(namespace), name, "Service")
	eventsCancel()
	a.emitHolmesContextProgress("Service", namespace, name, "Collecting recent events", "done", "")

	return sb.String(), nil
}

func (a *App) getRecentPodLogs(namespace, name string, lines int64) string {
	logs, err := a.getPodLogsInNamespace(namespace, name, lines)
	if err != nil {
		return fmt.Sprintf("(Failed to fetch logs: %v)", err)
	}
	return logs
}

func writeDeploymentConditions(sb *strings.Builder, conditions []appsv1.DeploymentCondition) {
	if len(conditions) == 0 {
		return
	}
	sb.WriteString("\nConditions:\n")
	for _, cond := range conditions {
		sb.WriteString(fmt.Sprintf("  %s: %s\n", cond.Type, cond.Status))
		if cond.Message != "" {
			sb.WriteString(fmt.Sprintf("    Message: %s\n", cond.Message))
		}
	}
}

func writeStatefulSetConditions(sb *strings.Builder, conditions []appsv1.StatefulSetCondition) {
	if len(conditions) == 0 {
		return
	}
	sb.WriteString("\nConditions:\n")
	for _, cond := range conditions {
		sb.WriteString(fmt.Sprintf("  %s: %s\n", cond.Type, cond.Status))
		if cond.Message != "" {
			sb.WriteString(fmt.Sprintf("    Message: %s\n", cond.Message))
		}
	}
}

func writeDaemonSetConditions(sb *strings.Builder, conditions []appsv1.DaemonSetCondition) {
	if len(conditions) == 0 {
		return
	}
	sb.WriteString("\nConditions:\n")
	for _, cond := range conditions {
		sb.WriteString(fmt.Sprintf("  %s: %s\n", cond.Type, cond.Status))
		if cond.Message != "" {
			sb.WriteString(fmt.Sprintf("    Message: %s\n", cond.Message))
		}
	}
}

func appendRecentEvents(ctx context.Context, sb *strings.Builder, eventsClient corev1client.EventInterface, name, kind string) {
	if eventsClient == nil {
		return
	}
	if ctx == nil {
		ctx = context.Background()
	}

	events, err := eventsClient.List(ctx, metav1.ListOptions{
		FieldSelector: fmt.Sprintf("involvedObject.name=%s,involvedObject.kind=%s", name, kind),
	})
	if err != nil || len(events.Items) == 0 {
		return
	}

	sb.WriteString("\nRecent Events (last 10):\n")
	count := 0
	for i := len(events.Items) - 1; i >= 0 && count < 10; i-- {
		event := events.Items[i]
		timeStamp := event.LastTimestamp
		if timeStamp.IsZero() {
			if !event.EventTime.IsZero() {
				timeStamp = metav1.NewTime(event.EventTime.Time)
			}
		}
		sb.WriteString(fmt.Sprintf("  [%s] %s: %s\n",
			timeStamp.Format("15:04:05"), event.Reason, event.Message))
		count++
	}
}
