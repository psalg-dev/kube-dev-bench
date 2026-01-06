package docker

import (
	"context"
	"time"

	"github.com/docker/docker/api/types"
	"github.com/docker/docker/api/types/swarm"
	"github.com/docker/docker/client"
)

type swarmSecretsClient interface {
	SecretList(context.Context, types.SecretListOptions) ([]swarm.Secret, error)
	SecretInspectWithRaw(context.Context, string) (swarm.Secret, []byte, error)
	SecretCreate(context.Context, swarm.SecretSpec) (types.SecretCreateResponse, error)
	SecretRemove(context.Context, string) error
}

// GetSwarmSecrets returns all Swarm secrets (metadata only, not the actual secret data)
func GetSwarmSecrets(ctx context.Context, cli *client.Client) ([]SwarmSecretInfo, error) {
	return getSwarmSecrets(ctx, cli)
}

func getSwarmSecrets(ctx context.Context, cli swarmSecretsClient) ([]SwarmSecretInfo, error) {
	secrets, err := cli.SecretList(ctx, types.SecretListOptions{})
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
