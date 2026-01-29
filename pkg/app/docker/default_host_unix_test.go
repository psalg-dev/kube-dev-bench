//go:build !windows

package docker

import (
	"testing"
)

func TestPlatformDefaultDockerHost_Unix(t *testing.T) {
	host := platformDefaultDockerHost()
	expected := "unix:///var/run/docker.sock"
	if host != expected {
		t.Errorf("expected %s, got %s", expected, host)
	}
}
