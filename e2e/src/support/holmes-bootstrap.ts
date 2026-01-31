/**
 * Holmes Bootstrap - E2E test helper for configuring Holmes mock endpoint
 *
 * This module provides helpers to configure the Holmes AI integration
 * to point to the mock server for deterministic E2E testing.
 */

import { type Page, expect } from '@playwright/test';
import { readRunState } from './run-state.js';

export interface HolmesConfigData {
  enabled: boolean;
  endpoint: string;
  apiKey?: string;
  modelKey?: string;
  responseFormat?: string;
}

/**
 * Configure Holmes to use the mock server endpoint via Wails RPC.
 *
 * This function directly calls the backend SetHolmesConfig RPC method
 * to configure Holmes without needing UI interaction.
 *
 * @param opts.page - Playwright page instance
 * @param opts.endpoint - Optional custom endpoint (defaults to mock server from run state)
 * @param opts.enabled - Whether to enable Holmes (defaults to true)
 */
export async function configureHolmesMock(opts: {
  page: Page;
  endpoint?: string;
  enabled?: boolean;
}): Promise<void> {
  const { page, enabled = true } = opts;
  let endpoint = opts.endpoint;

  // If no endpoint provided, use the mock server from run state
  if (!endpoint) {
    const state = await readRunState();
    endpoint = state.holmesMockBaseURL;
    if (!endpoint) {
      throw new Error('Holmes mock server URL not found in run state. Did global-setup start it?');
    }
  }

  const config: HolmesConfigData = {
    enabled,
    endpoint,
    apiKey: '',
    modelKey: '',
    responseFormat: '',
  };

  // Call Wails RPC to set Holmes config
  const result = await page.evaluate(async (cfg) => {
    // Access the Wails-generated binding
    const setHolmesConfig = (window as any).go?.main?.App?.SetHolmesConfig;
    if (!setHolmesConfig) {
      throw new Error('SetHolmesConfig binding not available');
    }
    return await setHolmesConfig(cfg);
  }, config);

  // SetHolmesConfig returns null on success, error on failure
  if (result !== null && result !== undefined) {
    throw new Error(`Failed to configure Holmes: ${result}`);
  }
}

/**
 * Disable Holmes configuration.
 *
 * @param opts.page - Playwright page instance
 */
export async function disableHolmes(opts: { page: Page }): Promise<void> {
  const { page } = opts;

  const config: HolmesConfigData = {
    enabled: false,
    endpoint: '',
    apiKey: '',
    modelKey: '',
    responseFormat: '',
  };

  await page.evaluate(async (cfg) => {
    const setHolmesConfig = (window as any).go?.main?.App?.SetHolmesConfig;
    if (!setHolmesConfig) {
      throw new Error('SetHolmesConfig binding not available');
    }
    return await setHolmesConfig(cfg);
  }, config);
}

/**
 * Get the current Holmes configuration status.
 *
 * @param opts.page - Playwright page instance
 * @returns Current Holmes configuration
 */
export async function getHolmesConfig(opts: { page: Page }): Promise<HolmesConfigData> {
  const { page } = opts;

  const config = await page.evaluate(async () => {
    const getHolmesConfig = (window as any).go?.main?.App?.GetHolmesConfig;
    if (!getHolmesConfig) {
      throw new Error('GetHolmesConfig binding not available');
    }
    return await getHolmesConfig();
  });

  return config as HolmesConfigData;
}

/**
 * Wait for Holmes panel to be visible and show content.
 *
 * @param opts.page - Playwright page instance
 * @param opts.timeout - Maximum time to wait (default: 30s)
 */
export async function waitForHolmesPanel(opts: {
  page: Page;
  timeout?: number;
}): Promise<void> {
  const { page, timeout = 30_000 } = opts;
  await expect(page.locator('#holmes-panel')).toBeVisible({ timeout });
}

/**
 * Open Holmes panel if not already open.
 *
 * @param opts.page - Playwright page instance
 */
export async function openHolmesPanel(opts: { page: Page }): Promise<void> {
  const { page } = opts;
  const holmesPanel = page.locator('#holmes-panel');

  if (!(await holmesPanel.isVisible().catch(() => false))) {
    await page.locator('#holmes-toggle-btn').click();
    await expect(holmesPanel).toBeVisible({ timeout: 10_000 });
  }
}

/**
 * Ask Holmes a question and wait for response.
 *
 * @param opts.page - Playwright page instance
 * @param opts.question - The question to ask
 * @param opts.timeout - Maximum time to wait for response (default: 60s)
 */
export async function askHolmes(opts: {
  page: Page;
  question: string;
  timeout?: number;
}): Promise<void> {
  const { page, question, timeout = 60_000 } = opts;

  await openHolmesPanel({ page });

  const input = page.getByPlaceholder('Ask about your cluster...');
  await expect(input).toBeVisible({ timeout: 10_000 });
  await input.fill(question);

  const sendButton = page.getByRole('button', { name: '→' });
  await sendButton.click();

  // Wait for response to appear (the clear button appears when there's conversation history)
  const clearButton = page.getByTitle('Clear conversation');
  await expect(clearButton).toBeVisible({ timeout });
}

/**
 * Get the Holmes mock server URL from run state.
 *
 * @returns The mock server base URL
 */
export async function getHolmesMockURL(): Promise<string> {
  const state = await readRunState();
  if (!state.holmesMockBaseURL) {
    throw new Error('Holmes mock server URL not found in run state');
  }
  return state.holmesMockBaseURL;
}
