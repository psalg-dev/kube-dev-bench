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
	Transport      http.RoundTripper
}

// HolmesClient is an HTTP client for the HolmesGPT API
type HolmesClient struct {
	endpoint       string
	apiKey         string
	httpClient     *http.Client
	streamClient   *http.Client
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
		// LLM responses for context-aware analysis can take several minutes,
		// especially when analyzing complex resources with lots of context data.
		timeout = 5 * time.Minute
	}

	transport := config.Transport
	if transport == nil {
		transport = http.DefaultTransport
	}

	endpoint := strings.TrimRight(config.Endpoint, "/")

	return &HolmesClient{
		endpoint:       endpoint,
		apiKey:         config.APIKey,
		modelKey:       config.ModelKey,
		responseFormat: config.ResponseFormat,
		httpClient: &http.Client{
			Timeout:   timeout,
			Transport: transport,
		},
		streamClient: &http.Client{
			Transport: transport,
		},
	}, nil
}

// buildAskRequest creates the HTTP request for a non-streaming ask.
func (c *HolmesClient) buildAskRequest(question string, log *Logger) ([]byte, error) {
	reqBody := HolmesRequest{
		Ask:                    question,
		Model:                  c.modelKey,
		ResponseFormat:         c.responseFormat,
		AdditionalSystemPrompt: windowsCommandPrompt(),
	}

	logHolmesRequest(log, "Ask", c.endpoint+"/api/chat", reqBody)

	body, err := json.Marshal(reqBody)
	if err != nil {
		log.Error("Ask: failed to marshal request", "error", err)
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}
	log.Debug("Ask: request body marshaled", "bodyLen", len(body))
	return body, nil
}

// executeAskRequest executes a single attempt to ask Holmes.
func (c *HolmesClient) executeAskRequest(ctx context.Context, body []byte, log *Logger) (*HolmesResponse, error) {
	req, err := http.NewRequestWithContext(ctx, "POST", c.endpoint+"/api/chat", bytes.NewReader(body))
	if err != nil {
		log.Error("Ask: failed to create request", "error", err)
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	if c.apiKey != "" {
		req.Header.Set("Authorization", "Bearer "+c.apiKey)
		log.Debug("Ask: using API key authentication")
	}

	log.Debug("Ask: executing HTTP request")
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		log.Error("Ask: API returned error status", "statusCode", resp.StatusCode, "responseBody", string(respBody))
		return nil, fmt.Errorf("holmes API error (status %d): %s", resp.StatusCode, string(respBody))
	}

	log.Debug("Ask: decoding response body")
	var holmesResp HolmesResponse
	if err := json.NewDecoder(resp.Body).Decode(&holmesResp); err != nil {
		log.Error("Ask: failed to decode response", "error", err)
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	// Set timestamp if not provided by API
	if holmesResp.Timestamp == "" {
		holmesResp.Timestamp = time.Now().UTC().Format(time.RFC3339Nano)
	}
	if holmesResp.Response == "" && holmesResp.Analysis != "" {
		holmesResp.Response = holmesResp.Analysis
	}

	return &holmesResp, nil
}

// Ask sends a question to HolmesGPT and returns the response
func (c *HolmesClient) Ask(question string) (*HolmesResponse, error) {
	log := GetLogger()
	startTime := time.Now()
	questionPreview := question
	if len(questionPreview) > 200 {
		questionPreview = questionPreview[:200] + "..."
	}

	log.Info("Ask: starting request",
		"endpoint", c.endpoint,
		"model", c.modelKey,
		"questionLen", len(question))
	log.Debug("Ask: question preview", "preview", questionPreview)

	body, err := c.buildAskRequest(question, log)
	if err != nil {
		return nil, err
	}

	overallDeadline := time.Now().Add(6 * time.Minute)
	attempt := 0

	log.Info("Ask: sending HTTP request",
		"url", c.endpoint+"/api/chat",
		"httpTimeout", c.httpClient.Timeout,
		"overallDeadline", overallDeadline.Format(time.RFC3339))

	for {
		attemptStart := time.Now()
		log.Debug("Ask: attempt", "attempt", attempt+1, "elapsed", time.Since(startTime))

		ctx, cancel := context.WithDeadline(context.Background(), overallDeadline)
		resp, err := c.executeAskRequest(ctx, body, log)
		cancel()

		if err == nil {
			log.Info("Ask: request completed successfully",
				"responseLen", len(resp.Response),
				"totalDuration", time.Since(startTime))
			logHolmesResponse(log, "Ask", resp.Response)
			return resp, nil
		}

		log.Error("Ask: request failed",
			"error", err,
			"attempt", attempt+1,
			"attemptDuration", time.Since(attemptStart),
			"totalElapsed", time.Since(startTime))

		if shouldRetry(err) && time.Now().Before(overallDeadline) {
			delay := retryDelay(attempt)
			attempt++
			log.Info("Ask: will retry after delay", "delay", delay, "attempt", attempt)
			if time.Now().Add(delay).Before(overallDeadline) {
				time.Sleep(delay)
				continue
			}
			log.Warn("Ask: retry delay would exceed deadline, giving up")
		}
		return nil, err
	}
}

// buildStreamRequest creates the HTTP request for streaming.
func (c *HolmesClient) buildStreamRequest(ctx context.Context, question string, log *Logger) (*http.Request, error) {
	reqBody := HolmesRequest{
		Ask:                    question,
		Model:                  c.modelKey,
		Stream:                 true,
		ResponseFormat:         c.responseFormat,
		AdditionalSystemPrompt: windowsCommandPrompt(),
	}

	logHolmesRequest(log, "StreamAsk", c.endpoint+"/api/chat", reqBody)

	body, err := json.Marshal(reqBody)
	if err != nil {
		log.Error("StreamAsk: failed to marshal request", "error", err)
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}
	log.Debug("StreamAsk: request body marshaled", "bodyLen", len(body))

	req, err := http.NewRequestWithContext(ctx, "POST", c.endpoint+"/api/chat", bytes.NewReader(body))
	if err != nil {
		log.Error("StreamAsk: failed to create request", "error", err)
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "text/event-stream")
	if c.apiKey != "" {
		req.Header.Set("Authorization", "Bearer "+c.apiKey)
		log.Debug("StreamAsk: using API key authentication")
	}

	return req, nil
}

// sseParser handles parsing of SSE events from a stream.
type sseParser struct {
	log       *Logger
	reader    *bufio.Reader
	onEvent   func(event string, data []byte) error
	eventType string
	dataLines []string
	count     int
}

func (p *sseParser) dispatch() error {
	if len(p.dataLines) == 0 {
		return nil
	}
	currentEvent := strings.TrimSpace(p.eventType)
	if currentEvent == "" {
		currentEvent = "message"
	}
	data := strings.Join(p.dataLines, "\n")
	p.dataLines = nil
	p.eventType = ""
	p.count++
	if p.count <= 5 || p.count%50 == 0 {
		p.log.Debug("StreamAsk: dispatching event",
			"eventType", currentEvent,
			"eventCount", p.count,
			"dataLen", len(data))
	}
	return p.onEvent(currentEvent, []byte(data))
}

func (p *sseParser) parseLine(line string) error {
	line = strings.TrimRight(line, "\r\n")
	if line == "" {
		return p.dispatch()
	}
	if strings.HasPrefix(line, ":") {
		return nil
	}
	if strings.HasPrefix(line, "event:") {
		p.eventType = strings.TrimSpace(strings.TrimPrefix(line, "event:"))
		return nil
	}
	if strings.HasPrefix(line, "data:") {
		p.dataLines = append(p.dataLines, strings.TrimSpace(strings.TrimPrefix(line, "data:")))
	}
	return nil
}

// StreamAsk streams a question to HolmesGPT and emits SSE events via callback.
func (c *HolmesClient) StreamAsk(ctx context.Context, question string, onEvent func(event string, data []byte) error) error {
	log := GetLogger()
	startTime := time.Now()

	log.Info("StreamAsk: starting streaming request",
		"endpoint", c.endpoint,
		"model", c.modelKey,
		"questionLen", len(question))

	req, err := c.buildStreamRequest(ctx, question, log)
	if err != nil {
		return err
	}

	log.Debug("StreamAsk: sending HTTP request")
	resp, err := c.streamClient.Do(req)
	if err != nil {
		log.Error("StreamAsk: HTTP request failed", "error", err, "elapsed", time.Since(startTime))
		return fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()
	log.Info("StreamAsk: received HTTP response", "statusCode", resp.StatusCode, "elapsed", time.Since(startTime))

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		log.Error("StreamAsk: API returned error status", "statusCode", resp.StatusCode, "responseBody", string(respBody))
		return fmt.Errorf("holmes API error (status %d): %s", resp.StatusCode, string(respBody))
	}

	log.Debug("StreamAsk: starting to read SSE stream")
	parser := &sseParser{
		log:     log,
		reader:  bufio.NewReader(resp.Body),
		onEvent: onEvent,
	}

	for {
		if ctx.Err() != nil {
			log.Warn("StreamAsk: context cancelled", "error", ctx.Err(), "eventCount", parser.count, "elapsed", time.Since(startTime))
			return ctx.Err()
		}
		line, err := parser.reader.ReadString('\n')
		if err != nil {
			if errors.Is(err, io.EOF) {
				log.Info("StreamAsk: stream completed", "eventCount", parser.count, "totalDuration", time.Since(startTime))
				return parser.dispatch()
			}
			log.Error("StreamAsk: error reading stream", "error", err, "eventCount", parser.count, "elapsed", time.Since(startTime))
			return err
		}
		if err := parser.parseLine(line); err != nil {
			return err
		}
	}
}

func shouldRetry(err error) bool {
	if errors.Is(err, context.DeadlineExceeded) {
		return true
	}
	var netErr net.Error
	if errors.As(err, &netErr) {
		return netErr.Timeout()
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

func logHolmesRequest(log *Logger, operation, url string, req HolmesRequest) {
	if log == nil {
		return
	}
	questionLen := len(req.Ask)
	systemPromptLen := len(req.AdditionalSystemPrompt)
	responseFormatLen := len(req.ResponseFormat)
	log.Info("LLM request",
		"operation", operation,
		"url", url,
		"model", req.Model,
		"stream", req.Stream,
		"questionLen", questionLen,
		"systemPromptLen", systemPromptLen,
		"responseFormatLen", responseFormatLen)
	log.Debug("LLM request payload",
		"operation", operation,
		"questionPreview", truncateForLog(req.Ask, 600),
		"systemPromptPreview", truncateForLog(req.AdditionalSystemPrompt, 600),
		"responseFormatPreview", truncateForLog(string(req.ResponseFormat), 600))
}

func logHolmesResponse(log *Logger, operation, response string) {
	if log == nil {
		return
	}
	log.Debug("LLM response preview",
		"operation", operation,
		"responseLen", len(response),
		"responsePreview", truncateForLog(response, 800))
}

func truncateForLog(input string, max int) string {
	if max <= 0 || input == "" {
		return input
	}
	if len(input) <= max {
		return input
	}
	return input[:max] + "..."
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
