package holmesgpt

import (
	"bufio"
	"bytes"
	"context"
	_ "embed"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"runtime"
	"strings"
	"time"
)

//go:embed windows-system-prompt.md
var windowsSystemPrompt string

// HolmesConfig holds configuration for creating a HolmesClient
type HolmesConfig struct {
	Endpoint       string
	APIKey         string
	Timeout        time.Duration
	ModelKey       string
	ResponseFormat json.RawMessage
}

// HolmesClient is an HTTP client for the HolmesGPT API
type HolmesClient struct {
	endpoint       string
	apiKey         string
	httpClient     *http.Client
	modelKey       string
	responseFormat json.RawMessage
}

// NewHolmesClient creates a new HolmesClient with the given configuration
func NewHolmesClient(config HolmesConfig) (*HolmesClient, error) {
	if config.Endpoint == "" {
		return nil, fmt.Errorf("holmes endpoint is required")
	}

	timeout := config.Timeout
	if timeout == 0 {
		timeout = 30 * time.Second
	}

	return &HolmesClient{
		endpoint:       config.Endpoint,
		apiKey:         config.APIKey,
		modelKey:       config.ModelKey,
		responseFormat: config.ResponseFormat,
		httpClient: &http.Client{
			Timeout: timeout,
		},
	}, nil
}

// Ask sends a question to HolmesGPT and returns the response
func (c *HolmesClient) Ask(question string) (*HolmesResponse, error) {
	reqBody := HolmesRequest{
		Ask:                    question,
		Model:                  c.modelKey,
		ResponseFormat:         c.responseFormat,
		AdditionalSystemPrompt: windowsCommandPrompt(),
	}

	body, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	overallDeadline := time.Now().Add(2 * time.Minute)
	attempt := 0

	for {
		ctx, cancel := context.WithDeadline(context.Background(), overallDeadline)
		req, err := http.NewRequestWithContext(ctx, "POST", c.endpoint+"/api/chat", bytes.NewReader(body))
		if err != nil {
			cancel()
			return nil, fmt.Errorf("failed to create request: %w", err)
		}

		req.Header.Set("Content-Type", "application/json")
		if c.apiKey != "" {
			req.Header.Set("Authorization", "Bearer "+c.apiKey)
		}

		resp, err := c.httpClient.Do(req)
		if err != nil {
			cancel()
			if shouldRetry(err) && time.Now().Before(overallDeadline) {
				delay := retryDelay(attempt)
				attempt++
				if time.Now().Add(delay).Before(overallDeadline) {
					time.Sleep(delay)
					continue
				}
			}
			return nil, fmt.Errorf("failed to send request: %w", err)
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			respBody, _ := io.ReadAll(resp.Body)
			cancel()
			return nil, fmt.Errorf("holmes API error (status %d): %s", resp.StatusCode, string(respBody))
		}

		var holmesResp HolmesResponse
		if err := json.NewDecoder(resp.Body).Decode(&holmesResp); err != nil {
			cancel()
			return nil, fmt.Errorf("failed to decode response: %w", err)
		}

		cancel()

		// Set timestamp if not provided by API
		if holmesResp.Timestamp.IsZero() {
			holmesResp.Timestamp = time.Now()
		}

		if holmesResp.Response == "" && holmesResp.Analysis != "" {
			holmesResp.Response = holmesResp.Analysis
		}

		return &holmesResp, nil
	}
}

// StreamAsk streams a question to HolmesGPT and emits SSE events via callback.
func (c *HolmesClient) StreamAsk(ctx context.Context, question string, onEvent func(event string, data []byte) error) error {
	reqBody := HolmesRequest{
		Ask:                    question,
		Model:                  c.modelKey,
		Stream:                 true,
		ResponseFormat:         c.responseFormat,
		AdditionalSystemPrompt: windowsCommandPrompt(),
	}

	body, err := json.Marshal(reqBody)
	if err != nil {
		return fmt.Errorf("failed to marshal request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", c.endpoint+"/api/chat", bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "text/event-stream")
	if c.apiKey != "" {
		req.Header.Set("Authorization", "Bearer "+c.apiKey)
	}

	streamClient := &http.Client{}
	resp, err := streamClient.Do(req)
	if err != nil {
		return fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("holmes API error (status %d): %s", resp.StatusCode, string(respBody))
	}

	reader := bufio.NewReader(resp.Body)
	var eventType string
	var dataLines []string

	dispatch := func() error {
		if len(dataLines) == 0 {
			return nil
		}
		currentEvent := strings.TrimSpace(eventType)
		if currentEvent == "" {
			currentEvent = "message"
		}
		data := strings.Join(dataLines, "\n")
		dataLines = nil
		eventType = ""
		return onEvent(currentEvent, []byte(data))
	}

	for {
		if ctx.Err() != nil {
			return ctx.Err()
		}
		line, err := reader.ReadString('\n')
		if err != nil {
			if errors.Is(err, io.EOF) {
				return dispatch()
			}
			return err
		}
		line = strings.TrimRight(line, "\r\n")
		if line == "" {
			if err := dispatch(); err != nil {
				return err
			}
			continue
		}
		if strings.HasPrefix(line, ":") {
			continue
		}
		if strings.HasPrefix(line, "event:") {
			eventType = strings.TrimSpace(strings.TrimPrefix(line, "event:"))
			continue
		}
		if strings.HasPrefix(line, "data:") {
			dataLines = append(dataLines, strings.TrimSpace(strings.TrimPrefix(line, "data:")))
			continue
		}
	}
}

func shouldRetry(err error) bool {
	if errors.Is(err, context.DeadlineExceeded) {
		return true
	}
	var netErr net.Error
	if errors.As(err, &netErr) {
		return netErr.Timeout() || netErr.Temporary()
	}
	return false
}

func retryDelay(attempt int) time.Duration {
	if attempt < 0 {
		attempt = 0
	}
	delay := time.Duration(500*(1<<attempt)) * time.Millisecond
	if delay > 5*time.Second {
		return 5 * time.Second
	}
	return delay
}

func windowsCommandPrompt() string {
	if runtime.GOOS != "windows" {
		return ""
	}
	return strings.TrimSpace(windowsSystemPrompt)
}

// TestConnection tests the connection to HolmesGPT by calling the health endpoint
func (c *HolmesClient) TestConnection() error {
	req, err := http.NewRequest("GET", c.endpoint+"/healthz", nil)
	if err != nil {
		return fmt.Errorf("failed to create health check request: %w", err)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("health check failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("health check returned status %d", resp.StatusCode)
	}

	return nil
}

// GetEndpoint returns the configured endpoint URL
func (c *HolmesClient) GetEndpoint() string {
	return c.endpoint
}
