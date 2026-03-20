/**
 * MCP Server E2E Tests
 *
 * Tests the MCP (Model Context Protocol) server integration:
 * 1. Configure and start MCP via Wails RPC
 * 2. Connect with the MCP SDK client over HTTP
 * 3. Verify tools, resources, and protocol operations
 *
 * These tests require a running Wails dev server with KinD cluster.
 */

import { test, expect } from '../../src/fixtures.js';
import { bootstrapApp } from '../../src/support/bootstrap.js';
import { configureMCPServer, getMCPStatus, stopMCPServer } from '../../src/support/mcp-bootstrap.js';

// MCP port is derived from the Wails base port + 100 offset to avoid conflicts.
// E.g. Wails on 34200 → MCP on 34300+workerIndex (handled per-worker).
function getMCPPort(wailsPort: number): number {
  // Use a fixed offset of 1000 from the assigned Wails port to avoid collisions
  // with other shards. E.g., Wails port 34400 → MCP port 35400.
  return wailsPort + 1000;
}

test.describe('MCP Server E2E', () => {
  let mcpPort: number;
  let mcpBaseURL: string;

  test.beforeEach(async ({ page, contextName, namespace }, workerInfo) => {
    // Bootstrap the app (connect to KinD cluster)
    await bootstrapApp({ page, contextName, namespace });

    // Derive MCP port from worker's Wails port
    const basePort = Number(process.env.E2E_WAILS_BASE_PORT || 34200);
    mcpPort = getMCPPort(basePort + (workerInfo.workerIndex % 2));
    mcpBaseURL = `http://localhost:${mcpPort}`;

    // Configure and start MCP server via Wails RPC
    await configureMCPServer({ page, port: mcpPort });
  });

  test.afterEach(async ({ page }) => {
    // Stop MCP server after each test
    try {
      await stopMCPServer({ page });
    } catch {
      // Best-effort cleanup
    }
  });

  test('MCP server starts and reports running status', async ({ page }) => {
    const status = await getMCPStatus({ page });

    expect(status.running).toBe(true);
    expect(status.enabled).toBe(true);
    expect(status.transport).toBe('http');
  });

  test('MCP health endpoint returns ok', async () => {
    const resp = await fetch(`${mcpBaseURL}/health`);
    expect(resp.status).toBe(200);

    const body = await resp.json();
    expect(body.status).toBe('ok');
  });

  test('MCP root endpoint returns server info', async () => {
    const resp = await fetch(`${mcpBaseURL}/`);
    expect(resp.status).toBe(200);

    const body = await resp.json();
    expect(body.name).toBe('KubeDevBench MCP Server');
    expect(body.transport).toBe('streamable-http');
    expect(body.endpoint).toBe('/mcp');
  });

  test('MCP initialize via JSON-RPC returns server capabilities', async () => {
    const payload = {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2025-03-26',
        clientInfo: { name: 'e2e-test', version: '1.0' },
      },
    };

    const resp = await fetch(`${mcpBaseURL}/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    expect(resp.status).toBe(200);
    const body = await resp.json();

    expect(body.result).toBeDefined();
    expect(body.result.serverInfo.name).toBe('kubedevbench');
    expect(body.result.capabilities).toBeDefined();
    expect(body.result.capabilities.tools).toBeDefined();
    expect(body.result.capabilities.resources).toBeDefined();
  });

  test('MCP tools/list returns expected tools', async () => {
    // Initialize first
    await sendJSONRPC(mcpBaseURL, 'initialize', {
      protocolVersion: '2025-03-26',
      clientInfo: { name: 'e2e-test', version: '1.0' },
    }, 1);

    const resp = await sendJSONRPC(mcpBaseURL, 'tools/list', {}, 2);

    expect(resp.result).toBeDefined();
    expect(resp.result.tools).toBeDefined();
    expect(resp.result.tools.length).toBeGreaterThanOrEqual(10);

    const toolNames = resp.result.tools.map((t: { name: string }) => t.name);
    expect(toolNames).toContain('k8s_list');
    expect(toolNames).toContain('k8s_describe');
    expect(toolNames).toContain('k8s_get_resource_yaml');
    expect(toolNames).toContain('k8s_get_pod_logs');
    expect(toolNames).toContain('k8s_get_events');
    expect(toolNames).toContain('k8s_get_resource_counts');
    expect(toolNames).toContain('k8s_scale_deployment');
    expect(toolNames).toContain('k8s_restart_deployment');
    expect(toolNames).toContain('swarm_list');
    expect(toolNames).toContain('swarm_inspect');
  });

  test('MCP resources/list returns expected resources', async () => {
    await sendJSONRPC(mcpBaseURL, 'initialize', {
      protocolVersion: '2025-03-26',
      clientInfo: { name: 'e2e-test', version: '1.0' },
    }, 1);

    const resp = await sendJSONRPC(mcpBaseURL, 'resources/list', {}, 2);

    expect(resp.result).toBeDefined();
    expect(resp.result.resources).toBeDefined();

    const resourceURIs = resp.result.resources.map((r: { uri: string }) => r.uri);
    expect(resourceURIs).toContain('resource://cluster/connection');
    expect(resourceURIs).toContain('resource://k8s/namespaces');
    expect(resourceURIs).toContain('resource://k8s/contexts');
    expect(resourceURIs).toContain('resource://mcp/config');
  });

  test('MCP tools/call k8s_list namespaces returns a response from live cluster', async () => {
    await sendJSONRPC(mcpBaseURL, 'initialize', {
      protocolVersion: '2025-03-26',
      clientInfo: { name: 'e2e-test', version: '1.0' },
    }, 1);

    await expect(async () => {
      const resp = await sendJSONRPC(mcpBaseURL, 'tools/call', {
        name: 'k8s_list',
        arguments: { kind: 'namespaces', limit: 25 },
      }, 2, 45_000);

      expect(resp.result).toBeDefined();
      expect(resp.result.content).toBeDefined();
      expect(resp.result.content.length).toBeGreaterThan(0);
    }).toPass({ timeout: 90_000, intervals: [2000, 5000, 10_000] });
  });

  test('MCP tools/call k8s_get_resource_counts returns counts', async () => {
    await sendJSONRPC(mcpBaseURL, 'initialize', {
      protocolVersion: '2025-03-26',
      clientInfo: { name: 'e2e-test', version: '1.0' },
    }, 1);

    const resp = await sendJSONRPC(mcpBaseURL, 'tools/call', {
      name: 'k8s_get_resource_counts',
      arguments: {},
    }, 2);

    expect(resp.result).toBeDefined();
    expect(resp.result.isError).toBeFalsy();
    expect(resp.result.content).toBeDefined();
  });

  test('MCP resources/read cluster connection returns status', async () => {
    await sendJSONRPC(mcpBaseURL, 'initialize', {
      protocolVersion: '2025-03-26',
      clientInfo: { name: 'e2e-test', version: '1.0' },
    }, 1);

    const resp = await sendJSONRPC(mcpBaseURL, 'resources/read', {
      uri: 'resource://cluster/connection',
    }, 2);

    expect(resp.result).toBeDefined();
    expect(resp.result.contents).toBeDefined();
    expect(resp.result.contents.length).toBeGreaterThan(0);
  });

  test('MCP resources/read mcp config returns configuration', async () => {
    await sendJSONRPC(mcpBaseURL, 'initialize', {
      protocolVersion: '2025-03-26',
      clientInfo: { name: 'e2e-test', version: '1.0' },
    }, 1);

    const resp = await sendJSONRPC(mcpBaseURL, 'resources/read', {
      uri: 'resource://mcp/config',
    }, 2);

    expect(resp.result).toBeDefined();
    expect(resp.result.contents).toBeDefined();
    expect(resp.result.contents.length).toBeGreaterThan(0);

    // Parse the config content
    const configText = resp.result.contents[0].text;
    const config = JSON.parse(configText);
    expect(config.enabled).toBe(true);
    expect(config.port).toBe(mcpPort);
  });

  test('MCP ping returns pong', async () => {
    await sendJSONRPC(mcpBaseURL, 'initialize', {
      protocolVersion: '2025-03-26',
      clientInfo: { name: 'e2e-test', version: '1.0' },
    }, 1);

    const resp = await sendJSONRPC(mcpBaseURL, 'ping', {}, 2);

    expect(resp.result).toBeDefined();
    // Ping should return empty result (pong)
    expect(resp.error).toBeUndefined();
  });
});

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Send a JSON-RPC request to the MCP endpoint and return the parsed response.
 */
async function sendJSONRPC(
  baseURL: string,
  method: string,
  params: Record<string, unknown>,
  id: number,
  timeoutMs = 30_000,
): Promise<{ result?: any; error?: any }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  let resp: Response;
  try {
    resp = await fetch(`${baseURL}/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id,
        method,
        params,
      }),
      signal: controller.signal,
    });
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      throw new Error(`JSON-RPC request timed out after ${timeoutMs}ms (${method})`);
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }

  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`JSON-RPC request failed: ${resp.status} ${body}`);
  }

  return resp.json();
}
