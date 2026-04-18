package docker

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/docker/docker/api/types"
	"github.com/docker/docker/api/types/swarm"
	"github.com/docker/docker/client"
)

var swarmSecretNowUTC = func() time.Time { return time.Now().UTC() }

type swarmSecretsClient interface {
	SecretList(context.Context, swarm.SecretListOptions) ([]swarm.Secret, error)
	SecretInspectWithRaw(context.Context, string) (swarm.Secret, []byte, error)
	SecretCreate(context.Context, swarm.SecretSpec) (swarm.SecretCreateResponse, error)
	SecretRemove(context.Context, string) error
}

type swarmSecretEditClient interface {
	swarmSecretsClient
	ServiceList(context.Context, types.ServiceListOptions) ([]swarm.Service, error)
	ServiceInspectWithRaw(context.Context, string, types.ServiceInspectOptions) (swarm.Service, []byte, error)
	ServiceUpdate(context.Context, string, swarm.Version, swarm.ServiceSpec, types.ServiceUpdateOptions) (swarm.ServiceUpdateResponse, error)
}

// GetSwarmSecrets returns all Swarm secrets (metadata only, not the actual secret data)
func GetSwarmSecrets(ctx context.Context, cli *client.Client) ([]SwarmSecretInfo, error) {
	return getSwarmSecrets(ctx, cli)
}

func getSwarmSecrets(ctx context.Context, cli swarmSecretsClient) ([]SwarmSecretInfo, error) {
	secrets, err := cli.SecretList(ctx, swarm.SecretListOptions{})
	if err != nil {
		return nil, err
	}

	result := make([]SwarmSecretInfo, 0, len(secrets))
	for _, secret := range secrets {
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
	secret, _, err := cli.SecretInspectWithRaw(ctx, secretID)
	if err != nil {
		return nil, err
	}

	info := secretToInfo(secret)
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
	spec := swarm.SecretSpec{
		Annotations: swarm.Annotations{
			Name:   name,
			Labels: labels,
		},
		Data: data,
	}

	resp, err := cli.SecretCreate(ctx, spec)
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
	return cli.SecretRemove(ctx, secretID)
}

// GetSwarmSecretUsage returns services that reference the given secret (by ID or name).
func GetSwarmSecretUsage(ctx context.Context, cli *client.Client, secretID string) ([]SwarmServiceRef, error) {
	return getSwarmSecretUsage(ctx, cli, secretID)
}

func getSwarmSecretUsage(ctx context.Context, cli swarmSecretEditClient, secretID string) ([]SwarmServiceRef, error) {
	sec, _, err := cli.SecretInspectWithRaw(ctx, secretID)
	if err != nil {
		return nil, err
	}
	secretName := sec.Spec.Name

	services, err := cli.ServiceList(ctx, types.ServiceListOptions{})
	if err != nil {
		return nil, err
	}

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
	oldSec, _, err := cli.SecretInspectWithRaw(ctx, secretID)
	if err != nil {
		return nil, err
	}
	oldName := oldSec.Spec.Name

	stamp := swarmSecretNowUTC().Format("2006-01-02T150405Z")
	newName := swarmTimestampedName(oldName, stamp)
	newSpec := oldSec.Spec
	newSpec.Annotations.Name = newName
	newSpec.Data = newData

	createResp, err := cli.SecretCreate(ctx, newSpec)
	if err != nil {
		return nil, err
	}

	result := &SwarmSecretUpdateResult{
		OldSecretID:   oldSec.ID,
		OldSecretName: oldName,
		NewSecretID:   createResp.ID,
		NewSecretName: newName,
		Updated:       []SwarmServiceRef{},
	}

	services, err := cli.ServiceList(ctx, types.ServiceListOptions{})
	if err != nil {
		return nil, err
	}

	var updateErrs []string
	for _, svc := range services {
		if !serviceReferencesSecret(svc, oldSec.ID, oldName) {
			continue
		}
		inspected, _, err := cli.ServiceInspectWithRaw(ctx, svc.ID, types.ServiceInspectOptions{})
		if err != nil {
			updateErrs = append(updateErrs, fmt.Sprintf("inspect %s: %v", svc.Spec.Name, err))
			continue
		}
		changed := replaceServiceSecretRefs(&inspected.Spec, oldSec.ID, oldName, createResp.ID, newName)
		if !changed {
			continue
		}
		inspected.Spec.TaskTemplate.ForceUpdate++
		_, err = cli.ServiceUpdate(ctx, inspected.ID, inspected.Version, inspected.Spec, types.ServiceUpdateOptions{})
		if err != nil {
			updateErrs = append(updateErrs, fmt.Sprintf("update %s: %v", inspected.Spec.Name, err))
			continue
		}
		result.Updated = append(result.Updated, SwarmServiceRef{ServiceID: inspected.ID, ServiceName: inspected.Spec.Name})
	}

	if len(updateErrs) > 0 {
		return nil, fmt.Errorf("created new secret %q but failed to migrate all services: %s", newName, strings.Join(updateErrs, "; "))
	}

	if err := cli.SecretRemove(ctx, oldSec.ID); err != nil {
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
