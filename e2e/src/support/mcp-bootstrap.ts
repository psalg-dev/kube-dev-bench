/**
 * MCP Bootstrap - E2E test helper for configuring MCP server via Wails RPC
 *
 * This module provides helpers to configure and start the MCP server
 * for E2E testing, following the same pattern as holmes-bootstrap.ts.
 */

import { type Page, expect } from '@playwright/test';

export interface MCPConfigData {
  enabled: boolean;
  host: string;
  port: number;
  transportMode: string;
  allowDestructive: boolean;
  requireConfirm: boolean;
  maxLogLines: number;
}

export interface MCPStatus {
  running: boolean;
  enabled: boolean;
  transport: string;
  address: string;
}

/**
 * Configure and start the MCP server via Wails RPC.
 *
 * @param opts.page - Playwright page instance (must be navigated to the app)
 * @param opts.port - Port to bind the MCP server to
 * @param opts.host - Host to bind to (defaults to 'localhost')
 * @param opts.allowDestructive - Allow destructive operations (defaults to true for testing)
 * @param opts.requireConfirm - Require confirmation for destructive ops (defaults to false for testing)
 */
export async function configureMCPServer(opts: {
  page: Page;
  port: number;
  host?: string;
  allowDestructive?: boolean;
  requireConfirm?: boolean;
}): Promise<void> {
  const {
    page,
    port,
    host = 'localhost',
    allowDestructive = true,
    requireConfirm = false,
  } = opts;

  const config: MCPConfigData = {
    enabled: true,
    host,
    port,
    transportMode: 'http',
    allowDestructive,
    requireConfirm,
    maxLogLines: 1000,
  };

  // Call Wails RPC to set MCP config
  const setResult = await page.evaluate(async (cfg) => {
    const setMCPConfig = (window as any).go?.main?.App?.SetMCPConfig;
    if (!setMCPConfig) {
      throw new Error('SetMCPConfig binding not available — is the page loaded?');
    }
    return await setMCPConfig(cfg);
  }, config);

  if (setResult !== null && setResult !== undefined) {
    throw new Error(`Failed to set MCP config: ${JSON.stringify(setResult)}`);
  }

  // Start the MCP server
  const startResult = await page.evaluate(async () => {
    const startMCPServer = (window as any).go?.main?.App?.StartMCPServer;
    if (!startMCPServer) {
      throw new Error('StartMCPServer binding not available');
    }
    return await startMCPServer();
  });

  if (startResult !== null && startResult !== undefined) {
    throw new Error(`Failed to start MCP server: ${JSON.stringify(startResult)}`);
  }

  // Verify the server is running
  await waitForMCPRunning({ page, port });
}

/**
 * Wait for the MCP server to be running and reachable.
 */
export async function waitForMCPRunning(opts: {
  page: Page;
  port: number;
  timeout?: number;
}): Promise<void> {
  const { page, port, timeout = 15_000 } = opts;

  // Poll the MCP status via Wails RPC
  await expect(async () => {
    const status = await page.evaluate(async () => {
      const getMCPStatus = (window as any).go?.main?.App?.GetMCPStatus;
      if (!getMCPStatus) return null;
      return await getMCPStatus();
    });

    if (!status || !status.running) {
      throw new Error('MCP server not running yet');
    }
  }).toPass({ timeout, intervals: [500, 1000, 2000] });

  // Also verify the HTTP health endpoint is reachable
  await expect(async () => {
    const healthURL = `http://localhost:${port}/health`;
    const resp = await fetch(healthURL);
    if (!resp.ok) {
      throw new Error(`MCP health check failed: ${resp.status}`);
    }
  }).toPass({ timeout: 10_000, intervals: [500, 1000] });
}

/**
 * Stop the MCP server via Wails RPC.
 */
export async function stopMCPServer(opts: { page: Page }): Promise<void> {
  const { page } = opts;

  await page.evaluate(async () => {
    const stopMCPServer = (window as any).go?.main?.App?.StopMCPServer;
    if (!stopMCPServer) {
      throw new Error('StopMCPServer binding not available');
    }
    return await stopMCPServer();
  });
}

/**
 * Get the current MCP server status.
 */
export async function getMCPStatus(opts: { page: Page }): Promise<MCPStatus> {
  const { page } = opts;

  return await page.evaluate(async () => {
    const getMCPStatus = (window as any).go?.main?.App?.GetMCPStatus;
    if (!getMCPStatus) {
      throw new Error('GetMCPStatus binding not available');
    }
    return await getMCPStatus();
  }) as MCPStatus;
}

/**
 * Get the current MCP configuration.
 */
export async function getMCPConfig(opts: { page: Page }): Promise<MCPConfigData> {
  const { page } = opts;

  return await page.evaluate(async () => {
    const getMCPConfig = (window as any).go?.main?.App?.GetMCPConfig;
    if (!getMCPConfig) {
      throw new Error('GetMCPConfig binding not available');
    }
    return await getMCPConfig();
  }) as MCPConfigData;
}
