package docker

import (
	"bytes"
	"context"
	"encoding/json"

	"github.com/docker/docker/client"
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
	cfg, raw, err := cli.ConfigInspectWithRaw(ctx, configID)
	if err != nil {
		return "", err
	}
	if len(raw) > 0 {
		return prettyJSON(raw), nil
	}
	b, err := json.MarshalIndent(cfg, "", "  ")
	if err != nil {
		return "", err
	}
	return string(b), nil
}

// GetSwarmSecretInspectJSON returns an indented JSON representation of Docker's secret inspect payload.
// Note: Docker Swarm secrets cannot be read back (their value/data is not returned).
func GetSwarmSecretInspectJSON(ctx context.Context, cli *client.Client, secretID string) (string, error) {
	sec, raw, err := cli.SecretInspectWithRaw(ctx, secretID)
	if err != nil {
		return "", err
	}
	if len(raw) > 0 {
		return prettyJSON(raw), nil
	}
	b, err := json.MarshalIndent(sec, "", "  ")
	if err != nil {
		return "", err
	}
	return string(b), nil
}

// GetSwarmVolumeInspectJSON returns an indented JSON representation of Docker's volume inspect payload.
func GetSwarmVolumeInspectJSON(ctx context.Context, cli *client.Client, volumeName string) (string, error) {
	vol, err := cli.VolumeInspect(ctx, volumeName)
	if err != nil {
		return "", err
	}
	b, err := json.MarshalIndent(vol, "", "  ")
	if err != nil {
		return "", err
	}
	return string(b), nil
}
