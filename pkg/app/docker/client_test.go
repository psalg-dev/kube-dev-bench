package docker

import (
	"context"
	"errors"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/docker/docker/api/types"
	"github.com/docker/docker/api/types/swarm"
	"github.com/docker/docker/client"
)

type fakeConnClient struct {
	pingErr       error
	serverVersion types.Version
	serverErr     error
	swarmInfo     swarm.Swarm
	swarmErr      error
	info          types.Info
	infoErr       error
	closed        bool
}

func (f *fakeConnClient) Ping(context.Context) (types.Ping, error) { return types.Ping{}, f.pingErr }
func (f *fakeConnClient) ServerVersion(context.Context) (types.Version, error) {
	if f.serverErr != nil {
		return types.Version{}, f.serverErr
	}
	return f.serverVersion, nil
}
func (f *fakeConnClient) SwarmInspect(context.Context) (swarm.Swarm, error) {
	if f.swarmErr != nil {
		return swarm.Swarm{}, f.swarmErr
	}
	return f.swarmInfo, nil
}
func (f *fakeConnClient) Info(context.Context) (types.Info, error) {
	if f.infoErr != nil {
		return types.Info{}, f.infoErr
	}
	return f.info, nil
}
func (f *fakeConnClient) Close() error { f.closed = true; return nil }

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

func Test_createTLSHTTPClient_errorsOnInvalidCA(t *testing.T) {
	tmp := t.TempDir()
	caPath := filepath.Join(tmp, "ca.pem")
	if err := os.WriteFile(caPath, []byte("not pem"), 0600); err != nil {
		t.Fatalf("write temp CA: %v", err)
	}

	_, err := createTLSHTTPClient(DockerConfig{TLSCA: caPath, TLSVerify: true})
	if err == nil {
		t.Fatalf("expected error")
	}
}

func Test_createTLSHTTPClient_setsInsecureSkipVerifyWhenTLSVerifyFalse(t *testing.T) {
	hc, err := createTLSHTTPClient(DockerConfig{TLSVerify: false})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	tr, ok := hc.Transport.(*http.Transport)
	if !ok || tr.TLSClientConfig == nil {
		t.Fatalf("expected transport with TLS config")
	}
	if !tr.TLSClientConfig.InsecureSkipVerify {
		t.Fatalf("expected InsecureSkipVerify=true")
	}
}

func Test_NewClient_TLSBranchCallsConstructor(t *testing.T) {
	oldCtor := newDockerClientWithOpts
	oldDial := dialPipe
	defer func() { newDockerClientWithOpts = oldCtor; dialPipe = oldDial }()

	dialPipe = func(string, *time.Duration) (net.Conn, error) { return nil, errors.New("missing") }

	called := false
	newDockerClientWithOpts = func(...client.Opt) (*client.Client, error) {
		called = true
		return nil, nil
	}

	_, err := NewClient(DockerConfig{Host: "", TLSEnabled: true, TLSVerify: false})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !called {
		t.Fatalf("expected constructor called")
	}
}

func Test_NewClient_usesInjectableConstructor(t *testing.T) {
	old := newDockerClientWithOpts
	defer func() { newDockerClientWithOpts = old }()

	called := false
	newDockerClientWithOpts = func(...client.Opt) (*client.Client, error) {
		called = true
		return nil, nil
	}

	_, err := NewClient(DockerConfig{Host: "npipe:////./pipe/docker_engine", TLSEnabled: false})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !called {
		t.Fatalf("expected docker client constructor to be called")
	}
}

func Test_TestConnection_returnsDisconnectedOnClientError(t *testing.T) {
	old := newDockerConnectionClient
	defer func() { newDockerConnectionClient = old }()

	newDockerConnectionClient = func(DockerConfig) (dockerConnectionClient, error) {
		return nil, errors.New("boom")
	}

	st, err := TestConnection(context.Background(), DockerConfig{})
	if err != nil {
		t.Fatalf("unexpected err: %v", err)
	}
	if st.Connected {
		t.Fatalf("expected disconnected")
	}
	if st.Error == "" {
		t.Fatalf("expected error message")
	}
}

func Test_TestConnection_happyPathSetsSwarmAndManager(t *testing.T) {
	old := newDockerConnectionClient
	defer func() { newDockerConnectionClient = old }()

	fc := &fakeConnClient{
		serverVersion: types.Version{Version: "1.2.3"},
		swarmInfo:     swarm.Swarm{ClusterInfo: swarm.ClusterInfo{ID: "node-id"}},
		info:          types.Info{Swarm: swarm.Info{ControlAvailable: true}},
	}

	newDockerConnectionClient = func(DockerConfig) (dockerConnectionClient, error) {
		return fc, nil
	}

	st, err := TestConnection(context.Background(), DockerConfig{})
	if err != nil {
		t.Fatalf("unexpected err: %v", err)
	}
	if !st.Connected || !st.SwarmActive || !st.IsManager || st.NodeID != "node-id" {
		t.Fatalf("unexpected status: %+v", st)
	}
	if !fc.closed {
		t.Fatalf("expected client to be closed")
	}
}

func Test_isSwarmActive(t *testing.T) {
	ok := isSwarmActive(context.Background(), &fakeConnClient{swarmInfo: swarm.Swarm{ClusterInfo: swarm.ClusterInfo{ID: "x"}}})
	if !ok {
		t.Fatalf("expected true")
	}

	no := isSwarmActive(context.Background(), &fakeConnClient{swarmErr: errors.New("no swarm")})
	if no {
		t.Fatalf("expected false")
	}
}
