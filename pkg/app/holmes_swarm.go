package app

import (
	"context"
	"fmt"
	"io"
	"strings"
	"time"

	"gowails/pkg/app/holmesgpt"

	"github.com/docker/docker/api/types"
	"github.com/docker/docker/api/types/filters"
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
		sb.WriteString(fmt.Sprintf("\nTasks (%d):\n", len(tasks)))
		for _, task := range tasks {
			sb.WriteString(fmt.Sprintf("  - %s: %s\n", task.ID[:12], task.Status.State))
			if task.Status.Err != "" {
				sb.WriteString(fmt.Sprintf("    Error: %s\n", task.Status.Err))
			}
		}
	}

	// Get service logs (last 50 lines)
	a.emitHolmesContextProgress("Swarm Service", "swarm", serviceID, "Collecting recent logs", "running", "")
	logCtx, logCancel := context.WithTimeout(ctx, 10*time.Second)
	logs, err := dockerClient.ServiceLogs(logCtx, serviceID, types.ContainerLogsOptions{
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

	sb.WriteString(fmt.Sprintf("Task: %s\n", task.ID[:12]))
	sb.WriteString(fmt.Sprintf("Service: %s\n", task.ServiceID[:12]))
	sb.WriteString(fmt.Sprintf("Node: %s\n", task.NodeID[:12]))
	sb.WriteString(fmt.Sprintf("State: %s\n", task.Status.State))

	if task.Status.Err != "" {
		sb.WriteString(fmt.Sprintf("Error: %s\n", task.Status.Err))
	}

	if task.Status.ContainerStatus != nil {
		cid := task.Status.ContainerStatus.ContainerID
		if len(cid) > 12 {
			cid = cid[:12]
		}
		sb.WriteString(fmt.Sprintf("Container ID: %s\n", cid))
		if task.Status.ContainerStatus.ExitCode != 0 {
			sb.WriteString(fmt.Sprintf("Exit Code: %d\n", task.Status.ContainerStatus.ExitCode))
		}
	}

	// Get task logs if container exists
	if task.Status.ContainerStatus != nil {
		a.emitHolmesContextProgress("Swarm Task", "swarm", taskID, "Collecting recent logs", "running", "")
		logCtx, logCancel := context.WithTimeout(ctx, 10*time.Second)
		logs, err := dockerClient.ContainerLogs(logCtx, task.Status.ContainerStatus.ContainerID, types.ContainerLogsOptions{
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
