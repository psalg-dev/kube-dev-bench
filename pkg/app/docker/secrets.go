package docker

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/moby/moby/api/types/swarm"
	"github.com/moby/moby/client"
)

var swarmSecretNowUTC = func() time.Time { return time.Now().UTC() }

type swarmSecretsClient interface {
	SecretList(context.Context, client.SecretListOptions) (client.SecretListResult, error)
	SecretInspect(context.Context, string, client.SecretInspectOptions) (client.SecretInspectResult, error)
	SecretCreate(context.Context, client.SecretCreateOptions) (client.SecretCreateResult, error)
	SecretRemove(context.Context, string, client.SecretRemoveOptions) (client.SecretRemoveResult, error)
}

type swarmSecretEditClient interface {
	swarmSecretsClient
	ServiceList(context.Context, client.ServiceListOptions) (client.ServiceListResult, error)
	ServiceInspect(context.Context, string, client.ServiceInspectOptions) (client.ServiceInspectResult, error)
	ServiceUpdate(context.Context, string, client.ServiceUpdateOptions) (client.ServiceUpdateResult, error)
}

// GetSwarmSecrets returns all Swarm secrets (metadata only, not the actual secret data)
func GetSwarmSecrets(ctx context.Context, cli *client.Client) ([]SwarmSecretInfo, error) {
	return getSwarmSecrets(ctx, cli)
}

func getSwarmSecrets(ctx context.Context, cli swarmSecretsClient) ([]SwarmSecretInfo, error) {
	secretResult, err := cli.SecretList(ctx, client.SecretListOptions{})
	if err != nil {
		return nil, err
	}

	result := make([]SwarmSecretInfo, 0, len(secretResult.Items))
	for _, secret := range secretResult.Items {
		info := secretToInfo(secret)
		result = append(result, info)
	}

	return result, nil
}

// GetSwarmSecret returns a specific Swarm secret by ID or name (metadata only)
func GetSwarmSecret(ctx context.Context, cli *client.Client, secretID string) (*SwarmSecretInfo, error) {
	return getSwarmSecret(ctx, cli, secretID)
}

func getSwarmSecret(ctx context.Context, cli swarmSecretsClient, secretID string) (*SwarmSecretInfo, error) {
	result, err := cli.SecretInspect(ctx, secretID, client.SecretInspectOptions{})
	if err != nil {
		return nil, err
	}

	info := secretToInfo(result.Secret)
	return &info, nil
}

// secretToInfo converts a swarm.Secret to SwarmSecretInfo
func secretToInfo(secret swarm.Secret) SwarmSecretInfo {
	info := SwarmSecretInfo{
		ID:        secret.ID,
		Name:      secret.Spec.Name,
		CreatedAt: secret.CreatedAt.Format(time.RFC3339),
		UpdatedAt: secret.UpdatedAt.Format(time.RFC3339),
		Labels:    secret.Spec.Labels,
	}

	if secret.Spec.Driver != nil {
		info.DriverName = secret.Spec.Driver.Name
		info.DriverOptions = secret.Spec.Driver.Options
	}
	if info.DriverOptions == nil {
		info.DriverOptions = make(map[string]string)
	}

	if info.Labels == nil {
		info.Labels = make(map[string]string)
	}

	return info
}

// CreateSwarmSecret creates a new Swarm secret
func CreateSwarmSecret(ctx context.Context, cli *client.Client, name string, data []byte, labels map[string]string) (string, error) {
	return createSwarmSecret(ctx, cli, name, data, labels)
}

func createSwarmSecret(ctx context.Context, cli swarmSecretsClient, name string, data []byte, labels map[string]string) (string, error) {
	options := client.SecretCreateOptions{
		Spec: swarm.SecretSpec{
			Annotations: swarm.Annotations{
				Name:   name,
				Labels: labels,
			},
			Data: data,
		},
	}

	resp, err := cli.SecretCreate(ctx, options)
	if err != nil {
		return "", err
	}
	return resp.ID, nil
}

// RemoveSwarmSecret removes a Swarm secret
func RemoveSwarmSecret(ctx context.Context, cli *client.Client, secretID string) error {
	return removeSwarmSecret(ctx, cli, secretID)
}

func removeSwarmSecret(ctx context.Context, cli swarmSecretsClient, secretID string) error {
	_, err := cli.SecretRemove(ctx, secretID, client.SecretRemoveOptions{})
	return err
}

// GetSwarmSecretUsage returns services that reference the given secret (by ID or name).
func GetSwarmSecretUsage(ctx context.Context, cli *client.Client, secretID string) ([]SwarmServiceRef, error) {
	return getSwarmSecretUsage(ctx, cli, secretID)
}

func getSwarmSecretUsage(ctx context.Context, cli swarmSecretEditClient, secretID string) ([]SwarmServiceRef, error) {
	secResult, err := cli.SecretInspect(ctx, secretID, client.SecretInspectOptions{})
	if err != nil {
		return nil, err
	}
	secretName := secResult.Secret.Spec.Name

	svcResult, err := cli.ServiceList(ctx, client.ServiceListOptions{})
	if err != nil {
		return nil, err
	}
	services := svcResult.Items

	out := make([]SwarmServiceRef, 0)
	for _, svc := range services {
		if serviceReferencesSecret(svc, secretID, secretName) {
			out = append(out, SwarmServiceRef{ServiceID: svc.ID, ServiceName: svc.Spec.Name})
		}
	}
	return out, nil
}

// UpdateSwarmSecretDataImmutable performs an "edit" of a secret by creating a new secret
// (timestamp-suffixed name), updating all referencing services, then deleting the old secret.
func UpdateSwarmSecretDataImmutable(ctx context.Context, cli *client.Client, secretID string, newData []byte) (*SwarmSecretUpdateResult, error) {
	return updateSwarmSecretDataImmutable(ctx, cli, secretID, newData)
}

func updateSwarmSecretDataImmutable(ctx context.Context, cli swarmSecretEditClient, secretID string, newData []byte) (*SwarmSecretUpdateResult, error) {
	oldResult, err := cli.SecretInspect(ctx, secretID, client.SecretInspectOptions{})
	if err != nil {
		return nil, err
	}
	oldName := oldResult.Secret.Spec.Name

	stamp := swarmSecretNowUTC().Format("2006-01-02T150405Z")
	newName := swarmTimestampedName(oldName, stamp)
	newSpec := oldResult.Secret.Spec
	newSpec.Annotations.Name = newName
	newSpec.Data = newData

	createResp, err := cli.SecretCreate(ctx, client.SecretCreateOptions{Spec: newSpec})
	if err != nil {
		return nil, err
	}

	result := &SwarmSecretUpdateResult{
		OldSecretID:   oldResult.Secret.ID,
		OldSecretName: oldName,
		NewSecretID:   createResp.ID,
		NewSecretName: newName,
		Updated:       []SwarmServiceRef{},
	}

	svcResult, err := cli.ServiceList(ctx, client.ServiceListOptions{})
	if err != nil {
		return nil, err
	}

	var updateErrs []string
	for _, svc := range svcResult.Items {
		if !serviceReferencesSecret(svc, oldResult.Secret.ID, oldName) {
			continue
		}
		inspectResult, err := cli.ServiceInspect(ctx, svc.ID, client.ServiceInspectOptions{})
		if err != nil {
			updateErrs = append(updateErrs, fmt.Sprintf("inspect %s: %v", svc.Spec.Name, err))
			continue
		}
		changed := replaceServiceSecretRefs(&inspectResult.Service.Spec, oldResult.Secret.ID, oldName, createResp.ID, newName)
		if !changed {
			continue
		}
		inspectResult.Service.Spec.TaskTemplate.ForceUpdate++
		_, err = cli.ServiceUpdate(ctx, inspectResult.Service.ID, client.ServiceUpdateOptions{Version: inspectResult.Service.Version, Spec: inspectResult.Service.Spec})
		if err != nil {
			updateErrs = append(updateErrs, fmt.Sprintf("update %s: %v", inspectResult.Service.Spec.Name, err))
			continue
		}
		result.Updated = append(result.Updated, SwarmServiceRef{ServiceID: inspectResult.Service.ID, ServiceName: inspectResult.Service.Spec.Name})
	}

	if len(updateErrs) > 0 {
		return nil, fmt.Errorf("created new secret %q but failed to migrate all services: %s", newName, strings.Join(updateErrs, "; "))
	}

	if _, err := cli.SecretRemove(ctx, oldResult.Secret.ID, client.SecretRemoveOptions{}); err != nil {
		return nil, fmt.Errorf("migrated services to %q but failed to delete old secret %q: %w", newName, oldName, err)
	}

	return result, nil
}

func serviceReferencesSecret(svc swarm.Service, secretID, secretName string) bool {
	cs := svc.Spec.TaskTemplate.ContainerSpec
	if cs == nil {
		return false
	}
	if len(cs.Secrets) == 0 {
		return false
	}
	for _, ref := range cs.Secrets {
		if ref.SecretID == secretID || (secretName != "" && ref.SecretName == secretName) {
			return true
		}
	}
	return false
}

func replaceServiceSecretRefs(spec *swarm.ServiceSpec, oldID, oldName, newID, newName string) bool {
	cs := spec.TaskTemplate.ContainerSpec
	if cs == nil {
		return false
	}
	changed := false
	for i := range cs.Secrets {
		ref := cs.Secrets[i]
		if ref.SecretID == oldID || (oldName != "" && ref.SecretName == oldName) {
			cs.Secrets[i].SecretID = newID
			cs.Secrets[i].SecretName = newName
			changed = true
		}
	}
	return changed
}
