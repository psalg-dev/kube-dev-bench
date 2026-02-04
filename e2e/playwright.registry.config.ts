import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testMatch: ['registry/**/*.spec.ts'],
  outputDir: './test-results',
  // Note: worker-scoped fixtures (like starting Wails) run under the test timeout.
  // Keep this high enough to allow cold-starts when running with multiple workers.
  timeout: 120_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  workers: process.env.PW_WORKERS
    ? Number(process.env.PW_WORKERS)
    : process.platform === 'win32'
      ? 1
      : 3,
  retries: process.env.CI ? 2 : 1,  // Enable retries for flaky tests
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI
    ? [['github'], ['html', { open: 'never' }], ['list']]
    : [['html', { open: 'never' }], ['list']],
  use: {
    actionTimeout: 10_000,
    navigationTimeout: 20_000,
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'on',
  },
  globalSetup: './src/support/global-setup-registry.ts',
  globalTeardown: './src/support/global-teardown.ts',
});