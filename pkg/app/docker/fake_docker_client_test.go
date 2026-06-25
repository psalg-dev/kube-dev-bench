package docker

import (
	"context"
	"io"

	"github.com/moby/moby/client"
)

type fakeDockerClient struct {
	NetworkListFn    func(context.Context, client.NetworkListOptions) (client.NetworkListResult, error)
	NetworkInspectFn func(context.Context, string, client.NetworkInspectOptions) (client.NetworkInspectResult, error)
	NetworkCreateFn  func(context.Context, string, client.NetworkCreateOptions) (client.NetworkCreateResult, error)
	NetworkRemoveFn  func(context.Context, string, client.NetworkRemoveOptions) (client.NetworkRemoveResult, error)
	NetworkPruneFn  func(context.Context, client.NetworkPruneOptions) (client.NetworkPruneResult, error)

	VolumeListFn    func(context.Context, client.VolumeListOptions) (client.VolumeListResult, error)
	VolumeInspectFn func(context.Context, string, client.VolumeInspectOptions) (client.VolumeInspectResult, error)
	VolumeCreateFn  func(context.Context, client.VolumeCreateOptions) (client.VolumeCreateResult, error)
	VolumeRemoveFn  func(context.Context, string, client.VolumeRemoveOptions) (client.VolumeRemoveResult, error)
	VolumePruneFn   func(context.Context, client.VolumePruneOptions) (client.VolumePruneResult, error)

	ServiceListFn           func(context.Context, client.ServiceListOptions) (client.ServiceListResult, error)
	ServiceInspectFn        func(context.Context, string, client.ServiceInspectOptions) (client.ServiceInspectResult, error)
	ServiceInspectWithRawFn func(context.Context, string, client.ServiceInspectOptions) (client.ServiceInspectResult, error)
	ServiceCreateFn         func(context.Context, client.ServiceCreateOptions) (client.ServiceCreateResult, error)
	ServiceUpdateFn         func(context.Context, string, client.ServiceUpdateOptions) (client.ServiceUpdateResult, error)
	ServiceRemoveFn         func(context.Context, string, client.ServiceRemoveOptions) (client.ServiceRemoveResult, error)

	TaskListFn           func(context.Context, client.TaskListOptions) (client.TaskListResult, error)
	TaskInspectFn        func(context.Context, string, client.TaskInspectOptions) (client.TaskInspectResult, error)
	TaskInspectWithRawFn func(context.Context, string, client.TaskInspectOptions) (client.TaskInspectResult, error)

	NodeListFn           func(context.Context, client.NodeListOptions) (client.NodeListResult, error)
	NodeInspectFn func(context.Context, string, client.NodeInspectOptions) (client.NodeInspectResult, error)
	NodeUpdateFn         func(context.Context, string, client.NodeUpdateOptions) (client.NodeUpdateResult, error)
	NodeRemoveFn         func(context.Context, string, client.NodeRemoveOptions) (client.NodeRemoveResult, error)

	ConfigListFn           func(context.Context, client.ConfigListOptions) (client.ConfigListResult, error)
	ConfigInspectFn func(context.Context, string, client.ConfigInspectOptions) (client.ConfigInspectResult, error)
	ConfigCreateFn         func(context.Context, client.ConfigCreateOptions) (client.ConfigCreateResult, error)
	ConfigUpdateFn         func(context.Context, string, client.ConfigUpdateOptions) (client.ConfigUpdateResult, error)
	ConfigRemoveFn         func(context.Context, string, client.ConfigRemoveOptions) (client.ConfigRemoveResult, error)

	SecretListFn           func(context.Context, client.SecretListOptions) (client.SecretListResult, error)
	SecretInspectWithRawFn func(context.Context, string, client.SecretInspectOptions) (client.SecretInspectResult, error)
	SecretCreateFn         func(context.Context, client.SecretCreateOptions) (client.SecretCreateResult, error)
	SecretRemoveFn         func(context.Context, string, client.SecretRemoveOptions) (client.SecretRemoveResult, error)

	ContainerLogsFn    func(context.Context, string, client.ContainerLogsOptions) (client.ContainerLogsResult, error)
	ServiceLogsFn      func(context.Context, string, client.ServiceLogsOptions) (client.ServiceLogsResult, error)
	ContainerInspectFn func(context.Context, string, client.ContainerInspectOptions) (client.ContainerInspectResult, error)
}

func (f *fakeDockerClient) ContainerInspect(ctx context.Context, containerID string, opts client.ContainerInspectOptions) (client.ContainerInspectResult, error) {
	if f.ContainerInspectFn == nil {
		return client.ContainerInspectResult{}, nil
	}
	return f.ContainerInspectFn(ctx, containerID, opts)
}

func (f *fakeDockerClient) NetworkList(ctx context.Context, opts client.NetworkListOptions) (client.NetworkListResult, error) {
	if f.NetworkListFn == nil {
		return client.NetworkListResult{}, nil
	}
	return f.NetworkListFn(ctx, opts)
}

func (f *fakeDockerClient) NetworkInspect(ctx context.Context, networkID string, opts client.NetworkInspectOptions) (client.NetworkInspectResult, error) {
	if f.NetworkInspectFn == nil {
		return client.NetworkInspectResult{}, nil
	}
	return f.NetworkInspectFn(ctx, networkID, opts)
}

func (f *fakeDockerClient) NetworkCreate(ctx context.Context, name string, opts client.NetworkCreateOptions) (client.NetworkCreateResult, error) {
	if f.NetworkCreateFn == nil {
		return client.NetworkCreateResult{}, nil
	}
	return f.NetworkCreateFn(ctx, name, opts)
}

func (f *fakeDockerClient) NetworkRemove(ctx context.Context, networkID string, opts client.NetworkRemoveOptions) (client.NetworkRemoveResult, error) {
	if f.NetworkRemoveFn == nil {
		return client.NetworkRemoveResult{}, nil
	}
	return f.NetworkRemoveFn(ctx, networkID, opts)
}

func (f *fakeDockerClient) NetworkPrune(ctx context.Context, opts client.NetworkPruneOptions) (client.NetworkPruneResult, error) {
	if f.NetworkPruneFn == nil {
		return client.NetworkPruneResult{}, nil
	}
	return f.NetworkPruneFn(ctx, opts)
}

func (f *fakeDockerClient) VolumeList(ctx context.Context, opts client.VolumeListOptions) (client.VolumeListResult, error) {
	if f.VolumeListFn == nil {
		return client.VolumeListResult{}, nil
	}
	return f.VolumeListFn(ctx, opts)
}

func (f *fakeDockerClient) VolumeInspect(ctx context.Context, volumeName string, opts client.VolumeInspectOptions) (client.VolumeInspectResult, error) {
	if f.VolumeInspectFn == nil {
		return client.VolumeInspectResult{}, nil
	}
	return f.VolumeInspectFn(ctx, volumeName, opts)
}

func (f *fakeDockerClient) VolumeCreate(ctx context.Context, opts client.VolumeCreateOptions) (client.VolumeCreateResult, error) {
	if f.VolumeCreateFn == nil {
		return client.VolumeCreateResult{}, nil
	}
	return f.VolumeCreateFn(ctx, opts)
}

func (f *fakeDockerClient) VolumeRemove(ctx context.Context, volumeName string, opts client.VolumeRemoveOptions) (client.VolumeRemoveResult, error) {
	if f.VolumeRemoveFn == nil {
		return client.VolumeRemoveResult{}, nil
	}
	return f.VolumeRemoveFn(ctx, volumeName, opts)
}

func (f *fakeDockerClient) VolumePrune(ctx context.Context, opts client.VolumePruneOptions) (client.VolumePruneResult, error) {
	if f.VolumePruneFn == nil {
		return client.VolumePruneResult{}, nil
	}
	return f.VolumePruneFn(ctx, opts)
}

func (f *fakeDockerClient) ServiceList(ctx context.Context, opts client.ServiceListOptions) (client.ServiceListResult, error) {
	if f.ServiceListFn == nil {
		return client.ServiceListResult{}, nil
	}
	return f.ServiceListFn(ctx, opts)
}

func (f *fakeDockerClient) ServiceInspect(ctx context.Context, serviceID string, opts client.ServiceInspectOptions) (client.ServiceInspectResult, error) {
	if f.ServiceInspectFn == nil {
		return client.ServiceInspectResult{}, nil
	}
	return f.ServiceInspectFn(ctx, serviceID, opts)
}

func (f *fakeDockerClient) ServiceInspectWithRaw(ctx context.Context, serviceID string, opts client.ServiceInspectOptions) (client.ServiceInspectResult, error) {
	if f.ServiceInspectWithRawFn == nil {
		return client.ServiceInspectResult{}, nil
	}
	return f.ServiceInspectWithRawFn(ctx, serviceID, opts)
}

func (f *fakeDockerClient) ServiceCreate(ctx context.Context, opts client.ServiceCreateOptions) (client.ServiceCreateResult, error) {
	if f.ServiceCreateFn == nil {
		return client.ServiceCreateResult{}, nil
	}
	return f.ServiceCreateFn(ctx, opts)
}

func (f *fakeDockerClient) ServiceUpdate(ctx context.Context, serviceID string, opts client.ServiceUpdateOptions) (client.ServiceUpdateResult, error) {
	if f.ServiceUpdateFn == nil {
		return client.ServiceUpdateResult{}, nil
	}
	return f.ServiceUpdateFn(ctx, serviceID, opts)
}

func (f *fakeDockerClient) ServiceRemove(ctx context.Context, serviceID string, opts client.ServiceRemoveOptions) (client.ServiceRemoveResult, error) {
	if f.ServiceRemoveFn == nil {
		return client.ServiceRemoveResult{}, nil
	}
	return f.ServiceRemoveFn(ctx, serviceID, opts)
}

func (f *fakeDockerClient) TaskList(ctx context.Context, opts client.TaskListOptions) (client.TaskListResult, error) {
	if f.TaskListFn == nil {
		return client.TaskListResult{}, nil
	}
	return f.TaskListFn(ctx, opts)
}

func (f *fakeDockerClient) TaskInspect(ctx context.Context, taskID string, opts client.TaskInspectOptions) (client.TaskInspectResult, error) {
	if f.TaskInspectFn == nil {
		return client.TaskInspectResult{}, nil
	}
	return f.TaskInspectFn(ctx, taskID, opts)
}

func (f *fakeDockerClient) TaskInspectWithRaw(ctx context.Context, taskID string, opts client.TaskInspectOptions) (client.TaskInspectResult, error) {
	if f.TaskInspectWithRawFn == nil {
		return client.TaskInspectResult{}, nil
	}
	return f.TaskInspectWithRawFn(ctx, taskID, opts)
}

func (f *fakeDockerClient) NodeList(ctx context.Context, opts client.NodeListOptions) (client.NodeListResult, error) {
	if f.NodeListFn == nil {
		return client.NodeListResult{}, nil
	}
	return f.NodeListFn(ctx, opts)
}

func (f *fakeDockerClient) NodeInspect(ctx context.Context, nodeID string, opts client.NodeInspectOptions) (client.NodeInspectResult, error) {
	if f.NodeInspectFn == nil {
		return client.NodeInspectResult{}, nil
	}
	return f.NodeInspectFn(ctx, nodeID, opts)
}

func (f *fakeDockerClient) NodeUpdate(ctx context.Context, nodeID string, opts client.NodeUpdateOptions) (client.NodeUpdateResult, error) {
	if f.NodeUpdateFn == nil {
		return client.NodeUpdateResult{}, nil
	}
	return f.NodeUpdateFn(ctx, nodeID, opts)
}

func (f *fakeDockerClient) NodeRemove(ctx context.Context, nodeID string, opts client.NodeRemoveOptions) (client.NodeRemoveResult, error) {
	if f.NodeRemoveFn == nil {
		return client.NodeRemoveResult{}, nil
	}
	return f.NodeRemoveFn(ctx, nodeID, opts)
}

func (f *fakeDockerClient) ConfigList(ctx context.Context, opts client.ConfigListOptions) (client.ConfigListResult, error) {
	if f.ConfigListFn == nil {
		return client.ConfigListResult{}, nil
	}
	return f.ConfigListFn(ctx, opts)
}

func (f *fakeDockerClient) ConfigInspect(ctx context.Context, configID string, opts client.ConfigInspectOptions) (client.ConfigInspectResult, error) {
	if f.ConfigInspectFn == nil {
		return client.ConfigInspectResult{}, nil
	}
	return f.ConfigInspectFn(ctx, configID, opts)
}

func (f *fakeDockerClient) ConfigCreate(ctx context.Context, opts client.ConfigCreateOptions) (client.ConfigCreateResult, error) {
	if f.ConfigCreateFn == nil {
		return client.ConfigCreateResult{}, nil
	}
	return f.ConfigCreateFn(ctx, opts)
}

func (f *fakeDockerClient) ConfigUpdate(ctx context.Context, configID string, opts client.ConfigUpdateOptions) (client.ConfigUpdateResult, error) {
	if f.ConfigUpdateFn == nil {
		return client.ConfigUpdateResult{}, nil
	}
	return f.ConfigUpdateFn(ctx, configID, opts)
}

func (f *fakeDockerClient) ConfigRemove(ctx context.Context, configID string, opts client.ConfigRemoveOptions) (client.ConfigRemoveResult, error) {
	if f.ConfigRemoveFn == nil {
		return client.ConfigRemoveResult{}, nil
	}
	return f.ConfigRemoveFn(ctx, configID, opts)
}

func (f *fakeDockerClient) SecretList(ctx context.Context, opts client.SecretListOptions) (client.SecretListResult, error) {
	if f.SecretListFn == nil {
		return client.SecretListResult{}, nil
	}
	return f.SecretListFn(ctx, opts)
}

func (f *fakeDockerClient) SecretInspectWithRaw(ctx context.Context, secretID string, opts client.SecretInspectOptions) (client.SecretInspectResult, error) {
	if f.SecretInspectWithRawFn == nil {
		return client.SecretInspectResult{}, nil
	}
	return f.SecretInspectWithRawFn(ctx, secretID, opts)
}

func (f *fakeDockerClient) SecretCreate(ctx context.Context, opts client.SecretCreateOptions) (client.SecretCreateResult, error) {
	if f.SecretCreateFn == nil {
		return client.SecretCreateResult{}, nil
	}
	return f.SecretCreateFn(ctx, opts)
}

func (f *fakeDockerClient) SecretRemove(ctx context.Context, secretID string, opts client.SecretRemoveOptions) (client.SecretRemoveResult, error) {
	if f.SecretRemoveFn == nil {
		return client.SecretRemoveResult{}, nil
	}
	return f.SecretRemoveFn(ctx, secretID, opts)
}

func (f *fakeDockerClient) SecretInspect(ctx context.Context, secretID string, opts client.SecretInspectOptions) (client.SecretInspectResult, error) {
	if f.SecretInspectWithRawFn == nil {
		return client.SecretInspectResult{}, nil
	}
	return f.SecretInspectWithRawFn(ctx, secretID, opts)
}

func (f *fakeDockerClient) ContainerLogs(ctx context.Context, containerID string, opts client.ContainerLogsOptions) (client.ContainerLogsResult, error) {
	if f.ContainerLogsFn == nil {
		return io.NopCloser(&emptyReader{}), nil
	}
	return f.ContainerLogsFn(ctx, containerID, opts)
}

func (f *fakeDockerClient) ServiceLogs(ctx context.Context, serviceID string, opts client.ServiceLogsOptions) (client.ServiceLogsResult, error) {
	if f.ServiceLogsFn == nil {
		return io.NopCloser(&emptyReader{}), nil
	}
	return f.ServiceLogsFn(ctx, serviceID, opts)
}

type emptyReader struct{}

func (e *emptyReader) Read(_ []byte) (n int, err error) { return 0, io.EOF }
