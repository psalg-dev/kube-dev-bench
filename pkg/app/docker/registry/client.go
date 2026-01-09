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

	// Split on commas not inside quotes.
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

func (c *v2Client) do(ctx context.Context, method, p string, query url.Values, headers map[string]string) (*http.Response, []byte, error) {
	if c == nil || c.baseURL == nil {
		return nil, nil, fmt.Errorf("client not initialized")
	}

	u := *c.baseURL
	// Join with base path.
	u.Path = path.Join(strings.TrimSuffix(u.Path, "/"), p)
	u.RawQuery = ""
	if query != nil {
		u.RawQuery = query.Encode()
	}

	doOnce := func(authHeader string) (*http.Response, []byte, error) {
		req, err := http.NewRequestWithContext(ctx, method, u.String(), nil)
		if err != nil {
			return nil, nil, err
		}
		for k, v := range headers {
			if strings.TrimSpace(k) == "" {
				continue
			}
			req.Header.Set(k, v)
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

	resp, b, err := doOnce(c.authHeader)
	if err != nil {
		return nil, nil, err
	}

	// Handle Bearer token challenge (Docker Hub and other registries).
	if resp.StatusCode == http.StatusUnauthorized {
		if ch, ok := parseBearerChallenge(resp.Header.Get("Www-Authenticate")); ok {
			if tok, terr := c.exchangeBearerToken(ctx, ch); terr == nil {
				c.authHeader = "Bearer " + tok
				resp2, b2, err2 := doOnce(c.authHeader)
				if err2 != nil {
					return nil, nil, err2
				}
				resp, b = resp2, b2
			}
		}
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		// Keep the error short but include a hint.
		msg := strings.TrimSpace(string(b))
		if len(msg) > 512 {
			msg = msg[:512]
		}
		if msg == "" {
			msg = resp.Status
		}
		return nil, nil, fmt.Errorf("registry request failed: %s", msg)
	}

	return resp, b, nil
}
