package docker

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
)

// DeploySwarmStack deploys a stack using the local Docker CLI.
// Docker does not expose a native "stack" API; stacks are managed via docker CLI.
// The composeYAML is written to a temporary file and passed to `docker stack deploy -c`.
func DeploySwarmStack(ctx context.Context, stackName string, composeYAML string) error {
	if stackName == "" {
		return fmt.Errorf("stack name is required")
	}
	if composeYAML == "" {
		return fmt.Errorf("compose yaml is required")
	}

	// Write compose to a temp file so it works across platforms.
	tmpDir := os.TempDir()
	file, err := os.CreateTemp(tmpDir, "kube-dev-bench-stack-*.yaml")
	if err != nil {
		return err
	}
	path := file.Name()
	defer func() { _ = os.Remove(path) }()

	if _, err := file.WriteString(composeYAML); err != nil {
		_ = file.Close()
		return err
	}
	if err := file.Close(); err != nil {
		return err
	}

	// Ensure we pass an absolute path for Windows.
	absPath, err := filepath.Abs(path)
	if err != nil {
		absPath = path
	}

	cmd := exec.CommandContext(ctx, "docker", "stack", "deploy", "-c", absPath, stackName)
	out, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("docker stack deploy failed: %w: %s", err, string(out))
	}
	return nil
}
