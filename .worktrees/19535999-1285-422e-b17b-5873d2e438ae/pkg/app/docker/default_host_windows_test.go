//go:build windows

package docker

import (
	"errors"
	"net"
	"testing"
	"time"
)

func Test_DefaultDockerHost_prefersDesktopLinuxPipeWhenPresent(t *testing.T) {
	old := dialPipe
	defer func() { dialPipe = old }()

	dialPipe = func(path string, _ *time.Duration) (net.Conn, error) {
		if path == `\\.\pipe\dockerDesktopLinuxEngine` {
			c1, c2 := net.Pipe()
			_ = c2.Close()
			return c1, nil
		}
		return nil, errors.New("not found")
	}

	if got := DefaultDockerHost(); got != "npipe:////./pipe/dockerDesktopLinuxEngine" {
		t.Fatalf("expected desktop-linux engine pipe host, got %q", got)
	}
}

func Test_DefaultDockerHost_fallsBackToDockerEngineWhenDesktopPipeMissing(t *testing.T) {
	old := dialPipe
	defer func() { dialPipe = old }()

	dialPipe = func(string, *time.Duration) (net.Conn, error) {
		return nil, errors.New("missing")
	}

	if got := DefaultDockerHost(); got != "npipe:////./pipe/docker_engine" {
		t.Fatalf("expected docker_engine host, got %q", got)
	}
}
