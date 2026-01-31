package registry

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

// dockerHubClient implements repository listing via the Docker Hub API.
// It delegates tag/digest operations to the Registry v2 client.
//
// Docker Hub's registry endpoint generally does not allow /v2/_catalog, so
// repository browsing must use hub.docker.com APIs.
//
// This stays intentionally minimal to match the current UI needs.
// It lists repositories for the configured username.
// Returned repository names are of the form "namespace/name".
//
// NOTE: This does not attempt to list organizations; only the configured user's namespace.
//
// Docker Hub API docs/behavior can evolve; this client is best-effort.
// If listing fails, callers can still browse tags/digests by entering a known repo name.

type dockerHubClient struct {
	v2         *v2Client
	hubBaseURL string
	username   string
	password   string
	httpClient *http.Client
}

func NewDockerHubClient(cfg RegistryConfig) (RegistryClient, error) {
	v2, err := NewV2Client(cfg)
	if err != nil {
		return nil, err
	}

	username := strings.TrimSpace(cfg.Credentials.Username)
	password := strings.TrimSpace(cfg.Credentials.Password)

	timeout := 15 * time.Second
	if cfg.TimeoutSeconds > 0 {
		timeout = time.Duration(cfg.TimeoutSeconds) * time.Second
	}

	return &dockerHubClient{
		v2:         v2,
		hubBaseURL: "https://hub.docker.com",
		username:   username,
		password:   password,
		httpClient: &http.Client{Timeout: timeout},
	}, nil
}

// dockerHubRepoPage represents a page of repository results from Docker Hub
type dockerHubRepoPage struct {
	Next    *string `json:"next"`
	Results []struct {
		Name      string `json:"name"`
		Namespace string `json:"namespace"`
	} `json:"results"`
}

// setListReposAuth sets authorization header for repository listing
func (c *dockerHubClient) setListReposAuth(req *http.Request, jwt string) {
	if jwt != "" {
		req.Header.Set("Authorization", "JWT "+jwt)
	} else if c.password != "" {
		cred := c.username + ":" + c.password
		req.Header.Set("Authorization", "Basic "+base64.StdEncoding.EncodeToString([]byte(cred)))
	}
}

// buildListReposURL builds the URL for listing repositories
func (c *dockerHubClient) buildListReposURL(base *url.URL, next string) (*url.URL, error) {
	u, err := base.Parse(next)
	if err != nil {
		return nil, fmt.Errorf("build docker hub url: %w", err)
	}
	q := u.Query()
	if q.Get("page_size") == "" {
		q.Set("page_size", "100")
		u.RawQuery = q.Encode()
	}
	return u, nil
}

// fetchReposPage fetches a single page of repositories
func (c *dockerHubClient) fetchReposPage(ctx context.Context, u *url.URL, jwt string) ([]byte, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u.String(), nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Accept", "application/json")
	c.setListReposAuth(req, jwt)

	resp, err := c.httpClient.Do(req)
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
		return nil, fmt.Errorf("docker hub repositories request failed: %s", msg)
	}
	return b, nil
}

// parseReposPage parses repository page and appends to results
func (c *dockerHubClient) parseReposPage(b []byte, repos *[]string) (string, error) {
	var page dockerHubRepoPage
	if err := json.Unmarshal(b, &page); err != nil {
		return "", fmt.Errorf("decode docker hub repositories response: %w", err)
	}

	for _, r := range page.Results {
		ns := strings.TrimSpace(r.Namespace)
		name := strings.TrimSpace(r.Name)
		if name == "" {
			continue
		}
		if ns == "" {
			ns = c.username
		}
		*repos = append(*repos, ns+"/"+name)
	}

	if page.Next == nil || strings.TrimSpace(*page.Next) == "" {
		return "", nil
	}
	return *page.Next, nil
}

func (c *dockerHubClient) ListRepositories(ctx context.Context) ([]string, error) {
	if c.username == "" {
		return nil, fmt.Errorf("docker hub username is required to list repositories")
	}

	jwt := ""
	if c.password != "" {
		jwt, _ = c.loginJWT(ctx)
	}

	base, err := url.Parse(c.hubBaseURL)
	if err != nil {
		return nil, fmt.Errorf("invalid docker hub api base url: %w", err)
	}

	next := (&url.URL{Path: fmt.Sprintf("/v2/repositories/%s/", url.PathEscape(c.username))}).String()
	repos := make([]string, 0, 64)

	for {
		u, err := c.buildListReposURL(base, next)
		if err != nil {
			return nil, err
		}

		b, err := c.fetchReposPage(ctx, u, jwt)
		if err != nil {
			return nil, err
		}

		next, err = c.parseReposPage(b, &repos)
		if err != nil {
			return nil, err
		}
		if next == "" {
			break
		}
	}

	return repos, nil
}

func (c *dockerHubClient) loginJWT(ctx context.Context) (string, error) {
	base, err := url.Parse(c.hubBaseURL)
	if err != nil {
		return "", fmt.Errorf("invalid docker hub api base url: %w", err)
	}
	u, err := base.Parse("/v2/users/login/")
	if err != nil {
		return "", fmt.Errorf("build docker hub login url: %w", err)
	}

	body := map[string]string{"username": c.username, "password": c.password}
	buf, _ := json.Marshal(body)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, u.String(), strings.NewReader(string(buf)))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return "", err
	}
	b, _ := io.ReadAll(resp.Body)
	_ = resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		msg := strings.TrimSpace(string(b))
		if msg == "" {
			msg = resp.Status
		}
		return "", fmt.Errorf("docker hub login failed: %s", msg)
	}

	var out struct {
		Token string `json:"token"`
	}
	if err := json.Unmarshal(b, &out); err != nil {
		return "", fmt.Errorf("decode docker hub login response: %w", err)
	}
	jwt := strings.TrimSpace(out.Token)
	if jwt == "" {
		return "", fmt.Errorf("docker hub login response missing token")
	}
	return jwt, nil
}

func (c *dockerHubClient) ListTags(ctx context.Context, repository string) ([]string, error) {
	return c.v2.ListTags(ctx, repository)
}

func (c *dockerHubClient) GetManifestDigest(ctx context.Context, repository, reference string) (string, error) {
	return c.v2.GetManifestDigest(ctx, repository, reference)
}
