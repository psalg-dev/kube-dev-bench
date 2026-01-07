package app

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"gowails/pkg/app/docker"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// ExportSwarmConfig exports a Swarm config's data to a local file chosen via a Wails save dialog.
// Returns the saved path (empty if the user cancelled).
func (a *App) ExportSwarmConfig(configID string, defaultFilename string) (string, error) {
	if strings.TrimSpace(configID) == "" {
		return "", fmt.Errorf("config id required")
	}

	cli, err := a.getDockerClient()
	if err != nil {
		return "", err
	}

	data, err := docker.GetSwarmConfigData(a.ctx, cli, configID)
	if err != nil {
		return "", err
	}

	name := strings.TrimSpace(defaultFilename)
	if name == "" {
		name = "config.txt"
	}
	name = filepath.Base(name)
	if name == "." || name == string(filepath.Separator) || name == "" {
		name = "config.txt"
	}

	destPath, err := a.saveFileDialogWithE2E(runtime.SaveDialogOptions{
		Title:           "Save Config",
		DefaultFilename: name,
		Filters: []runtime.FileFilter{
			{DisplayName: "Text", Pattern: "*.txt"},
			{DisplayName: "All Files", Pattern: "*"},
		},
	})
	if err != nil {
		return "", err
	}
	if destPath == "" {
		return "", nil
	}

	if err := os.WriteFile(destPath, data, 0o644); err != nil {
		return "", err
	}
	return destPath, nil
}
