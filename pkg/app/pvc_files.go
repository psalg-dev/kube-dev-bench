package app

import (
	"bytes"
	"context"
	"encoding/base64"
	"errors"
	"fmt"
	"math/rand"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"time"

	"io"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes/scheme"
	"k8s.io/client-go/tools/remotecommand"
)

// ListPVCFiles lists files for a PersistentVolumeClaim by reusing an existing running pod that mounts it.
// path is relative to the root of the PVC mount ("/" means the mount root). Only directories are listed.
// This MVP implementation:
//   - Only reuses an existing running pod (no helper pod creation)
//   - Executes an `ls -alp` and parses output
//   - Returns minimal fields required by UI
//   - Hard times out after 5 seconds
func (a *App) ListPVCFiles(namespace, pvcName, path string) ([]PodFileEntry, error) {
	if namespace == "" {
		return nil, fmt.Errorf("namespace required")
	}
	if pvcName == "" {
		return nil, fmt.Errorf("pvc name required")
	}
	if strings.Contains(path, "..") {
		return nil, fmt.Errorf("invalid path")
	}
	if path == "" {
		path = "/"
	}

	clientset, err := a.getKubernetesClient()
	if err != nil {
		return nil, err
	}

	// Ensure PVC exists & is bound (we don't strictly require Bound but it's a helpful early check)
	pvc, err := clientset.CoreV1().PersistentVolumeClaims(namespace).Get(a.ctx, pvcName, metav1.GetOptions{})
	if err != nil {
		return nil, err
	}
	if pvc.Status.Phase == corev1.ClaimLost {
		return nil, fmt.Errorf("pvc is in Lost state")
	}

	pod, container, mountPath, subPath, err := a.findPodMountingPVC(namespace, pvcName)
	if err != nil {
		// attempt helper pod creation
		pod, container, mountPath, subPath, err = a.ensurePVCBrowseHelper(namespace, pvcName)
		if err != nil {
			return nil, err
		}
	}

	// Build absolute path inside container
	rel := strings.TrimPrefix(path, "/")
	absPath := mountPath
	if subPath != "" {
		// If a subPath is used in the mount, the effective root is mountPath/subPath
		absPath = strings.TrimSuffix(absPath, "/") + "/" + strings.TrimPrefix(subPath, "/")
	}
	if rel != "" {
		absPath = strings.TrimSuffix(absPath, "/") + "/" + rel
	}

	// Use POSIX locale stable output. We skip first line (total X). time-style ISO for parse friendliness.
	// tail -n +2 ensures we skip the summary line if present.
	cmd := []string{"sh", "-c", fmt.Sprintf("ls -alp --time-style=+%%Y-%%m-%%dT%%H:%%M:%%S %q 2>/dev/null | tail -n +2", absPath)}
	raw, err := a.execInPod(namespace, pod, container, cmd, 5*time.Second)
	if err != nil {
		return nil, fmt.Errorf("exec ls: %w", err)
	}
	lines := strings.Split(strings.TrimSpace(raw), "\n")
	// Regex: type+perms, links, owner, group, size, timestamp, name (allow spaces in name => we capture rest)
	re := regexp.MustCompile(`^([\-ldcbps])([rwxstST\-]{9})\s+\d+\s+\S+\s+\S+\s+(\d+)\s+(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})\s+(.+)$`)
	now := time.Now()
	var entries []PodFileEntry
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		m := re.FindStringSubmatch(line)
		if len(m) != 6 {
			continue // skip unparseable line (e.g., permission denied entries)
		}
		fType := m[1]
		sizeStr := m[3]
		ts := m[4]
		nameField := m[5]
		// Symlink 'name -> target'
		var name = nameField
		var linkTarget string
		isSymlink := false
		if fType == "l" {
			parts := strings.SplitN(nameField, " -> ", 2)
			name = parts[0]
			if len(parts) == 2 {
				linkTarget = parts[1]
			}
			isSymlink = true
		}
		if name == "." || name == ".." {
			continue
		}
		size := int64(0)
		// Intentionally ignoring scan error; defaults to 0 size if parse fails
		_, _ = fmt.Sscan(sizeStr, &size)
		modified := ts
		// Validate timestamp parse (ignore error; fallback to ts string)
		if _, err := time.Parse("2006-01-02T15:04:05", ts); err != nil {
			modified = now.UTC().Format(time.RFC3339)
		}
		entryPath := strings.TrimSuffix(path, "/") + "/" + name
		if path == "/" {
			entryPath = "/" + name
		}
		entries = append(entries, PodFileEntry{
			Name:       name,
			Path:       entryPath,
			IsDir:      fType == "d",
			Size:       size,
			Mode:       fType + m[2],
			Modified:   modified,
			IsSymlink:  isSymlink,
			LinkTarget: linkTarget,
		})
	}
	// Sort directories first then by name
	sort.Slice(entries, func(i, j int) bool {
		if entries[i].IsDir != entries[j].IsDir {
			return entries[i].IsDir && !entries[j].IsDir
		}
		return entries[i].Name < entries[j].Name
	})
	return entries, nil
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
	base := mountPath
	if subPath != "" {
		base = strings.TrimSuffix(base, "/") + "/" + strings.TrimPrefix(subPath, "/")
	}
	abs := base
	if rel != "" {
		abs = strings.TrimSuffix(abs, "/") + "/" + rel
	}
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
	var tarCmd string
	if kind == "dir" {
		// For root '/' we want contents of mountPath
		if rel == "" {
			tarCmd = fmt.Sprintf("tar -C %q -czf - .", abs)
		} else {
			tarCmd = fmt.Sprintf("tar -C %q -czf - .", abs)
		}
	} else {
		parent := filepath.Dir(abs)
		name := filepath.Base(abs)
		tarCmd = fmt.Sprintf("tar -C %q -czf - %q", parent, name)
	}
	data, err := a.execInPodLimited(namespace, pod, container, []string{"sh", "-c", tarCmd}, 60*time.Second, maxBytes)
	if err != nil {
		return ArchiveResult{}, err
	}
	truncated := false
	if maxBytes > 0 && int64(len(data)) >= maxBytes {
		truncated = true
	}
	encoded := base64.StdEncoding.EncodeToString([]byte(data))
	return ArchiveResult{Path: path, Base64: encoded, Truncated: truncated, Size: int64(len(data))}, nil
}

// ensurePVCBrowseHelper creates or reuses a helper pod to mount the PVC read-only.
func (a *App) ensurePVCBrowseHelper(namespace, pvcName string) (podName, containerName, mountPath, subPath string, err error) {
	clientset, err2 := a.getKubernetesClient()
	if err2 != nil {
		err = err2
		return
	}
	// Try to find existing helper pod
	labelSel := fmt.Sprintf("app=kdb-pvc-browse,kdb-pvc=%s", pvcName)
	pods, _ := clientset.CoreV1().Pods(namespace).List(a.ctx, metav1.ListOptions{LabelSelector: labelSel})
	for _, p := range pods.Items {
		if p.Status.Phase == corev1.PodRunning {
			podName = p.Name
			containerName = "browse"
			mountPath = "/mnt/claim"
			return
		}
	}
	// Create new helper pod
	suffix := rand.Int31() & 0xffff
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
	if _, err2 := clientset.CoreV1().Pods(namespace).Create(a.ctx, podSpec, metav1.CreateOptions{}); err2 != nil {
		err = err2
		return
	}
	// Wait for running (timeout 20s)
	deadline := time.Now().Add(20 * time.Second)
	for time.Now().Before(deadline) {
		p, e := clientset.CoreV1().Pods(namespace).Get(a.ctx, name, metav1.GetOptions{})
		if e == nil && p.Status.Phase == corev1.PodRunning {
			podName = name
			containerName = "browse"
			mountPath = "/mnt/claim"
			return
		}
		time.Sleep(750 * time.Millisecond)
	}
	err = fmt.Errorf("helper pod not ready in time")
	return
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
		if p.Status.Phase != corev1.PodRunning {
			continue
		}
		ready := false
		for _, cs := range p.Status.ContainerStatuses {
			if cs.Ready {
				ready = true
				break
			}
		}
		if !ready {
			continue
		}
		volForPVC := make(map[string]bool)
		for _, v := range p.Spec.Volumes {
			if v.PersistentVolumeClaim != nil && v.PersistentVolumeClaim.ClaimName == pvcName {
				volForPVC[v.Name] = true
			}
		}
		if len(volForPVC) == 0 {
			continue
		}
		for _, c := range p.Spec.Containers {
			for _, m := range c.VolumeMounts {
				if volForPVC[m.Name] {
					podName = p.Name
					containerName = c.Name
					mountPath = m.MountPath
					subPath = m.SubPath
					return
				}
			}
		}
	}
	err = errors.New("no running pod found mounting pvc")
	return
}
