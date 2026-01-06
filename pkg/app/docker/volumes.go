package docker

import (
	"context"
	"time"

	"github.com/docker/docker/api/types"
	"github.com/docker/docker/api/types/filters"
	"github.com/docker/docker/api/types/mount"
	"github.com/docker/docker/api/types/swarm"
	"github.com/docker/docker/api/types/volume"
	"github.com/docker/docker/client"
)

type swarmVolumesClient interface {
	VolumeList(context.Context, volume.ListOptions) (volume.ListResponse, error)
	VolumeInspect(context.Context, string) (volume.Volume, error)
	VolumeCreate(context.Context, volume.CreateOptions) (volume.Volume, error)
	VolumeRemove(context.Context, string, bool) error
	VolumesPrune(context.Context, filters.Args) (types.VolumesPruneReport, error)
}

type swarmVolumeUsageClient interface {
	ServiceList(context.Context, types.ServiceListOptions) ([]swarm.Service, error)
}

func buildVolumeCreateOptions(name string, driver string, labels map[string]string, driverOpts map[string]string) volume.CreateOptions {
	return volume.CreateOptions{
		Name:       name,
		Driver:     driver,
		Labels:     labels,
		DriverOpts: driverOpts,
	}
}

// GetSwarmVolumes returns all Docker volumes
func GetSwarmVolumes(ctx context.Context, cli *client.Client) ([]SwarmVolumeInfo, error) {
	return getSwarmVolumes(ctx, cli)
}

func getSwarmVolumes(ctx context.Context, cli swarmVolumesClient) ([]SwarmVolumeInfo, error) {
	resp, err := cli.VolumeList(ctx, volume.ListOptions{})
	if err != nil {
		return nil, err
	}

	result := make([]SwarmVolumeInfo, 0, len(resp.Volumes))
	for _, vol := range resp.Volumes {
		info := volumeToInfo(vol)
		result = append(result, info)
	}

	return result, nil
}

// GetSwarmVolume returns a specific volume by name
func GetSwarmVolume(ctx context.Context, cli *client.Client, volumeName string) (*SwarmVolumeInfo, error) {
	return getSwarmVolume(ctx, cli, volumeName)
}

func getSwarmVolume(ctx context.Context, cli swarmVolumesClient, volumeName string) (*SwarmVolumeInfo, error) {
	vol, err := cli.VolumeInspect(ctx, volumeName)
	if err != nil {
		return nil, err
	}

	info := volumeToInfo(&vol)
	return &info, nil
}

// volumeToInfo converts a volume.Volume to SwarmVolumeInfo
func volumeToInfo(vol *volume.Volume) SwarmVolumeInfo {
	info := SwarmVolumeInfo{
		Name:       vol.Name,
		Driver:     vol.Driver,
		Scope:      vol.Scope,
		Mountpoint: vol.Mountpoint,
		Labels:     vol.Labels,
		CreatedAt:  vol.CreatedAt,
	}

	if info.Labels == nil {
		info.Labels = make(map[string]string)
	}

	return info
}

// CreateSwarmVolume creates a new Docker volume
func CreateSwarmVolume(ctx context.Context, cli *client.Client, name string, driver string, labels map[string]string, driverOpts map[string]string) (*SwarmVolumeInfo, error) {
	return createSwarmVolume(ctx, cli, name, driver, labels, driverOpts)
}

func createSwarmVolume(ctx context.Context, cli swarmVolumesClient, name string, driver string, labels map[string]string, driverOpts map[string]string) (*SwarmVolumeInfo, error) {
	options := buildVolumeCreateOptions(name, driver, labels, driverOpts)

	vol, err := cli.VolumeCreate(ctx, options)
	if err != nil {
		return nil, err
	}

	info := volumeToInfo(&vol)
	return &info, nil
}

// RemoveSwarmVolume removes a Docker volume
func RemoveSwarmVolume(ctx context.Context, cli *client.Client, volumeName string, force bool) error {
	return removeSwarmVolume(ctx, cli, volumeName, force)
}

func removeSwarmVolume(ctx context.Context, cli swarmVolumesClient, volumeName string, force bool) error {
	return cli.VolumeRemove(ctx, volumeName, force)
}

// PruneSwarmVolumes removes all unused volumes
func PruneSwarmVolumes(ctx context.Context, cli *client.Client) ([]string, uint64, error) {
	return pruneSwarmVolumes(ctx, cli)
}

func pruneSwarmVolumes(ctx context.Context, cli swarmVolumesClient) ([]string, uint64, error) {
	report, err := cli.VolumesPrune(ctx, filters.Args{})
	if err != nil {
		return nil, 0, err
	}
	return report.VolumesDeleted, report.SpaceReclaimed, nil
}

// GetSwarmVolumeUsage returns services that reference the given volume (by mount source).
func GetSwarmVolumeUsage(ctx context.Context, cli *client.Client, volumeName string) ([]SwarmServiceRef, error) {
	return getSwarmVolumeUsage(ctx, cli, volumeName)
}

func getSwarmVolumeUsage(ctx context.Context, cli swarmVolumeUsageClient, volumeName string) ([]SwarmServiceRef, error) {
	services, err := cli.ServiceList(ctx, types.ServiceListOptions{})
	if err != nil {
		return nil, err
	}

	out := make([]SwarmServiceRef, 0)
	for _, svc := range services {
		cs := svc.Spec.TaskTemplate.ContainerSpec
		if cs == nil {
			continue
		}
		for _, m := range cs.Mounts {
			if m.Type == mount.TypeVolume && m.Source == volumeName {
				out = append(out, SwarmServiceRef{ServiceID: svc.ID, ServiceName: svc.Spec.Name})
				break
			}
		}
	}
	return out, nil
}

// formatVolumeAge formats a volume creation time as an age string
func formatVolumeAge(createdAt string) string {
	t, err := time.Parse(time.RFC3339, createdAt)
	if err != nil {
		return "-"
	}
	d := time.Since(t)
	if d < 0 {
		d = 0
	}
	days := int(d.Hours() / 24)
	hours := int(d.Hours()) % 24
	minutes := int(d.Minutes()) % 60

	if days > 0 {
		return time.Now().Sub(t).Truncate(time.Hour * 24).String()
	} else if hours > 0 {
		return time.Now().Sub(t).Truncate(time.Hour).String()
	} else if minutes > 0 {
		return time.Now().Sub(t).Truncate(time.Minute).String()
	}
	return time.Now().Sub(t).Truncate(time.Second).String()
}
