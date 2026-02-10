package docker

import (
	"context"
	"io"

	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/filters"
	"github.com/docker/docker/api/types/network"
	"github.com/docker/docker/api/types/swarm"
	"github.com/docker/docker/api/types/volume"
)

type fakeDockerClient struct {
	NetworkListFn    func(context.Context, network.ListOptions) ([]network.Summary, error)
	NetworkInspectFn func(context.Context, string, network.InspectOptions) (network.Inspect, error)
	NetworkCreateFn  func(context.Context, string, network.CreateOptions) (network.CreateResponse, error)
	NetworkRemoveFn  func(context.Context, string) error
	NetworksPruneFn  func(context.Context, filters.Args) (network.PruneReport, error)

	VolumeListFn    func(context.Context, volume.ListOptions) (volume.ListResponse, error)
	VolumeInspectFn func(context.Context, string) (volume.Volume, error)
	VolumeCreateFn  func(context.Context, volume.CreateOptions) (volume.Volume, error)
	VolumeRemoveFn  func(context.Context, string, bool) error
	VolumesPruneFn  func(context.Context, filters.Args) (volume.PruneReport, error)

	ServiceListFn           func(context.Context, swarm.ServiceListOptions) ([]swarm.Service, error)
	ServiceInspectWithRawFn func(context.Context, string, swarm.ServiceInspectOptions) (swarm.Service, []byte, error)
	ServiceCreateFn         func(context.Context, swarm.ServiceSpec, swarm.ServiceCreateOptions) (swarm.ServiceCreateResponse, error)
	ServiceUpdateFn         func(context.Context, string, swarm.Version, swarm.ServiceSpec, swarm.ServiceUpdateOptions) (swarm.ServiceUpdateResponse, error)
	ServiceRemoveFn         func(context.Context, string) error

	TaskListFn           func(context.Context, swarm.TaskListOptions) ([]swarm.Task, error)
	TaskInspectWithRawFn func(context.Context, string) (swarm.Task, []byte, error)

	NodeListFn           func(context.Context, swarm.NodeListOptions) ([]swarm.Node, error)
	NodeInspectWithRawFn func(context.Context, string) (swarm.Node, []byte, error)
	NodeUpdateFn         func(context.Context, string, swarm.Version, swarm.NodeSpec) error
	NodeRemoveFn         func(context.Context, string, swarm.NodeRemoveOptions) error

	ConfigListFn           func(context.Context, swarm.ConfigListOptions) ([]swarm.Config, error)
	ConfigInspectWithRawFn func(context.Context, string) (swarm.Config, []byte, error)
	ConfigCreateFn         func(context.Context, swarm.ConfigSpec) (swarm.ConfigCreateResponse, error)
	ConfigUpdateFn         func(context.Context, string, swarm.Version, swarm.ConfigSpec) error
	ConfigRemoveFn         func(context.Context, string) error

	SecretListFn           func(context.Context, swarm.SecretListOptions) ([]swarm.Secret, error)
	SecretInspectWithRawFn func(context.Context, string) (swarm.Secret, []byte, error)
	SecretCreateFn         func(context.Context, swarm.SecretSpec) (swarm.SecretCreateResponse, error)
	SecretRemoveFn         func(context.Context, string) error

	ContainerLogsFn    func(context.Context, string, container.LogsOptions) (io.ReadCloser, error)
	ServiceLogsFn      func(context.Context, string, container.LogsOptions) (io.ReadCloser, error)
	ContainerInspectFn func(context.Context, string) (container.InspectResponse, error)
}

func (f *fakeDockerClient) ContainerInspect(ctx context.Context, containerID string) (container.InspectResponse, error) {
	if f.ContainerInspectFn == nil {
		return container.InspectResponse{}, nil
	}
	return f.ContainerInspectFn(ctx, containerID)
}

func (f *fakeDockerClient) NetworkList(ctx context.Context, opts network.ListOptions) ([]network.Summary, error) {
	if f.NetworkListFn == nil {
		return nil, nil
	}
	return f.NetworkListFn(ctx, opts)
}

func (f *fakeDockerClient) NetworkInspect(ctx context.Context, networkID string, opts network.InspectOptions) (network.Inspect, error) {
	if f.NetworkInspectFn == nil {
		return network.Inspect{}, nil
	}
	return f.NetworkInspectFn(ctx, networkID, opts)
}

func (f *fakeDockerClient) NetworkCreate(ctx context.Context, name string, opts network.CreateOptions) (network.CreateResponse, error) {
	if f.NetworkCreateFn == nil {
		return network.CreateResponse{}, nil
	}
	return f.NetworkCreateFn(ctx, name, opts)
}

func (f *fakeDockerClient) NetworkRemove(ctx context.Context, networkID string) error {
	if f.NetworkRemoveFn == nil {
		return nil
	}
	return f.NetworkRemoveFn(ctx, networkID)
}

func (f *fakeDockerClient) NetworksPrune(ctx context.Context, args filters.Args) (network.PruneReport, error) {
	if f.NetworksPruneFn == nil {
		return network.PruneReport{}, nil
	}
	return f.NetworksPruneFn(ctx, args)
}

func (f *fakeDockerClient) VolumeList(ctx context.Context, opts volume.ListOptions) (volume.ListResponse, error) {
	if f.VolumeListFn == nil {
		return volume.ListResponse{}, nil
	}
	return f.VolumeListFn(ctx, opts)
}

func (f *fakeDockerClient) VolumeInspect(ctx context.Context, volumeName string) (volume.Volume, error) {
	if f.VolumeInspectFn == nil {
		return volume.Volume{}, nil
	}
	return f.VolumeInspectFn(ctx, volumeName)
}

func (f *fakeDockerClient) VolumeCreate(ctx context.Context, opts volume.CreateOptions) (volume.Volume, error) {
	if f.VolumeCreateFn == nil {
		return volume.Volume{}, nil
	}
	return f.VolumeCreateFn(ctx, opts)
}

func (f *fakeDockerClient) VolumeRemove(ctx context.Context, volumeName string, force bool) error {
	if f.VolumeRemoveFn == nil {
		return nil
	}
	return f.VolumeRemoveFn(ctx, volumeName, force)
}

func (f *fakeDockerClient) VolumesPrune(ctx context.Context, args filters.Args) (volume.PruneReport, error) {
	if f.VolumesPruneFn == nil {
		return volume.PruneReport{}, nil
	}
	return f.VolumesPruneFn(ctx, args)
}

func (f *fakeDockerClient) ServiceList(ctx context.Context, opts swarm.ServiceListOptions) ([]swarm.Service, error) {
	if f.ServiceListFn == nil {
		return nil, nil
	}
	return f.ServiceListFn(ctx, opts)
}

func (f *fakeDockerClient) ServiceInspectWithRaw(ctx context.Context, serviceID string, opts swarm.ServiceInspectOptions) (swarm.Service, []byte, error) {
	if f.ServiceInspectWithRawFn == nil {
		return swarm.Service{}, nil, nil
	}
	return f.ServiceInspectWithRawFn(ctx, serviceID, opts)
}

func (f *fakeDockerClient) ServiceCreate(ctx context.Context, spec swarm.ServiceSpec, opts swarm.ServiceCreateOptions) (swarm.ServiceCreateResponse, error) {
	if f.ServiceCreateFn == nil {
		return swarm.ServiceCreateResponse{}, nil
	}
	return f.ServiceCreateFn(ctx, spec, opts)
}

func (f *fakeDockerClient) ServiceUpdate(ctx context.Context, serviceID string, version swarm.Version, spec swarm.ServiceSpec, opts swarm.ServiceUpdateOptions) (swarm.ServiceUpdateResponse, error) {
	if f.ServiceUpdateFn == nil {
		return swarm.ServiceUpdateResponse{}, nil
	}
	return f.ServiceUpdateFn(ctx, serviceID, version, spec, opts)
}

func (f *fakeDockerClient) ServiceRemove(ctx context.Context, serviceID string) error {
	if f.ServiceRemoveFn == nil {
		return nil
	}
	return f.ServiceRemoveFn(ctx, serviceID)
}

func (f *fakeDockerClient) TaskList(ctx context.Context, opts swarm.TaskListOptions) ([]swarm.Task, error) {
	if f.TaskListFn == nil {
		return nil, nil
	}
	return f.TaskListFn(ctx, opts)
}

func (f *fakeDockerClient) TaskInspectWithRaw(ctx context.Context, taskID string) (swarm.Task, []byte, error) {
	if f.TaskInspectWithRawFn == nil {
		return swarm.Task{}, nil, nil
	}
	return f.TaskInspectWithRawFn(ctx, taskID)
}

func (f *fakeDockerClient) NodeList(ctx context.Context, opts swarm.NodeListOptions) ([]swarm.Node, error) {
	if f.NodeListFn == nil {
		return nil, nil
	}
	return f.NodeListFn(ctx, opts)
}

func (f *fakeDockerClient) NodeInspectWithRaw(ctx context.Context, nodeID string) (swarm.Node, []byte, error) {
	if f.NodeInspectWithRawFn == nil {
		return swarm.Node{}, nil, nil
	}
	return f.NodeInspectWithRawFn(ctx, nodeID)
}

func (f *fakeDockerClient) NodeUpdate(ctx context.Context, nodeID string, version swarm.Version, spec swarm.NodeSpec) error {
	if f.NodeUpdateFn == nil {
		return nil
	}
	return f.NodeUpdateFn(ctx, nodeID, version, spec)
}

func (f *fakeDockerClient) NodeRemove(ctx context.Context, nodeID string, opts swarm.NodeRemoveOptions) error {
	if f.NodeRemoveFn == nil {
		return nil
	}
	return f.NodeRemoveFn(ctx, nodeID, opts)
}

func (f *fakeDockerClient) ConfigList(ctx context.Context, opts swarm.ConfigListOptions) ([]swarm.Config, error) {
	if f.ConfigListFn == nil {
		return nil, nil
	}
	return f.ConfigListFn(ctx, opts)
}

func (f *fakeDockerClient) ConfigInspectWithRaw(ctx context.Context, configID string) (swarm.Config, []byte, error) {
	if f.ConfigInspectWithRawFn == nil {
		return swarm.Config{}, nil, nil
	}
	return f.ConfigInspectWithRawFn(ctx, configID)
}

func (f *fakeDockerClient) ConfigCreate(ctx context.Context, spec swarm.ConfigSpec) (swarm.ConfigCreateResponse, error) {
	if f.ConfigCreateFn == nil {
		return swarm.ConfigCreateResponse{}, nil
	}
	return f.ConfigCreateFn(ctx, spec)
}

func (f *fakeDockerClient) ConfigUpdate(ctx context.Context, configID string, version swarm.Version, spec swarm.ConfigSpec) error {
	if f.ConfigUpdateFn == nil {
		return nil
	}
	return f.ConfigUpdateFn(ctx, configID, version, spec)
}

func (f *fakeDockerClient) ConfigRemove(ctx context.Context, configID string) error {
	if f.ConfigRemoveFn == nil {
		return nil
	}
	return f.ConfigRemoveFn(ctx, configID)
}

func (f *fakeDockerClient) SecretList(ctx context.Context, opts swarm.SecretListOptions) ([]swarm.Secret, error) {
	if f.SecretListFn == nil {
		return nil, nil
	}
	return f.SecretListFn(ctx, opts)
}

func (f *fakeDockerClient) SecretInspectWithRaw(ctx context.Context, secretID string) (swarm.Secret, []byte, error) {
	if f.SecretInspectWithRawFn == nil {
		return swarm.Secret{}, nil, nil
	}
	return f.SecretInspectWithRawFn(ctx, secretID)
}

func (f *fakeDockerClient) SecretCreate(ctx context.Context, spec swarm.SecretSpec) (swarm.SecretCreateResponse, error) {
	if f.SecretCreateFn == nil {
		return swarm.SecretCreateResponse{}, nil
	}
	return f.SecretCreateFn(ctx, spec)
}

func (f *fakeDockerClient) SecretRemove(ctx context.Context, secretID string) error {
	if f.SecretRemoveFn == nil {
		return nil
	}
	return f.SecretRemoveFn(ctx, secretID)
}

func (f *fakeDockerClient) ContainerLogs(ctx context.Context, containerID string, opts container.LogsOptions) (io.ReadCloser, error) {
	if f.ContainerLogsFn == nil {
		return io.NopCloser(&emptyReader{}), nil
	}
	return f.ContainerLogsFn(ctx, containerID, opts)
}

func (f *fakeDockerClient) ServiceLogs(ctx context.Context, serviceID string, opts container.LogsOptions) (io.ReadCloser, error) {
	if f.ServiceLogsFn == nil {
		return io.NopCloser(&emptyReader{}), nil
	}
	return f.ServiceLogsFn(ctx, serviceID, opts)
}

type emptyReader struct{}

func (e *emptyReader) Read(_ []byte) (n int, err error) { return 0, io.EOF }
