//go:build windows

package app

import (
	"os"
	"path/filepath"
	"strings"

	"gowails/pkg/logger"
)

// supplementWindowsPath appends common credential-provider binary locations to
// the process PATH. When the app is launched from the Start menu or taskbar it
// inherits a stripped PATH that may exclude tools installed via Chocolatey,
// Scoop, or MSI installers (kubelogin, tkgi, aws-iam-authenticator, etc.).
//
// This is a no-op on non-Windows platforms (ensured by the build tag).
func supplementWindowsPath() {
	extra := []string{
		os.ExpandEnv(`${ProgramFiles}\kubelogin`),
		os.ExpandEnv(`${ProgramFiles(x86)}\kubelogin`),
		os.ExpandEnv(`${LOCALAPPDATA}\Microsoft\WindowsApps`),
		os.ExpandEnv(`${USERPROFILE}\.local\bin`),
		os.ExpandEnv(`${USERPROFILE}\bin`),
		filepath.Join(os.ExpandEnv(`${ProgramData}`), "chocolatey", "bin"),
		filepath.Join(os.ExpandEnv(`${USERPROFILE}`), "scoop", "shims"),
		filepath.Join(os.ExpandEnv(`${USERPROFILE}`), "scoop", "apps", "kubelogin", "current"),
		filepath.Join(os.ExpandEnv(`${USERPROFILE}`), ".azure", "bin"),
		filepath.Join(os.ExpandEnv(`${APPDATA}`), "gcloud", "bin"),
	}

	currentPath := os.Getenv("PATH")
	lowerPaths := make(map[string]struct{})
	for _, p := range strings.Split(currentPath, ";") {
		lowerPaths[strings.ToLower(strings.TrimSpace(p))] = struct{}{}
	}

	var added []string
	for _, dir := range extra {
		dir = os.ExpandEnv(dir)
		if dir == "" || dir == "." {
			continue
		}
		lower := strings.ToLower(dir)
		if _, exists := lowerPaths[lower]; exists {
			continue
		}
		// Only add if the directory actually exists
		if info, err := os.Stat(dir); err == nil && info.IsDir() {
			added = append(added, dir)
			lowerPaths[lower] = struct{}{}
		}
	}

	if len(added) > 0 {
		newPath := currentPath + ";" + strings.Join(added, ";")
		os.Setenv("PATH", newPath)
		logger.Info("supplementWindowsPath: augmented PATH", "added", added)
	}
}
