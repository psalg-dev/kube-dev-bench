package app

import (
	"fmt"
	"strings"
	"time"

	"github.com/docker/docker/api/types"
	"github.com/docker/docker/api/types/swarm"
)

// SwarmBulkItem represents a single Docker Swarm resource for bulk operations
type SwarmBulkItem struct {
	ID   string `json:"id"`
	Name string `json:"name"`
	Kind string `json:"kind"`
}

// BulkRemoveSwarmResources removes multiple Docker Swarm resources
func (a *App) BulkRemoveSwarmResources(items []SwarmBulkItem) BulkOperationResponse {
	response := BulkOperationResponse{
		Results: make([]BulkOperationResult, 0, len(items)),
	}

	if len(items) == 0 {
		return response
	}

	dockerClient, err := a.getDockerClient()
	if err != nil {
		for _, item := range items {
			response.Results = append(response.Results, BulkOperationResult{
				Name:    item.Name,
				Success: false,
				Error:   err.Error(),
			})
			response.ErrorCount++
		}
		return response
	}

	for _, item := range items {
		var removeErr error
		kind := strings.ToLower(item.Kind)

		switch kind {
		case "service", "services":
			removeErr = dockerClient.ServiceRemove(a.ctx, item.ID)
		case "network", "networks":
			removeErr = dockerClient.NetworkRemove(a.ctx, item.ID)
		case "config", "configs":
			removeErr = dockerClient.ConfigRemove(a.ctx, item.ID)
		case "secret", "secrets":
			removeErr = dockerClient.SecretRemove(a.ctx, item.ID)
		case "volume", "volumes":
			removeErr = dockerClient.VolumeRemove(a.ctx, item.ID, true)
		case "node", "nodes":
			removeErr = dockerClient.NodeRemove(a.ctx, item.ID, types.NodeRemoveOptions{Force: true})
		default:
			removeErr = fmt.Errorf("unsupported Swarm resource kind: %s", item.Kind)
		}

		result := BulkOperationResult{
			Name:    item.Name,
			Success: removeErr == nil,
		}
		if removeErr != nil {
			result.Error = removeErr.Error()
			response.ErrorCount++
		} else {
			response.SuccessCount++
		}
		response.Results = append(response.Results, result)
	}

	return response
}

// BulkScaleSwarmServices scales multiple Docker Swarm services to the specified replica count
func (a *App) BulkScaleSwarmServices(items []SwarmBulkItem, replicas int) BulkOperationResponse {
	response := BulkOperationResponse{
		Results: make([]BulkOperationResult, 0, len(items)),
	}

	if len(items) == 0 {
		return response
	}

	if replicas < 0 {
		for _, item := range items {
			response.Results = append(response.Results, BulkOperationResult{
				Name:    item.Name,
				Success: false,
				Error:   "replicas must be non-negative",
			})
			response.ErrorCount++
		}
		return response
	}

	dockerClient, err := a.getDockerClient()
	if err != nil {
		for _, item := range items {
			response.Results = append(response.Results, BulkOperationResult{
				Name:    item.Name,
				Success: false,
				Error:   err.Error(),
			})
			response.ErrorCount++
		}
		return response
	}

	replicaCount := uint64(replicas)

	for _, item := range items {
		kind := strings.ToLower(item.Kind)
		if kind != "service" && kind != "services" {
			response.Results = append(response.Results, BulkOperationResult{
				Name:    item.Name,
				Success: false,
				Error:   fmt.Sprintf("scaling not supported for kind: %s", item.Kind),
			})
			response.ErrorCount++
			continue
		}

		// Get current service spec
		service, _, err := dockerClient.ServiceInspectWithRaw(a.ctx, item.ID, swarm.ServiceInspectOptions{})
		if err != nil {
			response.Results = append(response.Results, BulkOperationResult{
				Name:    item.Name,
				Success: false,
				Error:   err.Error(),
			})
			response.ErrorCount++
			continue
		}

		// Update replica count
		if service.Spec.Mode.Replicated != nil {
			service.Spec.Mode.Replicated.Replicas = &replicaCount
		} else {
			response.Results = append(response.Results, BulkOperationResult{
				Name:    item.Name,
				Success: false,
				Error:   "service is not in replicated mode",
			})
			response.ErrorCount++
			continue
		}

		// Apply update
		_, updateErr := dockerClient.ServiceUpdate(a.ctx, item.ID, service.Version, service.Spec, swarm.ServiceUpdateOptions{})

		result := BulkOperationResult{
			Name:    item.Name,
			Success: updateErr == nil,
		}
		if updateErr != nil {
			result.Error = updateErr.Error()
			response.ErrorCount++
		} else {
			response.SuccessCount++
		}
		response.Results = append(response.Results, result)
	}

	return response
}

// BulkRestartSwarmServices restarts multiple Docker Swarm services by forcing an update
func (a *App) BulkRestartSwarmServices(items []SwarmBulkItem) BulkOperationResponse {
	response := BulkOperationResponse{
		Results: make([]BulkOperationResult, 0, len(items)),
	}

	if len(items) == 0 {
		return response
	}

	dockerClient, err := a.getDockerClient()
	if err != nil {
		for _, item := range items {
			response.Results = append(response.Results, BulkOperationResult{
				Name:    item.Name,
				Success: false,
				Error:   err.Error(),
			})
			response.ErrorCount++
		}
		return response
	}

	for _, item := range items {
		kind := strings.ToLower(item.Kind)
		if kind != "service" && kind != "services" {
			response.Results = append(response.Results, BulkOperationResult{
				Name:    item.Name,
				Success: false,
				Error:   fmt.Sprintf("restart not supported for kind: %s", item.Kind),
			})
			response.ErrorCount++
			continue
		}

		// Get current service spec
		service, _, err := dockerClient.ServiceInspectWithRaw(a.ctx, item.ID, swarm.ServiceInspectOptions{})
		if err != nil {
			response.Results = append(response.Results, BulkOperationResult{
				Name:    item.Name,
				Success: false,
				Error:   err.Error(),
			})
			response.ErrorCount++
			continue
		}

		// Force update by adding/updating a label
		if service.Spec.TaskTemplate.ContainerSpec != nil {
			if service.Spec.TaskTemplate.ContainerSpec.Labels == nil {
				service.Spec.TaskTemplate.ContainerSpec.Labels = make(map[string]string)
			}
			service.Spec.TaskTemplate.ContainerSpec.Labels["kube-dev-bench.restartedAt"] = time.Now().Format(time.RFC3339)
		}

		// Apply force update
		_, updateErr := dockerClient.ServiceUpdate(a.ctx, item.ID, service.Version, service.Spec, swarm.ServiceUpdateOptions{})

		result := BulkOperationResult{
			Name:    item.Name,
			Success: updateErr == nil,
		}
		if updateErr != nil {
			result.Error = updateErr.Error()
			response.ErrorCount++
		} else {
			response.SuccessCount++
		}
		response.Results = append(response.Results, result)
	}

	return response
}

// BulkUpdateSwarmNodeAvailability updates the availability of multiple Docker Swarm nodes
func (a *App) BulkUpdateSwarmNodeAvailability(items []SwarmBulkItem, availability string) BulkOperationResponse {
	response := BulkOperationResponse{
		Results: make([]BulkOperationResult, 0, len(items)),
	}

	if len(items) == 0 {
		return response
	}

	// Validate availability value
	var nodeAvailability swarm.NodeAvailability
	switch strings.ToLower(availability) {
	case "active":
		nodeAvailability = swarm.NodeAvailabilityActive
	case "pause", "paused":
		nodeAvailability = swarm.NodeAvailabilityPause
	case "drain", "drained":
		nodeAvailability = swarm.NodeAvailabilityDrain
	default:
		for _, item := range items {
			response.Results = append(response.Results, BulkOperationResult{
				Name:    item.Name,
				Success: false,
				Error:   fmt.Sprintf("invalid availability: %s (must be 'active', 'pause', or 'drain')", availability),
			})
			response.ErrorCount++
		}
		return response
	}

	dockerClient, err := a.getDockerClient()
	if err != nil {
		for _, item := range items {
			response.Results = append(response.Results, BulkOperationResult{
				Name:    item.Name,
				Success: false,
				Error:   err.Error(),
			})
			response.ErrorCount++
		}
		return response
	}

	for _, item := range items {
		kind := strings.ToLower(item.Kind)
		if kind != "node" && kind != "nodes" {
			response.Results = append(response.Results, BulkOperationResult{
				Name:    item.Name,
				Success: false,
				Error:   fmt.Sprintf("availability update not supported for kind: %s", item.Kind),
			})
			response.ErrorCount++
			continue
		}

		// Get current node
		node, _, err := dockerClient.NodeInspectWithRaw(a.ctx, item.ID)
		if err != nil {
			response.Results = append(response.Results, BulkOperationResult{
				Name:    item.Name,
				Success: false,
				Error:   err.Error(),
			})
			response.ErrorCount++
			continue
		}

		// Update availability
		node.Spec.Availability = nodeAvailability

		// Apply update
		updateErr := dockerClient.NodeUpdate(a.ctx, item.ID, node.Version, node.Spec)

		result := BulkOperationResult{
			Name:    item.Name,
			Success: updateErr == nil,
		}
		if updateErr != nil {
			result.Error = updateErr.Error()
			response.ErrorCount++
		} else {
			response.SuccessCount++
		}
		response.Results = append(response.Results, result)
	}

	return response
}
