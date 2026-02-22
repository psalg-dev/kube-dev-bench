//go:build windows

package docker

import (
	"net"
	"time"

	"github.com/Microsoft/go-winio"
)

var dialPipe = winio.DialPipe

func platformDefaultDockerHost() string {
	// Docker Desktop with WSL2 backend uses a different pipe
	desktopPipe := `\\.\pipe\dockerDesktopLinuxEngine`
	if pipeExists(desktopPipe) {
		return "npipe:////./pipe/dockerDesktopLinuxEngine"
	}
	// Fall back to standard Docker pipe
	return "npipe:////./pipe/docker_engine"
}

// pipeExists checks if a named pipe exists on Windows
func pipeExists(pipePath string) bool {
	conn, err := dialPipe(pipePath, nil)
	if err != nil {
		return false
	}
	_ = conn.Close()
	return true
}

// Ensure winio.DialPipe matches our injectable signature.
var _ func(string, *time.Duration) (net.Conn, error) = dialPipe
