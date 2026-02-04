package docker

import (
	"context"
	"fmt"
	"net/url"
	"strings"
	"sync"
	"time"

	"github.com/docker/docker/api/types"
	"github.com/docker/docker/api/types/filters"
	"github.com/docker/docker/api/types/swarm"
	"github.com/docker/docker/client"

	"gowails/pkg/app/docker/registry"
)

type cachedImageUpdate struct {
	info      ImageUpdateInfo
	checkedAt time.Time
}

var swarmImageUpdateCache = struct {
	mu    sync.RWMutex
	items map[string]cachedImageUpdate
}{items: make(map[string]cachedImageUpdate)}

const defaultImageUpdateCacheTTL = 10 * time.Minute

func applyCachedImageUpdateFields(serviceID string, svc *SwarmServiceInfo) {
	if svc == nil {
		return
	}
	swarmImageUpdateCache.mu.RLock()
	entry, ok := swarmImageUpdateCache.items[serviceID]
	swarmImageUpdateCache.mu.RUnlock()
	if !ok {
		return
	}
	// TTL-based: keep stale values out of the UI so we don't mislead.
	if !entry.checkedAt.IsZero() && time.Since(entry.checkedAt) > defaultImageUpdateCacheTTL {
		return
	}

	svc.ImageUpdateAvailable = entry.info.UpdateAvailable
	svc.ImageLocalDigest = entry.info.LocalDigest
	svc.ImageRemoteDigest = entry.info.RemoteDigest
	svc.ImageCheckedAt = entry.info.CheckedAt
}

func setCachedImageUpdate(serviceID string, info ImageUpdateInfo) {
	swarmImageUpdateCache.mu.Lock()
	swarmImageUpdateCache.items[serviceID] = cachedImageUpdate{info: info, checkedAt: time.Now()}
	swarmImageUpdateCache.mu.Unlock()
}

type parsedImageRef struct {
	registryHost string
	repository   string
	tag          string
	digest       string
}

func isRegistryHost(s string) bool {
	if s == "" {
		return false
	}
	// Docker reference heuristic: a domain (contains '.'), a port (contains ':'), or localhost.
	if strings.Contains(s, ".") || strings.Contains(s, ":") || s == "localhost" {
		return true
	}
	return false
}

func isDockerHubHost(host string) bool {
	h := strings.ToLower(strings.TrimSpace(host))
	return h == "docker.io" || h == "index.docker.io" || h == "registry-1.docker.io"
}

func parseImageReference(image string) (parsedImageRef, error) {
	img := strings.TrimSpace(image)
	if img == "" {
		return parsedImageRef{}, fmt.Errorf("image is required")
	}

	ref := parsedImageRef{}

	// Split digest first.
	if at := strings.Index(img, "@"); at >= 0 {
		ref.digest = strings.TrimSpace(img[at+1:])
		img = strings.TrimSpace(img[:at])
	}

	// Tag: last ':' after last '/'.
	lastSlash := strings.LastIndex(img, "/")
	lastColon := strings.LastIndex(img, ":")
	if lastColon > lastSlash {
		ref.tag = strings.TrimSpace(img[lastColon+1:])
		img = strings.TrimSpace(img[:lastColon])
	}

	img = strings.Trim(img, "/")
	if img == "" {
		return parsedImageRef{}, fmt.Errorf("invalid image reference")
	}

	// Registry host: first segment if it looks like a host.
	if idx := strings.Index(img, "/"); idx >= 0 {
		first := img[:idx]
		rest := strings.Trim(img[idx+1:], "/")
		if isRegistryHost(first) {
			ref.registryHost = strings.TrimSpace(first)
			ref.repository = rest
		} else {
			ref.repository = img
		}
	} else {
		ref.repository = img
	}

	if ref.repository == "" {
		return parsedImageRef{}, fmt.Errorf("invalid image reference")
	}

	// Default to Docker Hub when no explicit host was provided.
	if strings.TrimSpace(ref.registryHost) == "" {
		ref.registryHost = "docker.io"
	}

	// Normalize Docker Hub official images.
	if isDockerHubHost(ref.registryHost) && !strings.Contains(ref.repository, "/") {
		ref.repository = "library/" + ref.repository
	}

	return ref, nil
}

func resolveRegistryConfigForImage(ref parsedImageRef) (registry.RegistryConfig, error) {
	regs, err := registry.GetRegistries()
	if err != nil {
		return registry.RegistryConfig{}, err
	}

	// If this is a Docker Hub image, require an explicitly configured Docker Hub registry.
	if isDockerHubHost(ref.registryHost) {
		for _, r := range regs {
			if r.Type != registry.RegistryTypeDockerHub {
				continue
			}
			// No further matching required; there should typically only be one.
			return registry.GetRegistryWithCredentials(r.Name)
		}
		return registry.RegistryConfig{}, fmt.Errorf("docker hub registry not configured")
	}

	// Otherwise match by URL host.
	host := strings.ToLower(strings.TrimSpace(ref.registryHost))
	for _, r := range regs {
		u, err := url.Parse(strings.TrimSpace(r.URL))
		if err != nil {
			continue
		}
		if strings.ToLower(strings.TrimSpace(u.Host)) == host {
			return registry.GetRegistryWithCredentials(r.Name)
		}
	}

	return registry.RegistryConfig{}, fmt.Errorf("registry not configured for host %s", ref.registryHost)
}

// CheckImageUpdate checks whether the image tag points to a newer digest in the configured registry.
//
// Notes:
// - This is best-effort and requires the corresponding registry to be configured in the app.
// - LocalDigest is derived from the image reference when it contains an @sha256:... digest.
// - If LocalDigest is empty, UpdateAvailable will be false even when RemoteDigest is available.
func CheckImageUpdate(ctx context.Context, image string) (ImageUpdateInfo, error) {
	if ctx == nil {
		ctx = context.Background()
	}

	ref, err := parseImageReference(image)
	if err != nil {
		return ImageUpdateInfo{}, err
	}
	checkedAt := time.Now().UTC().Format(time.RFC3339)
	info := ImageUpdateInfo{
		Image:       strings.TrimSpace(image),
		LocalDigest: strings.TrimSpace(ref.digest),
		CheckedAt:   checkedAt,
		Error:       "",
	}

	if strings.TrimSpace(ref.tag) == "" {
		info.Error = "image tag missing"
		return info, nil
	}

	cfg, err := resolveRegistryConfigForImage(ref)
	if err != nil {
		info.Error = err.Error()
		return info, nil
	}

	c, err := registry.NewClient(cfg)
	if err != nil {
		info.Error = err.Error()
		return info, nil
	}

	// Keep registry call time-bounded.
	ctx, cancel := context.WithTimeout(ctx, 15*time.Second)
	defer cancel()

	digest, err := c.GetManifestDigest(ctx, ref.repository, ref.tag)
	if err != nil {
		info.Error = err.Error()
		return info, nil
	}
	info.RemoteDigest = strings.TrimSpace(digest)

	if info.LocalDigest != "" && info.RemoteDigest != "" && info.LocalDigest != info.RemoteDigest {
		info.UpdateAvailable = true
	}

	return info, nil
}

type swarmServiceInspector interface {
	ServiceInspectWithRaw(context.Context, string, types.ServiceInspectOptions) (swarm.Service, []byte, error)
	TaskList(context.Context, types.TaskListOptions) ([]swarm.Task, error)
	ContainerInspect(context.Context, string) (types.ContainerJSON, error)
	ImageInspectWithRaw(context.Context, string) (types.ImageInspect, []byte, error)
}

func repoDigestForRef(ref parsedImageRef, repoDigests []string) string {
	for _, rd := range repoDigests {
		rd = strings.TrimSpace(rd)
		if rd == "" {
			continue
		}
		p, err := parseImageReference(rd)
		if err != nil {
			continue
		}
		if strings.TrimSpace(p.digest) == "" {
			continue
		}

		// Docker Hub host equivalence.
		if isDockerHubHost(ref.registryHost) && isDockerHubHost(p.registryHost) {
			if strings.EqualFold(ref.repository, p.repository) {
				return strings.TrimSpace(p.digest)
			}
			continue
		}

		if strings.EqualFold(strings.TrimSpace(ref.registryHost), strings.TrimSpace(p.registryHost)) &&
			strings.EqualFold(ref.repository, p.repository) {
			return strings.TrimSpace(p.digest)
		}
	}
	return ""
}

// findRunningContainerID looks for a running task's container ID, falling back to any container ID.
func findRunningContainerID(tasks []swarm.Task) string {
	// First try: find running task.
	for _, t := range tasks {
		if t.Status.State != swarm.TaskStateRunning {
			continue
		}
		if t.Status.ContainerStatus == nil {
			continue
		}
		cid := strings.TrimSpace(t.Status.ContainerStatus.ContainerID)
		if cid != "" {
			return cid
		}
	}
	// Fallback: any task with a container ID.
	for _, t := range tasks {
		if t.Status.ContainerStatus == nil {
			continue
		}
		cid := strings.TrimSpace(t.Status.ContainerStatus.ContainerID)
		if cid != "" {
			return cid
		}
	}
	return ""
}

func resolveLocalDigestForService(ctx context.Context, cli swarmServiceInspector, serviceID string, ref parsedImageRef) (string, string) {
	if strings.TrimSpace(serviceID) == "" {
		return "", "service id missing"
	}

	filter := filters.NewArgs()
	filter.Add("service", serviceID)
	tasks, err := cli.TaskList(ctx, types.TaskListOptions{Filters: filter})
	if err != nil {
		return "", err.Error()
	}

	containerID := findRunningContainerID(tasks)
	if containerID == "" {
		return "", "no task container found"
	}

	ci, err := cli.ContainerInspect(ctx, containerID)
	if err != nil {
		return "", err.Error()
	}
	imageID := strings.TrimSpace(ci.Image)
	if imageID == "" {
		return "", "container image id missing"
	}

	inspect, _, err := cli.ImageInspectWithRaw(ctx, imageID)
	if err != nil {
		return "", err.Error()
	}
	d := repoDigestForRef(ref, inspect.RepoDigests)
	if d == "" {
		return "", "local digest not found"
	}
	return d, ""
}

// CheckSwarmServiceImageUpdates checks image updates for the given service IDs.
// It caches results for UI consumption in GetSwarmServices().
func CheckSwarmServiceImageUpdates(ctx context.Context, cli *client.Client, serviceIDs []string) (map[string]ImageUpdateInfo, error) {
	return checkSwarmServiceImageUpdates(ctx, cli, serviceIDs)
}

// trimServiceIDs filters and trims service IDs.
func trimServiceIDs(serviceIDs []string) []string {
	ids := make([]string, 0, len(serviceIDs))
	for _, id := range serviceIDs {
		id = strings.TrimSpace(id)
		if id != "" {
			ids = append(ids, id)
		}
	}
	return ids
}

// resolveAndUpdateLocalDigest attempts to resolve the local digest for a service.
func resolveAndUpdateLocalDigest(ctx context.Context, cli swarmServiceInspector, serviceID string, ref parsedImageRef, info *ImageUpdateInfo) {
	if strings.TrimSpace(info.LocalDigest) != "" || strings.TrimSpace(ref.tag) == "" {
		return
	}
	ld, lerr := resolveLocalDigestForService(ctx, cli, serviceID, ref)
	if strings.TrimSpace(ld) != "" {
		info.LocalDigest = ld
		if info.RemoteDigest != "" && info.LocalDigest != info.RemoteDigest {
			info.UpdateAvailable = true
		}
	} else if info.Error == "" && strings.TrimSpace(lerr) != "" {
		info.Error = lerr
	}
}

func checkSwarmServiceImageUpdates(ctx context.Context, cli swarmServiceInspector, serviceIDs []string) (map[string]ImageUpdateInfo, error) {
	if ctx == nil {
		ctx = context.Background()
	}
	ids := trimServiceIDs(serviceIDs)

	out := make(map[string]ImageUpdateInfo, len(ids))
	for _, id := range ids {
		svc, _, err := cli.ServiceInspectWithRaw(ctx, id, types.ServiceInspectOptions{})
		if err != nil {
			info := ImageUpdateInfo{Image: "", CheckedAt: time.Now().UTC().Format(time.RFC3339), Error: err.Error()}
			setCachedImageUpdate(id, info)
			out[id] = info
			continue
		}
		img := ""
		if svc.Spec.TaskTemplate.ContainerSpec != nil {
			img = svc.Spec.TaskTemplate.ContainerSpec.Image
		}
		info, _ := CheckImageUpdate(ctx, img)
		ref, refErr := parseImageReference(img)
		if refErr == nil {
			resolveAndUpdateLocalDigest(ctx, cli, id, ref, &info)
		}
		setCachedImageUpdate(id, info)
		out[id] = info
	}
	return out, nil
}
