package registry

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

var dockerHubAPIBaseURL = "https://hub.docker.com"

func dockerHubHTTPClient(timeoutSeconds int) *http.Client {
	timeout := 15 * time.Second
	if timeoutSeconds > 0 {
		timeout = time.Duration(timeoutSeconds) * time.Second
	}
	return &http.Client{Timeout: timeout}
}

// buildDockerHubSearchURL builds the search endpoint URL with query parameters.
func buildDockerHubSearchURL(query string) (string, error) {
	base, err := url.Parse(dockerHubAPIBaseURL)
	if err != nil {
		return "", fmt.Errorf("invalid docker hub api base url: %w", err)
	}
	u, err := base.Parse("/v2/search/repositories/")
	if err != nil {
		return "", fmt.Errorf("build docker hub search url: %w", err)
	}
	q := u.Query()
	q.Set("query", query)
	q.Set("page_size", "25")
	u.RawQuery = q.Encode()
	return u.String(), nil
}

// normalizeRepoName normalizes namespace and name into a full repository name.
func normalizeRepoName(name, namespace, full string) (string, string) {
	name = strings.TrimSpace(name)
	namespace = strings.TrimSpace(namespace)
	full = strings.TrimSpace(full)

	if full == "" {
		if namespace != "" {
			full = namespace + "/" + name
		} else {
			full = name
		}
	}
	if name == "" && full != "" {
		parts := strings.Split(full, "/")
		name = parts[len(parts)-1]
	}
	return name, full
}

func SearchDockerHubRepositories(ctx context.Context, query string) ([]DockerHubRepoSearchResult, error) {
	query = strings.TrimSpace(query)
	if query == "" {
		return []DockerHubRepoSearchResult{}, nil
	}

	searchURL, err := buildDockerHubSearchURL(query)
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, searchURL, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Accept", "application/json")

	hc := dockerHubHTTPClient(0)
	resp, err := hc.Do(req)
	if err != nil {
		return nil, err
	}
	b, _ := io.ReadAll(resp.Body)
	_ = resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		msg := strings.TrimSpace(string(b))
		if msg == "" {
			msg = resp.Status
		}
		return nil, fmt.Errorf("docker hub search failed: %s", msg)
	}

	var out struct {
		Results []struct {
			Name        string `json:"name"`
			Namespace   string `json:"namespace"`
			Repository  string `json:"repo_name"`
			Description string `json:"description"`
			ContentSize int64  `json:"content_size"`
			StarCount   int    `json:"star_count"`
			PullCount   int    `json:"pull_count"`
			IsOfficial  bool   `json:"is_official"`
			IsAutomated bool   `json:"is_automated"`
			LastUpdated string `json:"last_updated"`
		} `json:"results"`
	}
	if err := json.Unmarshal(b, &out); err != nil {
		return nil, fmt.Errorf("decode docker hub search response: %w", err)
	}

	results := make([]DockerHubRepoSearchResult, 0, len(out.Results))
	for _, r := range out.Results {
		name, full := normalizeRepoName(r.Name, r.Namespace, r.Repository)
		results = append(results, DockerHubRepoSearchResult{
			Name:        name,
			Namespace:   strings.TrimSpace(r.Namespace),
			FullName:    full,
			Description: r.Description,
			SizeBytes:   r.ContentSize,
			StarCount:   r.StarCount,
			PullCount:   r.PullCount,
			IsOfficial:  r.IsOfficial,
			IsAutomated: r.IsAutomated,
			LastUpdated: r.LastUpdated,
		})
	}
	return results, nil
}

func GetDockerHubRepositoryDetails(ctx context.Context, fullName string) (DockerHubRepoDetails, error) {
	fullName = strings.TrimSpace(fullName)
	if fullName == "" {
		return DockerHubRepoDetails{}, fmt.Errorf("repository is required")
	}

	namespace, name := splitDockerHubFullName(fullName)
	if namespace == "" || name == "" {
		return DockerHubRepoDetails{}, fmt.Errorf("invalid repository: %s", fullName)
	}

	base, err := url.Parse(dockerHubAPIBaseURL)
	if err != nil {
		return DockerHubRepoDetails{}, fmt.Errorf("invalid docker hub api base url: %w", err)
	}
	u, err := base.Parse(fmt.Sprintf("/v2/repositories/%s/%s/", url.PathEscape(namespace), url.PathEscape(name)))
	if err != nil {
		return DockerHubRepoDetails{}, fmt.Errorf("build docker hub repository url: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u.String(), nil)
	if err != nil {
		return DockerHubRepoDetails{}, err
	}
	req.Header.Set("Accept", "application/json")

	hc := dockerHubHTTPClient(0)
	resp, err := hc.Do(req)
	if err != nil {
		return DockerHubRepoDetails{}, err
	}
	b, _ := io.ReadAll(resp.Body)
	_ = resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		msg := strings.TrimSpace(string(b))
		if msg == "" {
			msg = resp.Status
		}
		return DockerHubRepoDetails{}, fmt.Errorf("docker hub repository request failed: %s", msg)
	}

	var out struct {
		Name        string `json:"name"`
		Namespace   string `json:"namespace"`
		FullName    string `json:"repo_name"`
		Description string `json:"description"`
		// Note: Docker Hub's repository payload also contains `storage_size`, but that is the
		// total storage for the repo across tags/architectures and is not representative of
		// an individual image size.
		StarCount   int    `json:"star_count"`
		PullCount   int    `json:"pull_count"`
		LastUpdated string `json:"last_updated"`
		IsPrivate   bool   `json:"is_private"`
	}
	if err := json.Unmarshal(b, &out); err != nil {
		return DockerHubRepoDetails{}, fmt.Errorf("decode docker hub repository response: %w", err)
	}

	fn := strings.TrimSpace(out.FullName)
	if fn == "" {
		fn = namespace + "/" + name
	}

	// Determine an image size for display. We prefer the linux/amd64 image for the latest tag.
	// If `latest` isn't present, fall back to the most recently updated tag.
	sizeBytes, _ := dockerHubResolveDisplayImageSizeBytes(ctx, namespace, name)

	return DockerHubRepoDetails{
		Name:        strings.TrimSpace(out.Name),
		Namespace:   strings.TrimSpace(out.Namespace),
		FullName:    fn,
		Description: out.Description,
		SizeBytes:   sizeBytes,
		StarCount:   out.StarCount,
		PullCount:   out.PullCount,
		LastUpdated: out.LastUpdated,
		IsPrivate:   out.IsPrivate,
	}, nil
}

type dockerHubTagImage struct {
	Architecture string `json:"architecture"`
	OS           string `json:"os"`
	Variant      string `json:"variant"`
	Size         int64  `json:"size"`
}

func dockerHubPickPreferredImageSize(images []dockerHubTagImage, fallback int64) int64 {
	// Prefer linux/amd64 (matches what most users expect from Docker Hub UI).
	for _, img := range images {
		if img.OS == "linux" && img.Architecture == "amd64" && img.Size > 0 {
			return img.Size
		}
	}
	for _, img := range images {
		if img.Size > 0 {
			return img.Size
		}
	}
	if fallback > 0 {
		return fallback
	}
	return 0
}

func dockerHubGetTagSizeBytes(ctx context.Context, namespace, name, tag string) (int64, error) {
	base, err := url.Parse(dockerHubAPIBaseURL)
	if err != nil {
		return 0, fmt.Errorf("invalid docker hub api base url: %w", err)
	}
	u, err := base.Parse(fmt.Sprintf("/v2/repositories/%s/%s/tags/%s/", url.PathEscape(namespace), url.PathEscape(name), url.PathEscape(tag)))
	if err != nil {
		return 0, fmt.Errorf("build docker hub tag url: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u.String(), nil)
	if err != nil {
		return 0, err
	}
	req.Header.Set("Accept", "application/json")

	hc := dockerHubHTTPClient(0)
	resp, err := hc.Do(req)
	if err != nil {
		return 0, err
	}
	b, _ := io.ReadAll(resp.Body)
	_ = resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		msg := strings.TrimSpace(string(b))
		if msg == "" {
			msg = resp.Status
		}
		return 0, fmt.Errorf("docker hub tag request failed: %s", msg)
	}

	var out struct {
		FullSize int64               `json:"full_size"`
		Images   []dockerHubTagImage `json:"images"`
	}
	if err := json.Unmarshal(b, &out); err != nil {
		return 0, fmt.Errorf("decode docker hub tag response: %w", err)
	}

	return dockerHubPickPreferredImageSize(out.Images, out.FullSize), nil
}

func dockerHubResolveDisplayImageSizeBytes(ctx context.Context, namespace, name string) (int64, error) {
	// 1) Try latest tag
	if size, err := dockerHubGetTagSizeBytes(ctx, namespace, name, "latest"); err == nil && size > 0 {
		return size, nil
	}

	// 2) Fall back to most recently updated tag
	base, err := url.Parse(dockerHubAPIBaseURL)
	if err != nil {
		return 0, fmt.Errorf("invalid docker hub api base url: %w", err)
	}
	u, err := base.Parse(fmt.Sprintf("/v2/repositories/%s/%s/tags/", url.PathEscape(namespace), url.PathEscape(name)))
	if err != nil {
		return 0, fmt.Errorf("build docker hub tags url: %w", err)
	}
	q := u.Query()
	q.Set("page_size", "1")
	q.Set("ordering", "last_updated")
	u.RawQuery = q.Encode()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u.String(), nil)
	if err != nil {
		return 0, err
	}
	req.Header.Set("Accept", "application/json")

	hc := dockerHubHTTPClient(0)
	resp, err := hc.Do(req)
	if err != nil {
		return 0, err
	}
	b, _ := io.ReadAll(resp.Body)
	_ = resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		msg := strings.TrimSpace(string(b))
		if msg == "" {
			msg = resp.Status
		}
		return 0, fmt.Errorf("docker hub tags request failed: %s", msg)
	}

	var out struct {
		Results []struct {
			Name     string              `json:"name"`
			FullSize int64               `json:"full_size"`
			Images   []dockerHubTagImage `json:"images"`
		} `json:"results"`
	}
	if err := json.Unmarshal(b, &out); err != nil {
		return 0, fmt.Errorf("decode docker hub tags response: %w", err)
	}
	if len(out.Results) == 0 {
		return 0, nil
	}

	first := out.Results[0]
	// If images are present in the list response, use them; otherwise, ask the tag endpoint.
	if s := dockerHubPickPreferredImageSize(first.Images, first.FullSize); s > 0 {
		return s, nil
	}
	if strings.TrimSpace(first.Name) == "" {
		return 0, nil
	}
	return dockerHubGetTagSizeBytes(ctx, namespace, name, first.Name)
}

func splitDockerHubFullName(full string) (namespace string, name string) {
	full = strings.TrimSpace(full)
	if full == "" {
		return "", ""
	}
	parts := strings.Split(full, "/")
	if len(parts) == 1 {
		// Docker Hub official images live in "library".
		return "library", parts[0]
	}
	if len(parts) == 2 {
		return parts[0], parts[1]
	}
	// If the string contains registry host prefixes, strip them.
	return parts[len(parts)-2], parts[len(parts)-1]
}
