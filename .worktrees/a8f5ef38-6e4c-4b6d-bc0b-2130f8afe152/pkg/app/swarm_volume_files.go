package app

import (
	"bytes"
	"encoding/base64"
	"errors"
	"fmt"
	"path"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"
)

func sanitizePosixPath(p string) (string, error) {
	if p == "" {
		return "/", nil
	}
	if strings.Contains(p, "\x00") {
		return "", fmt.Errorf("invalid path")
	}
	// Reject obvious traversal attempts before cleaning.
	if strings.Contains(p, "..") {
		return "", fmt.Errorf("invalid path")
	}
	// Disallow Windows-style separators.
	if strings.Contains(p, "\\") {
		return "", fmt.Errorf("invalid path")
	}
	clean := path.Clean(p)
	if !strings.HasPrefix(clean, "/") {
		clean = "/" + clean
	}
	if strings.Contains(clean, "..") {
		return "", fmt.Errorf("invalid path")
	}
	return clean, nil
}

// swarmVolumeLsRegex parses ls -alp output lines
var swarmVolumeLsRegex = regexp.MustCompile(`^([\-ldcbps])([rwxstST\-]{9})\s+\d+\s+\S+\s+\S+\s+(\d+)\s+(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})\s+(.+)$`)

// parseSwarmVolumeLsLine parses a single line of ls -alp output
func parseSwarmVolumeLsLine(line, basePath string) (*PodFileEntry, bool) {
	line = strings.TrimSpace(line)
	if line == "" || strings.HasPrefix(line, "total ") {
		return nil, false
	}

	m := swarmVolumeLsRegex.FindStringSubmatch(line)
	if len(m) != 6 {
		return nil, false
	}

	fType := m[1]
	nameField := m[5]

	name := nameField
	linkTarget := ""
	isSymlink := fType == "l"
	if isSymlink {
		parts := strings.SplitN(nameField, " -> ", 2)
		name = parts[0]
		if len(parts) == 2 {
			linkTarget = parts[1]
		}
	}
	if name == "." || name == ".." {
		return nil, false
	}

	size := int64(0)
	_, _ = fmt.Sscan(m[3], &size)

	entryPath := strings.TrimSuffix(basePath, "/") + "/" + name
	if basePath == "/" {
		entryPath = "/" + name
	}

	return &PodFileEntry{
		Name:       name,
		Path:       entryPath,
		IsDir:      fType == "d",
		Size:       size,
		Mode:       fType + m[2],
		Modified:   m[4],
		IsSymlink:  isSymlink,
		LinkTarget: linkTarget,
	}, true
}

// ListSwarmVolumeFiles lists directory entries inside a Docker volume.
// path is a POSIX-style absolute path relative to the volume root ("/" means root).
// This Phase-1 implementation mounts the volume read-only into a short-lived helper container.
func (a *App) ListSwarmVolumeFiles(volumeName string, p string) ([]PodFileEntry, error) {
	if volumeName == "" {
		return nil, fmt.Errorf("volume name required")
	}
	clean, err := sanitizePosixPath(p)
	if err != nil {
		return nil, err
	}

	absPath := "/mnt"
	if clean != "/" {
		absPath = "/mnt" + clean
	}

	cmd := []string{"ls", "-alp", "--time-style=+%Y-%m-%dT%H:%M:%S", absPath}
	out, errOut, code, err := a.execInSwarmVolumeHelper(volumeName, cmd, 10*time.Second)
	if err != nil {
		return nil, err
	}
	_ = errOut
	if code != 0 {
		msg := strings.TrimSpace(errOut)
		if msg == "" {
			msg = strings.TrimSpace(out)
		}
		if msg == "" {
			msg = fmt.Sprintf("ls exit code %d", code)
		}
		return nil, fmt.Errorf("%s", msg)
	}

	lines := strings.Split(strings.TrimSpace(out), "\n")
	var entries []PodFileEntry
	for _, line := range lines {
		if entry, ok := parseSwarmVolumeLsLine(line, clean); ok {
			entries = append(entries, *entry)
		}
	}

	sort.Slice(entries, func(i, j int) bool {
		if entries[i].IsDir != entries[j].IsDir {
			return entries[i].IsDir && !entries[j].IsDir
		}
		return entries[i].Name < entries[j].Name
	})

	return entries, nil
}

// GetSwarmVolumeFileContent returns (possibly truncated) content of a file within the volume.
// maxBytes limits returned data; if <= 0 a default (131072) is applied. Content is base64 encoded.
func (a *App) GetSwarmVolumeFileContent(volumeName string, filePath string, maxBytes int) (PodFileContent, error) {
	if volumeName == "" {
		return PodFileContent{}, fmt.Errorf("volume name required")
	}
	clean, err := sanitizePosixPath(filePath)
	if err != nil {
		return PodFileContent{}, err
	}
	if clean == "/" {
		return PodFileContent{}, fmt.Errorf("file path required")
	}
	if maxBytes <= 0 {
		maxBytes = 128 * 1024
	}

	absPath := "/mnt" + clean

	// Get full size via wc -c <file>
	sizeCmd := []string{"wc", "-c", absPath}
	sizeOut, sizeErr, code, err := a.execInSwarmVolumeHelper(volumeName, sizeCmd, 10*time.Second)
	if err != nil {
		return PodFileContent{}, err
	}
	if code != 0 {
		msg := strings.TrimSpace(sizeErr)
		if msg == "" {
			msg = strings.TrimSpace(sizeOut)
		}
		if msg == "" {
			msg = fmt.Sprintf("wc exit code %d", code)
		}
		return PodFileContent{}, errors.New(msg)
	}

	// wc output: "<bytes> <filename>" (or similar). Take first token.
	sizeFields := strings.Fields(sizeOut)
	var fullSize int64
	if len(sizeFields) > 0 {
		fullSize, _ = strconv.ParseInt(sizeFields[0], 10, 64)
	}

	headCmd := []string{"head", "-c", strconv.Itoa(maxBytes), absPath}
	dataOut, dataErr, code, err := a.execInSwarmVolumeHelper(volumeName, headCmd, 15*time.Second)
	if err != nil {
		return PodFileContent{}, err
	}
	if code != 0 {
		msg := strings.TrimSpace(dataErr)
		if msg == "" {
			msg = strings.TrimSpace(dataOut)
		}
		if msg == "" {
			msg = fmt.Sprintf("head exit code %d", code)
		}
		return PodFileContent{}, errors.New(msg)
	}

	b := []byte(dataOut)
	isBinary := bytes.IndexByte(b, 0) >= 0
	encoded := base64.StdEncoding.EncodeToString(b)
	truncated := int64(len(b)) < fullSize

	return PodFileContent{
		Path:      clean,
		Base64:    encoded,
		Size:      fullSize,
		Truncated: truncated,
		IsBinary:  isBinary,
	}, nil
}

// IsSwarmVolumeReadOnly returns true if the volume appears to be read-only for writes.
// This uses a "touch test" (create+write+delete) inside the helper container.
func (a *App) IsSwarmVolumeReadOnly(volumeName string) (bool, error) {
	if volumeName == "" {
		return false, fmt.Errorf("volume name required")
	}

	cmd := []string{"sh", "-c", "tmp=$(mktemp -p /mnt .kdb_rw_test.XXXXXX 2>/dev/null) || exit 1; echo test > \"$tmp\" || exit 2; rm -f \"$tmp\" || exit 3"}
	_, _, code, err := a.execInSwarmVolumeHelper(volumeName, cmd, 10*time.Second)
	if err != nil {
		return false, err
	}
	return code != 0, nil
}
