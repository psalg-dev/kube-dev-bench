package docker

import (
	"context"
	"time"

	"github.com/moby/moby/api/types/mount"
	"github.com/moby/moby/api/types/volume"
	"github.com/moby/moby/client"
)

type swarmVolumesClient interface {
	VolumeList(context.Context, client.VolumeListOptions) (client.VolumeListResult, error)
	VolumeInspect(context.Context, string, client.VolumeInspectOptions) (client.VolumeInspectResult, error)
	VolumeCreate(context.Context, client.VolumeCreateOptions) (client.VolumeCreateResult, error)
	VolumeRemove(context.Context, string, client.VolumeRemoveOptions) (client.VolumeRemoveResult, error)
	VolumePrune(context.Context, client.VolumePruneOptions) (client.VolumePruneResult, error)
}

type swarmVolumeUsageClient interface {
	ServiceList(context.Context, client.ServiceListOptions) (client.ServiceListResult, error)
}

func buildVolumeCreateOptions(name string, driver string, labels map[string]string, driverOpts map[string]string) client.VolumeCreateOptions {
	return client.VolumeCreateOptions{
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
	resp, err := cli.VolumeList(ctx, client.VolumeListOptions{})
	if err != nil {
		return nil, err
	}

	result := make([]SwarmVolumeInfo, 0, len(resp.Items))
	for _, vol := range resp.Items {
		info := volumeToInfo(&vol)
		result = append(result, info)
	}

	return result, nil
}

// GetSwarmVolume returns a specific volume by name
func GetSwarmVolume(ctx context.Context, cli *client.Client, volumeName string) (*SwarmVolumeInfo, error) {
	return getSwarmVolume(ctx, cli, volumeName)
}

func getSwarmVolume(ctx context.Context, cli swarmVolumesClient, volumeName string) (*SwarmVolumeInfo, error) {
	volResult, err := cli.VolumeInspect(ctx, volumeName, client.VolumeInspectOptions{})
	if err != nil {
		return nil, err
	}

	info := volumeToInfo(&volResult.Volume)
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

	volResult, err := cli.VolumeCreate(ctx, options)
	if err != nil {
		return nil, err
	}

	info := volumeToInfo(&volResult.Volume)
	return &info, nil
}

// RemoveSwarmVolume removes a Docker volume
func RemoveSwarmVolume(ctx context.Context, cli *client.Client, volumeName string, force bool) error {
	return removeSwarmVolume(ctx, cli, volumeName, force)
}

func removeSwarmVolume(ctx context.Context, cli swarmVolumesClient, volumeName string, force bool) error {
	_, err := cli.VolumeRemove(ctx, volumeName, client.VolumeRemoveOptions{})
	return err
}

// PruneSwarmVolumes removes all unused volumes
func PruneSwarmVolumes(ctx context.Context, cli *client.Client) ([]string, uint64, error) {
	return pruneSwarmVolumes(ctx, cli)
}

func pruneSwarmVolumes(ctx context.Context, cli swarmVolumesClient) ([]string, uint64, error) {
	report, err := cli.VolumePrune(ctx, client.VolumePruneOptions{})
	if err != nil {
		return nil, 0, err
	}
	return report.Report.VolumesDeleted, report.Report.SpaceReclaimed, nil
}

// GetSwarmVolumeUsage returns services that reference the given volume (by mount source).
func GetSwarmVolumeUsage(ctx context.Context, cli *client.Client, volumeName string) ([]SwarmServiceRef, error) {
	return getSwarmVolumeUsage(ctx, cli, volumeName)
}

func getSwarmVolumeUsage(ctx context.Context, cli swarmVolumeUsageClient, volumeName string) ([]SwarmServiceRef, error) {
	svcResult, err := cli.ServiceList(ctx, client.ServiceListOptions{})
	if err != nil {
		return nil, err
	}

	out := make([]SwarmServiceRef, 0)
	for _, svc := range svcResult.Items {
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
		return d.Truncate(time.Hour * 24).String()
	} else if hours > 0 {
		return d.Truncate(time.Hour).String()
	} else if minutes > 0 {
		return d.Truncate(time.Minute).String()
	}
	return d.Truncate(time.Second).String()
}
