package docker

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"time"
)

type ImageUpdateSettings struct {
	Enabled         bool `json:"enabled"`
	IntervalSeconds int  `json:"intervalSeconds"`
}

const (
	defaultImageUpdateIntervalSeconds = 5 * 60
	minImageUpdateIntervalSeconds     = 30
	maxImageUpdateIntervalSeconds     = 24 * 60 * 60
)

func DefaultImageUpdateSettings() ImageUpdateSettings {
	return ImageUpdateSettings{
		Enabled:         false,
		IntervalSeconds: defaultImageUpdateIntervalSeconds,
	}
}

func validateImageUpdateSettings(s ImageUpdateSettings) error {
	if s.IntervalSeconds <= 0 {
		return fmt.Errorf("intervalSeconds must be > 0")
	}
	if s.IntervalSeconds < minImageUpdateIntervalSeconds {
		return fmt.Errorf("intervalSeconds must be >= %d", minImageUpdateIntervalSeconds)
	}
	if s.IntervalSeconds > maxImageUpdateIntervalSeconds {
		return fmt.Errorf("intervalSeconds must be <= %d", maxImageUpdateIntervalSeconds)
	}
	return nil
}

func imageUpdateSettingsPath() (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(home, "KubeDevBench", "swarm-image-update-settings.json"), nil
}

func LoadImageUpdateSettings() (ImageUpdateSettings, error) {
	path, err := imageUpdateSettingsPath()
	if err != nil {
		return DefaultImageUpdateSettings(), err
	}

	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return DefaultImageUpdateSettings(), nil
		}
		return DefaultImageUpdateSettings(), err
	}

	var s ImageUpdateSettings
	if err := json.Unmarshal(data, &s); err != nil {
		return DefaultImageUpdateSettings(), err
	}
	if s.IntervalSeconds == 0 {
		// Back-compat / defaults
		s.IntervalSeconds = defaultImageUpdateIntervalSeconds
	}
	if err := validateImageUpdateSettings(s); err != nil {
		return DefaultImageUpdateSettings(), err
	}
	return s, nil
}

func SaveImageUpdateSettings(s ImageUpdateSettings) error {
	if s.IntervalSeconds == 0 {
		s.IntervalSeconds = defaultImageUpdateIntervalSeconds
	}
	if err := validateImageUpdateSettings(s); err != nil {
		return err
	}

	path, err := imageUpdateSettingsPath()
	if err != nil {
		return err
	}

	if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
		return err
	}

	data, err := json.MarshalIndent(s, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, data, 0644)
}

func (s ImageUpdateSettings) Interval() time.Duration {
	sec := s.IntervalSeconds
	if sec <= 0 {
		sec = defaultImageUpdateIntervalSeconds
	}
	return time.Duration(sec) * time.Second
}
