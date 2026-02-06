package app

import (
	"testing"
)

func TestEventNameConstants(t *testing.T) {
	// Verify K8s resource event names follow the "resource:update" convention.
	resourceEvents := map[string]string{
		"EventPodsUpdate":         EventPodsUpdate,
		"EventDeploymentsUpdate":  EventDeploymentsUpdate,
		"EventStatefulSetsUpdate": EventStatefulSetsUpdate,
		"EventDaemonSetsUpdate":   EventDaemonSetsUpdate,
		"EventReplicaSetsUpdate":  EventReplicaSetsUpdate,
		"EventCronJobsUpdate":     EventCronJobsUpdate,
		"EventJobsUpdate":         EventJobsUpdate,
		"EventSecretsUpdate":      EventSecretsUpdate,
		"EventConfigMapsUpdate":   EventConfigMapsUpdate,
		"EventIngressesUpdate":    EventIngressesUpdate,
		"EventHelmReleasesUpdate": EventHelmReleasesUpdate,
	}
	for name, value := range resourceEvents {
		if value == "" {
			t.Errorf("%s is empty", name)
		}
	}

	// Verify colon-separated convention for all constants.
	allEvents := []struct {
		name  string
		value string
	}{
		{"EventPodsUpdate", EventPodsUpdate},
		{"EventDeploymentsUpdate", EventDeploymentsUpdate},
		{"EventMonitorUpdate", EventMonitorUpdate},
		{"EventResourceCountsUpdate", EventResourceCountsUpdate},
		{"EventPortForwardsUpdate", EventPortForwardsUpdate},
		{"EventConsoleOutput", EventConsoleOutput},
		{"EventHolmesAnalysisUpdate", EventHolmesAnalysisUpdate},
		{"EventHolmesAnalysisProgress", EventHolmesAnalysisProgress},
		{"EventHolmesChatStream", EventHolmesChatStream},
		{"EventHolmesDeploymentStatus", EventHolmesDeploymentStatus},
		{"EventHolmesContextProgress", EventHolmesContextProgress},
		{"EventHookStarted", EventHookStarted},
		{"EventHookCompleted", EventHookCompleted},
		{"EventDockerConnected", EventDockerConnected},
		{"EventSwarmServicesUpdate", EventSwarmServicesUpdate},
		{"EventSwarmTasksUpdate", EventSwarmTasksUpdate},
		{"EventSwarmNodesUpdate", EventSwarmNodesUpdate},
		{"EventSwarmResourceCountsUpdate", EventSwarmResourceCountsUpdate},
		{"EventSwarmMetricsUpdate", EventSwarmMetricsUpdate},
		{"EventSwarmMetricsBreakdown", EventSwarmMetricsBreakdown},
		{"EventSwarmImageUpdates", EventSwarmImageUpdates},
	}
	for _, tc := range allEvents {
		if tc.value == "" {
			t.Errorf("%s is empty", tc.name)
		}
		// All events should contain a colon separator
		found := false
		for _, c := range tc.value {
			if c == ':' {
				found = true
				break
			}
		}
		if !found {
			t.Errorf("%s = %q does not contain colon separator", tc.name, tc.value)
		}
	}
}

func TestPortForwardEvent(t *testing.T) {
	tests := []struct {
		key    string
		action string
		want   string
	}{
		{"ns/pod:8080:80", "ready", "portforward:ns/pod:8080:80:ready"},
		{"ns/pod:8080:80", "error", "portforward:ns/pod:8080:80:error"},
		{"ns/pod:8080:80", "output", "portforward:ns/pod:8080:80:output"},
		{"ns/pod:8080:80", "exit", "portforward:ns/pod:8080:80:exit"},
	}
	for _, tt := range tests {
		got := PortForwardEvent(tt.key, tt.action)
		if got != tt.want {
			t.Errorf("PortForwardEvent(%q, %q) = %q, want %q", tt.key, tt.action, got, tt.want)
		}
	}
}

func TestTerminalEvents(t *testing.T) {
	tests := []struct {
		sessionID string
		wantOut   string
		wantExit  string
	}{
		{"abc123", "terminal:abc123:output", "terminal:abc123:exit"},
		{"session-1", "terminal:session-1:output", "terminal:session-1:exit"},
	}
	for _, tt := range tests {
		gotOut := TerminalOutputEvent(tt.sessionID)
		if gotOut != tt.wantOut {
			t.Errorf("TerminalOutputEvent(%q) = %q, want %q", tt.sessionID, gotOut, tt.wantOut)
		}
		gotExit := TerminalExitEvent(tt.sessionID)
		if gotExit != tt.wantExit {
			t.Errorf("TerminalExitEvent(%q) = %q, want %q", tt.sessionID, gotExit, tt.wantExit)
		}
	}
}

func TestPodLogsEvent(t *testing.T) {
	tests := []struct {
		podName string
		want    string
	}{
		{"nginx-abc123", "podlogs:nginx-abc123"},
		{"my-pod", "podlogs:my-pod"},
	}
	for _, tt := range tests {
		got := PodLogsEvent(tt.podName)
		if got != tt.want {
			t.Errorf("PodLogsEvent(%q) = %q, want %q", tt.podName, got, tt.want)
		}
	}
}
