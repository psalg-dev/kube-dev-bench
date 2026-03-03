package docker

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
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

// writeDockerShim creates a fake docker executable in dir that exits with the
// given exit code. It returns the path to the shim. On Windows it writes a
// .bat file; on Unix-like systems it writes a shell script named "docker".
func writeDockerShim(dir string, exitCode int) (string, error) {
	var p, content string
	if runtime.GOOS == "windows" {
		p = filepath.Join(dir, "docker.bat")
		content = fmt.Sprintf("@echo off\necho fake docker\nexit /b %d\n", exitCode)
	} else {
		p = filepath.Join(dir, "docker")
		content = fmt.Sprintf("#!/bin/sh\necho fake docker\nexit %d\n", exitCode)
	}
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
	if _, err := writeDockerShim(tmp, 2); err != nil {
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
	if _, err := writeDockerShim(tmp, 0); err != nil {
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
