package registry

import (
	"context"
	"crypto/tls"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"path"
	"strings"
	"time"
)

var ErrUnsupportedRegistryType = errors.New("unsupported registry type")

// RegistryClient provides minimal operations used by the Swarm UI.
// Implementations may support a subset of the methods depending on registry capabilities.
type RegistryClient interface {
	ListRepositories(ctx context.Context) ([]string, error)
	ListTags(ctx context.Context, repository string) ([]string, error)
	GetManifestDigest(ctx context.Context, repository, reference string) (string, error)
}

// NewClient constructs a registry client from configuration.
func NewClient(cfg RegistryConfig) (RegistryClient, error) {
	switch cfg.Type {
	case RegistryTypeGenericV2:
		return NewV2Client(cfg)
	case RegistryTypeArtifactory:
		return NewV2Client(cfg)
	case RegistryTypeDockerHub:
		return NewDockerHubClient(cfg)
	default:
		return nil, fmt.Errorf("%w: %s", ErrUnsupportedRegistryType, cfg.Type)
	}
}

type v2Client struct {
	baseURL         *url.URL
	httpClient      *http.Client
	authHeader      string
	basicAuthHeader string
}

// NewV2Client creates a generic Docker Registry v2 client.
// cfg.URL must include scheme and host (e.g. https://registry.example.com).
func NewV2Client(cfg RegistryConfig) (*v2Client, error) {
	if strings.TrimSpace(cfg.URL) == "" {
		return nil, fmt.Errorf("registry url is required")
	}

	u, err := url.Parse(cfg.URL)
	if err != nil {
		return nil, fmt.Errorf("invalid registry url: %w", err)
	}
	if u.Scheme == "" {
		return nil, fmt.Errorf("registry url must include scheme")
	}
	if u.Scheme == "http" && !cfg.AllowInsecureHTTP {
		return nil, fmt.Errorf("insecure http registry url not allowed")
	}

	timeout := 15 * time.Second
	if cfg.TimeoutSeconds > 0 {
		timeout = time.Duration(cfg.TimeoutSeconds) * time.Second
	}

	tlsCfg := &tls.Config{}
	// Support both fields (DisableTLSVerification exists for forward/backward flexibility).
	if cfg.InsecureSkipTLSVerify || cfg.DisableTLSVerification {
		tlsCfg.InsecureSkipVerify = true
	}

	transport := http.DefaultTransport.(*http.Transport).Clone()
	transport.TLSClientConfig = tlsCfg

	hc := &http.Client{
		Timeout:   timeout,
		Transport: transport,
	}

	basicAuthHeader := ""
	if strings.TrimSpace(cfg.Credentials.Username) != "" || strings.TrimSpace(cfg.Credentials.Password) != "" {
		cred := strings.TrimSpace(cfg.Credentials.Username) + ":" + strings.TrimSpace(cfg.Credentials.Password)
		basicAuthHeader = "Basic " + base64.StdEncoding.EncodeToString([]byte(cred))
	}

	authHeader := ""
	if strings.TrimSpace(cfg.Credentials.Token) != "" {
		authHeader = "Bearer " + strings.TrimSpace(cfg.Credentials.Token)
	} else if basicAuthHeader != "" {
		authHeader = basicAuthHeader
	}

	// Ensure the base path doesn't end with a slash so JoinPath is stable.
	if u.Path == "/" {
		u.Path = ""
	}

	return &v2Client{
		baseURL:         u,
		httpClient:      hc,
		authHeader:      authHeader,
		basicAuthHeader: basicAuthHeader,
	}, nil
}

type bearerChallenge struct {
	realm   string
	service string
	scope   string
}

// splitChallengeParams splits challenge parameters on commas not inside quotes.
func splitChallengeParams(params string) []string {
	var parts []string
	var cur strings.Builder
	inQuotes := false
	for _, r := range params {
		switch r {
		case '"':
			inQuotes = !inQuotes
			cur.WriteRune(r)
		case ',':
			if inQuotes {
				cur.WriteRune(r)
			} else {
				parts = append(parts, strings.TrimSpace(cur.String()))
				cur.Reset()
			}
		default:
			cur.WriteRune(r)
		}
	}
	if s := strings.TrimSpace(cur.String()); s != "" {
		parts = append(parts, s)
	}
	return parts
}

// parseChallengeParams parses key=value pairs into a bearerChallenge.
func parseChallengeParams(parts []string) bearerChallenge {
	out := bearerChallenge{}
	for _, p := range parts {
		if p == "" {
			continue
		}
		kv := strings.SplitN(p, "=", 2)
		if len(kv) != 2 {
			continue
		}
		k := strings.ToLower(strings.TrimSpace(kv[0]))
		v := strings.TrimSpace(kv[1])
		v = strings.TrimPrefix(v, "\"")
		v = strings.TrimSuffix(v, "\"")
		switch k {
		case "realm":
			out.realm = v
		case "service":
			out.service = v
		case "scope":
			out.scope = v
		}
	}
	return out
}

func parseBearerChallenge(header string) (bearerChallenge, bool) {
	header = strings.TrimSpace(header)
	if header == "" {
		return bearerChallenge{}, false
	}
	lower := strings.ToLower(header)
	if !strings.HasPrefix(lower, "bearer ") {
		return bearerChallenge{}, false
	}
	sp := strings.IndexByte(header, ' ')
	if sp < 0 {
		return bearerChallenge{}, false
	}
	params := strings.TrimSpace(header[sp+1:])
	if params == "" {
		return bearerChallenge{}, false
	}

	parts := splitChallengeParams(params)
	out := parseChallengeParams(parts)

	if strings.TrimSpace(out.realm) == "" {
		return bearerChallenge{}, false
	}
	return out, true
}

type bearerTokenResponse struct {
	Token       string `json:"token"`
	AccessToken string `json:"access_token"`
}

func (c *v2Client) exchangeBearerToken(ctx context.Context, ch bearerChallenge) (string, error) {
	if c == nil {
		return "", fmt.Errorf("client not initialized")
	}
	if strings.TrimSpace(ch.realm) == "" {
		return "", fmt.Errorf("missing bearer realm")
	}

	u, err := url.Parse(ch.realm)
	if err != nil {
		return "", fmt.Errorf("invalid bearer realm: %w", err)
	}

	q := u.Query()
	if strings.TrimSpace(ch.service) != "" {
		q.Set("service", ch.service)
	}
	if strings.TrimSpace(ch.scope) != "" {
		q.Set("scope", ch.scope)
	}
	u.RawQuery = q.Encode()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u.String(), nil)
	if err != nil {
		return "", err
	}
	if strings.TrimSpace(c.basicAuthHeader) != "" {
		req.Header.Set("Authorization", c.basicAuthHeader)
	}
	req.Header.Set("Accept", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	b, _ := io.ReadAll(resp.Body)
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		msg := strings.TrimSpace(string(b))
		if msg == "" {
			msg = resp.Status
		}
		return "", fmt.Errorf("registry auth token request failed: %s", msg)
	}

	var tr bearerTokenResponse
	if len(b) > 0 {
		if err := json.Unmarshal(b, &tr); err != nil {
			return "", fmt.Errorf("decode auth token response: %w", err)
		}
	}
	tok := strings.TrimSpace(tr.Token)
	if tok == "" {
		tok = strings.TrimSpace(tr.AccessToken)
	}
	if tok == "" {
		return "", fmt.Errorf("auth token response missing token")
	}
	return tok, nil
}

type catalogResponse struct {
	Repositories []string `json:"repositories"`
}

type tagsResponse struct {
	Name string   `json:"name"`
	Tags []string `json:"tags"`
}

type v2ManifestList struct {
	SchemaVersion int    `json:"schemaVersion"`
	MediaType     string `json:"mediaType"`
	Manifests     []struct {
		MediaType string `json:"mediaType"`
		Digest    string `json:"digest"`
		Platform  struct {
			Architecture string `json:"architecture"`
			OS           string `json:"os"`
			Variant      string `json:"variant"`
		} `json:"platform"`
	} `json:"manifests"`
}

type v2ImageManifest struct {
	SchemaVersion int    `json:"schemaVersion"`
	MediaType     string `json:"mediaType"`
	Layers        []struct {
		Size int64 `json:"size"`
	} `json:"layers"`
}

// parseManifestListSize tries to parse as manifest list and return the size for a specific platform.
func (c *v2Client) parseManifestListSize(ctx context.Context, repository string, body []byte) (int64, bool) {
	var ml v2ManifestList
	if err := json.Unmarshal(body, &ml); err != nil || len(ml.Manifests) == 0 {
		return 0, false
	}

	chosen := chooseManifestDigestFromList(ml.Manifests)
	if chosen == "" {
		return 0, true // empty means we handled it but found nothing
	}
	size, _ := c.GetImageSizeBytes(ctx, repository, chosen)
	return size, true
}

// chooseManifestDigestFromList selects the best manifest digest, preferring linux/amd64.
func chooseManifestDigestFromList(manifests []struct {
	MediaType string `json:"mediaType"`
	Digest    string `json:"digest"`
	Platform  struct {
		Architecture string `json:"architecture"`
		OS           string `json:"os"`
		Variant      string `json:"variant"`
	} `json:"platform"`
}) string {
	for _, m := range manifests {
		if m.Platform.OS == "linux" && m.Platform.Architecture == "amd64" && strings.TrimSpace(m.Digest) != "" {
			return strings.TrimSpace(m.Digest)
		}
	}
	if len(manifests) > 0 {
		return strings.TrimSpace(manifests[0].Digest)
	}
	return ""
}

// parseImageManifestSize tries to parse as image manifest and sum layer sizes.
func parseImageManifestSize(body []byte) (int64, bool) {
	var im v2ImageManifest
	if err := json.Unmarshal(body, &im); err != nil || len(im.Layers) == 0 {
		return 0, false
	}
	var total int64
	for _, l := range im.Layers {
		if l.Size > 0 {
			total += l.Size
		}
	}
	return total, true
}

func (c *v2Client) GetImageSizeBytes(ctx context.Context, repository, reference string) (int64, error) {
	repository = strings.TrimSpace(repository)
	reference = strings.TrimSpace(reference)
	if repository == "" {
		return 0, fmt.Errorf("repository is required")
	}
	if reference == "" {
		return 0, fmt.Errorf("reference is required")
	}

	p := fmt.Sprintf("/v2/%s/manifests/%s", repository, reference)
	headers := map[string]string{
		"Accept": strings.Join([]string{
			"application/vnd.docker.distribution.manifest.v2+json",
			"application/vnd.oci.image.manifest.v1+json",
			"application/vnd.docker.distribution.manifest.list.v2+json",
			"application/vnd.oci.image.index.v1+json",
		}, ", "),
	}

	_, body, err := c.do(ctx, http.MethodGet, p, nil, headers)
	if err != nil {
		return 0, err
	}
	if len(body) == 0 {
		return 0, nil
	}

	// Try manifest list / index first.
	if size, ok := c.parseManifestListSize(ctx, repository, body); ok {
		return size, nil
	}

	// Try image manifest (schema2/OCI).
	if size, ok := parseImageManifestSize(body); ok {
		return size, nil
	}

	return 0, nil
}

func (c *v2Client) ListRepositories(ctx context.Context) ([]string, error) {
	// Docker Hub does not generally support catalog listing; it returns 401/404.
	// Keep behavior generic (return error if server doesn't support it).
	var out catalogResponse
	_, err := c.getJSON(ctx, "/v2/_catalog", nil, &out)
	if err != nil {
		return nil, err
	}
	if out.Repositories == nil {
		return []string{}, nil
	}
	return out.Repositories, nil
}

func (c *v2Client) ListTags(ctx context.Context, repository string) ([]string, error) {
	repository = strings.TrimSpace(repository)
	if repository == "" {
		return nil, fmt.Errorf("repository is required")
	}
	var out tagsResponse
	_, err := c.getJSON(ctx, fmt.Sprintf("/v2/%s/tags/list", repository), nil, &out)
	if err != nil {
		return nil, err
	}
	if out.Tags == nil {
		return []string{}, nil
	}
	return out.Tags, nil
}

func (c *v2Client) GetManifestDigest(ctx context.Context, repository, reference string) (string, error) {
	repository = strings.TrimSpace(repository)
	reference = strings.TrimSpace(reference)
	if repository == "" {
		return "", fmt.Errorf("repository is required")
	}
	if reference == "" {
		return "", fmt.Errorf("reference is required")
	}

	p := fmt.Sprintf("/v2/%s/manifests/%s", repository, reference)
	headers := map[string]string{
		"Accept": strings.Join([]string{
			"application/vnd.docker.distribution.manifest.v2+json",
			"application/vnd.oci.image.manifest.v1+json",
			"application/vnd.docker.distribution.manifest.list.v2+json",
			"application/vnd.oci.image.index.v1+json",
		}, ", "),
	}

	resp, body, err := c.do(ctx, http.MethodGet, p, nil, headers)
	if err != nil {
		return "", err
	}
	_ = body

	digest := strings.TrimSpace(resp.Header.Get("Docker-Content-Digest"))
	if digest == "" {
		return "", fmt.Errorf("manifest digest not provided by registry")
	}
	return digest, nil
}

func (c *v2Client) getJSON(ctx context.Context, p string, query url.Values, out any) (*http.Response, error) {
	resp, body, err := c.do(ctx, http.MethodGet, p, query, map[string]string{"Accept": "application/json"})
	if err != nil {
		return nil, err
	}
	if len(body) == 0 {
		return resp, nil
	}
	if err := json.Unmarshal(body, out); err != nil {
		return nil, fmt.Errorf("decode response: %w", err)
	}
	return resp, nil
}

// buildRequestURL constructs the full URL for the registry request.
func (c *v2Client) buildRequestURL(p string, query url.Values) url.URL {
	u := *c.baseURL
	u.Path = path.Join(strings.TrimSuffix(u.Path, "/"), p)
	u.RawQuery = ""
	if query != nil {
		u.RawQuery = query.Encode()
	}
	return u
}

// executeRequest executes a single HTTP request with the given auth header.
func (c *v2Client) executeRequest(ctx context.Context, method string, u url.URL, headers map[string]string, authHeader string) (*http.Response, []byte, error) {
	req, err := http.NewRequestWithContext(ctx, method, u.String(), nil)
	if err != nil {
		return nil, nil, err
	}
	for k, v := range headers {
		if strings.TrimSpace(k) != "" {
			req.Header.Set(k, v)
		}
	}
	if strings.TrimSpace(authHeader) != "" {
		req.Header.Set("Authorization", authHeader)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, nil, err
	}
	defer resp.Body.Close()
	b, _ := io.ReadAll(resp.Body)
	return resp, b, nil
}

// handleBearerChallenge attempts to exchange a Bearer token and retry the request.
func (c *v2Client) handleBearerChallenge(ctx context.Context, resp *http.Response, method string, u url.URL, headers map[string]string) (*http.Response, []byte, bool) {
	if resp.StatusCode != http.StatusUnauthorized {
		return nil, nil, false
	}
	ch, ok := parseBearerChallenge(resp.Header.Get("Www-Authenticate"))
	if !ok {
		return nil, nil, false
	}
	tok, err := c.exchangeBearerToken(ctx, ch)
	if err != nil {
		return nil, nil, false
	}
	c.authHeader = "Bearer " + tok
	resp2, b2, err2 := c.executeRequest(ctx, method, u, headers, c.authHeader)
	if err2 != nil {
		return nil, nil, false
	}
	return resp2, b2, true
}

// formatErrorMessage formats the error message from response body.
func formatErrorMessage(body []byte, status string) string {
	msg := strings.TrimSpace(string(body))
	if len(msg) > 512 {
		msg = msg[:512]
	}
	if msg == "" {
		msg = status
	}
	return msg
}

func (c *v2Client) do(ctx context.Context, method, p string, query url.Values, headers map[string]string) (*http.Response, []byte, error) {
	if c == nil || c.baseURL == nil {
		return nil, nil, fmt.Errorf("client not initialized")
	}

	u := c.buildRequestURL(p, query)

	resp, b, err := c.executeRequest(ctx, method, u, headers, c.authHeader)
	if err != nil {
		return nil, nil, err
	}

	// Handle Bearer token challenge.
	if resp2, b2, ok := c.handleBearerChallenge(ctx, resp, method, u, headers); ok {
		resp, b = resp2, b2
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, nil, fmt.Errorf("registry request failed: %s", formatErrorMessage(b, resp.Status))
	}

	return resp, b, nil
}
