package app

import (
	"fmt"
	"net/http"
	"net/url"
	"os"
	"strings"

	"k8s.io/client-go/rest"
)

// ProxyConfig holds proxy configuration for frontend consumption
type ProxyConfig struct {
	URL      string `json:"url"`
	AuthType string `json:"authType"` // "none", "basic", "system"
	Username string `json:"username"`
	// Password is intentionally omitted from the response for security
}

// SetProxyConfig configures the HTTP/HTTPS proxy settings
func (a *App) SetProxyConfig(proxyURL, authType, username, password string) error {
	// Validate authType
	authType = strings.ToLower(authType)
	if authType != "none" && authType != "basic" && authType != "system" {
		return fmt.Errorf("invalid authType: must be 'none', 'basic', or 'system'")
	}

	// Validate proxy URL if not empty and not using system proxy
	if proxyURL != "" && authType != "system" {
		if _, err := url.Parse(proxyURL); err != nil {
			return fmt.Errorf("invalid proxy URL: %w", err)
		}
	}

	// If authType is "system", clear manual proxy settings
	if authType == "system" {
		a.proxyURL = ""
		a.proxyUsername = ""
		a.proxyPassword = ""
	} else {
		a.proxyURL = proxyURL
		a.proxyUsername = username
		a.proxyPassword = password
	}
	a.proxyAuthType = authType

	return a.saveConfig()
}

// GetProxyConfig returns the current proxy configuration
func (a *App) GetProxyConfig() ProxyConfig {
	return ProxyConfig{
		URL:      a.proxyURL,
		AuthType: a.proxyAuthType,
		Username: a.proxyUsername,
	}
}

// ClearProxyConfig removes the proxy configuration
func (a *App) ClearProxyConfig() error {
	a.proxyURL = ""
	a.proxyAuthType = "none"
	a.proxyUsername = ""
	a.proxyPassword = ""
	return a.saveConfig()
}

// DetectSystemProxy returns the system proxy settings from environment variables
func (a *App) DetectSystemProxy() map[string]string {
	return map[string]string{
		"HTTP_PROXY":  getEnvCaseInsensitive("HTTP_PROXY"),
		"HTTPS_PROXY": getEnvCaseInsensitive("HTTPS_PROXY"),
		"NO_PROXY":    getEnvCaseInsensitive("NO_PROXY"),
	}
}

// getEnvCaseInsensitive returns the value of an environment variable,
// checking both uppercase and lowercase versions
func getEnvCaseInsensitive(key string) string {
	if val := os.Getenv(strings.ToUpper(key)); val != "" {
		return val
	}
	return os.Getenv(strings.ToLower(key))
}

// getProxyURL returns the effective proxy URL based on configuration
func (a *App) getProxyURL() string {
	switch a.proxyAuthType {
	case "system":
		// Use system environment variables - client-go will pick these up automatically
		return ""
	case "basic", "none":
		return a.proxyURL
	default:
		return ""
	}
}

// applyProxyConfig applies proxy configuration to a REST config
func (a *App) applyProxyConfig(restConfig *rest.Config) {
	proxyURL := a.getProxyURL()
	if proxyURL == "" {
		// If using system proxy or no proxy, let the default behavior handle it
		if a.proxyAuthType != "system" {
			// Explicitly disable proxy
			restConfig.Proxy = func(_ *http.Request) (*url.URL, error) {
				return nil, nil
			}
		}
		// For "system", don't set Proxy - let http.ProxyFromEnvironment handle it
		return
	}

	// Parse the proxy URL
	parsedURL, err := url.Parse(proxyURL)
	if err != nil {
		fmt.Printf("[WARN] Invalid proxy URL '%s': %v\n", proxyURL, err)
		return
	}

	// Add basic auth credentials if configured
	if a.proxyAuthType == "basic" && a.proxyUsername != "" {
		parsedURL.User = url.UserPassword(a.proxyUsername, a.proxyPassword)
	}

	// Set the proxy function on the REST config
	restConfig.Proxy = func(_ *http.Request) (*url.URL, error) {
		return parsedURL, nil
	}
}

// IsProxyEnabled returns true if a proxy is configured and active
func (a *App) IsProxyEnabled() bool {
	if a.proxyAuthType == "system" {
		// Check if system has proxy environment variables set
		return getEnvCaseInsensitive("HTTP_PROXY") != "" || getEnvCaseInsensitive("HTTPS_PROXY") != ""
	}
	return a.proxyURL != ""
}

// GetProxyDisplayURL returns a display-safe proxy URL (without password)
func (a *App) GetProxyDisplayURL() string {
	if a.proxyAuthType == "system" {
		if httpsProxy := getEnvCaseInsensitive("HTTPS_PROXY"); httpsProxy != "" {
			return sanitizeProxyURL(httpsProxy)
		}
		if httpProxy := getEnvCaseInsensitive("HTTP_PROXY"); httpProxy != "" {
			return sanitizeProxyURL(httpProxy)
		}
		return ""
	}
	return sanitizeProxyURL(a.proxyURL)
}

// sanitizeProxyURL removes password from proxy URL for display purposes
func sanitizeProxyURL(proxyURL string) string {
	if proxyURL == "" {
		return ""
	}
	parsed, err := url.Parse(proxyURL)
	if err != nil {
		return proxyURL
	}
	if parsed.User != nil {
		// Replace password with asterisks
		if _, hasPassword := parsed.User.Password(); hasPassword {
			// Build URL manually to avoid URL-encoding the asterisks
			user := parsed.User.Username()
			host := parsed.Host
			scheme := parsed.Scheme
			path := parsed.Path
			rawQuery := parsed.RawQuery
			result := fmt.Sprintf("%s://%s:***@%s", scheme, user, host)
			if path != "" {
				result += path
			}
			if rawQuery != "" {
				result += "?" + rawQuery
			}
			return result
		}
	}
	return parsed.String()
}
