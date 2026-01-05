package docker

import "errors"

// Common errors for Docker Swarm operations
var (
	ErrCannotScaleGlobalService = errors.New("cannot scale a global service")
	ErrNoContainerSpec          = errors.New("service has no container spec")
	ErrInvalidServiceName       = errors.New("service name is required")
	ErrInvalidServiceImage      = errors.New("service image is required")
	ErrNotConnected             = errors.New("docker client not connected")
	ErrSwarmNotActive           = errors.New("docker swarm is not active")
	ErrNodeNotManager           = errors.New("this node is not a swarm manager")
)
