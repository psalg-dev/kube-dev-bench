package app

import "fmt"

// Kubernetes resource polling events.
// These are emitted periodically by the polling framework and on resource mutations.
const (
	EventPodsUpdate         = "pods:update"
	EventDeploymentsUpdate  = "deployments:update"
	EventStatefulSetsUpdate = "statefulsets:update"
	EventDaemonSetsUpdate   = "daemonsets:update"
	EventReplicaSetsUpdate  = "replicasets:update"
	EventCronJobsUpdate     = "cronjobs:update"
	EventJobsUpdate         = "jobs:update"
	EventSecretsUpdate      = "secrets:update"
	EventConfigMapsUpdate   = "configmaps:update"
	EventIngressesUpdate    = "ingresses:update"
	EventHelmReleasesUpdate = "helmreleases:update"
	EventRolesUpdate        = "roles:update"
	EventClusterRolesUpdate = "clusterroles:update"
	EventRoleBindingsUpdate = "rolebindings:update"
	EventClusterRoleBindingsUpdate = "clusterrolebindings:update"
)

// Kubernetes system events.
const (
	EventMonitorUpdate        = "monitor:update"
	EventResourceCountsUpdate = "resourcecounts:update"
	EventPortForwardsUpdate   = "portforwards:update"
	EventConsoleOutput        = "console:output"
)

// Holmes AI events.
const (
	EventHolmesAnalysisUpdate   = "holmes:analysis:update"
	EventHolmesAnalysisProgress = "holmes:analysis:progress"
	EventHolmesChatStream       = "holmes:chat:stream"
	EventHolmesDeploymentStatus = "holmes:deployment:status"
	EventHolmesContextProgress  = "holmes:context:progress"
)

// Hook events.
const (
	EventHookStarted   = "hook:started"
	EventHookCompleted = "hook:completed"
)

// Docker / Swarm events.
const (
	EventDockerConnected           = "docker:connected"
	EventSwarmServicesUpdate       = "swarm:services:update"
	EventSwarmTasksUpdate          = "swarm:tasks:update"
	EventSwarmNodesUpdate          = "swarm:nodes:update"
	EventSwarmResourceCountsUpdate = "swarm:resourcecounts:update"
	EventSwarmMetricsUpdate        = "swarm:metrics:update"
	EventSwarmMetricsBreakdown     = "swarm:metrics:breakdown"
	EventSwarmImageUpdates         = "swarm:image:updates"
)

// Dynamic event name helpers for parameterized events.

// PortForwardEvent returns a port-forward event name for the given key and action.
// Actions: "exit", "output", "ready", "error".
func PortForwardEvent(key, action string) string {
	return fmt.Sprintf("portforward:%s:%s", key, action)
}

// TerminalOutputEvent returns the terminal output event name for a session.
func TerminalOutputEvent(sessionID string) string {
	return fmt.Sprintf("terminal:%s:output", sessionID)
}

// TerminalExitEvent returns the terminal exit event name for a session.
func TerminalExitEvent(sessionID string) string {
	return fmt.Sprintf("terminal:%s:exit", sessionID)
}

// PodLogsEvent returns the pod-logs streaming event name for a pod.
func PodLogsEvent(podName string) string {
	return fmt.Sprintf("podlogs:%s", podName)
}
