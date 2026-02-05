package app

import (
	"context"
	"fmt"
	"io"
	"strings"
	"time"

	"gowails/pkg/app/holmesgpt"

	"github.com/docker/docker/api/types"
	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/filters"
	"github.com/docker/docker/api/types/swarm"
)

// AnalyzeSwarmService gathers Swarm service context and sends it to HolmesGPT.
// This is a Wails RPC method callable from the frontend.
func (a *App) AnalyzeSwarmService(serviceID string) (*holmesgpt.HolmesResponse, error) {
	log := holmesgpt.GetLogger()
	startTime := time.Now()

	if serviceID == "" {
		return nil, fmt.Errorf("service ID required")
	}

	log.Info("AnalyzeSwarmService: starting", "serviceID", serviceID)

	ctx, err := a.getSwarmServiceContext(serviceID)
	if err != nil {
		log.Error("AnalyzeSwarmService: failed to get service context",
			"error", err,
			"elapsed", time.Since(startTime))
		return nil, fmt.Errorf("failed to get service context: %w", err)
	}

	question := fmt.Sprintf(
		"Analyze this Docker Swarm service and explain any issues:\n\nService ID: %s\n\n%s",
		serviceID, ctx,
	)

	resp, err := a.AskHolmes(question)
	if err != nil {
		log.Error("AnalyzeSwarmService: analysis failed",
			"error", err,
			"elapsed", time.Since(startTime))
	} else {
		log.Info("AnalyzeSwarmService: completed",
			"responseLen", len(resp.Response),
			"elapsed", time.Since(startTime))
	}

	return resp, err
}

// AnalyzeSwarmServiceStream gathers Swarm service context and streams analysis to the frontend.
// This is a Wails RPC method callable from the frontend.
func (a *App) AnalyzeSwarmServiceStream(serviceID string, streamID string) error {
	log := holmesgpt.GetLogger()
	startTime := time.Now()

	if serviceID == "" {
		return fmt.Errorf("service ID required")
	}

	log.Info("AnalyzeSwarmServiceStream: starting",
		"serviceID", serviceID,
		"streamID", streamID)

	ctx, err := a.getSwarmServiceContext(serviceID)
	if err != nil {
		log.Error("AnalyzeSwarmServiceStream: failed to get service context",
			"error", err,
			"elapsed", time.Since(startTime))
		return fmt.Errorf("failed to get service context: %w", err)
	}

	question := fmt.Sprintf(
		"Analyze this Docker Swarm service and explain any issues:\n\nService ID: %s\n\n%s",
		serviceID, ctx,
	)

	log.Debug("AnalyzeSwarmServiceStream: sending to Holmes stream",
		"questionLen", len(question))

	return a.AskHolmesStream(question, streamID)
}

// AnalyzeSwarmTask gathers Swarm task context and sends it to HolmesGPT.
// This is a Wails RPC method callable from the frontend.
func (a *App) AnalyzeSwarmTask(taskID string) (*holmesgpt.HolmesResponse, error) {
	log := holmesgpt.GetLogger()
	startTime := time.Now()

	if taskID == "" {
		return nil, fmt.Errorf("task ID required")
	}

	log.Info("AnalyzeSwarmTask: starting", "taskID", taskID)

	ctx, err := a.getSwarmTaskContext(taskID)
	if err != nil {
		log.Error("AnalyzeSwarmTask: failed to get task context",
			"error", err,
			"elapsed", time.Since(startTime))
		return nil, fmt.Errorf("failed to get task context: %w", err)
	}

	question := fmt.Sprintf(
		"Analyze this Docker Swarm task and explain any issues:\n\nTask ID: %s\n\n%s",
		taskID, ctx,
	)

	resp, err := a.AskHolmes(question)
	if err != nil {
		log.Error("AnalyzeSwarmTask: analysis failed",
			"error", err,
			"elapsed", time.Since(startTime))
	} else {
		log.Info("AnalyzeSwarmTask: completed",
			"responseLen", len(resp.Response),
			"elapsed", time.Since(startTime))
	}

	return resp, err
}

// AnalyzeSwarmTaskStream gathers Swarm task context and streams analysis to the frontend.
// This is a Wails RPC method callable from the frontend.
func (a *App) AnalyzeSwarmTaskStream(taskID string, streamID string) error {
	log := holmesgpt.GetLogger()
	startTime := time.Now()

	if taskID == "" {
		return fmt.Errorf("task ID required")
	}

	log.Info("AnalyzeSwarmTaskStream: starting",
		"taskID", taskID,
		"streamID", streamID)

	ctx, err := a.getSwarmTaskContext(taskID)
	if err != nil {
		log.Error("AnalyzeSwarmTaskStream: failed to get task context",
			"error", err,
			"elapsed", time.Since(startTime))
		return fmt.Errorf("failed to get task context: %w", err)
	}

	question := fmt.Sprintf(
		"Analyze this Docker Swarm task and explain any issues:\n\nTask ID: %s\n\n%s",
		taskID, ctx,
	)

	log.Debug("AnalyzeSwarmTaskStream: sending to Holmes stream",
		"questionLen", len(question))

	return a.AskHolmesStream(question, streamID)
}

// writeServiceTasksContext writes task summary to the string builder.
func writeServiceTasksContext(sb *strings.Builder, tasks []swarm.Task) {
	sb.WriteString(fmt.Sprintf("\nTasks (%d):\n", len(tasks)))
	for _, task := range tasks {
		taskIDShort := task.ID
		if len(taskIDShort) > 12 {
			taskIDShort = taskIDShort[:12]
		}
		sb.WriteString(fmt.Sprintf("  - %s: %s\n", taskIDShort, task.Status.State))
		if task.Status.Err != "" {
			sb.WriteString(fmt.Sprintf("    Error: %s\n", task.Status.Err))
		}
	}
}

func (a *App) getSwarmServiceContext(serviceID string) (string, error) {
	dockerClient, err := a.getDockerClient()
	if err != nil {
		return "", err
	}

	ctx := a.ctx
	if ctx == nil {
		ctx = context.Background()
	}

	var sb strings.Builder

	a.emitHolmesContextProgress("Swarm Service", "swarm", serviceID, "Fetching service details", "running", "")
	serviceCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	service, _, err := dockerClient.ServiceInspectWithRaw(serviceCtx, serviceID, types.ServiceInspectOptions{})
	if err != nil {
		a.emitHolmesContextProgress("Swarm Service", "swarm", serviceID, "Fetching service details", "error", err.Error())
		return "", fmt.Errorf("failed to inspect service: %w", err)
	}
	a.emitHolmesContextProgress("Swarm Service", "swarm", serviceID, "Fetching service details", "done", "")

	sb.WriteString(fmt.Sprintf("Service: %s\n", service.Spec.Name))
	if service.Spec.Mode.Replicated != nil && service.Spec.Mode.Replicated.Replicas != nil {
		sb.WriteString(fmt.Sprintf("Replicas: %d\n", *service.Spec.Mode.Replicated.Replicas))
	}
	if service.Spec.TaskTemplate.ContainerSpec != nil {
		sb.WriteString(fmt.Sprintf("Image: %s\n", service.Spec.TaskTemplate.ContainerSpec.Image))
	}

	// Get tasks for this service
	a.emitHolmesContextProgress("Swarm Service", "swarm", serviceID, "Listing tasks", "running", "")
	listCtx, listCancel := context.WithTimeout(ctx, 8*time.Second)
	tasks, err := dockerClient.TaskList(listCtx, types.TaskListOptions{
		Filters: filters.NewArgs(filters.Arg("service", serviceID)),
	})
	listCancel()
	if err != nil {
		a.emitHolmesContextProgress("Swarm Service", "swarm", serviceID, "Listing tasks", "error", err.Error())
		sb.WriteString(fmt.Sprintf("\nFailed to get tasks: %v\n", err))
	} else {
		a.emitHolmesContextProgress("Swarm Service", "swarm", serviceID, "Listing tasks", "done", "")
		writeServiceTasksContext(&sb, tasks)
	}

	// Get service logs (last 50 lines)
	a.emitHolmesContextProgress("Swarm Service", "swarm", serviceID, "Collecting recent logs", "running", "")
	logCtx, logCancel := context.WithTimeout(ctx, 10*time.Second)
	logs, err := dockerClient.ServiceLogs(logCtx, serviceID, container.LogsOptions{
		ShowStdout: true,
		ShowStderr: true,
		Tail:       "50",
	})
	if err == nil && logs != nil {
		defer logCancel()
		defer logs.Close()
		logBytes, _ := io.ReadAll(logs)
		if len(logBytes) > 0 {
			sb.WriteString("\nRecent Logs (last 50 lines):\n")
			sb.WriteString(string(logBytes))
		}
		a.emitHolmesContextProgress("Swarm Service", "swarm", serviceID, "Collecting recent logs", "done", "")
	} else {
		if err != nil {
			a.emitHolmesContextProgress("Swarm Service", "swarm", serviceID, "Collecting recent logs", "error", err.Error())
		}
		logCancel()
	}

	return sb.String(), nil
}

// truncateID returns the first 12 characters of an ID
func truncateID(id string) string {
	if len(id) > 12 {
		return id[:12]
	}
	return id
}

// writeTaskInfo writes basic task info to the builder
func writeTaskInfo(sb *strings.Builder, task swarm.Task) {
	sb.WriteString(fmt.Sprintf("Task: %s\n", truncateID(task.ID)))
	sb.WriteString(fmt.Sprintf("Service: %s\n", truncateID(task.ServiceID)))
	sb.WriteString(fmt.Sprintf("Node: %s\n", truncateID(task.NodeID)))
	sb.WriteString(fmt.Sprintf("State: %s\n", task.Status.State))

	if task.Status.Err != "" {
		sb.WriteString(fmt.Sprintf("Error: %s\n", task.Status.Err))
	}

	if task.Status.ContainerStatus != nil {
		sb.WriteString(fmt.Sprintf("Container ID: %s\n", truncateID(task.Status.ContainerStatus.ContainerID)))
		if task.Status.ContainerStatus.ExitCode != 0 {
			sb.WriteString(fmt.Sprintf("Exit Code: %d\n", task.Status.ContainerStatus.ExitCode))
		}
	}
}

func (a *App) getSwarmTaskContext(taskID string) (string, error) {
	dockerClient, err := a.getDockerClient()
	if err != nil {
		return "", err
	}

	ctx := a.ctx
	if ctx == nil {
		ctx = context.Background()
	}

	var sb strings.Builder

	a.emitHolmesContextProgress("Swarm Task", "swarm", taskID, "Fetching task details", "running", "")
	taskCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	task, _, err := dockerClient.TaskInspectWithRaw(taskCtx, taskID)
	if err != nil {
		a.emitHolmesContextProgress("Swarm Task", "swarm", taskID, "Fetching task details", "error", err.Error())
		return "", fmt.Errorf("failed to inspect task: %w", err)
	}
	a.emitHolmesContextProgress("Swarm Task", "swarm", taskID, "Fetching task details", "done", "")

	writeTaskInfo(&sb, task)

	// Get task logs if container exists
	if task.Status.ContainerStatus != nil {
		a.emitHolmesContextProgress("Swarm Task", "swarm", taskID, "Collecting recent logs", "running", "")
		logCtx, logCancel := context.WithTimeout(ctx, 10*time.Second)
		logs, err := dockerClient.ContainerLogs(logCtx, task.Status.ContainerStatus.ContainerID, container.LogsOptions{
			ShowStdout: true,
			ShowStderr: true,
			Tail:       "50",
		})
		if err == nil && logs != nil {
			defer logCancel()
			defer logs.Close()
			logBytes, _ := io.ReadAll(logs)
			if len(logBytes) > 0 {
				sb.WriteString("\nRecent Logs (last 50 lines):\n")
				sb.WriteString(string(logBytes))
			}
			a.emitHolmesContextProgress("Swarm Task", "swarm", taskID, "Collecting recent logs", "done", "")
		} else {
			if err != nil {
				a.emitHolmesContextProgress("Swarm Task", "swarm", taskID, "Collecting recent logs", "error", err.Error())
			}
			logCancel()
		}
	}

	return sb.String(), nil
}

// AnalyzeSwarmNode gathers Swarm node context and sends it to HolmesGPT.
// This is a Wails RPC method callable from the frontend.
func (a *App) AnalyzeSwarmNode(nodeID string) (*holmesgpt.HolmesResponse, error) {
	log := holmesgpt.GetLogger()
	startTime := time.Now()

	if nodeID == "" {
		return nil, fmt.Errorf("node ID required")
	}

	log.Info("AnalyzeSwarmNode: starting", "nodeID", nodeID)

	ctx, err := a.getSwarmNodeContext(nodeID)
	if err != nil {
		log.Error("AnalyzeSwarmNode: failed to get node context",
			"error", err,
			"elapsed", time.Since(startTime))
		return nil, fmt.Errorf("failed to get node context: %w", err)
	}

	question := fmt.Sprintf(
		"Analyze this Docker Swarm node and explain any issues or recommendations:\n\nNode ID: %s\n\n%s",
		nodeID, ctx,
	)

	resp, err := a.AskHolmes(question)
	if err != nil {
		log.Error("AnalyzeSwarmNode: analysis failed",
			"error", err,
			"elapsed", time.Since(startTime))
	} else {
		log.Info("AnalyzeSwarmNode: completed",
			"responseLen", len(resp.Response),
			"elapsed", time.Since(startTime))
	}

	return resp, err
}

// AnalyzeSwarmNodeStream gathers Swarm node context and streams analysis to the frontend.
// This is a Wails RPC method callable from the frontend.
func (a *App) AnalyzeSwarmNodeStream(nodeID string, streamID string) error {
	log := holmesgpt.GetLogger()
	startTime := time.Now()

	if nodeID == "" {
		return fmt.Errorf("node ID required")
	}

	log.Info("AnalyzeSwarmNodeStream: starting",
		"nodeID", nodeID,
		"streamID", streamID)

	ctx, err := a.getSwarmNodeContext(nodeID)
	if err != nil {
		log.Error("AnalyzeSwarmNodeStream: failed to get node context",
			"error", err,
			"elapsed", time.Since(startTime))
		return fmt.Errorf("failed to get node context: %w", err)
	}

	question := fmt.Sprintf(
		"Analyze this Docker Swarm node and explain any issues or recommendations:\n\nNode ID: %s\n\n%s",
		nodeID, ctx,
	)

	log.Debug("AnalyzeSwarmNodeStream: sending to Holmes stream",
		"questionLen", len(question))

	return a.AskHolmesStream(question, streamID)
}

// AnalyzeSwarmStack gathers Swarm stack context and sends it to HolmesGPT.
// This is a Wails RPC method callable from the frontend.
func (a *App) AnalyzeSwarmStack(stackName string) (*holmesgpt.HolmesResponse, error) {
	log := holmesgpt.GetLogger()
	startTime := time.Now()

	if stackName == "" {
		return nil, fmt.Errorf("stack name required")
	}

	log.Info("AnalyzeSwarmStack: starting", "stackName", stackName)

	ctx, err := a.getSwarmStackContext(stackName)
	if err != nil {
		log.Error("AnalyzeSwarmStack: failed to get stack context",
			"error", err,
			"elapsed", time.Since(startTime))
		return nil, fmt.Errorf("failed to get stack context: %w", err)
	}

	question := fmt.Sprintf(
		"Analyze this Docker Swarm stack and explain any issues or recommendations:\n\nStack Name: %s\n\n%s",
		stackName, ctx,
	)

	resp, err := a.AskHolmes(question)
	if err != nil {
		log.Error("AnalyzeSwarmStack: analysis failed",
			"error", err,
			"elapsed", time.Since(startTime))
	} else {
		log.Info("AnalyzeSwarmStack: completed",
			"responseLen", len(resp.Response),
			"elapsed", time.Since(startTime))
	}

	return resp, err
}

// AnalyzeSwarmStackStream gathers Swarm stack context and streams analysis to the frontend.
// This is a Wails RPC method callable from the frontend.
func (a *App) AnalyzeSwarmStackStream(stackName string, streamID string) error {
	log := holmesgpt.GetLogger()
	startTime := time.Now()

	if stackName == "" {
		return fmt.Errorf("stack name required")
	}

	log.Info("AnalyzeSwarmStackStream: starting",
		"stackName", stackName,
		"streamID", streamID)

	ctx, err := a.getSwarmStackContext(stackName)
	if err != nil {
		log.Error("AnalyzeSwarmStackStream: failed to get stack context",
			"error", err,
			"elapsed", time.Since(startTime))
		return fmt.Errorf("failed to get stack context: %w", err)
	}

	question := fmt.Sprintf(
		"Analyze this Docker Swarm stack and explain any issues or recommendations:\n\nStack Name: %s\n\n%s",
		stackName, ctx,
	)

	log.Debug("AnalyzeSwarmStackStream: sending to Holmes stream",
		"questionLen", len(question))

	return a.AskHolmesStream(question, streamID)
}

// writeNodeTasksContext writes tasks on a node to the string builder.
func writeNodeTasksContext(sb *strings.Builder, tasks []swarm.Task) {
	sb.WriteString(fmt.Sprintf("\nTasks on node (%d):\n", len(tasks)))
	for _, task := range tasks {
		taskIDShort := truncateID(task.ID)
		serviceIDShort := truncateID(task.ServiceID)
		sb.WriteString(fmt.Sprintf("  - %s: %s (service: %s)\n", taskIDShort, task.Status.State, serviceIDShort))
		if task.Status.Err != "" {
			sb.WriteString(fmt.Sprintf("    Error: %s\n", task.Status.Err))
		}
	}
}

func (a *App) getSwarmNodeContext(nodeID string) (string, error) {
	dockerClient, err := a.getDockerClient()
	if err != nil {
		return "", err
	}

	ctx := a.ctx
	if ctx == nil {
		ctx = context.Background()
	}

	var sb strings.Builder

	a.emitHolmesContextProgress("Swarm Node", "swarm", nodeID, "Fetching node details", "running", "")
	nodeCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	node, _, err := dockerClient.NodeInspectWithRaw(nodeCtx, nodeID)
	if err != nil {
		a.emitHolmesContextProgress("Swarm Node", "swarm", nodeID, "Fetching node details", "error", err.Error())
		return "", fmt.Errorf("failed to inspect node: %w", err)
	}
	a.emitHolmesContextProgress("Swarm Node", "swarm", nodeID, "Fetching node details", "done", "")

	sb.WriteString(fmt.Sprintf("Node: %s\n", truncateID(node.ID)))
	sb.WriteString(fmt.Sprintf("Hostname: %s\n", node.Description.Hostname))
	sb.WriteString(fmt.Sprintf("Role: %s\n", node.Spec.Role))
	sb.WriteString(fmt.Sprintf("Availability: %s\n", node.Spec.Availability))
	sb.WriteString(fmt.Sprintf("State: %s\n", node.Status.State))
	if node.Status.Message != "" {
		sb.WriteString(fmt.Sprintf("Status Message: %s\n", node.Status.Message))
	}
	sb.WriteString(fmt.Sprintf("Address: %s\n", node.Status.Addr))
	sb.WriteString(fmt.Sprintf("Engine Version: %s\n", node.Description.Engine.EngineVersion))
	sb.WriteString(fmt.Sprintf("OS: %s\n", node.Description.Platform.OS))
	sb.WriteString(fmt.Sprintf("Architecture: %s\n", node.Description.Platform.Architecture))

	// Get tasks on this node
	a.emitHolmesContextProgress("Swarm Node", "swarm", nodeID, "Listing tasks on node", "running", "")
	listCtx, listCancel := context.WithTimeout(ctx, 8*time.Second)
	tasks, err := dockerClient.TaskList(listCtx, types.TaskListOptions{
		Filters: filters.NewArgs(filters.Arg("node", nodeID)),
	})
	listCancel()
	if err != nil {
		a.emitHolmesContextProgress("Swarm Node", "swarm", nodeID, "Listing tasks on node", "error", err.Error())
		sb.WriteString(fmt.Sprintf("\nFailed to get tasks: %v\n", err))
	} else {
		a.emitHolmesContextProgress("Swarm Node", "swarm", nodeID, "Listing tasks on node", "done", "")
		writeNodeTasksContext(&sb, tasks)
	}

	// Node labels
	if len(node.Spec.Labels) > 0 {
		sb.WriteString("\nLabels:\n")
		for k, v := range node.Spec.Labels {
			sb.WriteString(fmt.Sprintf("  %s=%s\n", k, v))
		}
	}

	return sb.String(), nil
}

// formatServiceReplicas returns a human-readable replica count string
func formatServiceReplicas(svc swarm.Service) string {
	if svc.Spec.Mode.Replicated != nil && svc.Spec.Mode.Replicated.Replicas != nil {
		return fmt.Sprintf("%d replicas", *svc.Spec.Mode.Replicated.Replicas)
	}
	if svc.Spec.Mode.Global != nil {
		return "global"
	}
	return ""
}

// writeStackServiceInfo writes service info to the builder
func writeStackServiceInfo(sb *strings.Builder, services []swarm.Service) {
	sb.WriteString(fmt.Sprintf("Services (%d):\n", len(services)))
	for _, svc := range services {
		sb.WriteString(fmt.Sprintf("  - %s (%s)\n", svc.Spec.Name, formatServiceReplicas(svc)))
		if svc.Spec.TaskTemplate.ContainerSpec != nil {
			sb.WriteString(fmt.Sprintf("    Image: %s\n", svc.Spec.TaskTemplate.ContainerSpec.Image))
		}
	}
}

// countTaskStates returns a map of state counts and a list of failed tasks
func countTaskStates(tasks []swarm.Task) (map[string]int, []swarm.Task) {
	stateCounts := make(map[string]int)
	var failedTasks []swarm.Task
	for _, task := range tasks {
		stateCounts[string(task.Status.State)]++
		if task.Status.State == "failed" || task.Status.State == "rejected" {
			failedTasks = append(failedTasks, task)
		}
	}
	return stateCounts, failedTasks
}

// writeTaskSummary writes task summary info to the builder
func writeTaskSummary(sb *strings.Builder, tasks []swarm.Task, stateCounts map[string]int, failedTasks []swarm.Task) {
	sb.WriteString(fmt.Sprintf("\nTask Summary (%d total):\n", len(tasks)))
	for state, count := range stateCounts {
		sb.WriteString(fmt.Sprintf("  %s: %d\n", state, count))
	}

	if len(failedTasks) > 0 {
		sb.WriteString("\nFailed Tasks:\n")
		for _, task := range failedTasks {
			taskIDShort := task.ID
			if len(taskIDShort) > 12 {
				taskIDShort = taskIDShort[:12]
			}
			sb.WriteString(fmt.Sprintf("  - %s: %s\n", taskIDShort, task.Status.State))
			if task.Status.Err != "" {
				sb.WriteString(fmt.Sprintf("    Error: %s\n", task.Status.Err))
			}
		}
	}
}

func (a *App) getSwarmStackContext(stackName string) (string, error) {
	dockerClient, err := a.getDockerClient()
	if err != nil {
		return "", err
	}

	ctx := a.ctx
	if ctx == nil {
		ctx = context.Background()
	}

	var sb strings.Builder

	sb.WriteString(fmt.Sprintf("Stack: %s\n\n", stackName))

	// Get services in this stack
	a.emitHolmesContextProgress("Swarm Stack", "swarm", stackName, "Listing stack services", "running", "")
	svcCtx, svcCancel := context.WithTimeout(ctx, 10*time.Second)
	services, err := dockerClient.ServiceList(svcCtx, types.ServiceListOptions{
		Filters: filters.NewArgs(filters.Arg("label", fmt.Sprintf("com.docker.stack.namespace=%s", stackName))),
	})
	svcCancel()
	if err != nil {
		a.emitHolmesContextProgress("Swarm Stack", "swarm", stackName, "Listing stack services", "error", err.Error())
		sb.WriteString(fmt.Sprintf("Failed to get services: %v\n", err))
	} else {
		a.emitHolmesContextProgress("Swarm Stack", "swarm", stackName, "Listing stack services", "done", "")
		writeStackServiceInfo(&sb, services)
	}

	// Get tasks for all services in the stack
	a.emitHolmesContextProgress("Swarm Stack", "swarm", stackName, "Listing stack tasks", "running", "")
	taskCtx, taskCancel := context.WithTimeout(ctx, 10*time.Second)
	var allTasks []swarm.Task
	for _, svc := range services {
		tasks, taskErr := dockerClient.TaskList(taskCtx, types.TaskListOptions{
			Filters: filters.NewArgs(filters.Arg("service", svc.ID)),
		})
		if taskErr == nil {
			allTasks = append(allTasks, tasks...)
		}
	}
	taskCancel()
	a.emitHolmesContextProgress("Swarm Stack", "swarm", stackName, "Listing stack tasks", "done", "")

	stateCounts, failedTasks := countTaskStates(allTasks)
	writeTaskSummary(&sb, allTasks, stateCounts, failedTasks)

	return sb.String(), nil
}
