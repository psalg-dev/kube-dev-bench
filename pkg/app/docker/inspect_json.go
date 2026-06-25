package docker

import (
	"bytes"
	"context"
	"encoding/json"

	"github.com/moby/moby/client"
)

func prettyJSON(raw []byte) string {
	b := bytes.TrimSpace(raw)
	if len(b) == 0 {
		return ""
	}
	var v interface{}
	if err := json.Unmarshal(b, &v); err != nil {
		// If the Docker API returns non-JSON (unexpected), just return raw.
		return string(raw)
	}
	out, err := json.MarshalIndent(v, "", "  ")
	if err != nil {
		return string(raw)
	}
	return string(out)
}

// GetSwarmConfigInspectJSON returns an indented JSON representation of Docker's config inspect payload.
func GetSwarmConfigInspectJSON(ctx context.Context, cli *client.Client, configID string) (string, error) {
	result, err := cli.ConfigInspect(ctx, configID, client.ConfigInspectOptions{})
	if err != nil {
		return "", err
	}
	if len(result.Raw) > 0 {
		return prettyJSON(result.Raw), nil
	}
	b, err := json.MarshalIndent(result.Config, "", "  ")
	if err != nil {
		return "", err
	}
	return string(b), nil
}

// GetSwarmSecretInspectJSON returns an indented JSON representation of Docker's secret inspect payload.
// Note: Docker Swarm secrets cannot be read back (their value/data is not returned).
func GetSwarmSecretInspectJSON(ctx context.Context, cli *client.Client, secretID string) (string, error) {
	result, err := cli.SecretInspect(ctx, secretID, client.SecretInspectOptions{})
	if err != nil {
		return "", err
	}
	if len(result.Raw) > 0 {
		return prettyJSON(result.Raw), nil
	}
	b, err := json.MarshalIndent(result.Secret, "", "  ")
	if err != nil {
		return "", err
	}
	return string(b), nil
}

// GetSwarmVolumeInspectJSON returns an indented JSON representation of Docker's volume inspect payload.
func GetSwarmVolumeInspectJSON(ctx context.Context, cli *client.Client, volumeName string) (string, error) {
	result, err := cli.VolumeInspect(ctx, volumeName, client.VolumeInspectOptions{})
	if err != nil {
		return "", err
	}
	b, err := json.MarshalIndent(result.Volume, "", "  ")
	if err != nil {
		return "", err
	}
	return string(b), nil
}
