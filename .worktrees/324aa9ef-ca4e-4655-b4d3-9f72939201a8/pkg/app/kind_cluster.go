package app

import (
	"bufio"
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"runtime"
	"strconv"
	"strings"
	"sync"
	"time"
)

const (
	defaultKindClusterName = "kdb-local"
	kindNodeImage          = "kindest/node:v1.29.4"
)

// CreateKindCluster provisions a local KinD cluster and returns its kubeconfig details.
func (a *App) CreateKindCluster(name string) (KindClusterResult, error) {
	clusterName := strings.TrimSpace(name)
	if clusterName == "" {
		clusterName = defaultKindClusterName
	}
	if !isValidKindName(clusterName) {
		return KindClusterResult{}, fmt.Errorf("invalid kind cluster name: %s", clusterName)
	}

	a.emitKindProgress(5, "Checking KinD binary", "discovery", false)

	kindPath, err := exec.LookPath("kind")
	if err != nil {
		a.emitKindProgress(100, "KinD not found in PATH", "error", true)
		return KindClusterResult{}, errors.New("kind not found in path")
	}

	a.emitKindProgress(15, "Preparing kubeconfig path", "discovery", false)

	kubeconfigPath, err := kindKubeconfigPath(clusterName)
	if err != nil {
		a.emitKindProgress(100, "Failed to resolve kubeconfig path", "error", true)
		return KindClusterResult{}, fmt.Errorf("resolve kubeconfig path: %w", err)
	}
	if err := os.MkdirAll(filepath.Dir(kubeconfigPath), 0o750); err != nil {
		a.emitKindProgress(100, "Failed to create kubeconfig directory", "error", true)
		return KindClusterResult{}, fmt.Errorf("create kubeconfig directory: %w", err)
	}

	baseCtx := a.ctx
	if baseCtx == nil {
		baseCtx = context.Background()
	}
	ctx, cancel := context.WithTimeout(baseCtx, 10*time.Minute)
	kindCancelID := a.setKindCancel(cancel)
	defer func() {
		a.clearKindCancel(kindCancelID)
		cancel()
	}()

	a.emitKindProgress(25, "Checking existing clusters", "discovery", false)
	exists, err := kindClusterExists(ctx, kindPath, clusterName)
	if err != nil {
		if a.isKindCanceled(ctx) {
			return KindClusterResult{}, ctx.Err()
		}
		a.emitKindProgress(100, "Failed to check existing clusters", "error", true)
		return KindClusterResult{}, err
	}

	created := false
	if !exists {
		dockerPath, err := exec.LookPath("docker")
		if err != nil {
			if a.isKindCanceled(ctx) {
				return KindClusterResult{}, ctx.Err()
			}
			a.emitKindProgress(100, "Docker not found in PATH", "error", true)
			return KindClusterResult{}, errors.New("docker not found in path")
		}

		a.emitKindProgress(30, "Checking KinD node image", "pull", false)
		if err := a.ensureKindNodeImage(ctx, dockerPath); err != nil {
			if a.isKindCanceled(ctx) {
				return KindClusterResult{}, ctx.Err()
			}
			a.emitKindProgress(100, "Failed to pull KinD image", "error", true)
			return KindClusterResult{}, err
		}

		a.emitKindProgress(72, "Creating KinD cluster", "pull", false)
		out, err := a.runKindCreateWithProgress(ctx, kindPath, clusterName, kubeconfigPath)
		if err != nil {
			if a.isKindCanceled(ctx) {
				return KindClusterResult{}, ctx.Err()
			}
			a.emitKindProgress(100, "KinD cluster creation failed", "error", true)
			return KindClusterResult{}, fmt.Errorf("kind create cluster failed: %w: %s", err, trimCommandOutput(out))
		}
		created = true
		a.emitKindProgress(80, "Finalizing kubeconfig", "kubeconfig", false)
	} else {
		a.emitKindProgress(40, "Cluster exists, exporting kubeconfig", "kubeconfig", false)
		out, err := exec.CommandContext(ctx, kindPath, "get", "kubeconfig", "--name", clusterName).CombinedOutput()
		if err != nil {
			if a.isKindCanceled(ctx) {
				return KindClusterResult{}, ctx.Err()
			}
			a.emitKindProgress(100, "Failed to export kubeconfig", "error", true)
			return KindClusterResult{}, fmt.Errorf("kind get kubeconfig failed: %w: %s", err, trimCommandOutput(out))
		}
		a.emitKindProgress(75, "Writing kubeconfig", "kubeconfig", false)
		if err := os.WriteFile(kubeconfigPath, out, 0o600); err != nil {
			if a.isKindCanceled(ctx) {
				return KindClusterResult{}, ctx.Err()
			}
			a.emitKindProgress(100, "Failed to write kubeconfig", "error", true)
			return KindClusterResult{}, fmt.Errorf("write kubeconfig: %w", err)
		}
	}

	a.emitKindProgress(100, "KinD cluster ready", "done", true)

	return KindClusterResult{
		Name:           clusterName,
		KubeconfigPath: kubeconfigPath,
		Context:        "kind-" + clusterName,
		Created:        created,
	}, nil
}

// CancelKindCluster stops an in-flight KinD setup, if any.
func (a *App) CancelKindCluster() bool {
	a.kindMu.Lock()
	cancel := a.kindCancel
	cmd := a.kindCmd
	pullCmd := a.kindPullCmd
	a.kindCancel = nil
	a.kindCmd = nil
	a.kindPullCmd = nil
	a.kindMu.Unlock()

	if cancel == nil {
		return false
	}

	cancel()
	if cmd != nil {
		_ = terminateKindProcess(cmd)
	}
	if pullCmd != nil {
		_ = terminateKindProcess(pullCmd)
	}
	a.emitKindProgress(100, "KinD setup canceled", "done", true)
	return true
}

func (a *App) setKindCancel(cancel context.CancelFunc) uint64 {
	a.kindMu.Lock()
	prev := a.kindCancel
	a.kindCancelID++
	id := a.kindCancelID
	a.kindCancel = cancel
	a.kindMu.Unlock()

	if prev != nil {
		prev()
	}

	return id
}

func (a *App) setKindCmd(cmd *exec.Cmd) {
	a.kindMu.Lock()
	a.kindCmd = cmd
	a.kindMu.Unlock()
}

func (a *App) clearKindCmd(cmd *exec.Cmd) {
	a.kindMu.Lock()
	if a.kindCmd == cmd {
		a.kindCmd = nil
	}
	a.kindMu.Unlock()
}

func (a *App) setKindPullCmd(cmd *exec.Cmd) {
	a.kindMu.Lock()
	a.kindPullCmd = cmd
	a.kindMu.Unlock()
}

func (a *App) clearKindPullCmd(cmd *exec.Cmd) {
	a.kindMu.Lock()
	if a.kindPullCmd == cmd {
		a.kindPullCmd = nil
	}
	a.kindMu.Unlock()
}

func (a *App) clearKindCancel(id uint64) {
	a.kindMu.Lock()
	if a.kindCancelID == id {
		a.kindCancel = nil
	}
	a.kindMu.Unlock()
}

func (a *App) isKindCanceled(ctx context.Context) bool {
	if ctx.Err() == context.Canceled {
		a.emitKindProgress(100, "KinD setup canceled", "done", true)
		return true
	}
	return false
}

func (a *App) emitKindProgress(percent int, message, stage string, done bool) {
	if percent < 0 {
		percent = 0
	} else if percent > 100 {
		percent = 100
	}
	emitEvent(a.ctx, "kind:progress", KindProgressUpdate{
		Percent: percent,
		Message: message,
		Stage:   stage,
		Done:    done,
	})
}

func kindKubeconfigPath(clusterName string) (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(home, ".kube", "kind-"+clusterName), nil
}

func kindClusterExists(ctx context.Context, kindPath, clusterName string) (bool, error) {
	out, err := exec.CommandContext(ctx, kindPath, "get", "clusters").CombinedOutput()
	if err != nil {
		return false, fmt.Errorf("kind get clusters failed: %w: %s", err, trimCommandOutput(out))
	}
	for _, line := range strings.Split(string(out), "\n") {
		if strings.TrimSpace(line) == clusterName {
			return true, nil
		}
	}
	return false, nil
}

func isValidKindName(name string) bool {
	if name == "" {
		return false
	}
	for _, r := range name {
		if (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9') || r == '-' || r == '_' {
			continue
		}
		return false
	}
	return true
}

func trimCommandOutput(out []byte) string {
	trimmed := strings.TrimSpace(string(out))
	if trimmed == "" {
		return ""
	}
	if len(trimmed) > 400 {
		return trimmed[:400] + "..."
	}
	return trimmed
}

type kindOutputCollector struct {
	mu  sync.Mutex
	buf bytes.Buffer
}

func (c *kindOutputCollector) Write(data []byte) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.buf.Write(data)
}

func (c *kindOutputCollector) Bytes() []byte {
	c.mu.Lock()
	defer c.mu.Unlock()
	return append([]byte(nil), c.buf.Bytes()...)
}

type kindCreateProgress struct {
	image           string
	lastPullPercent int
	lastOverall     int
}

var (
	kindImageRegex       = regexp.MustCompile(`(?i)\bimage:\s*"?([^\s"]+)"?`)
	kindUsingImageRegex  = regexp.MustCompile(`(?i)\busing image\s+"?([^\s"]+)"?`)
	kindPullingRegex     = regexp.MustCompile(`(?i)pulling image\s+"?([^\s"]+)"?`)
	kindDownloadingRegex = regexp.MustCompile(`(?i)downloading[:\s]+([0-9.]+)\s*([kmgt]i?b)?\s*/\s*([0-9.]+)\s*([kmgt]i?b)?`)
	dockerLayerRegex     = regexp.MustCompile(`(?i)^([0-9a-f]+):\s+(downloading|extracting)(?:\s+\[[^\]]+\])?\s+([0-9.]+)\s*([kmgt]i?b)?\s*/\s*([0-9.]+)\s*([kmgt]i?b)?`)
	dockerLayerStatus    = regexp.MustCompile(`(?i)^([0-9a-f]+):\s+(pulling fs layer|waiting|download complete|pull complete|verifying checksum|downloading|extracting|already exists)\s*$`)
)

func (a *App) runKindCreateWithProgress(ctx context.Context, kindPath, clusterName, kubeconfigPath string) ([]byte, error) {
	cmd := exec.CommandContext(
		ctx,
		kindPath,
		"create",
		"cluster",
		"--name",
		clusterName,
		"--kubeconfig",
		kubeconfigPath,
		"--image",
		kindNodeImage,
	)
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return nil, err
	}
	stderr, err := cmd.StderrPipe()
	if err != nil {
		return nil, err
	}

	collector := &kindOutputCollector{}
	lineCh := make(chan string, 64)
	var wg sync.WaitGroup
	wg.Add(2)
	go streamKindOutput(stdout, collector, lineCh, &wg)
	go streamKindOutput(stderr, collector, lineCh, &wg)

	if err := cmd.Start(); err != nil {
		return nil, err
	}
	a.setKindCmd(cmd)
	defer a.clearKindCmd(cmd)

	go func() {
		wg.Wait()
		close(lineCh)
	}()

	progress := &kindCreateProgress{lastPullPercent: -1, lastOverall: -1}
	for line := range lineCh {
		a.handleKindCreateLine(line, progress)
	}

	return collector.Bytes(), cmd.Wait()
}

type dockerLayerProgress struct {
	current int64
	total   int64
	phase   string
	weight  int // 0-100 progress weight for this layer
}

// dockerLayerPhaseWeight maps Docker layer status strings to a progress
// weight (0-100). This enables meaningful progress tracking even when
// Docker is not attached to a TTY and omits byte-level download stats.
var dockerLayerPhaseWeight = map[string]int{
	"pulling fs layer":   0,
	"waiting":            5,
	"downloading":        20,
	"verifying checksum": 45,
	"download complete":  50,
	"extracting":         75,
	"pull complete":      100,
	"already exists":     100,
}

type dockerPullProgress struct {
	image       string
	lastPercent int
	layers      map[string]dockerLayerProgress
}

func (a *App) ensureKindNodeImage(ctx context.Context, dockerPath string) error {
	exists, err := kindImageExists(ctx, dockerPath, kindNodeImage)
	if err != nil {
		return err
	}
	if exists {
		a.emitKindProgress(38, "KinD node image already cached", "pull", false)
		return nil
	}

	a.emitKindProgress(40, "Pulling KinD node image", "pull", false)
	out, err := a.runDockerPullWithProgress(ctx, dockerPath, kindNodeImage)
	if err != nil {
		if a.isKindCanceled(ctx) {
			return ctx.Err()
		}
		return fmt.Errorf("docker pull failed: %w: %s", err, trimCommandOutput(out))
	}

	a.emitKindProgress(70, "KinD node image pulled", "pull", false)
	return nil
}

func kindImageExists(ctx context.Context, dockerPath, image string) (bool, error) {
	out, err := exec.CommandContext(ctx, dockerPath, "image", "inspect", image).CombinedOutput()
	if err != nil {
		if ctx.Err() != nil {
			return false, ctx.Err()
		}
		if strings.Contains(strings.ToLower(string(out)), "no such image") {
			return false, nil
		}
		return false, fmt.Errorf("docker image inspect failed: %w: %s", err, trimCommandOutput(out))
	}
	return true, nil
}

func (a *App) runDockerPullWithProgress(ctx context.Context, dockerPath, image string) ([]byte, error) {
	cmd := exec.CommandContext(ctx, dockerPath, "pull", image)
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return nil, err
	}
	stderr, err := cmd.StderrPipe()
	if err != nil {
		return nil, err
	}

	collector := &kindOutputCollector{}
	lineCh := make(chan string, 64)
	var wg sync.WaitGroup
	wg.Add(2)
	go streamKindOutput(stdout, collector, lineCh, &wg)
	go streamKindOutput(stderr, collector, lineCh, &wg)

	if err := cmd.Start(); err != nil {
		return nil, err
	}
	a.setKindPullCmd(cmd)
	defer a.clearKindPullCmd(cmd)

	go func() {
		wg.Wait()
		close(lineCh)
	}()

	progress := &dockerPullProgress{image: image, lastPercent: -1, layers: make(map[string]dockerLayerProgress)}
	for line := range lineCh {
		a.handleDockerPullLine(line, progress)
	}

	return collector.Bytes(), cmd.Wait()
}

func terminateKindProcess(cmd *exec.Cmd) error {
	if cmd == nil || cmd.Process == nil {
		return nil
	}
	if runtime.GOOS == "windows" {
		pid := cmd.Process.Pid
		if pid > 0 {
			return exec.Command("taskkill", "/T", "/F", "/PID", strconv.Itoa(pid)).Run()
		}
	}
	return cmd.Process.Kill()
}

func streamKindOutput(r io.Reader, collector *kindOutputCollector, lineCh chan<- string, wg *sync.WaitGroup) {
	defer wg.Done()
	scanner := bufio.NewScanner(r)
	scanner.Split(splitKindOutput)
	for scanner.Scan() {
		text := strings.TrimSpace(scanner.Text())
		if text != "" {
			lineCh <- text
		}
		collector.Write(append(scanner.Bytes(), '\n'))
	}
}

func splitKindOutput(data []byte, atEOF bool) (advance int, token []byte, err error) {
	for i, b := range data {
		if b == '\n' || b == '\r' {
			return i + 1, data[:i], nil
		}
	}
	if atEOF && len(data) > 0 {
		return len(data), data, nil
	}
	return 0, nil, nil
}

func (a *App) handleKindCreateLine(line string, progress *kindCreateProgress) {
	line = strings.TrimSpace(line)
	if line == "" {
		return
	}

	if match := kindImageRegex.FindStringSubmatch(line); len(match) == 2 {
		progress.image = match[1]
	}
	if match := kindUsingImageRegex.FindStringSubmatch(line); len(match) == 2 {
		progress.image = match[1]
	}
	if match := kindPullingRegex.FindStringSubmatch(line); len(match) == 2 {
		progress.image = match[1]
		a.emitKindPullProgress(45, progress, "Pulling image")
		return
	}

	if strings.Contains(strings.ToLower(line), "pulling image") {
		a.emitKindPullProgress(45, progress, "Pulling image")
		return
	}

	if match := kindDownloadingRegex.FindStringSubmatch(line); len(match) == 5 {
		current, total := parseSize(match[1], match[2]), parseSize(match[3], match[4])
		if total > 0 {
			percent := int((float64(current) / float64(total)) * 100)
			a.emitKindPullProgress(percent, progress, fmt.Sprintf("Downloading %s/%s", formatKindBytes(current), formatKindBytes(total)))
			return
		}
	}

	if strings.Contains(strings.ToLower(line), "downloading") {
		a.emitKindPullProgress(50, progress, "Downloading image layers")
		return
	}

	if strings.Contains(strings.ToLower(line), "extracting") {
		a.emitKindPullProgress(70, progress, "Extracting image layers")
		return
	}
}

func (a *App) handleDockerPullLine(line string, progress *dockerPullProgress) {
	line = strings.TrimSpace(line)
	if line == "" {
		return
	}

	// Debug log to file for troubleshooting
	if logPath := os.Getenv("KIND_DEBUG_LOG"); logPath != "" {
		f, _ := os.OpenFile(logPath, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
		if f != nil {
			fmt.Fprintf(f, "docker: %s\n", line)
			f.Close()
		}
	}

	// First try per-layer byte-level progress (available when Docker has a TTY)
	match := dockerLayerRegex.FindStringSubmatch(line)
	if len(match) == 7 {
		layerID := match[1]
		phase := strings.ToLower(match[2])
		current := parseSize(match[3], match[4])
		total := parseSize(match[5], match[6])
		if total > 0 && layerID != "" {
			weight := dockerLayerPhaseWeight[phase]
			if phase == "downloading" {
				weight = 20 + int(float64(current)/float64(total)*30) // 20-50
			} else if phase == "extracting" {
				weight = 50 + int(float64(current)/float64(total)*50) // 50-100
			}
			progress.layers[layerID] = dockerLayerProgress{current: current, total: total, phase: phase, weight: weight}
			a.updateDockerPullProgress(progress)
		}
		return
	}

	// Try simple status lines (no byte-level data — non-TTY Docker output)
	if statusMatch := dockerLayerStatus.FindStringSubmatch(line); len(statusMatch) == 3 {
		layerID := statusMatch[1]
		status := strings.ToLower(statusMatch[2])
		weight := dockerLayerPhaseWeight[status]

		layer, exists := progress.layers[layerID]
		if !exists {
			layer = dockerLayerProgress{phase: status, weight: weight}
		} else if weight > layer.weight {
			// Only advance forward, never regress
			layer.phase = status
			layer.weight = weight
		}
		progress.layers[layerID] = layer
		a.updateDockerPullProgress(progress)
		return
	}

	// Fallback for unstructured lines
	if strings.Contains(strings.ToLower(line), "downloading") && progress.lastPercent < 45 {
		progress.lastPercent = 45
		a.emitKindProgress(45, "Downloading image layers", "pull", false)
	}
}

func (a *App) updateDockerPullProgress(progress *dockerPullProgress) {
	if len(progress.layers) == 0 {
		return
	}

	// Calculate pull progress from phase weights (works without TTY)
	var sumWeight int
	var completedLayers int
	var activePhase string
	for _, layer := range progress.layers {
		sumWeight += layer.weight
		if layer.weight >= 100 {
			completedLayers++
		} else if layer.phase != "" && layer.phase != "waiting" && layer.phase != "pulling fs layer" {
			if activePhase == "" {
				activePhase = layer.phase
			}
		}
	}
	totalLayers := len(progress.layers)
	pullPercent := (sumWeight * 100) / (totalLayers * 100)

	// Also incorporate byte-level progress when available (TTY mode)
	var sumCurrent, sumTotal int64
	for _, layer := range progress.layers {
		if layer.total > 0 {
			sumCurrent += layer.current
			sumTotal += layer.total
		}
	}
	if sumTotal > 0 {
		bytePullPercent := int((float64(sumCurrent) / float64(sumTotal)) * 100)
		if bytePullPercent > pullPercent {
			pullPercent = bytePullPercent
		}
	}

	// Map 0-100% docker pull to 40-70% overall progress
	percent := 40 + int(float64(pullPercent)*0.30)
	if percent <= progress.lastPercent {
		return
	}
	progress.lastPercent = percent

	if activePhase == "" {
		activePhase = "downloading"
	}

	// Build a descriptive message
	var message string
	if sumTotal > 0 {
		message = fmt.Sprintf("%s %s/%s (%d/%d layers)",
			formatDockerPhase(activePhase), formatKindBytes(sumCurrent), formatKindBytes(sumTotal),
			completedLayers, totalLayers)
	} else {
		message = fmt.Sprintf("%s layers (%d/%d complete)",
			formatDockerPhase(activePhase), completedLayers, totalLayers)
	}
	a.emitKindProgress(percent, message, "pull", false)
}

func formatDockerPhase(phase string) string {
	switch strings.ToLower(phase) {
	case "downloading":
		return "Downloading"
	case "extracting":
		return "Extracting"
	default:
		return "Pulling"
	}
}

func (a *App) emitKindPullProgress(pullPercent int, progress *kindCreateProgress, detail string) {
	pullPercent = clampPercent(pullPercent)
	if pullPercent <= progress.lastPullPercent {
		return
	}
	progress.lastPullPercent = pullPercent
	percent := 40 + int(float64(pullPercent)*0.35)
	if percent <= progress.lastOverall {
		return
	}
	progress.lastOverall = percent
	message := detail
	if progress.image != "" {
		message = fmt.Sprintf("%s (%s)", detail, progress.image)
	}
	a.emitKindProgress(percent, message, "pull", false)
}

func clampPercent(value int) int {
	if value < 0 {
		return 0
	}
	if value > 100 {
		return 100
	}
	return value
}

func parseSize(value, unit string) int64 {
	if value == "" {
		return 0
	}
	parsed, err := strconv.ParseFloat(value, 64)
	if err != nil {
		return 0
	}
	unit = strings.ToUpper(strings.TrimSpace(unit))
	switch unit {
	case "KB", "KIB":
		return int64(parsed * 1024)
	case "MB", "MIB":
		return int64(parsed * 1024 * 1024)
	case "GB", "GIB":
		return int64(parsed * 1024 * 1024 * 1024)
	case "TB", "TIB":
		return int64(parsed * 1024 * 1024 * 1024 * 1024)
	default:
		return int64(parsed)
	}
}

func formatKindBytes(value int64) string {
	const (
		kb = 1024
		mb = 1024 * kb
		gb = 1024 * mb
		tb = 1024 * gb
	)
	switch {
	case value >= tb:
		return fmt.Sprintf("%.1fTB", float64(value)/float64(tb))
	case value >= gb:
		return fmt.Sprintf("%.1fGB", float64(value)/float64(gb))
	case value >= mb:
		return fmt.Sprintf("%.1fMB", float64(value)/float64(mb))
	case value >= kb:
		return fmt.Sprintf("%.1fKB", float64(value)/float64(kb))
	default:
		return fmt.Sprintf("%dB", value)
	}
}
