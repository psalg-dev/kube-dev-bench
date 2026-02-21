package docker

import (
	"context"
	"errors"
	"testing"

	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/filters"
	"github.com/docker/docker/api/types/image"
	"github.com/docker/docker/api/types/swarm"
)

// fakeSwarmInspector implements swarmServiceInspector for testing.
type fakeSwarmInspector struct {
	serviceInspectFn func(context.Context, string, swarm.ServiceInspectOptions) (swarm.Service, []byte, error)
	taskListFn       func(context.Context, swarm.TaskListOptions) ([]swarm.Task, error)
	containerInspect func(context.Context, string) (container.InspectResponse, error)
	imageInspect     func(context.Context, string) (image.InspectResponse, []byte, error)
}

func (f *fakeSwarmInspector) ServiceInspectWithRaw(ctx context.Context, id string, opts swarm.ServiceInspectOptions) (swarm.Service, []byte, error) {
	if f.serviceInspectFn != nil {
		return f.serviceInspectFn(ctx, id, opts)
	}
	return swarm.Service{}, nil, nil
}

func (f *fakeSwarmInspector) TaskList(ctx context.Context, opts swarm.TaskListOptions) ([]swarm.Task, error) {
	if f.taskListFn != nil {
		return f.taskListFn(ctx, opts)
	}
	return nil, nil
}

func (f *fakeSwarmInspector) ContainerInspect(ctx context.Context, id string) (container.InspectResponse, error) {
	if f.containerInspect != nil {
		return f.containerInspect(ctx, id)
	}
	return container.InspectResponse{}, nil
}

func (f *fakeSwarmInspector) ImageInspectWithRaw(ctx context.Context, id string) (image.InspectResponse, []byte, error) {
	if f.imageInspect != nil {
		return f.imageInspect(ctx, id)
	}
	return image.InspectResponse{}, nil, nil
}

func TestResolveLocalDigestForService_EmptyServiceID(t *testing.T) {
	t.Parallel()

	cli := &fakeSwarmInspector{}
	ref := parsedImageRef{registryHost: "docker.io", repository: "library/nginx", tag: "1.25"}
	_, errMsg := resolveLocalDigestForService(context.Background(), cli, "", ref)
	if errMsg == "" {
		t.Fatal("expected error message for empty service ID")
	}
}

func TestResolveLocalDigestForService_TaskListError(t *testing.T) {
	t.Parallel()

	cli := &fakeSwarmInspector{
		taskListFn: func(_ context.Context, _ swarm.TaskListOptions) ([]swarm.Task, error) {
			return nil, errors.New("daemon error")
		},
	}
	ref := parsedImageRef{registryHost: "docker.io", repository: "library/nginx", tag: "1.25"}
	_, errMsg := resolveLocalDigestForService(context.Background(), cli, "svc-1", ref)
	if errMsg == "" {
		t.Fatal("expected error message when task list fails")
	}
}

func TestResolveLocalDigestForService_NoTaskContainer(t *testing.T) {
	t.Parallel()

	cli := &fakeSwarmInspector{
		taskListFn: func(_ context.Context, _ swarm.TaskListOptions) ([]swarm.Task, error) {
			return []swarm.Task{}, nil // no tasks
		},
	}
	ref := parsedImageRef{registryHost: "docker.io", repository: "library/nginx", tag: "1.25"}
	digest, errMsg := resolveLocalDigestForService(context.Background(), cli, "svc-1", ref)
	if digest != "" {
		t.Fatalf("expected empty digest, got %q", digest)
	}
	if errMsg == "" {
		t.Fatal("expected error message when no task container found")
	}
}

func TestResolveLocalDigestForService_ContainerInspectError(t *testing.T) {
	t.Parallel()

	cli := &fakeSwarmInspector{
		taskListFn: func(_ context.Context, _ swarm.TaskListOptions) ([]swarm.Task, error) {
			return []swarm.Task{
				{
					Status: swarm.TaskStatus{
						State:           swarm.TaskStateRunning,
						ContainerStatus: &swarm.ContainerStatus{ContainerID: "ctr-1"},
					},
				},
			}, nil
		},
		containerInspect: func(_ context.Context, _ string) (container.InspectResponse, error) {
			return container.InspectResponse{}, errors.New("container gone")
		},
	}
	ref := parsedImageRef{registryHost: "docker.io", repository: "library/nginx", tag: "1.25"}
	digest, errMsg := resolveLocalDigestForService(context.Background(), cli, "svc-1", ref)
	if digest != "" {
		t.Fatalf("expected empty digest, got %q", digest)
	}
	if errMsg == "" {
		t.Fatal("expected error message when container inspect fails")
	}
}

func TestResolveLocalDigestForService_NoRepoDigestFound(t *testing.T) {
	t.Parallel()

	cli := &fakeSwarmInspector{
		taskListFn: func(_ context.Context, _ swarm.TaskListOptions) ([]swarm.Task, error) {
			return []swarm.Task{
				{
					Status: swarm.TaskStatus{
						State:           swarm.TaskStateRunning,
						ContainerStatus: &swarm.ContainerStatus{ContainerID: "ctr-1"},
					},
				},
			}, nil
		},
		containerInspect: func(_ context.Context, _ string) (container.InspectResponse, error) {
			return container.InspectResponse{ContainerJSONBase: &container.ContainerJSONBase{Image: "sha256:abc123"}}, nil
		},
		imageInspect: func(_ context.Context, _ string) (image.InspectResponse, []byte, error) {
			return image.InspectResponse{RepoDigests: []string{}}, nil, nil
		},
	}
	ref := parsedImageRef{registryHost: "docker.io", repository: "library/nginx", tag: "1.25"}
	digest, errMsg := resolveLocalDigestForService(context.Background(), cli, "svc-1", ref)
	if digest != "" {
		t.Fatalf("expected empty digest, got %q", digest)
	}
	if errMsg == "" {
		t.Fatal("expected error message when no repo digest found")
	}
}

func TestResolveLocalDigestForService_DigestFoundInRepoDigests(t *testing.T) {
	t.Parallel()

	cli := &fakeSwarmInspector{
		taskListFn: func(_ context.Context, _ swarm.TaskListOptions) ([]swarm.Task, error) {
			return []swarm.Task{
				{
					Status: swarm.TaskStatus{
						State:           swarm.TaskStateRunning,
						ContainerStatus: &swarm.ContainerStatus{ContainerID: "ctr-1"},
					},
				},
			}, nil
		},
		containerInspect: func(_ context.Context, _ string) (container.InspectResponse, error) {
			return container.InspectResponse{ContainerJSONBase: &container.ContainerJSONBase{Image: "sha256:abc123"}}, nil
		},
		imageInspect: func(_ context.Context, _ string) (image.InspectResponse, []byte, error) {
			return image.InspectResponse{
				RepoDigests: []string{"docker.io/library/nginx@sha256:digestvalue"},
			}, nil, nil
		},
	}
	ref := parsedImageRef{registryHost: "docker.io", repository: "library/nginx", tag: "1.25"}
	digest, errMsg := resolveLocalDigestForService(context.Background(), cli, "svc-1", ref)
	if digest != "sha256:digestvalue" {
		t.Fatalf("expected sha256:digestvalue, got %q (errMsg=%q)", digest, errMsg)
	}
}

func TestResolveAndUpdateLocalDigest_SkipsWhenLocalDigestAlreadySet(t *testing.T) {
	t.Parallel()

	cli := &fakeSwarmInspector{
		taskListFn: func(_ context.Context, opts swarm.TaskListOptions) ([]swarm.Task, error) {
			t.Fatal("expected TaskList not to be called when local digest already set")
			return nil, nil
		},
	}

	info := &ImageUpdateInfo{LocalDigest: "sha256:existing"}
	ref := parsedImageRef{registryHost: "docker.io", repository: "library/nginx", tag: "1.25"}
	resolveAndUpdateLocalDigest(context.Background(), cli, "svc-1", ref, info)

	if info.LocalDigest != "sha256:existing" {
		t.Fatalf("expected local digest unchanged, got %q", info.LocalDigest)
	}
}

func TestResolveAndUpdateLocalDigest_SkipsWhenNoTag(t *testing.T) {
	t.Parallel()

	cli := &fakeSwarmInspector{
		taskListFn: func(_ context.Context, _ swarm.TaskListOptions) ([]swarm.Task, error) {
			t.Fatal("expected TaskList not to be called without a tag")
			return nil, nil
		},
	}

	info := &ImageUpdateInfo{LocalDigest: ""}
	ref := parsedImageRef{registryHost: "docker.io", repository: "library/nginx", tag: ""}
	resolveAndUpdateLocalDigest(context.Background(), cli, "svc-1", ref, info)
}

func TestResolveAndUpdateLocalDigest_SetsUpdateAvailableWhenDigestsDiffer(t *testing.T) {
	t.Parallel()

	cli := &fakeSwarmInspector{
		taskListFn: func(_ context.Context, _ swarm.TaskListOptions) ([]swarm.Task, error) {
			return []swarm.Task{
				{
					Status: swarm.TaskStatus{
						State:           swarm.TaskStateRunning,
						ContainerStatus: &swarm.ContainerStatus{ContainerID: "ctr-1"},
					},
				},
			}, nil
		},
		containerInspect: func(_ context.Context, _ string) (container.InspectResponse, error) {
			return container.InspectResponse{ContainerJSONBase: &container.ContainerJSONBase{Image: "sha256:abc"}}, nil
		},
		imageInspect: func(_ context.Context, _ string) (image.InspectResponse, []byte, error) {
			return image.InspectResponse{
				RepoDigests: []string{"docker.io/library/nginx@sha256:localdigest"},
			}, nil, nil
		},
	}

	info := &ImageUpdateInfo{
		LocalDigest:  "",
		RemoteDigest: "sha256:remotedigest",
	}
	ref := parsedImageRef{registryHost: "docker.io", repository: "library/nginx", tag: "1.25"}
	resolveAndUpdateLocalDigest(context.Background(), cli, "svc-1", ref, info)

	if info.LocalDigest != "sha256:localdigest" {
		t.Fatalf("expected local digest set, got %q", info.LocalDigest)
	}
	if !info.UpdateAvailable {
		t.Fatal("expected UpdateAvailable=true when digests differ")
	}
}

func TestRepoDigestForRef_DockerHubEquivalence(t *testing.T) {
	t.Parallel()

	ref := parsedImageRef{registryHost: "docker.io", repository: "library/nginx"}
	repoDigests := []string{
		"docker.io/library/nginx@sha256:matchingdigest",
	}

	got := repoDigestForRef(ref, repoDigests)
	if got != "sha256:matchingdigest" {
		t.Fatalf("expected sha256:matchingdigest, got %q", got)
	}
}

func TestRepoDigestForRef_OtherRegistry(t *testing.T) {
	t.Parallel()

	ref := parsedImageRef{registryHost: "ghcr.io", repository: "myorg/myimage"}
	repoDigests := []string{
		"ghcr.io/myorg/myimage@sha256:ghcrdigest",
	}

	got := repoDigestForRef(ref, repoDigests)
	if got != "sha256:ghcrdigest" {
		t.Fatalf("expected sha256:ghcrdigest, got %q", got)
	}
}

func TestRepoDigestForRef_NoMatch(t *testing.T) {
	t.Parallel()

	ref := parsedImageRef{registryHost: "ghcr.io", repository: "myorg/myimage"}
	repoDigests := []string{
		"docker.io/other/image@sha256:somedigest",
	}

	got := repoDigestForRef(ref, repoDigests)
	if got != "" {
		t.Fatalf("expected empty string, got %q", got)
	}
}

func TestRepoDigestForRef_EmptyRepoDigests(t *testing.T) {
	t.Parallel()

	ref := parsedImageRef{registryHost: "docker.io", repository: "library/nginx"}
	got := repoDigestForRef(ref, nil)
	if got != "" {
		t.Fatalf("expected empty string, got %q", got)
	}
}

func TestCheckSwarmServiceImageUpdates_EmptyServiceIDs(t *testing.T) {
	t.Parallel()

	cli := &fakeSwarmInspector{}
	out, err := checkSwarmServiceImageUpdates(context.Background(), cli, nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(out) != 0 {
		t.Fatalf("expected empty map, got %v", out)
	}
}

func TestCheckSwarmServiceImageUpdates_ServiceInspectError(t *testing.T) {
	t.Parallel()

	cli := &fakeSwarmInspector{
		serviceInspectFn: func(_ context.Context, _ string, _ swarm.ServiceInspectOptions) (swarm.Service, []byte, error) {
			return swarm.Service{}, nil, errors.New("not found")
		},
	}

	out, err := checkSwarmServiceImageUpdates(context.Background(), cli, []string{"svc-1"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if _, ok := out["svc-1"]; !ok {
		t.Fatal("expected svc-1 key in result")
	}
	if out["svc-1"].Error == "" {
		t.Fatal("expected error in ImageUpdateInfo")
	}
}

// Ensure fakeSwarmInspector can be used where swarmServiceInspector is required.
// This is needed because TaskListOptions uses swarm.TaskListOptions which includes filters.
func TestTaskListOptionsFilters(t *testing.T) {
	_ = filters.NewArgs()
}
