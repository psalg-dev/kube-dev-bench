package docker

import (
	"context"
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestDeploySwarmStack_EmptyName(t *testing.T) {
	if err := DeploySwarmStack(context.Background(), "", "yaml"); err == nil {
		t.Fatalf("expected error for empty stack name")
	}
}

func TestDeploySwarmStack_EmptyCompose(t *testing.T) {
	if err := DeploySwarmStack(context.Background(), "stack", ""); err == nil {
		t.Fatalf("expected error for empty compose yaml")
	}
}

func writeDockerShim(dir string, content string) (string, error) {
	p := filepath.Join(dir, "docker.bat")
	if err := os.WriteFile(p, []byte(content), 0755); err != nil {
		return "", err
	}
	return p, nil
}

func TestDeploySwarmStack_CommandFailure(t *testing.T) {
	tmp, err := os.MkdirTemp("", "fake-docker")
	if err != nil {
		t.Fatal(err)
	}
	defer os.RemoveAll(tmp)

	// Create a docker shim that exits with code 2
	content := "@echo off\necho fake docker\nexit /b 2\n"
	if _, err := writeDockerShim(tmp, content); err != nil {
		t.Fatal(err)
	}

	// Prepend tmp to PATH so exec finds our shim
	origPath := os.Getenv("PATH")
	os.Setenv("PATH", tmp+string(os.PathListSeparator)+origPath)
	defer os.Setenv("PATH", origPath)

	// Call function
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	err = DeploySwarmStack(ctx, "mystack", "version: '3'")
	if err == nil {
		t.Fatalf("expected error when docker shim exits non-zero")
	}
}

func TestDeploySwarmStack_CommandSuccess(t *testing.T) {
	tmp, err := os.MkdirTemp("", "fake-docker")
	if err != nil {
		t.Fatal(err)
	}
	defer os.RemoveAll(tmp)

	// Create a docker shim that exits 0
	content := "@echo off\necho fake docker success\nexit /b 0\n"
	if _, err := writeDockerShim(tmp, content); err != nil {
		t.Fatal(err)
	}

	origPath := os.Getenv("PATH")
	os.Setenv("PATH", tmp+string(os.PathListSeparator)+origPath)
	defer os.Setenv("PATH", origPath)

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := DeploySwarmStack(ctx, "mystack", "version: '3'\nservices: {}\n"); err != nil {
		t.Fatalf("expected no error, got: %v", err)
	}
}
