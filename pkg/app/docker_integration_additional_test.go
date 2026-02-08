package app

import (
	"context"
	"testing"

	"gowails/pkg/app/docker"
)

func TestDockerIntegration_NotConnectedErrors(t *testing.T) {
	dockerClientMu.Lock()
	prevClient := dockerClient
	dockerClient = nil
	dockerClientMu.Unlock()
	t.Cleanup(func() {
		dockerClientMu.Lock()
		dockerClient = prevClient
		dockerClientMu.Unlock()
	})

	app := &App{ctx: context.Background()}

	tests := []struct {
		name string
		fn   func() error
	}{
		{"GetClusterTopology", func() error { _, err := app.GetClusterTopology(); return err }},
		{"PullDockerImageLatest", func() error { return app.PullDockerImageLatest("busybox:latest", "") }},
		{"GetSwarmServices", func() error { _, err := app.GetSwarmServices(); return err }},
		{"GetSwarmService", func() error { _, err := app.GetSwarmService("svc"); return err }},
		{"ScaleSwarmService", func() error { return app.ScaleSwarmService("svc", 2) }},
		{"RemoveSwarmService", func() error { return app.RemoveSwarmService("svc") }},
		{"UpdateSwarmServiceImage", func() error { return app.UpdateSwarmServiceImage("svc", "busybox:latest") }},
		{"CheckServiceImageUpdates", func() error { _, err := app.CheckServiceImageUpdates([]string{"svc"}); return err }},
		{"RestartSwarmService", func() error { return app.RestartSwarmService("svc") }},
		{"CreateSwarmService", func() error { _, err := app.CreateSwarmService(docker.CreateServiceOptions{}); return err }},
		{"GetSwarmTasks", func() error { _, err := app.GetSwarmTasks(); return err }},
		{"GetSwarmTasksByService", func() error { _, err := app.GetSwarmTasksByService("svc"); return err }},
		{"GetSwarmTask", func() error { _, err := app.GetSwarmTask("task"); return err }},
		{"GetSwarmTaskHealthLogs", func() error { _, err := app.GetSwarmTaskHealthLogs("task"); return err }},
		{"GetSwarmNodes", func() error { _, err := app.GetSwarmNodes(); return err }},
		{"GetSwarmNode", func() error { _, err := app.GetSwarmNode("node"); return err }},
		{"UpdateSwarmNodeAvailability", func() error { return app.UpdateSwarmNodeAvailability("node", "pause") }},
		{"UpdateSwarmNodeRole", func() error { return app.UpdateSwarmNodeRole("node", "worker") }},
		{"UpdateSwarmNodeLabels", func() error { return app.UpdateSwarmNodeLabels("node", map[string]string{"k": "v"}) }},
		{"GetSwarmNodeTasks", func() error { _, err := app.GetSwarmNodeTasks("node"); return err }},
		{"RemoveSwarmNode", func() error { return app.RemoveSwarmNode("node") }},
		{"GetSwarmJoinTokens", func() error { _, err := app.GetSwarmJoinTokens(); return err }},
		{"GetSwarmNetworks", func() error { _, err := app.GetSwarmNetworks(); return err }},
		{"GetSwarmNetwork", func() error { _, err := app.GetSwarmNetwork("net"); return err }},
		{"GetSwarmNetworkServices", func() error { _, err := app.GetSwarmNetworkServices("net"); return err }},
		{"GetSwarmNetworkContainers", func() error { _, err := app.GetSwarmNetworkContainers("net"); return err }},
		{"GetSwarmNetworkInspectJSON", func() error { _, err := app.GetSwarmNetworkInspectJSON("net"); return err }},
		{"RemoveSwarmNetwork", func() error { return app.RemoveSwarmNetwork("net") }},
		{"CreateSwarmNetwork", func() error { _, err := app.CreateSwarmNetwork("net", "overlay", docker.CreateNetworkOptions{}); return err }},
		{"PruneSwarmNetworks", func() error { _, err := app.PruneSwarmNetworks(); return err }},
		{"GetSwarmConfigs", func() error { _, err := app.GetSwarmConfigs(); return err }},
		{"GetSwarmConfig", func() error { _, err := app.GetSwarmConfig("cfg"); return err }},
		{"GetSwarmConfigData", func() error { _, err := app.GetSwarmConfigData("cfg"); return err }},
		{"GetSwarmConfigInspectJSON", func() error { _, err := app.GetSwarmConfigInspectJSON("cfg"); return err }},
		{"CreateSwarmConfig", func() error { _, err := app.CreateSwarmConfig("cfg", "data", nil); return err }},
		{"CloneSwarmConfig", func() error { _, err := app.CloneSwarmConfig("cfg", "cfg-new"); return err }},
		{"GetSwarmConfigUsage", func() error { _, err := app.GetSwarmConfigUsage("cfg"); return err }},
		{"UpdateSwarmConfigData", func() error { _, err := app.UpdateSwarmConfigData("cfg", "new"); return err }},
		{"RemoveSwarmConfig", func() error { return app.RemoveSwarmConfig("cfg") }},
		{"GetSwarmSecrets", func() error { _, err := app.GetSwarmSecrets(); return err }},
		{"GetSwarmSecret", func() error { _, err := app.GetSwarmSecret("sec"); return err }},
		{"GetSwarmSecretInspectJSON", func() error { _, err := app.GetSwarmSecretInspectJSON("sec"); return err }},
		{"CreateSwarmSecret", func() error { _, err := app.CreateSwarmSecret("sec", "data", nil); return err }},
		{"CloneSwarmSecret", func() error { _, err := app.CloneSwarmSecret("sec", "sec-new", "value"); return err }},
		{"GetSwarmSecretUsage", func() error { _, err := app.GetSwarmSecretUsage("sec"); return err }},
		{"UpdateSwarmSecretData", func() error { _, err := app.UpdateSwarmSecretData("sec", "new"); return err }},
		{"RemoveSwarmSecret", func() error { return app.RemoveSwarmSecret("sec") }},
		{"GetSwarmStacks", func() error { _, err := app.GetSwarmStacks(); return err }},
		{"GetSwarmStackServices", func() error { _, err := app.GetSwarmStackServices("stack"); return err }},
		{"GetSwarmStackResources", func() error { _, err := app.GetSwarmStackResources("stack"); return err }},
		{"GetSwarmStackComposeYAML", func() error { _, err := app.GetSwarmStackComposeYAML("stack"); return err }},
		{"RollbackSwarmStack", func() error { return app.RollbackSwarmStack("stack") }},
		{"RemoveSwarmStack", func() error { return app.RemoveSwarmStack("stack") }},
		{"CreateSwarmStack", func() error { _, err := app.CreateSwarmStack("stack", "version: \"3.9\"\nservices: {}\n"); return err }},
		{"GetSwarmVolumes", func() error { _, err := app.GetSwarmVolumes(); return err }},
		{"GetSwarmVolume", func() error { _, err := app.GetSwarmVolume("vol"); return err }},
		{"GetVolumeInfo", func() error { _, err := app.GetVolumeInfo("vol"); return err }},
		{"GetSwarmVolumeInspectJSON", func() error { _, err := app.GetSwarmVolumeInspectJSON("vol"); return err }},
		{"GetSwarmVolumeUsage", func() error { _, err := app.GetSwarmVolumeUsage("vol"); return err }},
		{"RemoveSwarmVolume", func() error { return app.RemoveSwarmVolume("vol") }},
		{"CreateSwarmVolume", func() error { _, err := app.CreateSwarmVolume("vol", "local", nil, nil); return err }},
		{"PruneSwarmVolumes", func() error { _, err := app.PruneSwarmVolumes(); return err }},
		{"GetSwarmServiceLogs", func() error { _, err := app.GetSwarmServiceLogs("svc", "100"); return err }},
		{"GetSwarmTaskLogs", func() error { _, err := app.GetSwarmTaskLogs("task", "100"); return err }},
		{"GetSwarmResourceCounts", func() error { _, err := app.GetSwarmResourceCounts(); return err }},
	}

	for _, tt := range tests {
		if err := tt.fn(); err == nil {
			t.Fatalf("expected error for %s", tt.name)
		}
	}
}

func TestDockerIntegration_Defaults(t *testing.T) {
	dockerClientMu.Lock()
	prevClient := dockerClient
	dockerClient = nil
	dockerClientMu.Unlock()
	t.Cleanup(func() {
		dockerClientMu.Lock()
		dockerClient = prevClient
		dockerClientMu.Unlock()
	})

	app := &App{ctx: context.Background()}

	status, err := app.GetDockerConnectionStatus()
	if err != nil {
		t.Fatalf("GetDockerConnectionStatus error: %v", err)
	}
	if status.Connected {
		t.Fatalf("expected disconnected status")
	}
	if status.Error == "" {
		t.Fatalf("expected error message")
	}

	if host := app.GetDefaultDockerHost(); host == "" {
		t.Fatalf("expected default docker host")
	}
}

func TestEnsureImageHasRegistryHost(t *testing.T) {
	tests := []struct {
		image    string
		registry string
		want     string
	}{
		{"", "https://registry.example.com", ""},
		{"repo/app:latest", "https://registry.example.com", "registry.example.com/repo/app:latest"},
		{"registry.example.com/repo/app", "https://registry.example.com", "registry.example.com/repo/app"},
		{"localhost/repo/app", "https://registry.example.com", "localhost/repo/app"},
		{"repo/app", "not a url", "repo/app"},
	}

	for _, tt := range tests {
		if got := ensureImageHasRegistryHost(tt.image, tt.registry); got != tt.want {
			t.Fatalf("ensureImageHasRegistryHost(%q, %q) = %q, want %q", tt.image, tt.registry, got, tt.want)
		}
	}
}
