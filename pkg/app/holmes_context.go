package app

import (
	"context"
	"fmt"
	"strings"
	"time"

	appsv1 "k8s.io/api/apps/v1"
	batchv1 "k8s.io/api/batch/v1"
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

func (a *App) getJobContext(namespace, name string) (string, error) {
	clientset, err := a.getKubernetesInterface()
	if err != nil {
		return "", err
	}

	ctx := a.ctx
	if ctx == nil {
		ctx = context.Background()
	}

	var sb strings.Builder

	a.emitHolmesContextProgress("Job", namespace, name, "Fetching job details", "running", "")
	jobCtx, jobCancel := context.WithTimeout(ctx, 10*time.Second)
	defer jobCancel()
	job, err := clientset.BatchV1().Jobs(namespace).Get(jobCtx, name, metav1.GetOptions{})
	if err != nil {
		return "", fmt.Errorf("failed to get job: %w", err)
	}
	a.emitHolmesContextProgress("Job", namespace, name, "Fetching job details", "done", "")

	sb.WriteString(fmt.Sprintf("Job: %s/%s\n", namespace, name))

	var parallelism int32 = 1
	if job.Spec.Parallelism != nil {
		parallelism = *job.Spec.Parallelism
	}
	var completions int32 = 1
	if job.Spec.Completions != nil {
		completions = *job.Spec.Completions
	}
	sb.WriteString(fmt.Sprintf("Parallelism: %d, Completions: %d\n", parallelism, completions))
	sb.WriteString(fmt.Sprintf("Active: %d, Succeeded: %d, Failed: %d\n",
		job.Status.Active, job.Status.Succeeded, job.Status.Failed))

	writeJobConditions(&sb, job.Status.Conditions)

	a.emitHolmesContextProgress("Job", namespace, name, "Listing related pods", "running", "")
	podsCtx, podsCancel := context.WithTimeout(ctx, 8*time.Second)
	pods, err := clientset.CoreV1().Pods(namespace).List(podsCtx, metav1.ListOptions{
		LabelSelector: metav1.FormatLabelSelector(job.Spec.Selector),
	})
	podsCancel()
	if err == nil && len(pods.Items) > 0 {
		sb.WriteString(fmt.Sprintf("\nPods (%d):\n", len(pods.Items)))
		for _, pod := range pods.Items {
			sb.WriteString(fmt.Sprintf("  %s: %s\n", pod.Name, pod.Status.Phase))
		}
	}
	a.emitHolmesContextProgress("Job", namespace, name, "Listing related pods", "done", "")

	a.emitHolmesContextProgress("Job", namespace, name, "Collecting recent events", "running", "")
	eventsCtx, eventsCancel := context.WithTimeout(ctx, 8*time.Second)
	appendRecentEvents(eventsCtx, &sb, clientset.CoreV1().Events(namespace), name, "Job")
	eventsCancel()
	a.emitHolmesContextProgress("Job", namespace, name, "Collecting recent events", "done", "")

	return sb.String(), nil
}

func (a *App) getCronJobContext(namespace, name string) (string, error) {
	clientset, err := a.getKubernetesInterface()
	if err != nil {
		return "", err
	}

	ctx := a.ctx
	if ctx == nil {
		ctx = context.Background()
	}

	var sb strings.Builder

	a.emitHolmesContextProgress("CronJob", namespace, name, "Fetching cronjob details", "running", "")
	cronJobCtx, cronJobCancel := context.WithTimeout(ctx, 10*time.Second)
	defer cronJobCancel()
	cronJob, err := clientset.BatchV1().CronJobs(namespace).Get(cronJobCtx, name, metav1.GetOptions{})
	if err != nil {
		return "", fmt.Errorf("failed to get cronjob: %w", err)
	}
	a.emitHolmesContextProgress("CronJob", namespace, name, "Fetching cronjob details", "done", "")

	sb.WriteString(fmt.Sprintf("CronJob: %s/%s\n", namespace, name))
	sb.WriteString(fmt.Sprintf("Schedule: %s\n", cronJob.Spec.Schedule))
	if cronJob.Spec.Suspend != nil && *cronJob.Spec.Suspend {
		sb.WriteString("Status: Suspended\n")
	} else {
		sb.WriteString("Status: Active\n")
	}
	if cronJob.Status.LastScheduleTime != nil {
		sb.WriteString(fmt.Sprintf("Last Schedule: %s\n", cronJob.Status.LastScheduleTime.Format(time.RFC3339)))
	}
	if cronJob.Status.LastSuccessfulTime != nil {
		sb.WriteString(fmt.Sprintf("Last Success: %s\n", cronJob.Status.LastSuccessfulTime.Format(time.RFC3339)))
	}
	sb.WriteString(fmt.Sprintf("Active Jobs: %d\n", len(cronJob.Status.Active)))

	a.emitHolmesContextProgress("CronJob", namespace, name, "Collecting recent events", "running", "")
	eventsCtx, eventsCancel := context.WithTimeout(ctx, 8*time.Second)
	appendRecentEvents(eventsCtx, &sb, clientset.CoreV1().Events(namespace), name, "CronJob")
	eventsCancel()
	a.emitHolmesContextProgress("CronJob", namespace, name, "Collecting recent events", "done", "")

	return sb.String(), nil
}

func (a *App) getIngressContext(namespace, name string) (string, error) {
	clientset, err := a.getKubernetesInterface()
	if err != nil {
		return "", err
	}

	ctx := a.ctx
	if ctx == nil {
		ctx = context.Background()
	}

	var sb strings.Builder

	a.emitHolmesContextProgress("Ingress", namespace, name, "Fetching ingress details", "running", "")
	ingressCtx, ingressCancel := context.WithTimeout(ctx, 10*time.Second)
	defer ingressCancel()
	ingress, err := clientset.NetworkingV1().Ingresses(namespace).Get(ingressCtx, name, metav1.GetOptions{})
	if err != nil {
		return "", fmt.Errorf("failed to get ingress: %w", err)
	}
	a.emitHolmesContextProgress("Ingress", namespace, name, "Fetching ingress details", "done", "")

	sb.WriteString(fmt.Sprintf("Ingress: %s/%s\n", namespace, name))

	if ingress.Spec.IngressClassName != nil {
		sb.WriteString(fmt.Sprintf("IngressClass: %s\n", *ingress.Spec.IngressClassName))
	}

	if len(ingress.Spec.TLS) > 0 {
		sb.WriteString("\nTLS Configuration:\n")
		for _, tls := range ingress.Spec.TLS {
			sb.WriteString(fmt.Sprintf("  Secret: %s, Hosts: %v\n", tls.SecretName, tls.Hosts))
		}
	}

	if len(ingress.Spec.Rules) > 0 {
		sb.WriteString("\nRules:\n")
		for _, rule := range ingress.Spec.Rules {
			sb.WriteString(fmt.Sprintf("  Host: %s\n", rule.Host))
			if rule.HTTP != nil {
				for _, path := range rule.HTTP.Paths {
					backend := ""
					if path.Backend.Service != nil {
						backend = fmt.Sprintf("%s:%v", path.Backend.Service.Name, path.Backend.Service.Port.Number)
					}
					sb.WriteString(fmt.Sprintf("    %s -> %s\n", path.Path, backend))
				}
			}
		}
	}

	if len(ingress.Status.LoadBalancer.Ingress) > 0 {
		sb.WriteString("\nLoad Balancer Status:\n")
		for _, lb := range ingress.Status.LoadBalancer.Ingress {
			if lb.IP != "" {
				sb.WriteString(fmt.Sprintf("  IP: %s\n", lb.IP))
			}
			if lb.Hostname != "" {
				sb.WriteString(fmt.Sprintf("  Hostname: %s\n", lb.Hostname))
			}
		}
	}

	a.emitHolmesContextProgress("Ingress", namespace, name, "Collecting recent events", "running", "")
	eventsCtx, eventsCancel := context.WithTimeout(ctx, 8*time.Second)
	appendRecentEvents(eventsCtx, &sb, clientset.CoreV1().Events(namespace), name, "Ingress")
	eventsCancel()
	a.emitHolmesContextProgress("Ingress", namespace, name, "Collecting recent events", "done", "")

	return sb.String(), nil
}

func (a *App) getConfigMapContext(namespace, name string) (string, error) {
	clientset, err := a.getKubernetesInterface()
	if err != nil {
		return "", err
	}

	ctx := a.ctx
	if ctx == nil {
		ctx = context.Background()
	}

	var sb strings.Builder

	a.emitHolmesContextProgress("ConfigMap", namespace, name, "Fetching configmap details", "running", "")
	cmCtx, cmCancel := context.WithTimeout(ctx, 10*time.Second)
	defer cmCancel()
	cm, err := clientset.CoreV1().ConfigMaps(namespace).Get(cmCtx, name, metav1.GetOptions{})
	if err != nil {
		return "", fmt.Errorf("failed to get configmap: %w", err)
	}
	a.emitHolmesContextProgress("ConfigMap", namespace, name, "Fetching configmap details", "done", "")

	sb.WriteString(fmt.Sprintf("ConfigMap: %s/%s\n", namespace, name))
	sb.WriteString(fmt.Sprintf("Data Keys: %d\n", len(cm.Data)))
	sb.WriteString(fmt.Sprintf("Binary Data Keys: %d\n", len(cm.BinaryData)))

	if len(cm.Data) > 0 {
		sb.WriteString("\nData Keys:\n")
		for key := range cm.Data {
			sb.WriteString(fmt.Sprintf("  - %s\n", key))
		}
	}

	if len(cm.BinaryData) > 0 {
		sb.WriteString("\nBinary Data Keys:\n")
		for key := range cm.BinaryData {
			sb.WriteString(fmt.Sprintf("  - %s\n", key))
		}
	}

	a.emitHolmesContextProgress("ConfigMap", namespace, name, "Collecting recent events", "running", "")
	eventsCtx, eventsCancel := context.WithTimeout(ctx, 8*time.Second)
	appendRecentEvents(eventsCtx, &sb, clientset.CoreV1().Events(namespace), name, "ConfigMap")
	eventsCancel()
	a.emitHolmesContextProgress("ConfigMap", namespace, name, "Collecting recent events", "done", "")

	return sb.String(), nil
}

func (a *App) getSecretContext(namespace, name string) (string, error) {
	clientset, err := a.getKubernetesInterface()
	if err != nil {
		return "", err
	}

	ctx := a.ctx
	if ctx == nil {
		ctx = context.Background()
	}

	var sb strings.Builder

	a.emitHolmesContextProgress("Secret", namespace, name, "Fetching secret details", "running", "")
	secretCtx, secretCancel := context.WithTimeout(ctx, 10*time.Second)
	defer secretCancel()
	secret, err := clientset.CoreV1().Secrets(namespace).Get(secretCtx, name, metav1.GetOptions{})
	if err != nil {
		return "", fmt.Errorf("failed to get secret: %w", err)
	}
	a.emitHolmesContextProgress("Secret", namespace, name, "Fetching secret details", "done", "")

	sb.WriteString(fmt.Sprintf("Secret: %s/%s\n", namespace, name))
	sb.WriteString(fmt.Sprintf("Type: %s\n", secret.Type))
	sb.WriteString(fmt.Sprintf("Data Keys: %d\n", len(secret.Data)))

	if len(secret.Data) > 0 {
		sb.WriteString("\nData Keys (values hidden):\n")
		for key := range secret.Data {
			sb.WriteString(fmt.Sprintf("  - %s\n", key))
		}
	}

	a.emitHolmesContextProgress("Secret", namespace, name, "Collecting recent events", "running", "")
	eventsCtx, eventsCancel := context.WithTimeout(ctx, 8*time.Second)
	appendRecentEvents(eventsCtx, &sb, clientset.CoreV1().Events(namespace), name, "Secret")
	eventsCancel()
	a.emitHolmesContextProgress("Secret", namespace, name, "Collecting recent events", "done", "")

	return sb.String(), nil
}

func (a *App) getPersistentVolumeContext(name string) (string, error) {
	clientset, err := a.getKubernetesInterface()
	if err != nil {
		return "", err
	}

	ctx := a.ctx
	if ctx == nil {
		ctx = context.Background()
	}

	var sb strings.Builder

	a.emitHolmesContextProgress("PersistentVolume", "", name, "Fetching PV details", "running", "")
	pvCtx, pvCancel := context.WithTimeout(ctx, 10*time.Second)
	defer pvCancel()
	pv, err := clientset.CoreV1().PersistentVolumes().Get(pvCtx, name, metav1.GetOptions{})
	if err != nil {
		return "", fmt.Errorf("failed to get persistent volume: %w", err)
	}
	a.emitHolmesContextProgress("PersistentVolume", "", name, "Fetching PV details", "done", "")

	sb.WriteString(fmt.Sprintf("PersistentVolume: %s\n", name))
	sb.WriteString(fmt.Sprintf("Status: %s\n", pv.Status.Phase))
	if storage, ok := pv.Spec.Capacity["storage"]; ok {
		sb.WriteString(fmt.Sprintf("Capacity: %s\n", storage.String()))
	}
	sb.WriteString(fmt.Sprintf("Access Modes: %v\n", pv.Spec.AccessModes))
	sb.WriteString(fmt.Sprintf("Reclaim Policy: %s\n", pv.Spec.PersistentVolumeReclaimPolicy))

	if pv.Spec.StorageClassName != "" {
		sb.WriteString(fmt.Sprintf("Storage Class: %s\n", pv.Spec.StorageClassName))
	}

	if pv.Spec.ClaimRef != nil {
		sb.WriteString(fmt.Sprintf("\nBound to PVC: %s/%s\n", pv.Spec.ClaimRef.Namespace, pv.Spec.ClaimRef.Name))
	}

	if pv.Status.Message != "" {
		sb.WriteString(fmt.Sprintf("\nStatus Message: %s\n", pv.Status.Message))
	}

	return sb.String(), nil
}

func (a *App) getPersistentVolumeClaimContext(namespace, name string) (string, error) {
	clientset, err := a.getKubernetesInterface()
	if err != nil {
		return "", err
	}

	ctx := a.ctx
	if ctx == nil {
		ctx = context.Background()
	}

	var sb strings.Builder

	a.emitHolmesContextProgress("PersistentVolumeClaim", namespace, name, "Fetching PVC details", "running", "")
	pvcCtx, pvcCancel := context.WithTimeout(ctx, 10*time.Second)
	defer pvcCancel()
	pvc, err := clientset.CoreV1().PersistentVolumeClaims(namespace).Get(pvcCtx, name, metav1.GetOptions{})
	if err != nil {
		return "", fmt.Errorf("failed to get persistent volume claim: %w", err)
	}
	a.emitHolmesContextProgress("PersistentVolumeClaim", namespace, name, "Fetching PVC details", "done", "")

	sb.WriteString(fmt.Sprintf("PersistentVolumeClaim: %s/%s\n", namespace, name))
	sb.WriteString(fmt.Sprintf("Status: %s\n", pvc.Status.Phase))
	if storage, ok := pvc.Status.Capacity["storage"]; ok {
		sb.WriteString(fmt.Sprintf("Capacity: %s\n", storage.String()))
	}
	sb.WriteString(fmt.Sprintf("Access Modes: %v\n", pvc.Spec.AccessModes))

	if pvc.Spec.StorageClassName != nil {
		sb.WriteString(fmt.Sprintf("Storage Class: %s\n", *pvc.Spec.StorageClassName))
	}

	if pvc.Spec.VolumeName != "" {
		sb.WriteString(fmt.Sprintf("\nBound to PV: %s\n", pvc.Spec.VolumeName))
	}

	a.emitHolmesContextProgress("PersistentVolumeClaim", namespace, name, "Collecting recent events", "running", "")
	eventsCtx, eventsCancel := context.WithTimeout(ctx, 8*time.Second)
	appendRecentEvents(eventsCtx, &sb, clientset.CoreV1().Events(namespace), name, "PersistentVolumeClaim")
	eventsCancel()
	a.emitHolmesContextProgress("PersistentVolumeClaim", namespace, name, "Collecting recent events", "done", "")

	return sb.String(), nil
}

func writeJobConditions(sb *strings.Builder, conditions []batchv1.JobCondition) {
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
