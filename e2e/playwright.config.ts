import { defineConfig } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

export default defineConfig({
  testDir: path.join(__dirname, 'tests'),
  testMatch: ['**/*.spec.ts'],
  timeout: 90_000, // Reduced from 120s
  expect: { timeout: 10_000 },
  retries: process.env.CI ? 1 : 0,
  workers: 1, // Keep serial for now since tests share state
  fullyParallel: false,
  use: {
    baseURL: 'http://localhost:34115',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    // Only record videos on failure to speed up tests
    video: 'retain-on-failure',
    // Reduce action timeout for faster failures
    actionTimeout: 15_000,
  },
  // Start KinD first (docker compose) and export kubeconfig path for tests
  globalSetup: path.join(__dirname, 'setup', 'global-setup.ts'),
  globalTeardown: path.join(__dirname, 'setup', 'global-teardown.ts'),
});
