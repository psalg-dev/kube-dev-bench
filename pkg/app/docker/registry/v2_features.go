package registry

import (
	"context"
	"fmt"
	"net/url"
	"sort"
	"strings"
)

// SearchV2Repositories lists repositories (via catalog) and filters client-side.
// Many registries (including Artifactory) may restrict catalog access; callers should
// surface errors to the UI.
func SearchV2Repositories(ctx context.Context, c *v2Client, query string, limit int) ([]RegistryRepoSearchResult, error) {
	if c == nil {
		return nil, fmt.Errorf("client is nil")
	}
	q := strings.ToLower(strings.TrimSpace(query))
	if limit <= 0 {
		limit = 100
	}

	repos, err := c.ListRepositories(ctx)
	if err != nil {
		return nil, err
	}

	items := make([]RegistryRepoSearchResult, 0, len(repos))
	for _, r := range repos {
		r = strings.TrimSpace(r)
		if r == "" {
			continue
		}
		if q == "" || strings.Contains(strings.ToLower(r), q) {
			name := r
			if idx := strings.LastIndex(r, "/"); idx >= 0 && idx+1 < len(r) {
				name = r[idx+1:]
			}
			items = append(items, RegistryRepoSearchResult{Name: name, FullName: r})
			if len(items) >= limit {
				break
			}
		}
	}

	sort.Slice(items, func(i, j int) bool { return items[i].FullName < items[j].FullName })
	return items, nil
}

func ArtifactoryRepoURL(baseURL, repository string) string {
	baseURL = strings.TrimSpace(baseURL)
	repository = strings.Trim(repository, "/")
	if baseURL == "" || repository == "" {
		return ""
	}
	parsed, err := url.Parse(baseURL)
	if err != nil {
		return ""
	}
	// Best-effort UI link: /ui/repos/tree/General/<repo>
	parsed.Path = strings.TrimRight(parsed.Path, "/") + "/ui/repos/tree/General/" + url.PathEscape(repository)
	return parsed.String()
}

func GetV2RepoDetails(ctx context.Context, c *v2Client, baseURL, repository string) (RegistryRepoDetails, error) {
	if c == nil {
		return RegistryRepoDetails{}, fmt.Errorf("client is nil")
	}
	repository = strings.TrimSpace(repository)
	if repository == "" {
		return RegistryRepoDetails{}, fmt.Errorf("repository is required")
	}

	name := repository
	if idx := strings.LastIndex(repository, "/"); idx >= 0 && idx+1 < len(repository) {
		name = repository[idx+1:]
	}

	details := RegistryRepoDetails{
		Name:     name,
		FullName: repository,
		URL:      ArtifactoryRepoURL(baseURL, repository),
		// SizeBytes is resolved best-effort from the latest tag.
		SizeBytes: 0,
	}

	tags, err := c.ListTags(ctx, repository)
	if err != nil {
		return details, nil
	}
	if len(tags) == 0 {
		return details, nil
	}

	// Prefer `latest` when available.
	ref := tags[0]
	for _, t := range tags {
		if t == "latest" {
			ref = "latest"
			break
		}
	}

	sizeBytes, err := c.GetImageSizeBytes(ctx, repository, ref)
	if err == nil {
		details.SizeBytes = sizeBytes
	}
	return details, nil
}
