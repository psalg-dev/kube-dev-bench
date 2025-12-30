package app

import (
	"bytes"
	"context"
	"encoding/base64"
	"fmt"
	"sort"
	"strconv"
	"strings"
	"time"

	v1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/kubernetes/scheme"
	"k8s.io/client-go/tools/remotecommand"

	"gopkg.in/yaml.v3"
)

// GetPodYAML returns the live Pod manifest as YAML
func (a *App) GetPodYAML(podName string) (string, error) {
	if a.currentNamespace == "" {
		return "", fmt.Errorf("no namespace selected")
	}
	clientset, err := a.getKubernetesInterface()
	if err != nil {
		return "", err
	}
	pod, err := clientset.CoreV1().Pods(a.currentNamespace).Get(a.ctx, podName, metav1.GetOptions{})
	if err != nil {
		return "", err
	}
	out, err := yaml.Marshal(pod)
	if err != nil {
		return "", err
	}
	return string(out), nil
}

// GetPodContainers returns the list of container names for the pod (regular containers only)
func (a *App) GetPodContainers(podName string) ([]string, error) {
	if a.currentNamespace == "" {
		return nil, fmt.Errorf("no namespace selected")
	}
	clientset, err := a.getKubernetesInterface()
	if err != nil {
		return nil, err
	}
	pod, err := clientset.CoreV1().Pods(a.currentNamespace).Get(a.ctx, podName, metav1.GetOptions{})
	if err != nil {
		return nil, err
	}
	names := make([]string, 0, len(pod.Spec.Containers))
	for _, c := range pod.Spec.Containers {
		names = append(names, c.Name)
	}
	return names, nil
}

// GetPodSummary fetches a pod and returns a concise summary
func (a *App) GetPodSummary(podName string) (PodSummary, error) {
	var out PodSummary
	if a.currentNamespace == "" {
		return out, fmt.Errorf("no namespace selected")
	}
	clientset, err := a.getKubernetesInterface()
	if err != nil {
		return out, err
	}
	pod, err := clientset.CoreV1().Pods(a.currentNamespace).Get(a.ctx, podName, metav1.GetOptions{})
	if err != nil {
		return out, err
	}
	ports := []int{}
	for _, c := range pod.Spec.Containers {
		for _, p := range c.Ports {
			if p.ContainerPort > 0 {
				ports = append(ports, int(p.ContainerPort))
			}
		}
	}
	out = PodSummary{
		Name:      pod.Name,
		Namespace: pod.Namespace,
		Created:   pod.CreationTimestamp.Time,
		Labels:    pod.Labels,
		Status:    string(pod.Status.Phase),
		Ports:     ports,
	}
	return out, nil
}

// GetPodContainerPorts returns a flat list of all defined container ports for the pod
func (a *App) GetPodContainerPorts(podName string) ([]int, error) {
	if a.currentNamespace == "" {
		return nil, fmt.Errorf("no namespace selected")
	}
	clientset, err := a.getKubernetesInterface()
	if err != nil {
		return nil, err
	}
	pod, err := clientset.CoreV1().Pods(a.currentNamespace).Get(a.ctx, podName, metav1.GetOptions{})
	if err != nil {
		return nil, err
	}
	ports := []int{}
	for _, c := range pod.Spec.Containers {
		for _, p := range c.Ports {
			if p.ContainerPort > 0 {
				ports = append(ports, int(p.ContainerPort))
			}
		}
	}
	return ports, nil
}

// GetPodMounts returns volumes and volume mounts (incl. secret mounts) for a pod
func (a *App) GetPodMounts(podName string) (PodMounts, error) {
	var result PodMounts
	if a.currentNamespace == "" {
		return result, fmt.Errorf("no namespace selected")
	}
	clientset, err := a.getKubernetesInterface()
	if err != nil {
		return result, err
	}
	pod, err := clientset.CoreV1().Pods(a.currentNamespace).Get(a.ctx, podName, metav1.GetOptions{})
	if err != nil {
		return result, err
	}
	// Build volumes info
	vols := make([]VolumeInfo, 0, len(pod.Spec.Volumes))
	for _, v := range pod.Spec.Volumes {
		vi := VolumeInfo{Name: v.Name}
		if v.Secret != nil {
			vi.Type = "Secret"
			vi.SecretName = v.Secret.SecretName
		} else if v.ConfigMap != nil {
			vi.Type = "ConfigMap"
			if v.ConfigMap.Name != "" {
				vi.ConfigMapName = v.ConfigMap.Name
			}
		} else if v.PersistentVolumeClaim != nil {
			vi.Type = "PVC"
			vi.PersistentVolumeClaim = v.PersistentVolumeClaim.ClaimName
		} else if v.HostPath != nil {
			vi.Type = "HostPath"
			if v.HostPath.Path != "" {
				vi.HostPath = v.HostPath.Path
			}
		} else if v.EmptyDir != nil {
			vi.Type = "EmptyDir"
			vi.EmptyDir = true
		} else if v.Projected != nil {
			vi.Type = "Projected"
			for _, src := range v.Projected.Sources {
				if src.Secret != nil {
					name := src.Secret.Name
					if name != "" {
						vi.ProjectedSecretNames = append(vi.ProjectedSecretNames, name)
					}
				}
				if src.ConfigMap != nil {
					name := src.ConfigMap.Name
					if name != "" {
						vi.ProjectedConfigMapNames = append(vi.ProjectedConfigMapNames, name)
					}
				}
			}
		} else if v.DownwardAPI != nil {
			vi.Type = "DownwardAPI"
		} else if v.CSI != nil {
			vi.Type = "CSI"
		} else {
			vi.Type = "Other"
		}
		vols = append(vols, vi)
	}
	result.Volumes = vols
	for _, c := range pod.Spec.InitContainers {
		cm := ContainerMountInfo{Container: c.Name, IsInit: true}
		for _, m := range c.VolumeMounts {
			cm.Mounts = append(cm.Mounts, MountInfo{
				Name:      m.Name,
				MountPath: m.MountPath,
				ReadOnly:  m.ReadOnly,
				SubPath:   m.SubPath,
			})
		}
		result.Containers = append(result.Containers, cm)
	}
	for _, c := range pod.Spec.Containers {
		cm := ContainerMountInfo{Container: c.Name}
		for _, m := range c.VolumeMounts {
			cm.Mounts = append(cm.Mounts, MountInfo{
				Name:      m.Name,
				MountPath: m.MountPath,
				ReadOnly:  m.ReadOnly,
				SubPath:   m.SubPath,
			})
		}
		result.Containers = append(result.Containers, cm)
	}
	return result, nil
}

// GetPodFiles lists files & directories at a given path inside a pod container.
// Enhanced: returns size (bytes) & Mode (dir|file|symlink|other) using a single exec.
func (a *App) GetPodFiles(podName, container, path string) ([]PodFileEntry, error) {
	if a.currentNamespace == "" {
		return nil, fmt.Errorf("no namespace selected")
	}
	if podName == "" {
		return nil, fmt.Errorf("pod name required")
	}
	if path == "" {
		path = "/"
	}
	if !strings.HasPrefix(path, "/") {
		path = "/" + path
	}
	// client & pod
	restConfig, err := a.getRESTConfig()
	if err != nil {
		return nil, err
	}
	clientset, err := kubernetes.NewForConfig(restConfig)
	if err != nil {
		return nil, err
	}
	pod, err := clientset.CoreV1().Pods(a.currentNamespace).Get(a.ctx, podName, metav1.GetOptions{})
	if err != nil {
		return nil, err
	}
	if container == "" {
		if len(pod.Spec.Containers) == 0 {
			return nil, fmt.Errorf("pod has no containers")
		}
		container = pod.Spec.Containers[0].Name
	} else {
		ok := false
		for _, c := range pod.Spec.Containers {
			if c.Name == container {
				ok = true
				break
			}
		}
		if !ok {
			return nil, fmt.Errorf("container '%s' not found", container)
		}
	}
	escaped := shEscape(path)
	// Portable listing: iterate dotfiles and regular files; use wc -c for size; modification time via stat -c %Y
	cmdStr := "p=" + escaped + `
if [ -d "$p" ]; then
  for f in "$p"/.[!.]* "$p"/..?* "$p"/*; do
    [ -e "$f" ] || continue
    bn=$(basename "$f")
    [ -n "$bn" ] || continue
    if [ -d "$f" ]; then t=d; elif [ -L "$f" ]; then t=l; elif [ -f "$f" ]; then t=f; else t=o; fi
    if [ "$t" = f ]; then sz=$( (wc -c <"$f" 2>/dev/null) || echo 0 ); else sz=0; fi
    ct=$(stat -c %Y "$f" 2>/dev/null || echo 0)
    printf '%s\t%s\t%s\t%s\n' "$bn" "$t" "$sz" "$ct"
  done
fi`
	cmd := []string{"/bin/sh", "-c", cmdStr}
	req := clientset.CoreV1().RESTClient().Post().Resource("pods").Namespace(a.currentNamespace).Name(podName).SubResource("exec")
	opts := &v1.PodExecOptions{Container: container, Command: cmd, Stdout: true, Stderr: true, TTY: false}
	req = req.VersionedParams(opts, scheme.ParameterCodec)
	exec, err := remotecommand.NewSPDYExecutor(restConfig, "POST", req.URL())
	if err != nil {
		return nil, err
	}
	var stdout, stderr bytes.Buffer
	ctx, cancel := context.WithTimeout(a.ctx, 15*time.Second)
	defer cancel()
	if err := exec.StreamWithContext(ctx, remotecommand.StreamOptions{Stdout: &stdout, Stderr: &stderr}); err != nil {
		return nil, fmt.Errorf("exec list failed: %v (%s)", err, strings.TrimSpace(stderr.String()))
	}
	lines := strings.Split(stdout.String(), "\n")
	entries := make([]PodFileEntry, 0, len(lines))
	for _, ln := range lines {
		ln = strings.TrimSpace(ln)
		if ln == "" {
			continue
		}
		parts := strings.Split(ln, "\t")
		if len(parts) < 4 {
			continue
		}
		name, tchar, szs, cts := parts[0], parts[1], parts[2], parts[3]
		if name == "." || name == ".." {
			continue
		}
		full := path
		if !strings.HasSuffix(full, "/") {
			full += "/"
		}
		full += name
		var sz int64
		if v, err := strconv.ParseInt(szs, 10, 64); err == nil {
			sz = v
		}
		var created int64
		if v, err := strconv.ParseInt(cts, 10, 64); err == nil {
			created = v
		}
		isDir := tchar == "d"
		ptype := "file"
		switch tchar {
		case "d":
			ptype = "dir"
		case "l":
			ptype = "symlink"
		case "f":
			ptype = "file"
		default:
			ptype = "other"
		}
		entries = append(entries, PodFileEntry{Name: name, Path: full, IsDir: isDir, Size: sz, Mode: ptype, Created: created})
	}
	if len(entries) > 1 {
		sort.Slice(entries, func(i, j int) bool {
			if entries[i].IsDir != entries[j].IsDir {
				return entries[i].IsDir && !entries[j].IsDir
			}
			return entries[i].Name < entries[j].Name
		})
	}
	return entries, nil
}

// SearchPodFiles performs a recursive name search starting at path. maxDepth<=0 => unlimited. maxResults caps results (>0)
func (a *App) SearchPodFiles(podName, container, path, query string, maxDepth, maxResults int) ([]PodFileEntry, error) {
	if a.currentNamespace == "" {
		return nil, fmt.Errorf("no namespace selected")
	}
	if podName == "" {
		return nil, fmt.Errorf("pod name required")
	}
	if path == "" {
		path = "/"
	}
	if !strings.HasPrefix(path, "/") {
		path = "/" + path
	}
	q := strings.ToLower(strings.TrimSpace(query))
	if q == "" {
		return []PodFileEntry{}, nil
	}
	restConfig, err := a.getRESTConfig()
	if err != nil {
		return nil, err
	}
	clientset, err := kubernetes.NewForConfig(restConfig)
	if err != nil {
		return nil, err
	}
	pod, err := clientset.CoreV1().Pods(a.currentNamespace).Get(a.ctx, podName, metav1.GetOptions{})
	if err != nil {
		return nil, err
	}
	// Determine container
	if container == "" {
		if len(pod.Spec.Containers) == 0 {
			return nil, fmt.Errorf("pod has no containers")
		}
		container = pod.Spec.Containers[0].Name
	} else {
		ok := false
		for _, c := range pod.Spec.Containers {
			if c.Name == container {
				ok = true
				break
			}
		}
		if !ok {
			return nil, fmt.Errorf("container '%s' not found", container)
		}
	}
	escaped := shEscape(path)
	depthArg := ""
	if maxDepth > 0 {
		depthArg = fmt.Sprintf("-maxdepth %d", maxDepth)
	}
	// We capture all entries first then filter in Go for case-insensitive substring on basename.
	cmdStr := fmt.Sprintf(`if command -v find >/dev/null 2>&1; then
  find %s %s -mindepth 1 -printf '%%p\t%%y\t%%s\t%%T@\n' 2>/dev/null || true
else
  for f in %s/* %s/.[!.]* %s/..?*; do [ -e "$f" ] || continue; bn=$(basename "$f"); if [ -d "$f" ]; then t=d; elif [ -L "$f" ]; then t=l; elif [ -f "$f" ]; then t=f; else t=o; fi; sz=0; if [ "$t" = f ]; then sz=$( (wc -c <"$f" 2>/dev/null) || echo 0); fi; ct=$(stat -c %%Y "$f" 2>/dev/null || echo 0); printf '%%s\t%%s\t%%s\t%%s\n' "$f" "$t" "$sz" "$ct"; done
fi`, escaped, depthArg, escaped, escaped, escaped)
	cmd := []string{"/bin/sh", "-c", cmdStr}

	req := clientset.CoreV1().RESTClient().Post().Resource("pods").Namespace(a.currentNamespace).Name(podName).SubResource("exec")
	opts := &v1.PodExecOptions{Container: container, Command: cmd, Stdout: true, Stderr: true, TTY: false}
	req = req.VersionedParams(opts, scheme.ParameterCodec)
	executor, err := remotecommand.NewSPDYExecutor(restConfig, "POST", req.URL())
	if err != nil {
		return nil, err
	}
	var stdout, stderr bytes.Buffer
	ctx, cancel := context.WithTimeout(a.ctx, 30*time.Second)
	defer cancel()
	if err := executor.StreamWithContext(ctx, remotecommand.StreamOptions{Stdout: &stdout, Stderr: &stderr}); err != nil {
		return nil, fmt.Errorf("search exec failed: %v (%s)", err, strings.TrimSpace(stderr.String()))
	}
	lines := strings.Split(stdout.String(), "\n")
	res := make([]PodFileEntry, 0)
	for _, ln := range lines {
		ln = strings.TrimSpace(ln)
		if ln == "" {
			continue
		}
		parts := strings.Split(ln, "\t")
		if len(parts) < 4 {
			continue
		}
		full, tchar, szs, cts := parts[0], parts[1], parts[2], parts[3]
		bn := full
		if idx := strings.LastIndex(full, "/"); idx >= 0 {
			bn = full[idx+1:]
		}
		if !strings.Contains(strings.ToLower(bn), q) {
			continue
		}
		var sz int64
		if v, err := strconv.ParseInt(szs, 10, 64); err == nil {
			sz = v
		}
		var created int64
		// find's %T@ prints float; trim fractional
		if strings.Contains(cts, ".") {
			cts = strings.SplitN(cts, ".", 2)[0]
		}
		if v, err := strconv.ParseInt(cts, 10, 64); err == nil {
			created = v
		}
		isDir := tchar == "d"
		ptype := "file"
		switch tchar {
		case "d":
			ptype = "dir"
		case "l":
			ptype = "symlink"
		case "f":
			ptype = "file"
		default:
			ptype = "other"
		}
		res = append(res, PodFileEntry{Name: bn, Path: full, IsDir: isDir, Size: sz, Mode: ptype, Created: created})
		if maxResults > 0 && len(res) >= maxResults {
			break
		}
	}
	if len(res) > 1 {
		sort.Slice(res, func(i, j int) bool { return res[i].Path < res[j].Path })
	}
	return res, nil
}

// GetPodFileContent returns (possibly truncated) file content in base64 for a pod container path.
// maxBytes caps the bytes read (defaults to 128KB if <=0 or too large).
func (a *App) GetPodFileContent(podName, container, path string, maxBytes int) (PodFileContent, error) {
	var resp PodFileContent
	if a.currentNamespace == "" {
		return resp, fmt.Errorf("no namespace selected")
	}
	if podName == "" {
		return resp, fmt.Errorf("pod name required")
	}
	if path == "" || strings.HasSuffix(path, "/") {
		return resp, fmt.Errorf("path must be a file, got directory or empty")
	}
	if maxBytes <= 0 || maxBytes > 5*1024*1024 { // cap at 5MB
		maxBytes = 128 * 1024
	}
	resp.Path = path
	// Setup client
	restConfig, err := a.getRESTConfig()
	if err != nil {
		return resp, err
	}
	clientset, err := kubernetes.NewForConfig(restConfig)
	if err != nil {
		return resp, err
	}
	pod, err := clientset.CoreV1().Pods(a.currentNamespace).Get(a.ctx, podName, metav1.GetOptions{})
	if err != nil {
		return resp, err
	}
	// Determine container
	if container == "" {
		if len(pod.Spec.Containers) == 0 {
			return resp, fmt.Errorf("pod has no containers")
		}
		container = pod.Spec.Containers[0].Name
	} else {
		ok := false
		for _, c := range pod.Spec.Containers {
			if c.Name == container {
				ok = true
				break
			}
		}
		if !ok {
			return resp, fmt.Errorf("container '%s' not found", container)
		}
	}
	// First: get size via wc -c; if file absent treat as error
	escaped := shEscape(path)
	sizeCmdStr := fmt.Sprintf("if [ -f %s ]; then wc -c < %s; else echo ERR; fi", escaped, escaped)
	sizeCmd := []string{"/bin/sh", "-c", sizeCmdStr}
	sizeReq := clientset.CoreV1().RESTClient().Post().Resource("pods").Namespace(a.currentNamespace).Name(podName).SubResource("exec")
	sizeOpts := &v1.PodExecOptions{Container: container, Command: sizeCmd, Stdout: true, Stderr: true, TTY: false}
	sizeReq = sizeReq.VersionedParams(sizeOpts, scheme.ParameterCodec)
	sizeExec, err := remotecommand.NewSPDYExecutor(restConfig, "POST", sizeReq.URL())
	if err != nil {
		return resp, err
	}
	var sizeOut, sizeErr bytes.Buffer
	ctx1, cancel1 := context.WithTimeout(a.ctx, defaultShortTimeout())
	defer cancel1()
	if err := sizeExec.StreamWithContext(ctx1, remotecommand.StreamOptions{Stdout: &sizeOut, Stderr: &sizeErr}); err != nil {
		return resp, fmt.Errorf("size exec failed: %v", err)
	}
	szLine := strings.TrimSpace(sizeOut.String())
	if szLine == "ERR" {
		return resp, fmt.Errorf("not a regular file: %s", path)
	}
	var fullSize int64 = 0
	if szLine != "" {
		fmt.Sscan(szLine, &fullSize)
	}
	resp.Size = fullSize
	// Second: read up to maxBytes using head -c
	readCmdStr := fmt.Sprintf("head -c %d %s 2>/dev/null", maxBytes, escaped)
	readCmd := []string{"/bin/sh", "-c", readCmdStr}
	readReq := clientset.CoreV1().RESTClient().Post().Resource("pods").Namespace(a.currentNamespace).Name(podName).SubResource("exec")
	readOpts := &v1.PodExecOptions{Container: container, Command: readCmd, Stdout: true, Stderr: true, TTY: false}
	readReq = readReq.VersionedParams(readOpts, scheme.ParameterCodec)
	readExec, err := remotecommand.NewSPDYExecutor(restConfig, "POST", readReq.URL())
	if err != nil {
		return resp, err
	}
	var fileBuf, fileErr bytes.Buffer
	ctx2, cancel2 := context.WithTimeout(a.ctx, 15*time.Second)
	defer cancel2()
	if err := readExec.StreamWithContext(ctx2, remotecommand.StreamOptions{Stdout: &fileBuf, Stderr: &fileErr}); err != nil {
		return resp, fmt.Errorf("read exec failed: %v", err)
	}
	data := fileBuf.Bytes()
	resp.Truncated = int64(len(data)) < fullSize
	// Binary detection
	isBinary := false
	checkLen := len(data)
	if checkLen > 8000 {
		checkLen = 8000
	}
	if checkLen > 0 {
		nonPrintable := 0
		nullBytes := 0
		for i := 0; i < checkLen; i++ {
			b := data[i]
			if b == 0 {
				nullBytes++
				if nullBytes > 0 {
					isBinary = true
					break
				}
			}
			if b < 0x09 || (b > 0x0D && b < 0x20) {
				nonPrintable++
			}
		}
		// heuristic: >30% non-printable => binary
		if !isBinary && float64(nonPrintable)/float64(checkLen) > 0.30 {
			isBinary = true
		}
	}
	resp.IsBinary = isBinary
	resp.Base64 = base64.StdEncoding.EncodeToString(data)
	return resp, nil
}

// GetPodFileContentSimple returns a default preview (128KB)
func (a *App) GetPodFileContentSimple(podName, container, path string) (PodFileContent, error) {
	return a.GetPodFileContent(podName, container, path, 128*1024)
}

// shEscape minimal shell escaping for a path argument
func shEscape(s string) string {
	if s == "" {
		return ""
	}
	if !strings.ContainsAny(s, " '`)\"") {
		return s
	}
	return "'" + strings.ReplaceAll(s, "'", "'\\''") + "'"
}

// defaultShortTimeout returns a short timeout for single exec operations
func defaultShortTimeout() time.Duration { return 5 * time.Second }
