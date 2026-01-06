//go:build !windows

package docker

func platformDefaultDockerHost() string {
	return "unix:///var/run/docker.sock"
}
