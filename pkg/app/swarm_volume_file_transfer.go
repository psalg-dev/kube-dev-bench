package app

import (
	"archive/tar"
	"fmt"
	"io"
	"os"
	"path"
	"path/filepath"
	"strings"
	"time"

	"github.com/docker/docker/api/types"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

func isTarPath(p string) bool {
	low := strings.ToLower(p)
	return strings.HasSuffix(low, ".tar") || strings.HasSuffix(low, ".tar.gz") || strings.HasSuffix(low, ".tgz")
}

func statModeIsDir(mode os.FileMode) bool {
	return mode.IsDir()
}

// DownloadFromSwarmVolume downloads a file or directory from a Swarm volume.
// - If the source is a directory, the result is saved as a .tar archive.
// - If the source is a single file, it is extracted from the tar stream and written as that file.
// Returns the chosen destination path (empty if user cancelled).
func (a *App) DownloadFromSwarmVolume(volumeName string, srcPath string) (string, error) {
	if volumeName == "" {
		return "", fmt.Errorf("volume name required")
	}
	clean, err := sanitizePosixPath(srcPath)
	if err != nil {
		return "", err
	}
	if clean == "/" {
		return "", fmt.Errorf("source path required")
	}

	containerID, err := a.ensureSwarmVolumeHelper(volumeName)
	if err != nil {
		return "", err
	}
	cli, err := a.getDockerClient()
	if err != nil {
		return "", err
	}

	containerPath := "/mnt" + clean
	base := path.Base(clean)
	if base == "/" || base == "." || base == "" {
		base = "download"
	}

	defaultName := base
	if st, statErr := cli.ContainerStatPath(a.ctx, containerID, containerPath); statErr == nil {
		if statModeIsDir(st.Mode) {
			defaultName = base + ".tar"
		}
	}

	destPath, err := runtime.SaveFileDialog(a.ctx, runtime.SaveDialogOptions{
		Title:           "Save From Volume",
		DefaultFilename: defaultName,
		Filters: []runtime.FileFilter{
			{DisplayName: "All Files", Pattern: "*"},
		},
	})
	if err != nil {
		return "", err
	}
	if destPath == "" {
		return "", nil
	}

	reader, _, err := cli.CopyFromContainer(a.ctx, containerID, containerPath)
	if err != nil {
		return "", err
	}
	defer reader.Close()

	// If user explicitly chose a tar path, always save raw tar stream.
	if isTarPath(destPath) {
		f, err := os.Create(destPath)
		if err != nil {
			return "", err
		}
		defer f.Close()
		if _, err := io.Copy(f, reader); err != nil {
			return "", err
		}
		return destPath, nil
	}

	// Otherwise, attempt to extract exactly one regular file.
	tr := tar.NewReader(reader)

	var wroteFile bool
	for {
		hdr, err := tr.Next()
		if err == io.EOF {
			break
		}
		if err != nil {
			return "", err
		}
		if hdr == nil {
			continue
		}
		if hdr.Typeflag != tar.TypeReg && hdr.Typeflag != tar.TypeRegA {
			continue
		}
		if wroteFile {
			return "", fmt.Errorf("source contains multiple files; choose a .tar destination")
		}
		f, err := os.Create(destPath)
		if err != nil {
			return "", err
		}
		_, copyErr := io.Copy(f, tr)
		closeErr := f.Close()
		if copyErr != nil {
			return "", copyErr
		}
		if closeErr != nil {
			return "", closeErr
		}
		wroteFile = true
	}

	if !wroteFile {
		return "", fmt.Errorf("no file content found; if this is a directory, save as .tar")
	}
	return destPath, nil
}

// UploadToSwarmVolume uploads a local file to a Swarm volume.
// destPath is a POSIX path relative to the volume root.
// - If destPath ends with '/', the file is uploaded into that directory using its original filename.
// - Otherwise, destPath is treated as the full destination path including filename.
// Returns the destination volume path (empty if user cancelled).
func (a *App) UploadToSwarmVolume(volumeName string, destPath string) (string, error) {
	if volumeName == "" {
		return "", fmt.Errorf("volume name required")
	}
	if destPath == "" {
		destPath = "/"
	}

	// Preserve the caller's intent of "directory" by looking at the raw input suffix.
	isDirIntent := strings.HasSuffix(destPath, "/")
	clean, err := sanitizePosixPath(destPath)
	if err != nil {
		return "", err
	}
	if clean == "/" {
		isDirIntent = true
	}

	localPath, err := runtime.OpenFileDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "Select File To Upload",
		Filters: []runtime.FileFilter{
			{DisplayName: "All Files", Pattern: "*"},
		},
	})
	if err != nil {
		return "", err
	}
	if localPath == "" {
		return "", nil
	}

	containerID, err := a.ensureSwarmVolumeHelper(volumeName)
	if err != nil {
		return "", err
	}
	cli, err := a.getDockerClient()
	if err != nil {
		return "", err
	}

	localBase := filepath.Base(localPath)
	if localBase == "." || localBase == string(filepath.Separator) || localBase == "" {
		return "", fmt.Errorf("invalid local filename")
	}

	finalVolPath := clean
	if isDirIntent {
		finalVolPath = path.Join(clean, localBase)
	}
	if finalVolPath == "/" {
		return "", fmt.Errorf("destination path required")
	}

	finalDir := path.Dir(finalVolPath)
	finalName := path.Base(finalVolPath)
	if finalDir == "." {
		finalDir = "/"
	}

	// Ensure directory exists.
	absDir := "/mnt" + finalDir
	_, errOut, code, err := a.execInSwarmVolumeHelper(volumeName, []string{"mkdir", "-p", absDir}, 10*time.Second)
	if err != nil {
		return "", err
	}
	if code != 0 {
		msg := strings.TrimSpace(errOut)
		if msg == "" {
			msg = fmt.Sprintf("mkdir exit code %d", code)
		}
		return "", fmt.Errorf("%s", msg)
	}

	src, err := os.Open(localPath)
	if err != nil {
		return "", err
	}
	defer src.Close()

	st, err := src.Stat()
	if err != nil {
		return "", err
	}
	if !st.Mode().IsRegular() {
		return "", fmt.Errorf("only regular files can be uploaded")
	}

	pr, pw := io.Pipe()

	go func() {
		tw := tar.NewWriter(pw)
		defer func() {
			_ = tw.Close()
			_ = pw.Close()
		}()

		hdr := &tar.Header{
			Name:    finalName,
			Mode:    0o644,
			Size:    st.Size(),
			ModTime: st.ModTime(),
		}
		if err := tw.WriteHeader(hdr); err != nil {
			_ = pw.CloseWithError(err)
			return
		}
		if _, err := io.Copy(tw, src); err != nil {
			_ = pw.CloseWithError(err)
			return
		}
	}()

	if err := cli.CopyToContainer(a.ctx, containerID, "/mnt"+finalDir, pr, types.CopyToContainerOptions{
		AllowOverwriteDirWithFile: true,
	}); err != nil {
		return "", err
	}

	return finalVolPath, nil
}
