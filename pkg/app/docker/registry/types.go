package registry

// RegistryType is the kind of registry backend.
type RegistryType string

const (
	RegistryTypeDockerHub RegistryType = "dockerhub"
	RegistryTypeECR       RegistryType = "ecr"
	RegistryTypeACR       RegistryType = "acr"
	RegistryTypeGitLab    RegistryType = "gitlab"
	RegistryTypeGenericV2 RegistryType = "generic_v2"
)

// RegistryCredentials holds optional authentication information.
// For registries that support username/password, use Username + Password.
// For token-based registries, use Token.
// For AWS ECR, Region can be used by the ECR-specific client.
type RegistryCredentials struct {
	Username string `json:"username"`
	Password string `json:"password"`
	Token    string `json:"token"`
	Region   string `json:"region"`
}

// RegistryConfig describes a configured registry instance.
type RegistryConfig struct {
	Name string       `json:"name"`
	URL  string       `json:"url"`
	Type RegistryType `json:"type"`

	Credentials RegistryCredentials `json:"credentials"`

	// HTTP/TLS settings (kept intentionally minimal; can be extended later).
	TimeoutSeconds         int  `json:"timeoutSeconds"`
	InsecureSkipTLSVerify  bool `json:"insecureSkipTlsVerify"`
	AllowInsecureHTTP      bool `json:"allowInsecureHttp"`
	DisableTLSVerification bool `json:"disableTlsVerification"` // legacy alias-ish; keep for future compatibility
}

// RegistryImage is a registry image reference with basic metadata.
type RegistryImage struct {
	Name        string   `json:"name"`
	Tags        []string `json:"tags"`
	Digest      string   `json:"digest"`
	LastUpdated string   `json:"lastUpdated"`
}

// DockerHubRepoSearchResult is a single Docker Hub search result.
// FullName is the "namespace/name" reference that can be pulled as "FullName:latest".
type DockerHubRepoSearchResult struct {
	Name        string `json:"name"`
	Namespace   string `json:"namespace"`
	FullName    string `json:"fullName"`
	Description string `json:"description"`
	SizeBytes   int64  `json:"sizeBytes"`
	StarCount   int    `json:"starCount"`
	PullCount   int    `json:"pullCount"`
	IsOfficial  bool   `json:"isOfficial"`
	IsAutomated bool   `json:"isAutomated"`
	LastUpdated string `json:"lastUpdated"`
}

// DockerHubRepoDetails is a detailed Docker Hub repository response used for inspection.
type DockerHubRepoDetails struct {
	Name        string `json:"name"`
	Namespace   string `json:"namespace"`
	FullName    string `json:"fullName"`
	Description string `json:"description"`
	SizeBytes   int64  `json:"sizeBytes"`
	StarCount   int    `json:"starCount"`
	PullCount   int    `json:"pullCount"`
	LastUpdated string `json:"lastUpdated"`

	// These are included when available.
	IsPrivate bool `json:"isPrivate"`
}
