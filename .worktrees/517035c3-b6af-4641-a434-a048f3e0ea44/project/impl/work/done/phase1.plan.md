# Phase 1: Foundation (Sprint 1-2)

**Status:** DONE
**Created:** 2026-02-06
**Updated:** 2026-02-06

**Status**: Completed
**Duration**: 2 Sprints (4 weeks)
**Goal**: Establish basic HolmesGPT integration with HTTP API client, minimal UI, and configuration management

## Current Status (Verified 2026-02-06)

- Backend HolmesGPT client, config persistence, and Wails RPCs are implemented in [pkg/app/holmesgpt](pkg/app/holmesgpt) and [pkg/app/holmes_integration.go](pkg/app/holmes_integration.go), with startup wiring in [pkg/app/app_lifecycle.go](pkg/app/app_lifecycle.go).
- Frontend Holmes UI is implemented in TypeScript under [frontend/src/holmes](frontend/src/holmes), including [frontend/src/holmes/HolmesContext.tsx](frontend/src/holmes/HolmesContext.tsx), [frontend/src/holmes/HolmesPanel.tsx](frontend/src/holmes/HolmesPanel.tsx), and [frontend/src/holmes/HolmesConfigModal.tsx](frontend/src/holmes/HolmesConfigModal.tsx).
- Documentation updates are present in [CLAUDE.md](CLAUDE.md) and [README.md](README.md).
- Note: legacy .jsx references below are historical; current implementation uses .ts/.tsx files.

---

## Overview

### Goals
- ✅ Create Go HTTP client for HolmesGPT API
- ✅ Expose Wails RPC methods for frontend communication
- ✅ Build minimal React UI for Holmes queries
- ✅ Implement configuration management (endpoint, API keys)
- ✅ Achieve 70%+ test coverage

### Prerequisites
- HolmesGPT instance running (local or in-cluster)
- Understanding of HolmesGPT API endpoints
- Familiarity with Wails bindings

### Success Criteria
- [x] User can configure Holmes endpoint and credentials
- [x] User can ask arbitrary questions about their cluster
- [x] Responses display in KubeDevBench UI
- [x] Configuration persists across app restarts
- [x] All tests passing with 70%+ coverage

---

## Implementation Tasks

### Backend Tasks

#### Core Infrastructure
- [x] Create `pkg/app/holmesgpt/` directory
- [x] Implement `pkg/app/holmesgpt/client.go` - HTTP client for Holmes API
- [x] Implement `pkg/app/holmesgpt/types.go` - Request/response type definitions
- [x] Implement `pkg/app/holmesgpt/config.go` - Holmes configuration management
- [x] Implement `pkg/app/holmesgpt/client_test.go` - Unit tests with fake HTTP server

#### Wails Integration
- [x] Implement `pkg/app/holmes_integration.go` - Wails RPC methods
- [x] Implement `pkg/app/holmes_integration_test.go` - Integration tests
- [x] Update `pkg/app/config.go` - Add Holmes config to AppConfig struct
- [x] Update `pkg/app/app_lifecycle.go` - Initialize Holmes client in Startup

### Frontend Tasks

#### Core Components
- [x] Create `frontend/src/holmes/` directory
- [x] Implement `frontend/src/holmes/HolmesContext.jsx` - State management
- [x] Implement `frontend/src/holmes/HolmesPanel.jsx` - Main UI component
- [x] Implement `frontend/src/holmes/HolmesConfigModal.jsx` - Configuration overlay
- [x] Implement `frontend/src/holmes/holmesApi.js` - Wails binding wrapper

#### UI Integration
- [x] Update `frontend/src/AppContainer.jsx` - Add HolmesProvider to context stack
- [x] Add Holmes toggle button to main UI
- [x] Add keyboard shortcut (Ctrl+Shift+H) to open Holmes panel

### Testing Tasks

#### Go Unit Tests
- [x] Test Holmes HTTP client with fake server (success cases)
- [x] Test Holmes HTTP client with fake server (error cases)
- [x] Test configuration persistence
- [x] Test Wails RPC method `AskHolmes`
- [x] Test Wails RPC method `GetHolmesConfig`
- [x] Test Wails RPC method `SetHolmesConfig`
- [x] Test Wails RPC method `TestHolmesConnection`

#### Frontend Unit Tests
- [x] Create `frontend/src/__tests__/holmesContext.test.jsx`
- [x] Test HolmesContext state management
- [x] Test HolmesPanel rendering
- [x] Test HolmesConfigModal form submission
- [x] Test holmesApi wrapper functions
- [x] Mock all Wails bindings using wailsMocks.js

#### Coverage Verification
- [x] Run `go test -cover ./pkg/app/holmesgpt/...` - verify 70%+ (achieved: 90.2%)
- [x] Run `cd frontend && npm test -- --coverage` - verify 70%+ (achieved: 91.14%)

### Documentation Tasks
- [x] Update `CLAUDE.md` with Holmes integration section
- [x] Add Holmes configuration instructions to README (or user docs)
- [x] Document Holmes API client usage patterns
- [x] Add inline code comments for public APIs

---

## Detailed Task Breakdown

### 1. Backend: Holmes HTTP Client

**Files**: `pkg/app/holmesgpt/client.go`

#### Implementation Steps:

- [ ] Define `HolmesClient` struct
  ```go
  type HolmesClient struct {
      endpoint   string
      apiKey     string
      httpClient *http.Client
      timeout    time.Duration
  }
  ```

- [ ] Implement `NewHolmesClient(config HolmesConfig) (*HolmesClient, error)`
  - Validate endpoint URL
  - Configure HTTP client with timeout (30s default)
  - Support TLS configuration
  - Follow `pkg/app/docker/client.go` pattern

- [ ] Implement `Ask(question string) (HolmesResponse, error)`
  - POST to `/api/chat` endpoint
  - Set headers: `Content-Type: application/json`
  - Include API key if configured
  - Handle timeouts gracefully
  - Parse JSON response

- [ ] Implement `TestConnection() error`
  - Ping `/healthz` endpoint
  - Return detailed error messages

**Code Example**:
```go
package holmesgpt

import (
    "bytes"
    "encoding/json"
    "fmt"
    "io"
    "net/http"
    "time"
)

type HolmesClient struct {
    endpoint   string
    apiKey     string
    httpClient *http.Client
}

type HolmesConfig struct {
    Endpoint string
    APIKey   string
    Timeout  time.Duration
}

func NewHolmesClient(config HolmesConfig) (*HolmesClient, error) {
    if config.Endpoint == "" {
        return nil, fmt.Errorf("holmes endpoint is required")
    }

    timeout := config.Timeout
    if timeout == 0 {
        timeout = 30 * time.Second
    }

    return &HolmesClient{
        endpoint: config.Endpoint,
        apiKey:   config.APIKey,
        httpClient: &http.Client{
            Timeout: timeout,
        },
    }, nil
}

func (c *HolmesClient) Ask(question string) (*HolmesResponse, error) {
    reqBody := HolmesRequest{
        Ask:   question,
        Model: "", // Use Holmes default
    }

    body, err := json.Marshal(reqBody)
    if err != nil {
        return nil, fmt.Errorf("failed to marshal request: %w", err)
    }

    req, err := http.NewRequest("POST", c.endpoint+"/api/chat", bytes.NewReader(body))
    if err != nil {
        return nil, fmt.Errorf("failed to create request: %w", err)
    }

    req.Header.Set("Content-Type", "application/json")
    if c.apiKey != "" {
        req.Header.Set("Authorization", "Bearer "+c.apiKey)
    }

    resp, err := c.httpClient.Do(req)
    if err != nil {
        return nil, fmt.Errorf("failed to send request: %w", err)
    }
    defer resp.Body.Close()

    if resp.StatusCode != http.StatusOK {
        body, _ := io.ReadAll(resp.Body)
        return nil, fmt.Errorf("holmes API error (status %d): %s", resp.StatusCode, string(body))
    }

    var holmesResp HolmesResponse
    if err := json.NewDecoder(resp.Body).Decode(&holmesResp); err != nil {
        return nil, fmt.Errorf("failed to decode response: %w", err)
    }

    return &holmesResp, nil
}

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
```

---

### 2. Backend: Type Definitions

**Files**: `pkg/app/holmesgpt/types.go`

#### Implementation Steps:

- [ ] Define `HolmesRequest` struct
  ```go
  type HolmesRequest struct {
      Ask   string `json:"ask"`
      Model string `json:"model,omitempty"`
  }
  ```

- [ ] Define `HolmesResponse` struct
  ```go
  type HolmesResponse struct {
      Response    string                 `json:"response"`
      RichOutput  map[string]interface{} `json:"rich_output,omitempty"`
      Timestamp   time.Time              `json:"timestamp"`
      QueryID     string                 `json:"query_id,omitempty"`
  }
  ```

- [ ] Define `HolmesConnectionStatus` struct
  ```go
  type HolmesConnectionStatus struct {
      Connected bool   `json:"connected"`
      Endpoint  string `json:"endpoint"`
      Error     string `json:"error,omitempty"`
  }
  ```

**Complete Code**:
```go
package holmesgpt

import "time"

// HolmesRequest represents a query to HolmesGPT
type HolmesRequest struct {
    Ask   string `json:"ask"`
    Model string `json:"model,omitempty"`
}

// HolmesResponse represents the response from HolmesGPT
type HolmesResponse struct {
    Response    string                 `json:"response"`
    RichOutput  map[string]interface{} `json:"rich_output,omitempty"`
    Timestamp   time.Time              `json:"timestamp"`
    QueryID     string                 `json:"query_id,omitempty"`
}

// HolmesConnectionStatus represents the connection status to HolmesGPT
type HolmesConnectionStatus struct {
    Connected bool   `json:"connected"`
    Endpoint  string `json:"endpoint"`
    Error     string `json:"error,omitempty"`
}

// HolmesConfigData represents Holmes configuration (for AppConfig)
type HolmesConfigData struct {
    Enabled  bool   `json:"enabled"`
    Endpoint string `json:"endpoint"`
    APIKey   string `json:"apiKey,omitempty"`
}
```

---

### 3. Backend: Wails RPC Methods

**Files**: `pkg/app/holmes_integration.go`

#### Implementation Steps:

- [ ] Add Holmes client field to App struct
  ```go
  type App struct {
      // ... existing fields
      holmesClient *holmesgpt.HolmesClient
      holmesMu     sync.RWMutex
  }
  ```

- [ ] Implement `AskHolmes(question string) (*holmesgpt.HolmesResponse, error)`
  - Check if Holmes is configured
  - Call `holmesClient.Ask(question)`
  - Return response or error

- [ ] Implement `GetHolmesConfig() (*holmesgpt.HolmesConfigData, error)`
  - Read from AppConfig
  - Return sanitized config (mask API key)

- [ ] Implement `SetHolmesConfig(config holmesgpt.HolmesConfigData) error`
  - Validate config
  - Save to AppConfig
  - Reinitialize Holmes client
  - Test connection

- [ ] Implement `TestHolmesConnection() (*holmesgpt.HolmesConnectionStatus, error)`
  - Call `holmesClient.TestConnection()`
  - Return status

**Code Example**:
```go
package apppkg

import (
    "fmt"
    "sync"

    "github.com/yourusername/kube-dev-bench/pkg/app/holmesgpt"
)

// Add to App struct (in app_lifecycle.go or similar)
type App struct {
    // ... existing fields
    holmesClient *holmesgpt.HolmesClient
    holmesMu     sync.RWMutex
}

// Initialize in Startup (add to app_lifecycle.go)
func (a *App) initHolmes() {
    if a.holmesConfig.Enabled && a.holmesConfig.Endpoint != "" {
        client, err := holmesgpt.NewHolmesClient(holmesgpt.HolmesConfig{
            Endpoint: a.holmesConfig.Endpoint,
            APIKey:   a.holmesConfig.APIKey,
        })
        if err != nil {
            fmt.Printf("Failed to initialize Holmes client: %v\n", err)
            return
        }
        a.holmesMu.Lock()
        a.holmesClient = client
        a.holmesMu.Unlock()
    }
}

// AskHolmes sends a question to HolmesGPT
func (a *App) AskHolmes(question string) (*holmesgpt.HolmesResponse, error) {
    a.holmesMu.RLock()
    client := a.holmesClient
    a.holmesMu.RUnlock()

    if client == nil {
        return nil, fmt.Errorf("Holmes is not configured")
    }

    return client.Ask(question)
}

// GetHolmesConfig returns the current Holmes configuration
func (a *App) GetHolmesConfig() (*holmesgpt.HolmesConfigData, error) {
    // Read from app config
    return &holmesgpt.HolmesConfigData{
        Enabled:  a.holmesConfig.Enabled,
        Endpoint: a.holmesConfig.Endpoint,
        APIKey:   "********", // Mask API key
    }, nil
}

// SetHolmesConfig updates the Holmes configuration
func (a *App) SetHolmesConfig(config holmesgpt.HolmesConfigData) error {
    // Validate
    if config.Enabled && config.Endpoint == "" {
        return fmt.Errorf("endpoint is required when Holmes is enabled")
    }

    // Save to AppConfig
    a.holmesConfig = config
    if err := a.saveConfig(); err != nil {
        return fmt.Errorf("failed to save config: %w", err)
    }

    // Reinitialize client
    if config.Enabled {
        client, err := holmesgpt.NewHolmesClient(holmesgpt.HolmesConfig{
            Endpoint: config.Endpoint,
            APIKey:   config.APIKey,
        })
        if err != nil {
            return fmt.Errorf("failed to create Holmes client: %w", err)
        }

        // Test connection
        if err := client.TestConnection(); err != nil {
            return fmt.Errorf("connection test failed: %w", err)
        }

        a.holmesMu.Lock()
        a.holmesClient = client
        a.holmesMu.Unlock()
    } else {
        a.holmesMu.Lock()
        a.holmesClient = nil
        a.holmesMu.Unlock()
    }

    return nil
}

// TestHolmesConnection tests the connection to HolmesGPT
func (a *App) TestHolmesConnection() (*holmesgpt.HolmesConnectionStatus, error) {
    a.holmesMu.RLock()
    client := a.holmesClient
    a.holmesMu.RUnlock()

    if client == nil {
        return &holmesgpt.HolmesConnectionStatus{
            Connected: false,
            Error:     "Holmes is not configured",
        }, nil
    }

    err := client.TestConnection()
    if err != nil {
        return &holmesgpt.HolmesConnectionStatus{
            Connected: false,
            Endpoint:  a.holmesConfig.Endpoint,
            Error:     err.Error(),
        }, nil
    }

    return &holmesgpt.HolmesConnectionStatus{
        Connected: true,
        Endpoint:  a.holmesConfig.Endpoint,
    }, nil
}
```

---

### 4. Backend: Configuration Persistence

**Files**: `pkg/app/config.go`

#### Implementation Steps:

- [ ] Add Holmes config to AppConfig struct
  ```go
  type AppConfig struct {
      // ... existing fields
      HolmesConfig holmesgpt.HolmesConfigData `json:"holmesConfig"`
  }
  ```

- [ ] Update `loadConfig()` to handle Holmes config
- [ ] Update `saveConfig()` to persist Holmes config

---

### 5. Frontend: State Management

**Files**: `frontend/src/holmes/HolmesContext.jsx`

#### Implementation Steps:

- [ ] Create HolmesContext with useReducer
  ```javascript
  const initialState = {
      enabled: false,
      configured: false,
      endpoint: '',
      loading: false,
      query: '',
      response: null,
      error: null,
      showConfig: false,
  };
  ```

- [ ] Define reducer actions:
  - `SET_CONFIG`
  - `SET_QUERY`
  - `SET_RESPONSE`
  - `SET_LOADING`
  - `SET_ERROR`
  - `SHOW_CONFIG`
  - `HIDE_CONFIG`

- [ ] Implement `useHolmes()` hook
- [ ] Implement `askHolmes(question)` function
- [ ] Implement `loadConfig()` function
- [ ] Implement `saveConfig(config)` function

**Code Example**:
```javascript
import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { AskHolmes, GetHolmesConfig, SetHolmesConfig, TestHolmesConnection } from '../holmesApi';
import { showSuccess, showError } from '../../notification';

const HolmesContext = createContext();

const initialState = {
    enabled: false,
    configured: false,
    endpoint: '',
    loading: false,
    query: '',
    response: null,
    error: null,
    showConfig: false,
};

function holmesReducer(state, action) {
    switch (action.type) {
        case 'SET_CONFIG':
            return {
                ...state,
                enabled: action.config.enabled,
                configured: true,
                endpoint: action.config.endpoint,
            };
        case 'SET_QUERY':
            return { ...state, query: action.query };
        case 'SET_RESPONSE':
            return { ...state, response: action.response, loading: false, error: null };
        case 'SET_LOADING':
            return { ...state, loading: action.loading };
        case 'SET_ERROR':
            return { ...state, error: action.error, loading: false };
        case 'SHOW_CONFIG':
            return { ...state, showConfig: true };
        case 'HIDE_CONFIG':
            return { ...state, showConfig: false };
        default:
            return state;
    }
}

export function HolmesProvider({ children }) {
    const [state, dispatch] = useReducer(holmesReducer, initialState);

    useEffect(() => {
        loadConfig();
    }, []);

    const loadConfig = async () => {
        try {
            const config = await GetHolmesConfig();
            dispatch({ type: 'SET_CONFIG', config });
        } catch (err) {
            console.error('Failed to load Holmes config:', err);
        }
    };

    const askHolmes = async (question) => {
        dispatch({ type: 'SET_LOADING', loading: true });
        dispatch({ type: 'SET_QUERY', query: question });

        try {
            const response = await AskHolmes(question);
            dispatch({ type: 'SET_RESPONSE', response });
            return response;
        } catch (err) {
            dispatch({ type: 'SET_ERROR', error: err.message });
            showError('Holmes query failed: ' + err.message);
            throw err;
        }
    };

    const saveConfig = async (config) => {
        try {
            await SetHolmesConfig(config);
            dispatch({ type: 'SET_CONFIG', config });
            showSuccess('Holmes configuration saved');
            dispatch({ type: 'HIDE_CONFIG' });
        } catch (err) {
            showError('Failed to save Holmes config: ' + err.message);
            throw err;
        }
    };

    const testConnection = async () => {
        try {
            const status = await TestHolmesConnection();
            if (status.connected) {
                showSuccess('Holmes connection successful');
            } else {
                showError('Holmes connection failed: ' + status.error);
            }
            return status;
        } catch (err) {
            showError('Connection test failed: ' + err.message);
            throw err;
        }
    };

    const showConfigModal = () => dispatch({ type: 'SHOW_CONFIG' });
    const hideConfigModal = () => dispatch({ type: 'HIDE_CONFIG' });

    const value = {
        state,
        askHolmes,
        saveConfig,
        testConnection,
        showConfigModal,
        hideConfigModal,
        loadConfig,
    };

    return <HolmesContext.Provider value={value}>{children}</HolmesContext.Provider>;
}

export function useHolmes() {
    const context = useContext(HolmesContext);
    if (!context) {
        throw new Error('useHolmes must be used within HolmesProvider');
    }
    return context;
}
```

---

### 6. Frontend: Main UI Component

**Files**: `frontend/src/holmes/HolmesPanel.jsx`

#### Implementation Steps:

- [ ] Create collapsible side panel component
- [ ] Add text input for questions
- [ ] Add submit button
- [ ] Display loading state
- [ ] Display response with basic formatting
- [ ] Add error handling UI
- [ ] Add "Configure" button if not configured

**Code Example**:
```javascript
import React, { useState } from 'react';
import { useHolmes } from './HolmesContext';

export function HolmesPanel({ visible, onClose }) {
    const { state, askHolmes, showConfigModal } = useHolmes();
    const [question, setQuestion] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!question.trim()) return;

        try {
            await askHolmes(question);
        } catch (err) {
            // Error handled in context
        }
    };

    if (!visible) return null;

    return (
        <div style={{
            position: 'fixed',
            right: 0,
            top: 60,
            bottom: 0,
            width: 400,
            backgroundColor: 'var(--gh-bg)',
            borderLeft: '1px solid var(--gh-border)',
            display: 'flex',
            flexDirection: 'column',
            zIndex: 100,
        }}>
            <div style={{
                padding: 16,
                borderBottom: '1px solid var(--gh-border)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
            }}>
                <h3 style={{ margin: 0 }}>Holmes AI</h3>
                <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                    ✕
                </button>
            </div>

            {!state.configured ? (
                <div style={{ padding: 16 }}>
                    <p>Holmes is not configured.</p>
                    <button onClick={showConfigModal}>Configure Holmes</button>
                </div>
            ) : (
                <>
                    <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
                        {state.loading && <div>Thinking...</div>}
                        {state.error && (
                            <div style={{ color: 'var(--gh-error)', marginBottom: 16 }}>
                                Error: {state.error}
                            </div>
                        )}
                        {state.response && (
                            <div>
                                <h4>Response:</h4>
                                <pre style={{ whiteSpace: 'pre-wrap', wordWrap: 'break-word' }}>
                                    {state.response.response}
                                </pre>
                            </div>
                        )}
                    </div>

                    <form onSubmit={handleSubmit} style={{
                        padding: 16,
                        borderTop: '1px solid var(--gh-border)',
                    }}>
                        <textarea
                            value={question}
                            onChange={(e) => setQuestion(e.target.value)}
                            placeholder="Ask Holmes about your cluster..."
                            rows={3}
                            style={{ width: '100%', marginBottom: 8 }}
                        />
                        <button type="submit" disabled={state.loading || !question.trim()}>
                            Ask
                        </button>
                    </form>
                </>
            )}
        </div>
    );
}
```

---

### 7. Frontend: Configuration Modal

**Files**: `frontend/src/holmes/HolmesConfigModal.jsx`

#### Implementation Steps:

- [ ] Create modal overlay component
- [ ] Add form fields: enabled checkbox, endpoint input, API key input
- [ ] Add "Test Connection" button
- [ ] Add "Save" and "Cancel" buttons
- [ ] Handle form submission

**Code Example**:
```javascript
import React, { useState, useEffect } from 'react';
import { useHolmes } from './HolmesContext';

export function HolmesConfigModal() {
    const { state, saveConfig, testConnection, hideConfigModal } = useHolmes();
    const [formData, setFormData] = useState({
        enabled: false,
        endpoint: '',
        apiKey: '',
    });
    const [testing, setTesting] = useState(false);

    useEffect(() => {
        if (state.showConfig) {
            setFormData({
                enabled: state.enabled,
                endpoint: state.endpoint,
                apiKey: '', // Don't pre-fill API key
            });
        }
    }, [state.showConfig]);

    if (!state.showConfig) return null;

    const handleTest = async () => {
        setTesting(true);
        try {
            await testConnection();
        } finally {
            setTesting(false);
        }
    };

    const handleSave = async (e) => {
        e.preventDefault();
        await saveConfig(formData);
    };

    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
        }} onClick={hideConfigModal}>
            <div style={{
                backgroundColor: 'var(--gh-bg)',
                borderRadius: 8,
                padding: 24,
                width: 500,
                maxWidth: '90vw',
            }} onClick={(e) => e.stopPropagation()}>
                <h2>Configure Holmes AI</h2>

                <form onSubmit={handleSave}>
                    <div style={{ marginBottom: 16 }}>
                        <label>
                            <input
                                type="checkbox"
                                checked={formData.enabled}
                                onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                            />
                            {' '}Enable Holmes
                        </label>
                    </div>

                    <div style={{ marginBottom: 16 }}>
                        <label>
                            Endpoint
                            <input
                                type="text"
                                value={formData.endpoint}
                                onChange={(e) => setFormData({ ...formData, endpoint: e.target.value })}
                                placeholder="http://localhost:8080"
                                style={{ width: '100%', marginTop: 4 }}
                            />
                        </label>
                    </div>

                    <div style={{ marginBottom: 16 }}>
                        <label>
                            API Key (optional)
                            <input
                                type="password"
                                value={formData.apiKey}
                                onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                                placeholder="Optional API key"
                                style={{ width: '100%', marginTop: 4 }}
                            />
                        </label>
                    </div>

                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                        <button type="button" onClick={handleTest} disabled={testing || !formData.endpoint}>
                            {testing ? 'Testing...' : 'Test Connection'}
                        </button>
                        <button type="button" onClick={hideConfigModal}>
                            Cancel
                        </button>
                        <button type="submit">
                            Save
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
```

---

### 8. Frontend: API Wrapper

**Files**: `frontend/src/holmes/holmesApi.js`

#### Implementation Steps:

- [ ] Import Wails-generated bindings
- [ ] Create wrapper functions for all Holmes RPC methods
- [ ] Add error handling

**Code Example**:
```javascript
import {
    AskHolmes as _AskHolmes,
    GetHolmesConfig as _GetHolmesConfig,
    SetHolmesConfig as _SetHolmesConfig,
    TestHolmesConnection as _TestHolmesConnection,
} from '../../wailsjs/go/main/App';

export async function AskHolmes(question) {
    return await _AskHolmes(question);
}

export async function GetHolmesConfig() {
    return await _GetHolmesConfig();
}

export async function SetHolmesConfig(config) {
    return await _SetHolmesConfig(config);
}

export async function TestHolmesConnection() {
    return await _TestHolmesConnection();
}
```

---

### 9. Frontend: App Integration

**Files**: `frontend/src/AppContainer.jsx`

#### Implementation Steps:

- [ ] Import HolmesProvider
- [ ] Add HolmesProvider to context stack
- [ ] Import HolmesPanel and HolmesConfigModal
- [ ] Add state for Holmes panel visibility
- [ ] Add Holmes toggle button to header

**Code Example**:
```javascript
import { HolmesProvider } from './holmes/HolmesContext';
import { HolmesPanel } from './holmes/HolmesPanel';
import { HolmesConfigModal } from './holmes/HolmesConfigModal';

// In render:
<ClusterStateProvider>
  <ResourceCountsProvider>
    <SwarmStateProvider>
      <SwarmResourceCountsProvider>
        <HolmesProvider>
          {/* existing app content */}
          <HolmesPanel visible={holmesPanelVisible} onClose={() => setHolmesPanelVisible(false)} />
          <HolmesConfigModal />
        </HolmesProvider>
      </SwarmResourceCountsProvider>
    </SwarmStateProvider>
  </ResourceCountsProvider>
</ClusterStateProvider>
```

---

## Testing Requirements

### Go Unit Tests

**File**: `pkg/app/holmesgpt/client_test.go`

```go
package holmesgpt_test

import (
    "encoding/json"
    "net/http"
    "net/http/httptest"
    "testing"
    "time"

    "github.com/yourusername/kube-dev-bench/pkg/app/holmesgpt"
)

func TestNewHolmesClient(t *testing.T) {
    tests := []struct {
        name    string
        config  holmesgpt.HolmesConfig
        wantErr bool
    }{
        {
            name: "valid config",
            config: holmesgpt.HolmesConfig{
                Endpoint: "http://localhost:8080",
            },
            wantErr: false,
        },
        {
            name: "missing endpoint",
            config: holmesgpt.HolmesConfig{
                Endpoint: "",
            },
            wantErr: true,
        },
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            _, err := holmesgpt.NewHolmesClient(tt.config)
            if (err != nil) != tt.wantErr {
                t.Errorf("NewHolmesClient() error = %v, wantErr %v", err, tt.wantErr)
            }
        })
    }
}

func TestHolmesClient_Ask(t *testing.T) {
    // Create fake HTTP server
    server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        if r.URL.Path != "/api/chat" {
            t.Errorf("Expected /api/chat, got %s", r.URL.Path)
        }

        resp := holmesgpt.HolmesResponse{
            Response:  "Test response",
            Timestamp: time.Now(),
        }
        json.NewEncoder(w).Encode(resp)
    }))
    defer server.Close()

    client, err := holmesgpt.NewHolmesClient(holmesgpt.HolmesConfig{
        Endpoint: server.URL,
    })
    if err != nil {
        t.Fatalf("Failed to create client: %v", err)
    }

    resp, err := client.Ask("test question")
    if err != nil {
        t.Fatalf("Ask() failed: %v", err)
    }

    if resp.Response != "Test response" {
        t.Errorf("Expected 'Test response', got '%s'", resp.Response)
    }
}
```

### Frontend Unit Tests

**File**: `frontend/src/__tests__/holmesContext.test.jsx`

```javascript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { HolmesProvider, useHolmes } from '../holmes/HolmesContext';

// Mock Wails bindings
vi.mock('../holmes/holmesApi', () => ({
    AskHolmes: vi.fn(() => Promise.resolve({ response: 'Test response' })),
    GetHolmesConfig: vi.fn(() => Promise.resolve({ enabled: true, endpoint: 'http://test' })),
    SetHolmesConfig: vi.fn(() => Promise.resolve()),
    TestHolmesConnection: vi.fn(() => Promise.resolve({ connected: true })),
}));

describe('HolmesContext', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('loads configuration on mount', async () => {
        let context;
        function TestComponent() {
            context = useHolmes();
            return null;
        }

        render(
            <HolmesProvider>
                <TestComponent />
            </HolmesProvider>
        );

        await waitFor(() => {
            expect(context.state.configured).toBe(true);
            expect(context.state.endpoint).toBe('http://test');
        });
    });

    it('asks holmes and updates state', async () => {
        let context;
        function TestComponent() {
            context = useHolmes();
            return null;
        }

        render(
            <HolmesProvider>
                <TestComponent />
            </HolmesProvider>
        );

        await context.askHolmes('test question');

        expect(context.state.response).toBeTruthy();
        expect(context.state.response.response).toBe('Test response');
    });
});
```

### Coverage Commands

```bash
# Go tests with coverage
go test -cover ./pkg/app/holmesgpt/...
go test -cover ./pkg/app/holmes_*.go

# Frontend tests with coverage
cd frontend && npm test -- --coverage

# Generate coverage reports
go test -coverprofile=coverage.out ./pkg/app/holmesgpt/...
go tool cover -html=coverage.out
```

---

## Verification Steps

### Manual Testing

1. **Start the app**
   ```bash
   wails dev
   ```

2. **Configure Holmes**
   - Open Holmes config modal
   - Enter endpoint: `http://localhost:8080` (or your Holmes instance)
   - Enter API key (if required)
   - Click "Test Connection"
   - Verify success message
   - Click "Save"

3. **Open Holmes panel**
   - Click Holmes toggle button (or press Ctrl+Shift+H)
   - Verify panel opens on right side

4. **Ask a question**
   - Type: "What pods are running in the default namespace?"
   - Click "Ask"
   - Verify loading state appears
   - Verify response displays

5. **Test error handling**
   - Stop Holmes instance
   - Try asking a question
   - Verify error message displays

6. **Test persistence**
   - Close app
   - Restart app
   - Verify Holmes configuration persists
   - Verify Holmes is still enabled

### Automated Testing

```bash
# Run all Go tests
go test ./pkg/app/holmesgpt/... -v
go test ./pkg/app/holmes_*.go -v

# Run all frontend tests
cd frontend && npm test

# Run with coverage
go test -cover ./pkg/app/holmesgpt/...
cd frontend && npm test -- --coverage

# Verify coverage meets 70%
```

---

## Success Criteria Checklist

- [ ] Holmes HTTP client successfully communicates with Holmes API
- [ ] Configuration UI allows enabling/disabling Holmes
- [ ] Configuration persists across app restarts
- [ ] Holmes panel displays on right side of UI
- [ ] Users can ask arbitrary questions
- [ ] Responses display with basic formatting
- [ ] Loading states work correctly
- [ ] Error handling works (connection failures, API errors)
- [ ] Test connection functionality works
- [ ] All Go unit tests passing
- [ ] All frontend unit tests passing
- [ ] Go coverage >= 70%
- [ ] Frontend coverage >= 70%
- [ ] Documentation updated

---

## Next Phase Prerequisites

Before moving to Phase 2, ensure:

- [ ] All Phase 1 tasks completed
- [ ] All tests passing with 70%+ coverage
- [ ] Holmes configuration working end-to-end
- [ ] Code reviewed and merged to main branch
- [ ] CLAUDE.md updated with Holmes integration info
- [ ] User can successfully query Holmes from the UI

---

## Notes

- Holmes endpoint can be local (`http://localhost:8080`) or in-cluster (`http://holmesgpt-holmes.holmesgpt.svc.cluster.local:80`)
- API key is optional for local development
- Follow existing patterns from Docker integration for consistency
- Use stable DOM IDs for future E2E testing (e.g., `#holmes-panel`, `#holmes-config-btn`)
- Consider adding keyboard shortcuts (Ctrl+Shift+H to toggle Holmes panel)

---

**Phase 1 Complete When**: User can configure Holmes, ask questions, and receive responses in the UI with 70%+ test coverage.

