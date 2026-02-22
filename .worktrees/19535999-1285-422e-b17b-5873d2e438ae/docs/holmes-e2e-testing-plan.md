# Holmes E2E Testing Implementation Plan

## Overview

This document outlines the plan for implementing end-to-end testing of the HolmesGPT integration using a mock server approach. Since HolmesGPT does not provide a built-in mock or test mode, we will create a lightweight mock server that implements the Holmes API contract for deterministic E2E testing.

## Problem Statement

- HolmesGPT requires a real LLM backend, making E2E tests non-deterministic and costly
- Current Holmes E2E tests only verify UI interactions, accepting placeholder/error states
- No way to test specific response scenarios (errors, timeouts, streaming)

## Solution: Mock Holmes Server

Create a Node.js HTTP server that implements the Holmes API contract with pattern-based responses.

### Architecture

```
e2e/src/support/
├── holmes-mock/
│   ├── holmes-mock-server.mjs   # Node.js HTTP server (ESM)
│   └── fixtures.json            # Response patterns
├── holmes-mock.ts               # Startup/ensure helpers
└── holmes-bootstrap.ts          # Test helper to configure Holmes
```

**Mock Server Port**: `34117` (following existing pattern: proxy=34116)

## API Contract

The mock server implements the same endpoints as HolmesGPT:

### GET /healthz

Health check endpoint.

**Response**: `200 OK`

### POST /api/chat

Main chat endpoint for AI analysis.

**Request**:
```json
{
  "ask": "string",
  "model": "string (optional)",
  "stream": "boolean (optional)",
  "response_format": "object (optional)",
  "additional_system_prompt": "string (optional)"
}
```

**Response (non-streaming)**:
```json
{
  "response": "string",
  "analysis": "string (optional)",
  "rich_output": "object (optional)",
  "timestamp": "ISO 8601 string",
  "query_id": "string (optional)"
}
```

**Response (streaming, stream=true)**:
Server-Sent Events (SSE) with the following event types:
- `ai_message`: `{ "content": "string", "reasoning": "string (optional)" }`
- `start_tool_calling`: `{ "id": "string", "tool_name": "string", "description": "string" }`
- `tool_calling_result`: `{ "tool_call_id": "string", "name": "string", "status": "string" }`
- `ai_answer_end`: `{ "analysis": "string" }`
- `stream_end`: `{}`
- `error`: `{ "message": "string" }`

## Pattern-Based Responses

The mock server matches request patterns to return deterministic responses:

| Pattern | Response Type |
|---------|---------------|
| `pod.*crash\|CrashLoopBackOff` | Pod crash analysis |
| `deployment\|replica` | Deployment analysis |
| `logs?\|explain.*log` | Log analysis |
| `swarm.*service` | Swarm service analysis |
| `.*` (default) | Generic healthy resource response |

## Error Simulation

Environment variables control error scenarios for testing error handling:

| Variable | Effect |
|----------|--------|
| `HOLMES_MOCK_ERROR=timeout` | 60s delay (triggers client timeout) |
| `HOLMES_MOCK_ERROR=500` | Returns 500 Internal Server Error |
| `HOLMES_MOCK_ERROR=disconnect` | Closes connection without response |
| `HOLMES_MOCK_DELAY_MS=N` | Adds N milliseconds delay before response |

## Implementation Phases

### Phase 1: Mock Server Core

1. **Create `e2e/src/support/holmes-mock/holmes-mock-server.mjs`**
   - Standalone Node.js HTTP server
   - Implements `/healthz` and `/api/chat` endpoints
   - Pattern-based response matching
   - SSE streaming support
   - Error simulation via environment variables

2. **Create `e2e/src/support/holmes-mock/fixtures.json`**
   - Response patterns with regex patterns
   - Full markdown responses for realistic testing
   - Stream chunks for incremental streaming tests

### Phase 2: E2E Infrastructure Integration

3. **Create `e2e/src/support/holmes-mock.ts`**
   - `startHolmesMockServer()`: Spawns mock server process
   - `ensureHolmesMockServer()`: Ensures server is running, returns URL
   - Follows pattern from existing `proxy.ts`

4. **Update `e2e/src/support/run-state.ts`**
   - Add `holmesMockBaseURL?: string`
   - Add `holmesMockPid?: number`

5. **Update `e2e/src/support/global-setup.ts`**
   - Start mock server after proxy server
   - Store URL and PID in run state

6. **Update `e2e/src/support/global-teardown.ts`**
   - Add `holmesMockPid` to cleanup list

### Phase 3: Test Helpers

7. **Create `e2e/src/support/holmes-bootstrap.ts`**
   - `configureHolmesMock({ page })`: Configures app to use mock endpoint
   - Uses Wails RPC for fast configuration

### Phase 4: E2E Tests

8. **Create `e2e/tests/holmes/20-mock-analysis.spec.ts`**
   - Test pod analysis with mock response
   - Test deployment analysis
   - Test streaming response rendering
   - Test log analysis

9. **Create `e2e/tests/holmes/21-mock-errors.spec.ts`**
   - Test timeout error handling
   - Test 500 error handling
   - Test connection refused handling

10. **Update existing Holmes tests**
    - `10-context-analysis.spec.ts`
    - `11-conversation-history.spec.ts`
    - `40-log-analysis.spec.ts`
    - `50-swarm-integration.spec.ts`

## Files Summary

| File | Action | Description |
|------|--------|-------------|
| `e2e/src/support/holmes-mock/holmes-mock-server.mjs` | Create | Mock HTTP server |
| `e2e/src/support/holmes-mock/fixtures.json` | Create | Response patterns |
| `e2e/src/support/holmes-mock.ts` | Create | Startup helpers |
| `e2e/src/support/holmes-bootstrap.ts` | Create | Test configuration helper |
| `e2e/src/support/run-state.ts` | Modify | Add Holmes mock types |
| `e2e/src/support/global-setup.ts` | Modify | Start mock server |
| `e2e/src/support/global-teardown.ts` | Modify | Cleanup PID |
| `e2e/tests/holmes/20-mock-analysis.spec.ts` | Create | Analysis E2E tests |
| `e2e/tests/holmes/21-mock-errors.spec.ts` | Create | Error handling tests |

## Verification

### Manual Testing

```bash
# Start mock server standalone
cd e2e/src/support/holmes-mock
HOLMES_MOCK_PORT=34117 node holmes-mock-server.mjs

# Test health endpoint
curl http://127.0.0.1:34117/healthz

# Test non-streaming chat
curl -X POST http://127.0.0.1:34117/api/chat \
  -H "Content-Type: application/json" \
  -d '{"ask": "Why is my pod crashing?"}'

# Test streaming chat
curl -X POST http://127.0.0.1:34117/api/chat \
  -H "Content-Type: application/json" \
  -d '{"ask": "Analyze this deployment", "stream": true}'

# Test error simulation
HOLMES_MOCK_ERROR=500 node holmes-mock-server.mjs
```

### E2E Test Execution

```bash
cd e2e
npx playwright test tests/holmes/ --project=chromium
```

### CI Pipeline

Tests will run in the existing GitHub Actions workflow (`.github/workflows/build.yml`).

## Design Decisions

### Why Node.js instead of Go?

- Consistent with existing E2E infrastructure (proxy-server.mjs)
- Easier integration with Playwright test lifecycle
- No compilation step required
- Simpler SSE implementation

### Why pattern-based responses?

- Deterministic test results
- Easy to add new patterns for specific test cases
- Matches real-world usage (different resources get different analysis)

### Why environment variable error simulation?

- Non-invasive to normal operation
- Can be set per-test or per-worker
- Follows existing E2E patterns

## References

- [HolmesGPT GitHub](https://github.com/robusta-dev/holmesgpt)
- [HolmesGPT Documentation](https://docs.robusta.dev/master/configuration/holmesgpt/index.html)
- Existing Holmes integration: `pkg/app/holmes_integration.go`
- Existing Holmes tests: `pkg/app/holmes_integration_test.go`
- E2E proxy pattern: `e2e/src/support/proxy.ts`, `e2e/src/support/proxy-server.mjs`
