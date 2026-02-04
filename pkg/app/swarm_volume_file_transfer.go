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

	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/client"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

func isTarPath(p string) bool {
	low := strings.ToLower(p)
	return strings.HasSuffix(low, ".tar") || strings.HasSuffix(low, ".tar.gz") || strings.HasSuffix(low, ".tgz")
}

func statModeIsDir(mode os.FileMode) bool {
	return mode.IsDir()
}

// prepareSwarmDownload validates input and prepares the container path
func (a *App) prepareSwarmDownload(volumeName, srcPath string) (containerID, containerPath, base string, err error) {
	if volumeName == "" {
		return "", "", "", fmt.Errorf("volume name required")
	}
	clean, err := sanitizePosixPath(srcPath)
	if err != nil {
		return "", "", "", err
	}
	if clean == "/" {
		return "", "", "", fmt.Errorf("source path required")
	}

	containerID, err = a.ensureSwarmVolumeHelper(volumeName)
	if err != nil {
		return "", "", "", err
	}

	containerPath = "/mnt" + clean
	base = path.Base(clean)
	if base == "/" || base == "." || base == "" {
		base = "download"
	}
	return containerID, containerPath, base, nil
}

// getDefaultDownloadName determines the default filename based on source type
func (a *App) getDefaultDownloadName(containerID, containerPath, base string, cli *client.Client) string {
	defaultName := base
	if st, statErr := cli.ContainerStatPath(a.ctx, containerID, containerPath); statErr == nil {
		if statModeIsDir(st.Mode) {
			defaultName = base + ".tar"
		}
	}
	return defaultName
}

// writeTarToFile writes the reader content directly to a file
func writeTarToFile(destPath string, reader io.ReadCloser) error {
	f, err := os.Create(destPath)
	if err != nil {
		return err
	}
	defer f.Close()
	_, err = io.Copy(f, reader)
	return err
}

// extractSingleFileFromTar extracts a single file from tar stream
func extractSingleFileFromTar(destPath string, reader io.ReadCloser) error {
	tr := tar.NewReader(reader)
	var wroteFile bool
	for {
		hdr, err := tr.Next()
		if err == io.EOF {
			break
		}
		if err != nil {
			return err
		}
		if hdr == nil || (hdr.Typeflag != tar.TypeReg && hdr.Typeflag != tar.TypeRegA) {
			continue
		}
		if wroteFile {
			return fmt.Errorf("source contains multiple files; choose a .tar destination")
		}
		if err := writeFileFromTar(destPath, tr); err != nil {
			return err
		}
		wroteFile = true
	}
	if !wroteFile {
		return fmt.Errorf("no file content found; if this is a directory, save as .tar")
	}
	return nil
}

// writeFileFromTar writes content from tar reader to a file
func writeFileFromTar(destPath string, tr *tar.Reader) error {
	f, err := os.Create(destPath)
	if err != nil {
		return err
	}
	_, copyErr := io.Copy(f, tr)
	closeErr := f.Close()
	if copyErr != nil {
		return copyErr
	}
	return closeErr
}

// DownloadFromSwarmVolume downloads a file or directory from a Swarm volume.
// - If the source is a directory, the result is saved as a .tar archive.
// - If the source is a single file, it is extracted from the tar stream and written as that file.
// Returns the chosen destination path (empty if user cancelled).
func (a *App) DownloadFromSwarmVolume(volumeName string, srcPath string) (string, error) {
	containerID, containerPath, base, err := a.prepareSwarmDownload(volumeName, srcPath)
	if err != nil {
		return "", err
	}

	cli, err := a.getDockerClient()
	if err != nil {
		return "", err
	}

	defaultName := a.getDefaultDownloadName(containerID, containerPath, base, cli)

	destPath, err := a.saveFileDialogWithE2E(runtime.SaveDialogOptions{
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

	if isTarPath(destPath) {
		if err := writeTarToFile(destPath, reader); err != nil {
			return "", err
		}
		return destPath, nil
	}

	if err := extractSingleFileFromTar(destPath, reader); err != nil {
		return "", err
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

	finalVolPath, finalDir, isDirIntent, err := a.resolveUploadDest(destPath)
	if err != nil {
		return "", err
	}

	localPath, err := a.openFileDialogWithE2E(runtime.OpenDialogOptions{
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

	if isDirIntent {
		finalVolPath = path.Join(finalVolPath, localBase)
		finalDir = path.Dir(finalVolPath)
	}
	if finalVolPath == "/" {
		return "", fmt.Errorf("destination path required")
	}

	if err := a.ensureVolumeDir(volumeName, finalDir); err != nil {
		return "", err
	}

	if err := a.copyLocalFileToContainer(cli, containerID, localPath, finalDir); err != nil {
		return "", err
	}

	return finalVolPath, nil
}

// resolveUploadDest resolves the destination path for upload, returning the final path, directory, and whether it's a directory intent.
func (a *App) resolveUploadDest(destPath string) (finalVolPath, finalDir string, isDirIntent bool, err error) {
	isDirIntent = strings.HasSuffix(destPath, "/")
	clean, err := sanitizePosixPath(destPath)
	if err != nil {
		return "", "", false, err
	}
	if clean == "/" {
		isDirIntent = true
	}

	finalVolPath = clean
	finalDir = path.Dir(finalVolPath)
	if finalDir == "." {
		finalDir = "/"
	}
	return finalVolPath, finalDir, isDirIntent, nil
}

// ensureVolumeDir ensures the directory exists in the volume.
func (a *App) ensureVolumeDir(volumeName, dir string) error {
	absDir := "/mnt" + dir
	_, errOut, code, err := a.execInSwarmVolumeHelper(volumeName, []string{"mkdir", "-p", absDir}, 10*time.Second)
	if err != nil {
		return err
	}
	if code != 0 {
		msg := strings.TrimSpace(errOut)
		if msg == "" {
			msg = fmt.Sprintf("mkdir exit code %d", code)
		}
		return fmt.Errorf("%s", msg)
	}
	return nil
}

// copyLocalFileToContainer copies a local file to the container.
func (a *App) copyLocalFileToContainer(cli *client.Client, containerID, localPath, destDir string) error {
	src, err := os.Open(localPath)
	if err != nil {
		return err
	}
	defer src.Close()

	st, err := src.Stat()
	if err != nil {
		return err
	}
	if !st.Mode().IsRegular() {
		return fmt.Errorf("only regular files can be uploaded")
	}

	pr, pw := io.Pipe()
	finalName := path.Base(localPath)

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

	return cli.CopyToContainer(a.ctx, containerID, "/mnt"+destDir, pr, container.CopyToContainerOptions{
		AllowOverwriteDirWithFile: true,
	})
}
