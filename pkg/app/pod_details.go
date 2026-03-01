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
	"k8s.io/client-go/rest"
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

// GetPodDetailInNamespace fetches a pod in the given namespace and returns a concise summary.
// This is used by the MCP server which always specifies the namespace explicitly.
func (a *App) GetPodDetailInNamespace(namespace, podName string) (PodSummary, error) {
	var out PodSummary
	if namespace == "" {
		return out, fmt.Errorf("no namespace specified")
	}
	clientset, err := a.getKubernetesInterface()
	if err != nil {
		return out, err
	}
	pod, err := clientset.CoreV1().Pods(namespace).Get(a.ctx, podName, metav1.GetOptions{})
	if err != nil {
		return out, err
	}
	return buildPodSummary(pod), nil
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
	return buildPodSummary(pod), nil
}

// buildPodSummary constructs a PodSummary from a raw Pod object
func buildPodSummary(pod *v1.Pod) PodSummary {
	ports := []int{}
	for _, c := range pod.Spec.Containers {
		for _, p := range c.Ports {
			if p.ContainerPort > 0 {
				ports = append(ports, int(p.ContainerPort))
			}
		}
	}
	created := ""
	if !pod.CreationTimestamp.IsZero() {
		created = pod.CreationTimestamp.Time.UTC().Format(time.RFC3339Nano)
	}

	initContainers := buildInitContainerInfo(pod)

	return PodSummary{
		Name:           pod.Name,
		Namespace:      pod.Namespace,
		Created:        created,
		Labels:         pod.Labels,
		Status:         string(pod.Status.Phase),
		Ports:          ports,
		InitContainers: initContainers,
	}
}

// extractContainerState extracts state information from a container status
func extractContainerState(status v1.ContainerStatus) (state, reason, message, startedAt, finishedAt string, exitCode *int32) {
	if status.State.Waiting != nil {
		return "Waiting", status.State.Waiting.Reason, status.State.Waiting.Message, "", "", nil
	}
	if status.State.Running != nil {
		started := ""
		if !status.State.Running.StartedAt.IsZero() {
			started = status.State.Running.StartedAt.Time.UTC().Format(time.RFC3339Nano)
		}
		return "Running", "", "", started, "", nil
	}
	if status.State.Terminated != nil {
		started := ""
		finished := ""
		if !status.State.Terminated.StartedAt.IsZero() {
			started = status.State.Terminated.StartedAt.Time.UTC().Format(time.RFC3339Nano)
		}
		if !status.State.Terminated.FinishedAt.IsZero() {
			finished = status.State.Terminated.FinishedAt.Time.UTC().Format(time.RFC3339Nano)
		}
		code := status.State.Terminated.ExitCode
		return "Terminated", status.State.Terminated.Reason, status.State.Terminated.Message, started, finished, &code
	}
	return "Unknown", "", "", "", "", nil
}

// buildInitContainerFromStatus builds an InitContainerInfo from container spec and status
func buildInitContainerFromStatus(c v1.Container, status v1.ContainerStatus, hasStatus bool) InitContainerInfo {
	info := InitContainerInfo{
		Name:  c.Name,
		Image: c.Image,
	}

	if !hasStatus {
		info.State = "Pending"
		info.StateReason = "ContainerNotStarted"
		return info
	}

	info.Ready = status.Ready
	info.RestartCount = status.RestartCount
	info.State, info.StateReason, info.StateMessage, info.StartedAt, info.FinishedAt, info.ExitCode = extractContainerState(status)

	return info
}

// buildInitContainerInfo extracts init container info and statuses from a pod
func buildInitContainerInfo(pod *v1.Pod) []InitContainerInfo {
	if len(pod.Spec.InitContainers) == 0 {
		return nil
	}

	// Build a map of status by container name for quick lookup
	statusMap := make(map[string]v1.ContainerStatus)
	for _, cs := range pod.Status.InitContainerStatuses {
		statusMap[cs.Name] = cs
	}

	result := make([]InitContainerInfo, 0, len(pod.Spec.InitContainers))
	for _, c := range pod.Spec.InitContainers {
		status, hasStatus := statusMap[c.Name]
		result = append(result, buildInitContainerFromStatus(c, status, hasStatus))
	}

	return result
}

// extractContainerState extracts state information from a container status
func extractContainerState(status v1.ContainerStatus) (state, reason, message, startedAt, finishedAt string, exitCode *int32) {
	if status.State.Waiting != nil {
		return "Waiting", status.State.Waiting.Reason, status.State.Waiting.Message, "", "", nil
	}
	if status.State.Running != nil {
		started := ""
		if !status.State.Running.StartedAt.IsZero() {
			started = status.State.Running.StartedAt.Time.UTC().Format(time.RFC3339Nano)
		}
		return "Running", "", "", started, "", nil
	}
	if status.State.Terminated != nil {
		started := ""
		finished := ""
		if !status.State.Terminated.StartedAt.IsZero() {
			started = status.State.Terminated.StartedAt.Time.UTC().Format(time.RFC3339Nano)
		}
		if !status.State.Terminated.FinishedAt.IsZero() {
			finished = status.State.Terminated.FinishedAt.Time.UTC().Format(time.RFC3339Nano)
		}
		code := status.State.Terminated.ExitCode
		return "Terminated", status.State.Terminated.Reason, status.State.Terminated.Message, started, finished, &code
	}
	return "Unknown", "", "", "", "", nil
}

// buildInitContainerFromStatus builds an InitContainerInfo from container spec and status
func buildInitContainerFromStatus(c v1.Container, status v1.ContainerStatus, hasStatus bool) InitContainerInfo {
	info := InitContainerInfo{
		Name:  c.Name,
		Image: c.Image,
	}

	if !hasStatus {
		info.State = "Pending"
		info.StateReason = "ContainerNotStarted"
		return info
	}

	info.Ready = status.Ready
	info.RestartCount = status.RestartCount
	info.State, info.StateReason, info.StateMessage, info.StartedAt, info.FinishedAt, info.ExitCode = extractContainerState(status)

	return info
}

// buildInitContainerInfo extracts init container info and statuses from a pod
func buildInitContainerInfo(pod *v1.Pod) []InitContainerInfo {
	if len(pod.Spec.InitContainers) == 0 {
		return nil
	}

	// Build a map of status by container name for quick lookup
	statusMap := make(map[string]v1.ContainerStatus)
	for _, cs := range pod.Status.InitContainerStatuses {
		statusMap[cs.Name] = cs
	}

	result := make([]InitContainerInfo, 0, len(pod.Spec.InitContainers))
	for _, c := range pod.Spec.InitContainers {
		status, hasStatus := statusMap[c.Name]
		result = append(result, buildInitContainerFromStatus(c, status, hasStatus))
	}

	return result
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

// buildVolumeInfo creates a VolumeInfo from a volume spec
func buildVolumeInfo(v v1.Volume) VolumeInfo {
	vi := VolumeInfo{Name: v.Name}
	vi.Type, vi.SecretName, vi.ConfigMapName, vi.PersistentVolumeClaim, vi.HostPath, vi.EmptyDir, vi.ProjectedSecretNames, vi.ProjectedConfigMapNames = extractVolumeDetails(v)
	return vi
}

// extractVolumeDetails extracts type and details from a volume
func extractVolumeDetails(v v1.Volume) (volType string, secretName string, configMapName string, pvc string, hostPath string, emptyDir bool, projSecrets []string, projConfigMaps []string) {
	switch {
	case v.Secret != nil:
		return "Secret", v.Secret.SecretName, "", "", "", false, nil, nil
	case v.ConfigMap != nil:
		return "ConfigMap", "", v.ConfigMap.Name, "", "", false, nil, nil
	case v.PersistentVolumeClaim != nil:
		return "PVC", "", "", v.PersistentVolumeClaim.ClaimName, "", false, nil, nil
	case v.HostPath != nil:
		return "HostPath", "", "", "", v.HostPath.Path, false, nil, nil
	case v.EmptyDir != nil:
		return "EmptyDir", "", "", "", "", true, nil, nil
	case v.Projected != nil:
		secrets, configMaps := extractProjectedSources(v.Projected.Sources)
		return "Projected", "", "", "", "", false, secrets, configMaps
	case v.DownwardAPI != nil:
		return "DownwardAPI", "", "", "", "", false, nil, nil
	case v.CSI != nil:
		return "CSI", "", "", "", "", false, nil, nil
	default:
		return "Other", "", "", "", "", false, nil, nil
	}
}

// extractProjectedSources extracts secret and configmap names from projected volume sources
func extractProjectedSources(sources []v1.VolumeProjection) (secrets []string, configMaps []string) {
	for _, src := range sources {
		if src.Secret != nil && src.Secret.Name != "" {
			secrets = append(secrets, src.Secret.Name)
		}
		if src.ConfigMap != nil && src.ConfigMap.Name != "" {
			configMaps = append(configMaps, src.ConfigMap.Name)
		}
	}
	return
}

// buildContainerMountInfo creates mount info for a container
func buildContainerMountInfo(containerName string, mounts []v1.VolumeMount, isInit bool) ContainerMountInfo {
	cm := ContainerMountInfo{Container: containerName, IsInit: isInit}
	for _, m := range mounts {
		cm.Mounts = append(cm.Mounts, MountInfo{
			Name:      m.Name,
			MountPath: m.MountPath,
			ReadOnly:  m.ReadOnly,
			SubPath:   m.SubPath,
		})
	}
	return cm
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
	result.Volumes = make([]VolumeInfo, 0, len(pod.Spec.Volumes))
	for _, v := range pod.Spec.Volumes {
		result.Volumes = append(result.Volumes, buildVolumeInfo(v))
	}

	// Build container mount info
	for _, c := range pod.Spec.InitContainers {
		result.Containers = append(result.Containers, buildContainerMountInfo(c.Name, c.VolumeMounts, true))
	}
	for _, c := range pod.Spec.Containers {
		result.Containers = append(result.Containers, buildContainerMountInfo(c.Name, c.VolumeMounts, false))
	}

	return result, nil
}

// resolveContainerName returns a valid container name or an error
func resolveContainerName(pod *v1.Pod, container string) (string, error) {
	if container == "" {
		if len(pod.Spec.Containers) == 0 {
			return "", fmt.Errorf("pod has no containers")
		}
		return pod.Spec.Containers[0].Name, nil
	}
	for _, c := range pod.Spec.Containers {
		if c.Name == container {
			return container, nil
		}
	}
	return "", fmt.Errorf("container '%s' not found", container)
}

// normalizePath ensures path starts with / and is not empty
func normalizePath(path string) string {
	if path == "" {
		return "/"
	}
	if !strings.HasPrefix(path, "/") {
		return "/" + path
	}
	return path
}

// parseFileType converts a type character to a mode string
func parseFileType(tchar string) (isDir bool, mode string) {
	switch tchar {
	case "d":
		return true, "dir"
	case "l":
		return false, "symlink"
	case "f":
		return false, "file"
	default:
		return false, "other"
	}
}

// parseFileEntry parses a tab-separated file entry line
func parseFileEntry(line, basePath string) (PodFileEntry, bool) {
	line = strings.TrimSpace(line)
	if line == "" {
		return PodFileEntry{}, false
	}
	parts := strings.Split(line, "\t")
	if len(parts) < 4 {
		return PodFileEntry{}, false
	}
	name, tchar, szs, cts := parts[0], parts[1], parts[2], parts[3]
	if name == "." || name == ".." {
		return PodFileEntry{}, false
	}

	full := basePath
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
	isDir, ptype := parseFileType(tchar)

	return PodFileEntry{Name: name, Path: full, IsDir: isDir, Size: sz, Mode: ptype, Created: created}, true
}

// parseSearchEntry parses a search result line (full path in first field)
func parseSearchEntry(line, query string) (PodFileEntry, bool) {
	line = strings.TrimSpace(line)
	if line == "" {
		return PodFileEntry{}, false
	}
	parts := strings.Split(line, "\t")
	if len(parts) < 4 {
		return PodFileEntry{}, false
	}
	full, tchar, szs, cts := parts[0], parts[1], parts[2], parts[3]

	bn := full
	if idx := strings.LastIndex(full, "/"); idx >= 0 {
		bn = full[idx+1:]
	}
	if !strings.Contains(strings.ToLower(bn), query) {
		return PodFileEntry{}, false
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
	isDir, ptype := parseFileType(tchar)

	return PodFileEntry{Name: bn, Path: full, IsDir: isDir, Size: sz, Mode: ptype, Created: created}, true
}

// detectBinary checks if data appears to be binary content
func detectBinary(data []byte) bool {
	checkLen := len(data)
	if checkLen > 8000 {
		checkLen = 8000
	}
	if checkLen == 0 {
		return false
	}
	nonPrintable := 0
	for i := 0; i < checkLen; i++ {
		b := data[i]
		if b == 0 {
			return true // null byte = binary
		}
		if b < 0x09 || (b > 0x0D && b < 0x20) {
			nonPrintable++
		}
	}
	// heuristic: >30% non-printable => binary
	return float64(nonPrintable)/float64(checkLen) > 0.30
}

// GetPodFiles lists files & directories at a given path inside a pod container.
// Enhanced: returns size (bytes) & Mode (dir|file|symlink|other) using a single exec.
func (a *App) GetPodFiles(podName, container, path string) ([]PodFileEntry, error) {
	if err := a.validatePodFilesRequest(podName); err != nil {
		return nil, err
	}
	path = normalizePath(path)

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
	container, err = resolveContainerName(pod, container)
	if err != nil {
		return nil, err
	}

	stdout, err := a.execPodFileList(restConfig, clientset, podName, container, path)
	if err != nil {
		return nil, err
	}

	return parseAndSortFileEntries(stdout, path), nil
}

func (a *App) execPodFileList(restConfig *rest.Config, clientset *kubernetes.Clientset, podName, container, path string) (string, error) {
	escaped := shEscape(path)
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
	req := clientset.CoreV1().RESTClient().Post().Resource("pods").Namespace(a.currentNamespace).Name(podName).SubResource("exec")
	opts := &v1.PodExecOptions{Container: container, Command: []string{"/bin/sh", "-c", cmdStr}, Stdout: true, Stderr: true, TTY: false}
	req = req.VersionedParams(opts, scheme.ParameterCodec)
	exec, err := remotecommand.NewSPDYExecutor(restConfig, "POST", req.URL())
	if err != nil {
		return "", err
	}
	var stdout, stderr bytes.Buffer
	ctx, cancel := context.WithTimeout(a.ctx, 15*time.Second)
	defer cancel()
	if err := exec.StreamWithContext(ctx, remotecommand.StreamOptions{Stdout: &stdout, Stderr: &stderr}); err != nil {
		return "", fmt.Errorf("exec list failed: %v (%s)", err, strings.TrimSpace(stderr.String()))
	}
	return stdout.String(), nil
}

func parseAndSortFileEntries(output, path string) []PodFileEntry {
	lines := strings.Split(output, "\n")
	entries := make([]PodFileEntry, 0, len(lines))
	for _, ln := range lines {
		if entry, ok := parseFileEntry(ln, path); ok {
			entries = append(entries, entry)
		}
	}
	if len(entries) > 1 {
		sort.Slice(entries, func(i, j int) bool {
			if entries[i].IsDir != entries[j].IsDir {
				return entries[i].IsDir && !entries[j].IsDir
			}
			return entries[i].Name < entries[j].Name
		})
	}
	return entries
}

// SearchPodFiles performs a recursive name search starting at path. maxDepth<=0 => unlimited. maxResults caps results (>0)
func (a *App) SearchPodFiles(podName, container, path, query string, maxDepth, maxResults int) ([]PodFileEntry, error) {
	if err := a.validatePodFilesRequest(podName); err != nil {
		return nil, err
	}
	path = normalizePath(path)
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
	container, err = resolveContainerName(pod, container)
	if err != nil {
		return nil, err
	}

	stdout, err := a.execSearchCommand(restConfig, clientset, podName, container, path, maxDepth)
	if err != nil {
		return nil, err
	}

	return parseSearchResults(stdout, q, maxResults), nil
}

func (a *App) validatePodFilesRequest(podName string) error {
	if a.currentNamespace == "" {
		return fmt.Errorf("no namespace selected")
	}
	if podName == "" {
		return fmt.Errorf("pod name required")
	}
	return nil
}

func (a *App) execSearchCommand(restConfig *rest.Config, clientset *kubernetes.Clientset, podName, container, path string, maxDepth int) (string, error) {
	escaped := shEscape(path)
	depthArg := ""
	if maxDepth > 0 {
		depthArg = fmt.Sprintf("-maxdepth %d", maxDepth)
	}
	cmdStr := fmt.Sprintf(`if command -v find >/dev/null 2>&1; then
  find %s %s -mindepth 1 -printf '%%p\t%%y\t%%s\t%%T@\n' 2>/dev/null || true
else
  for f in %s/* %s/.[!.]* %s/..?*; do [ -e "$f" ] || continue; bn=$(basename "$f"); if [ -d "$f" ]; then t=d; elif [ -L "$f" ]; then t=l; elif [ -f "$f" ]; then t=f; else t=o; fi; sz=0; if [ "$t" = f ]; then sz=$( (wc -c <"$f" 2>/dev/null) || echo 0); fi; ct=$(stat -c %%Y "$f" 2>/dev/null || echo 0); printf '%%s\t%%s\t%%s\t%%s\n' "$f" "$t" "$sz" "$ct"; done
fi`, escaped, depthArg, escaped, escaped, escaped)

	req := clientset.CoreV1().RESTClient().Post().Resource("pods").Namespace(a.currentNamespace).Name(podName).SubResource("exec")
	opts := &v1.PodExecOptions{Container: container, Command: []string{"/bin/sh", "-c", cmdStr}, Stdout: true, Stderr: true, TTY: false}
	req = req.VersionedParams(opts, scheme.ParameterCodec)
	executor, err := remotecommand.NewSPDYExecutor(restConfig, "POST", req.URL())
	if err != nil {
		return "", err
	}

	var stdout, stderr bytes.Buffer
	ctx, cancel := context.WithTimeout(a.ctx, 30*time.Second)
	defer cancel()
	if err := executor.StreamWithContext(ctx, remotecommand.StreamOptions{Stdout: &stdout, Stderr: &stderr}); err != nil {
		return "", fmt.Errorf("search exec failed: %v (%s)", err, strings.TrimSpace(stderr.String()))
	}
	return stdout.String(), nil
}

func parseSearchResults(output, query string, maxResults int) []PodFileEntry {
	lines := strings.Split(output, "\n")
	res := make([]PodFileEntry, 0)
	for _, ln := range lines {
		if entry, ok := parseSearchEntry(ln, query); ok {
			res = append(res, entry)
			if maxResults > 0 && len(res) >= maxResults {
				break
			}
		}
	}
	if len(res) > 1 {
		sort.Slice(res, func(i, j int) bool { return res[i].Path < res[j].Path })
	}
	return res
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
	if maxBytes <= 0 || maxBytes > 5*1024*1024 {
		maxBytes = 128 * 1024
	}
	resp.Path = path

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
	container, err = resolveContainerName(pod, container)
	if err != nil {
		return resp, err
	}

	fullSize, err := a.getRemoteFileSize(clientset, restConfig, podName, container, path)
	if err != nil {
		return resp, err
	}
	resp.Size = fullSize

	data, err := a.readRemoteFileContent(clientset, restConfig, podName, container, path, maxBytes)
	if err != nil {
		return resp, err
	}
	resp.Truncated = int64(len(data)) < fullSize
	resp.IsBinary = detectBinary(data)
	resp.Base64 = base64.StdEncoding.EncodeToString(data)
	return resp, nil
}

// getRemoteFileSize gets the size of a file in a pod container
func (a *App) getRemoteFileSize(clientset *kubernetes.Clientset, restConfig *rest.Config, podName, container, path string) (int64, error) {
	escaped := shEscape(path)
	sizeCmdStr := fmt.Sprintf("if [ -f %s ]; then wc -c < %s; else echo ERR; fi", escaped, escaped)
	sizeCmd := []string{"/bin/sh", "-c", sizeCmdStr}
	sizeReq := clientset.CoreV1().RESTClient().Post().Resource("pods").Namespace(a.currentNamespace).Name(podName).SubResource("exec")
	sizeOpts := &v1.PodExecOptions{Container: container, Command: sizeCmd, Stdout: true, Stderr: true, TTY: false}
	sizeReq = sizeReq.VersionedParams(sizeOpts, scheme.ParameterCodec)
	sizeExec, err := remotecommand.NewSPDYExecutor(restConfig, "POST", sizeReq.URL())
	if err != nil {
		return 0, err
	}
	var sizeOut, sizeErr bytes.Buffer
	ctx, cancel := context.WithTimeout(a.ctx, defaultShortTimeout())
	defer cancel()
	if err := sizeExec.StreamWithContext(ctx, remotecommand.StreamOptions{Stdout: &sizeOut, Stderr: &sizeErr}); err != nil {
		return 0, fmt.Errorf("size exec failed: %v", err)
	}
	szLine := strings.TrimSpace(sizeOut.String())
	if szLine == "ERR" {
		return 0, fmt.Errorf("not a regular file: %s", path)
	}
	var fullSize int64
	if szLine != "" {
		if _, err := fmt.Sscan(szLine, &fullSize); err != nil {
			return 0, fmt.Errorf("parse file size: %w", err)
		}
	}
	return fullSize, nil
}

// readRemoteFileContent reads up to maxBytes from a file in a pod container
func (a *App) readRemoteFileContent(clientset *kubernetes.Clientset, restConfig *rest.Config, podName, container, path string, maxBytes int) ([]byte, error) {
	escaped := shEscape(path)
	readCmdStr := fmt.Sprintf("head -c %d %s 2>/dev/null", maxBytes, escaped)
	readCmd := []string{"/bin/sh", "-c", readCmdStr}
	readReq := clientset.CoreV1().RESTClient().Post().Resource("pods").Namespace(a.currentNamespace).Name(podName).SubResource("exec")
	readOpts := &v1.PodExecOptions{Container: container, Command: readCmd, Stdout: true, Stderr: true, TTY: false}
	readReq = readReq.VersionedParams(readOpts, scheme.ParameterCodec)
	readExec, err := remotecommand.NewSPDYExecutor(restConfig, "POST", readReq.URL())
	if err != nil {
		return nil, err
	}
	var fileBuf, fileErr bytes.Buffer
	ctx, cancel := context.WithTimeout(a.ctx, 15*time.Second)
	defer cancel()
	if err := readExec.StreamWithContext(ctx, remotecommand.StreamOptions{Stdout: &fileBuf, Stderr: &fileErr}); err != nil {
		return nil, fmt.Errorf("read exec failed: %v", err)
	}
	return fileBuf.Bytes(), nil
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
