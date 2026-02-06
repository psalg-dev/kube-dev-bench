package app

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"fmt"
	"io"
	"math/big"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"time"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/kubernetes/scheme"
	"k8s.io/client-go/tools/remotecommand"
)

// parsedLsEntry represents a parsed entry from ls -alp output
type parsedLsEntry struct {
	fileType   string
	perms      string
	size       int64
	modified   string
	name       string
	isSymlink  bool
	linkTarget string
}

// lsRegex parses ls -alp output lines
var lsRegex = regexp.MustCompile(`^([\-ldcbps])([rwxstST\-]{9})\s+\d+\s+\S+\s+\S+\s+(\d+)\s+(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})\s+(.+)$`)

// parseLsLine parses a single line of ls -alp output
func parseLsLine(line string) (*parsedLsEntry, bool) {
	line = strings.TrimSpace(line)
	if line == "" {
		return nil, false
	}
	m := lsRegex.FindStringSubmatch(line)
	if len(m) != 6 {
		return nil, false
	}

	fType := m[1]
	nameField := m[5]

	var name = nameField
	var linkTarget string
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

	modified := m[4]
	if _, err := time.Parse("2006-01-02T15:04:05", m[4]); err != nil {
		modified = time.Now().UTC().Format(time.RFC3339)
	}

	return &parsedLsEntry{
		fileType:   fType,
		perms:      m[2],
		size:       size,
		modified:   modified,
		name:       name,
		isSymlink:  isSymlink,
		linkTarget: linkTarget,
	}, true
}

// buildPVCFileEntry converts a parsed ls entry to PodFileEntry
func buildPVCFileEntry(entry *parsedLsEntry, path string) PodFileEntry {
	entryPath := strings.TrimSuffix(path, "/") + "/" + entry.name
	if path == "/" {
		entryPath = "/" + entry.name
	}
	return PodFileEntry{
		Name:       entry.name,
		Path:       entryPath,
		IsDir:      entry.fileType == "d",
		Size:       entry.size,
		Mode:       entry.fileType + entry.perms,
		Modified:   entry.modified,
		IsSymlink:  entry.isSymlink,
		LinkTarget: entry.linkTarget,
	}
}

// buildAbsPath constructs the absolute path inside container
func buildAbsPath(mountPath, subPath, path string) string {
	rel := strings.TrimPrefix(path, "/")
	absPath := mountPath
	if subPath != "" {
		absPath = strings.TrimSuffix(absPath, "/") + "/" + strings.TrimPrefix(subPath, "/")
	}
	if rel != "" {
		absPath = strings.TrimSuffix(absPath, "/") + "/" + rel
	}
	return absPath
}

// ListPVCFiles lists files for a PersistentVolumeClaim by reusing an existing running pod that mounts it.
// path is relative to the root of the PVC mount ("/" means the mount root). Only directories are listed.
// This MVP implementation:
//   - Only reuses an existing running pod (no helper pod creation)
//   - Executes an `ls -alp` and parses output
//   - Returns minimal fields required by UI
//   - Hard times out after 5 seconds
func (a *App) ListPVCFiles(namespace, pvcName, path string) ([]PodFileEntry, error) {
	if err := validatePVCFilesRequest(namespace, pvcName, path); err != nil {
		return nil, err
	}
	if path == "" {
		path = "/"
	}

	clientset, err := a.getKubernetesClient()
	if err != nil {
		return nil, err
	}

	if err := a.checkPVCState(clientset, namespace, pvcName); err != nil {
		return nil, err
	}

	pod, container, mountPath, subPath, err := a.resolvePVCMount(namespace, pvcName)
	if err != nil {
		return nil, err
	}

	return a.listPVCFilesFromPod(namespace, pod, container, mountPath, subPath, path)
}

func validatePVCFilesRequest(namespace, pvcName, path string) error {
	if namespace == "" {
		return fmt.Errorf("namespace required")
	}
	if pvcName == "" {
		return fmt.Errorf("pvc name required")
	}
	if strings.Contains(path, "..") {
		return fmt.Errorf("invalid path")
	}
	return nil
}

func (a *App) checkPVCState(clientset *kubernetes.Clientset, namespace, pvcName string) error {
	pvc, err := clientset.CoreV1().PersistentVolumeClaims(namespace).Get(a.ctx, pvcName, metav1.GetOptions{})
	if err != nil {
		return err
	}
	if pvc.Status.Phase == corev1.ClaimLost {
		return fmt.Errorf("pvc is in Lost state")
	}
	return nil
}

func (a *App) resolvePVCMount(namespace, pvcName string) (pod, container, mountPath, subPath string, err error) {
	pod, container, mountPath, subPath, err = a.findPodMountingPVC(namespace, pvcName)
	if err != nil {
		pod, container, mountPath, subPath, err = a.ensurePVCBrowseHelper(namespace, pvcName)
	}
	return
}

func (a *App) listPVCFilesFromPod(namespace, pod, container, mountPath, subPath, path string) ([]PodFileEntry, error) {
	absPath := buildAbsPath(mountPath, subPath, path)
	cmd := []string{"sh", "-c", fmt.Sprintf("ls -alp --time-style=+%%Y-%%m-%%dT%%H:%%M:%%S %q 2>/dev/null | tail -n +2", absPath)}
	raw, err := a.execInPod(namespace, pod, container, cmd, 5*time.Second)
	if err != nil {
		return nil, fmt.Errorf("exec ls: %w", err)
	}

	entries := parsePVCLsOutput(raw, path)
	sortFileEntriesByDirFirst(entries)
	return entries, nil
}

func parsePVCLsOutput(raw, path string) []PodFileEntry {
	lines := strings.Split(strings.TrimSpace(raw), "\n")
	var entries []PodFileEntry
	for _, line := range lines {
		if entry, ok := parseLsLine(line); ok {
			entries = append(entries, buildPVCFileEntry(entry, path))
		}
	}
	return entries
}

func sortFileEntriesByDirFirst(entries []PodFileEntry) {
	sort.Slice(entries, func(i, j int) bool {
		if entries[i].IsDir != entries[j].IsDir {
			return entries[i].IsDir && !entries[j].IsDir
		}
		return entries[i].Name < entries[j].Name
	})
}

// GetPVCFileContent returns (possibly truncated) content of a file within the PVC using an existing pod mount.
// maxBytes limits returned data; if <= 0 a default (131072) is applied. Content is base64 encoded.
func (a *App) GetPVCFileContent(namespace, pvcName, filePath string, maxBytes int) (PodFileContent, error) {
	if namespace == "" || pvcName == "" {
		return PodFileContent{}, fmt.Errorf("namespace and pvc name required")
	}
	if filePath == "" || filePath == "/" {
		return PodFileContent{}, fmt.Errorf("file path required")
	}
	if strings.Contains(filePath, "..") {
		return PodFileContent{}, fmt.Errorf("invalid path")
	}
	if maxBytes <= 0 {
		maxBytes = 128 * 1024 // 128 KiB default
	}

	clientset, err := a.getKubernetesClient()
	if err != nil {
		return PodFileContent{}, err
	}
	// Ensure PVC exists (fast fail)
	if _, err := clientset.CoreV1().PersistentVolumeClaims(namespace).Get(a.ctx, pvcName, metav1.GetOptions{}); err != nil {
		return PodFileContent{}, err
	}

	pod, container, mountPath, subPath, err := a.findPodMountingPVC(namespace, pvcName)
	if err != nil {
		return PodFileContent{}, err
	}

	// Reconstruct absolute path
	abs := mountPath
	if subPath != "" {
		abs = strings.TrimSuffix(abs, "/") + "/" + strings.TrimPrefix(subPath, "/")
	}
	rel := strings.TrimPrefix(filePath, "/")
	if rel != "" {
		abs = strings.TrimSuffix(abs, "/") + "/" + rel
	}

	// Determine total size first (stat)
	sizeCmd := []string{"sh", "-c", fmt.Sprintf("wc -c < %q 2>/dev/null", abs)}
	sizeRaw, _ := a.execInPod(namespace, pod, container, sizeCmd, 5*time.Second)
	sizeRaw = strings.TrimSpace(sizeRaw)
	var fullSize int64
	// Intentionally ignore parse error; size 0 fallback is acceptable for preview
	_, _ = fmt.Sscan(sizeRaw, &fullSize)

	catCmd := []string{"sh", "-c", fmt.Sprintf("head -c %d %q 2>/dev/null", maxBytes, abs)}
	data, err := a.execInPod(namespace, pod, container, catCmd, 10*time.Second)
	if err != nil {
		return PodFileContent{}, fmt.Errorf("read file: %w", err)
	}

	b := []byte(data)
	isBinary := bytes.IndexByte(b, 0) >= 0
	encoded := base64.StdEncoding.EncodeToString(b)
	truncated := int64(len(b)) < fullSize

	return PodFileContent{
		Path:      filePath,
		Base64:    encoded,
		Size:      fullSize,
		Truncated: truncated,
		IsBinary:  isBinary,
	}, nil
}

// buildPVCAbsPath constructs the absolute path inside the container
func buildPVCAbsPath(mountPath, subPath, relPath string) string {
	base := mountPath
	if subPath != "" {
		base = strings.TrimSuffix(base, "/") + "/" + strings.TrimPrefix(subPath, "/")
	}
	if relPath == "" {
		return base
	}
	return strings.TrimSuffix(base, "/") + "/" + relPath
}

// buildTarCommand creates the tar command for archiving a path
func buildTarCommand(abs string, isDir bool) string {
	if isDir {
		return fmt.Sprintf("tar -C %q -czf - .", abs)
	}
	parent := filepath.Dir(abs)
	name := filepath.Base(abs)
	return fmt.Sprintf("tar -C %q -czf - %q", parent, name)
}

// ArchivePVCPath creates a tar.gz archive (base64) of the specified path (file or directory) inside the PVC.
// If maxBytes > 0 and the archive exceeds that size, it is truncated and Truncated=true.
func (a *App) ArchivePVCPath(namespace, pvcName, path string, maxBytes int64) (ArchiveResult, error) {
	if namespace == "" || pvcName == "" {
		return ArchiveResult{}, fmt.Errorf("namespace and pvc required")
	}
	if path == "" {
		path = "/"
	}
	if strings.Contains(path, "..") {
		return ArchiveResult{}, fmt.Errorf("invalid path")
	}
	clientset, err := a.getKubernetesClient()
	if err != nil {
		return ArchiveResult{}, err
	}
	if _, err := clientset.CoreV1().PersistentVolumeClaims(namespace).Get(a.ctx, pvcName, metav1.GetOptions{}); err != nil {
		return ArchiveResult{}, err
	}
	pod, container, mountPath, subPath, err := a.findPodMountingPVC(namespace, pvcName)
	if err != nil {
		pod, container, mountPath, subPath, err = a.ensurePVCBrowseHelper(namespace, pvcName)
		if err != nil {
			return ArchiveResult{}, err
		}
	}
	rel := strings.TrimPrefix(path, "/")
	abs := buildPVCAbsPath(mountPath, subPath, rel)

	// Determine if directory
	statCmd := []string{"sh", "-c", fmt.Sprintf("if [ -d %q ]; then echo dir; elif [ -f %q ]; then echo file; else echo missing; fi", abs, abs)}
	kind, err := a.execInPod(namespace, pod, container, statCmd, 5*time.Second)
	if err != nil {
		return ArchiveResult{}, err
	}
	kind = strings.TrimSpace(kind)
	if kind == "missing" {
		return ArchiveResult{}, fmt.Errorf("path not found")
	}

	tarCmd := buildTarCommand(abs, kind == "dir")
	data, err := a.execInPodLimited(namespace, pod, container, []string{"sh", "-c", tarCmd}, 60*time.Second, maxBytes)
	if err != nil {
		return ArchiveResult{}, err
	}
	truncated := maxBytes > 0 && int64(len(data)) >= maxBytes
	encoded := base64.StdEncoding.EncodeToString([]byte(data))
	return ArchiveResult{Path: path, Base64: encoded, Truncated: truncated, Size: int64(len(data))}, nil
}

// ensurePVCBrowseHelper creates or reuses a helper pod to mount the PVC read-only.
func (a *App) ensurePVCBrowseHelper(namespace, pvcName string) (string, string, string, string, error) {
	clientset, err := a.getKubernetesClient()
	if err != nil {
		return "", "", "", "", err
	}
	// Try to find existing helper pod
	labelSel := fmt.Sprintf("app=kdb-pvc-browse,kdb-pvc=%s", pvcName)
	pods, _ := clientset.CoreV1().Pods(namespace).List(a.ctx, metav1.ListOptions{LabelSelector: labelSel})
	for _, p := range pods.Items {
		if p.Status.Phase == corev1.PodRunning {
			return p.Name, "browse", "/mnt/claim", "", nil
		}
	}
	// Create new helper pod
	limit := big.NewInt(1 << 16)
	value, err := rand.Int(rand.Reader, limit)
	if err != nil {
		return "", "", "", "", fmt.Errorf("generate pvc browse suffix: %w", err)
	}
	suffix := value.Int64()
	name := fmt.Sprintf("kdb-pvc-browse-%s-%x", sanitizeName(pvcName, 20), suffix)
	podSpec := &corev1.Pod{
		ObjectMeta: metav1.ObjectMeta{
			Name:      name,
			Namespace: namespace,
			Labels: map[string]string{
				"app":     "kdb-pvc-browse",
				"kdb-pvc": pvcName,
			},
		},
		Spec: corev1.PodSpec{
			RestartPolicy: corev1.RestartPolicyNever,
			Containers: []corev1.Container{{
				Name:  "browse",
				Image: "busybox:1.36",
				Command: []string{
					"sh", "-c", "sleep 900",
				},
				VolumeMounts: []corev1.VolumeMount{{
					Name:      "target",
					MountPath: "/mnt/claim",
					ReadOnly:  true,
				}},
				Resources: corev1.ResourceRequirements{},
			}},
			Volumes: []corev1.Volume{{
				Name: "target",
				VolumeSource: corev1.VolumeSource{
					PersistentVolumeClaim: &corev1.PersistentVolumeClaimVolumeSource{
						ClaimName: pvcName,
						ReadOnly:  true,
					},
				},
			}},
		},
	}
	if _, err := clientset.CoreV1().Pods(namespace).Create(a.ctx, podSpec, metav1.CreateOptions{}); err != nil {
		return "", "", "", "", err
	}
	// Wait for running (timeout 20s)
	deadline := time.Now().Add(20 * time.Second)
	for time.Now().Before(deadline) {
		p, e := clientset.CoreV1().Pods(namespace).Get(a.ctx, name, metav1.GetOptions{})
		if e == nil && p.Status.Phase == corev1.PodRunning {
			return name, "browse", "/mnt/claim", "", nil
		}
		time.Sleep(750 * time.Millisecond)
	}
	return "", "", "", "", fmt.Errorf("helper pod not ready in time")
}

func sanitizeName(in string, max int) string {
	valid := regexp.MustCompile(`[^a-z0-9\-]`)
	s := strings.ToLower(in)
	s = valid.ReplaceAllString(s, "-")
	s = strings.Trim(s, "-")
	if len(s) > max {
		s = s[:max]
	}
	if s == "" {
		s = "pvc"
	}
	return s
}

// execInPod performs an exec and returns stdout as string
func (a *App) execInPod(namespace, pod, container string, command []string, timeout time.Duration) (string, error) {
	if pod == "" || container == "" {
		return "", fmt.Errorf("pod/container required")
	}
	restCfg, err := a.getRESTConfig()
	if err != nil {
		return "", err
	}
	clientset, err := a.getKubernetesClient()
	if err != nil {
		return "", err
	}
	req := clientset.CoreV1().RESTClient().Post().Resource("pods").Name(pod).Namespace(namespace).SubResource("exec")
	req.VersionedParams(&corev1.PodExecOptions{
		Container: container,
		Command:   command,
		Stdout:    true,
		Stderr:    true,
		Stdin:     false,
		TTY:       false,
	}, scheme.ParameterCodec)
	executor, err := remotecommand.NewSPDYExecutor(restCfg, "POST", req.URL())
	if err != nil {
		return "", err
	}
	var stdout, stderr bytes.Buffer
	ctx, cancel := context.WithTimeout(a.ctx, timeout)
	defer cancel()
	err = executor.StreamWithContext(ctx, remotecommand.StreamOptions{Stdout: &stdout, Stderr: &stderr})
	if ctx.Err() == context.DeadlineExceeded {
		return "", fmt.Errorf("exec timeout")
	}
	if err != nil {
		return "", fmt.Errorf("exec error: %v (stderr: %s)", err, stderr.String())
	}
	return stdout.String(), nil
}

// execInPodLimited similar to execInPod but limits stdout to maxBytes (if >0)
func (a *App) execInPodLimited(namespace, pod, container string, command []string, timeout time.Duration, maxBytes int64) (string, error) {
	if pod == "" || container == "" {
		return "", fmt.Errorf("pod/container required")
	}
	restCfg, err := a.getRESTConfig()
	if err != nil {
		return "", err
	}
	clientset, err := a.getKubernetesClient()
	if err != nil {
		return "", err
	}
	req := clientset.CoreV1().RESTClient().Post().Resource("pods").Name(pod).Namespace(namespace).SubResource("exec")
	req.VersionedParams(&corev1.PodExecOptions{
		Container: container,
		Command:   command,
		Stdout:    true,
		Stderr:    true,
		Stdin:     false,
		TTY:       false,
	}, scheme.ParameterCodec)
	executor, err := remotecommand.NewSPDYExecutor(restCfg, "POST", req.URL())
	if err != nil {
		return "", err
	}
	var stdout, stderr bytes.Buffer
	var writer io.Writer = &stdout
	if maxBytes > 0 {
		writer = &limitedWriter{W: &stdout, Limit: maxBytes}
	}
	ctx, cancel := context.WithTimeout(a.ctx, timeout)
	defer cancel()
	err = executor.StreamWithContext(ctx, remotecommand.StreamOptions{Stdout: writer, Stderr: &stderr})
	if ctx.Err() == context.DeadlineExceeded {
		return "", fmt.Errorf("exec timeout")
	}
	if err != nil {
		return "", fmt.Errorf("exec error: %v (stderr: %s)", err, stderr.String())
	}
	return stdout.String(), nil
}

type limitedWriter struct {
	W     *bytes.Buffer
	Limit int64
}

func (l *limitedWriter) Write(p []byte) (int, error) {
	if int64(l.W.Len()) >= l.Limit {
		return len(p), nil
	}
	remaining := l.Limit - int64(l.W.Len())
	if int64(len(p)) > remaining {
		l.W.Write(p[:remaining])
		return len(p), nil
	}
	return l.W.Write(p)
}

// findPodMountingPVC attempts to locate an existing running pod mounting the PVC.
// isPodReady checks if at least one container in the pod is ready
func isPodReady(p *corev1.Pod) bool {
	if p.Status.Phase != corev1.PodRunning {
		return false
	}
	for _, cs := range p.Status.ContainerStatuses {
		if cs.Ready {
			return true
		}
	}
	return false
}

// getVolumeNamesForPVC returns a set of volume names that reference the given PVC
func getVolumeNamesForPVC(p *corev1.Pod, pvcName string) map[string]bool {
	volForPVC := make(map[string]bool)
	for _, v := range p.Spec.Volumes {
		if v.PersistentVolumeClaim != nil && v.PersistentVolumeClaim.ClaimName == pvcName {
			volForPVC[v.Name] = true
		}
	}
	return volForPVC
}

// findContainerMountingVolume finds a container that mounts any of the given volumes
func findContainerMountingVolume(p *corev1.Pod, volNames map[string]bool) (containerName, mountPath, subPath string, found bool) {
	for _, c := range p.Spec.Containers {
		for _, m := range c.VolumeMounts {
			if volNames[m.Name] {
				return c.Name, m.MountPath, m.SubPath, true
			}
		}
	}
	return "", "", "", false
}

// Returns error if none found (caller may create helper pod).
func (a *App) findPodMountingPVC(namespace, pvcName string) (podName, containerName, mountPath, subPath string, err error) {
	clientset, err2 := a.getKubernetesClient()
	if err2 != nil {
		err = err2
		return
	}
	pods, err2 := clientset.CoreV1().Pods(namespace).List(a.ctx, metav1.ListOptions{})
	if err2 != nil {
		err = err2
		return
	}
	for _, p := range pods.Items {
		if !isPodReady(&p) {
			continue
		}
		volForPVC := getVolumeNamesForPVC(&p, pvcName)
		if len(volForPVC) == 0 {
			continue
		}
		cName, mPath, sPath, found := findContainerMountingVolume(&p, volForPVC)
		if found {
			return p.Name, cName, mPath, sPath, nil
		}
	}
	err = errors.New("no running pod found mounting pvc")
	return
}
