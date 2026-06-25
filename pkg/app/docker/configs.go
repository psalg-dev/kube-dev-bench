package docker

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/moby/moby/api/types/swarm"
	"github.com/moby/moby/client"
)

var swarmConfigNowUTC = func() time.Time { return time.Now().UTC() }

type swarmConfigsClient interface {
	ConfigList(context.Context, client.ConfigListOptions) (client.ConfigListResult, error)
	ConfigInspect(context.Context, string, client.ConfigInspectOptions) (client.ConfigInspectResult, error)
	ConfigCreate(context.Context, client.ConfigCreateOptions) (client.ConfigCreateResult, error)
	ConfigUpdate(context.Context, string, client.ConfigUpdateOptions) (client.ConfigUpdateResult, error)
	ConfigRemove(context.Context, string, client.ConfigRemoveOptions) (client.ConfigRemoveResult, error)
}

type swarmConfigEditClient interface {
	swarmConfigsClient
	ServiceList(context.Context, client.ServiceListOptions) (client.ServiceListResult, error)
	ServiceInspect(context.Context, string, client.ServiceInspectOptions) (client.ServiceInspectResult, error)
	ServiceUpdate(context.Context, string, client.ServiceUpdateOptions) (client.ServiceUpdateResult, error)
}

// GetSwarmConfigs returns all Swarm configs
func GetSwarmConfigs(ctx context.Context, cli *client.Client) ([]SwarmConfigInfo, error) {
	return getSwarmConfigs(ctx, cli)
}

func getSwarmConfigs(ctx context.Context, cli swarmConfigsClient) ([]SwarmConfigInfo, error) {
	configsResult, err := cli.ConfigList(ctx, client.ConfigListOptions{})
	if err != nil {
		return nil, err
	}
	configs := configsResult.Items

	result := make([]SwarmConfigInfo, 0, len(configs))
	for _, cfg := range configs {
		info := configToInfo(cfg)
		result = append(result, info)
	}

	return result, nil
}

// GetSwarmConfig returns a specific Swarm config by ID or name
func GetSwarmConfig(ctx context.Context, cli *client.Client, configID string) (*SwarmConfigInfo, error) {
	return getSwarmConfig(ctx, cli, configID)
}

func getSwarmConfig(ctx context.Context, cli swarmConfigsClient, configID string) (*SwarmConfigInfo, error) {
	cfgResult, err := cli.ConfigInspect(ctx, configID, client.ConfigInspectOptions{})
	if err != nil {
		return nil, err
	}

	info := configToInfo(cfgResult.Config)
	return &info, nil
}

// GetSwarmConfigData returns the data content of a Swarm config
func GetSwarmConfigData(ctx context.Context, cli *client.Client, configID string) ([]byte, error) {
	return getSwarmConfigData(ctx, cli, configID)
}

func getSwarmConfigData(ctx context.Context, cli swarmConfigsClient, configID string) ([]byte, error) {
	cfgResult, err := cli.ConfigInspect(ctx, configID, client.ConfigInspectOptions{})
	if err != nil {
		return nil, err
	}
	return cfgResult.Config.Spec.Data, nil
}

// configToInfo converts a swarm.Config to SwarmConfigInfo
func configToInfo(cfg swarm.Config) SwarmConfigInfo {
	info := SwarmConfigInfo{
		ID:        cfg.ID,
		Name:      cfg.Spec.Name,
		CreatedAt: cfg.CreatedAt.Format(time.RFC3339),
		UpdatedAt: cfg.UpdatedAt.Format(time.RFC3339),
		DataSize:  len(cfg.Spec.Data),
		Labels:    cfg.Spec.Labels,
	}

	if info.Labels == nil {
		info.Labels = make(map[string]string)
	}

	return info
}

// CreateSwarmConfig creates a new Swarm config
func CreateSwarmConfig(ctx context.Context, cli *client.Client, name string, data []byte, labels map[string]string) (string, error) {
	return createSwarmConfig(ctx, cli, name, data, labels)
}

func createSwarmConfig(ctx context.Context, cli swarmConfigsClient, name string, data []byte, labels map[string]string) (string, error) {
	spec := swarm.ConfigSpec{
		Annotations: swarm.Annotations{
			Name:   name,
			Labels: labels,
		},
		Data: data,
	}

	resp, err := cli.ConfigCreate(ctx, client.ConfigCreateOptions{Spec: spec})
	if err != nil {
		return "", err
	}
	return resp.ID, nil
}

// UpdateSwarmConfig updates a Swarm config (note: configs are immutable, this creates a new version)
func UpdateSwarmConfig(ctx context.Context, cli *client.Client, configID string, newData []byte) error {
	return updateSwarmConfig(ctx, cli, configID, newData)
}

func updateSwarmConfig(ctx context.Context, cli swarmConfigsClient, configID string, newData []byte) error {
	// Get the current config
	cfgResult, err := cli.ConfigInspect(ctx, configID, client.ConfigInspectOptions{})
	if err != nil {
		return err
	}

	// Update the config spec
	cfgResult.Config.Spec.Data = newData

	_, err = cli.ConfigUpdate(ctx, configID, client.ConfigUpdateOptions{Version: cfgResult.Config.Version, Spec: cfgResult.Config.Spec})
	return err
}

// GetSwarmConfigUsage returns services that reference the given config (by ID or name).
func GetSwarmConfigUsage(ctx context.Context, cli *client.Client, configID string) ([]SwarmServiceRef, error) {
	return getSwarmConfigUsage(ctx, cli, configID)
}

func getSwarmConfigUsage(ctx context.Context, cli swarmConfigEditClient, configID string) ([]SwarmServiceRef, error) {
	cfgResult, err := cli.ConfigInspect(ctx, configID, client.ConfigInspectOptions{})
	if err != nil {
		return nil, err
	}
	configName := cfgResult.Config.Spec.Name

	servicesResult, err := cli.ServiceList(ctx, client.ServiceListOptions{})
	if err != nil {
		return nil, err
	}
	services := servicesResult.Items

	out := make([]SwarmServiceRef, 0)
	for _, svc := range services {
		if serviceReferencesConfig(svc, configID, configName) {
			out = append(out, SwarmServiceRef{ServiceID: svc.ID, ServiceName: svc.Spec.Name})
		}
	}
	return out, nil
}

// UpdateSwarmConfigDataImmutable performs an "edit" of a config by creating a new config
// (timestamp-suffixed name), updating all referencing services, then deleting the old config.
func UpdateSwarmConfigDataImmutable(ctx context.Context, cli *client.Client, configID string, newData []byte) (*SwarmConfigUpdateResult, error) {
	return updateSwarmConfigDataImmutable(ctx, cli, configID, newData)
}

func updateSwarmConfigDataImmutable(ctx context.Context, cli swarmConfigEditClient, configID string, newData []byte) (*SwarmConfigUpdateResult, error) {
	oldCfg, err := cli.ConfigInspect(ctx, configID, client.ConfigInspectOptions{})
	if err != nil {
		return nil, err
	}
	oldName := oldCfg.Config.Spec.Name

	// Create a new config with timestamp-suffixed name.
	stamp := swarmConfigNowUTC().Format("2006-01-02T150405Z")
	newName := swarmTimestampedName(oldName, stamp)
	newSpec := oldCfg.Config.Spec
	newSpec.Annotations.Name = newName
	newSpec.Data = newData

	createResp, err := cli.ConfigCreate(ctx, client.ConfigCreateOptions{Spec: newSpec})
	if err != nil {
		return nil, err
	}

	result := &SwarmConfigUpdateResult{
		OldConfigID:   oldCfg.Config.ID,
		OldConfigName: oldName,
		NewConfigID:   createResp.ID,
		NewConfigName: newName,
		Updated:       []SwarmServiceRef{},
	}

	// Migrate all services referencing old config.
	servicesResult, err := cli.ServiceList(ctx, client.ServiceListOptions{})
	if err != nil {
		return nil, err
	}
	services := servicesResult.Items

	var updateErrs []string
	for _, svc := range services {
		if !serviceReferencesConfig(svc, oldCfg.Config.ID, oldName) {
			continue
		}
		inspected, err := cli.ServiceInspect(ctx, svc.ID, client.ServiceInspectOptions{})
		if err != nil {
			updateErrs = append(updateErrs, fmt.Sprintf("inspect %s: %v", svc.Spec.Name, err))
			continue
		}
		changed := replaceServiceConfigRefs(&inspected.Service.Spec, oldCfg.Config.ID, oldName, createResp.ID, newName)
		if !changed {
			continue
		}
		// Ensure tasks roll if Docker doesn't consider config ref a task template change.
		inspected.Service.Spec.TaskTemplate.ForceUpdate++
		_, err = cli.ServiceUpdate(ctx, inspected.Service.ID, client.ServiceUpdateOptions{Version: inspected.Service.Version, Spec: inspected.Service.Spec})
		if err != nil {
			updateErrs = append(updateErrs, fmt.Sprintf("update %s: %v", inspected.Service.Spec.Name, err))
			continue
		}
		result.Updated = append(result.Updated, SwarmServiceRef{ServiceID: inspected.Service.ID, ServiceName: inspected.Service.Spec.Name})
	}

	if len(updateErrs) > 0 {
		// Best-effort: do NOT delete the old config if we couldn't migrate all services.
		// Caller can decide what to do; new config remains created.
		return nil, fmt.Errorf("created new config %q but failed to migrate all services: %s", newName, strings.Join(updateErrs, "; "))
	}

	// Delete old config after successful migration.
	if _, err := cli.ConfigRemove(ctx, oldCfg.Config.ID, client.ConfigRemoveOptions{}); err != nil {
		return nil, fmt.Errorf("migrated services to %q but failed to delete old config %q: %w", newName, oldName, err)
	}

	return result, nil
}

func serviceReferencesConfig(svc swarm.Service, configID, configName string) bool {
	cs := svc.Spec.TaskTemplate.ContainerSpec
	if cs == nil {
		return false
	}
	if len(cs.Configs) == 0 {
		return false
	}
	for _, ref := range cs.Configs {
		if ref.ConfigID == configID || (configName != "" && ref.ConfigName == configName) {
			return true
		}
	}
	return false
}

func replaceServiceConfigRefs(spec *swarm.ServiceSpec, oldID, oldName, newID, newName string) bool {
	cs := spec.TaskTemplate.ContainerSpec
	if cs == nil {
		return false
	}
	changed := false
	for i := range cs.Configs {
		ref := cs.Configs[i]
		if ref.ConfigID == oldID || (oldName != "" && ref.ConfigName == oldName) {
			cs.Configs[i].ConfigID = newID
			cs.Configs[i].ConfigName = newName
			changed = true
		}
	}
	return changed
}

// RemoveSwarmConfig removes a Swarm config
func RemoveSwarmConfig(ctx context.Context, cli *client.Client, configID string) error {
	return removeSwarmConfig(ctx, cli, configID)
}

func removeSwarmConfig(ctx context.Context, cli swarmConfigsClient, configID string) error {
	_, err := cli.ConfigRemove(ctx, configID, client.ConfigRemoveOptions{})
	return err
}
