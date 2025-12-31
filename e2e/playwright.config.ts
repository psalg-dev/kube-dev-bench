import { defineConfig } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

export default defineConfig({
  testDir: path.join(__dirname, 'tests'),
  testMatch: ['**/*.spec.ts'],
  timeout: 180_000, // Increased for monitor tests that involve K8s polling
  expect: { timeout: 20_000 }, // Increased for slow CI environments
  retries: process.env.CI ? 2 : 0, // Increased retries for flaky tests
  workers: 1, // Keep serial for now since tests share state
  fullyParallel: false,
  // Fail fast: stop after 3 test failures to get quick feedback in CI
  maxFailures: process.env.CI ? 3 : 0,
  // Global timeout: cap entire test run at 30 minutes in CI (increased for retries)
  globalTimeout: process.env.CI ? 30 * 60 * 1000 : 0,
  // Reporter configuration for better CI visibility
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: 'http://localhost:34115',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    // Only record videos on failure to speed up tests
    video: 'retain-on-failure',
    // Increase action timeout for slow CI environments
    actionTimeout: 45_000,
    // Navigation timeout
    navigationTimeout: 30_000,
  },
  // Start KinD first (docker compose) and export kubeconfig path for tests
  globalSetup: path.join(__dirname, 'setup', 'global-setup.ts'),
  globalTeardown: path.join(__dirname, 'setup', 'global-teardown.ts'),
});
