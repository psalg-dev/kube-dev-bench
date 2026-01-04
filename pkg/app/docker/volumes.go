package docker

import (
	"context"
	"time"

	"github.com/docker/docker/api/types/filters"
	"github.com/docker/docker/api/types/volume"
	"github.com/docker/docker/client"
)

// GetSwarmVolumes returns all Docker volumes
func GetSwarmVolumes(ctx context.Context, cli *client.Client) ([]SwarmVolumeInfo, error) {
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
	vol, err := cli.VolumeInspect(ctx, volumeName)
	if err != nil {
		return nil, err
	}

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
	options := volume.CreateOptions{
		Name:       name,
		Driver:     driver,
		Labels:     labels,
		DriverOpts: driverOpts,
	}

	vol, err := cli.VolumeCreate(ctx, options)
	if err != nil {
		return nil, err
	}

	info := SwarmVolumeInfo{
		Name:       vol.Name,
		Driver:     vol.Driver,
		Scope:      vol.Scope,
		Mountpoint: vol.Mountpoint,
		Labels:     vol.Labels,
		CreatedAt:  vol.CreatedAt,
	}

	return &info, nil
}

// RemoveSwarmVolume removes a Docker volume
func RemoveSwarmVolume(ctx context.Context, cli *client.Client, volumeName string, force bool) error {
	return cli.VolumeRemove(ctx, volumeName, force)
}

// PruneSwarmVolumes removes all unused volumes
func PruneSwarmVolumes(ctx context.Context, cli *client.Client) ([]string, uint64, error) {
	report, err := cli.VolumesPrune(ctx, filters.Args{})
	if err != nil {
		return nil, 0, err
	}
	return report.VolumesDeleted, report.SpaceReclaimed, nil
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
