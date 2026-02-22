import { defineConfig } from '@playwright/test';

const ciReportPrefix = process.env.E2E_REPORT_PREFIX?.trim();
const ciReportDir = './test-results/ci-reports';

const ciReporters = ciReportPrefix
  ? [
      ['github'],
      ['html', { open: 'never' }],
      ['list'],
      ['json', { outputFile: `${ciReportDir}/${ciReportPrefix}.json` }],
      ['junit', { outputFile: `${ciReportDir}/${ciReportPrefix}.xml` }],
    ]
  : [['github'], ['html', { open: 'never' }], ['list']];

export default defineConfig({
  testDir: './tests',
  testIgnore: ['registry/**'],
  outputDir: './test-results',
  // Note: worker-scoped fixtures (like starting Wails) run under the test timeout.
  // Keep this high enough to allow cold-starts when running with multiple workers.
  timeout: 120_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  maxFailures: 1,  // Stop after first failure
  workers: process.env.PW_WORKERS
    ? Number(process.env.PW_WORKERS)
    : process.platform === 'win32'
      ? 1
      : 3,
  retries: process.env.CI ? 2 : 1,  // Enable retries for flaky tests
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI
    ? ciReporters
    : [['html', { open: 'never' }], ['list']],
  use: {
    actionTimeout: 10_000,
    navigationTimeout: 20_000,
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'on',
    colorScheme: 'dark',
    launchOptions: {
      args: [
        '--force-dark-mode',
        '--enable-features=WebContentsForceDark:inversion_method/cielab_based/image_behavior/none/foreground_lightness_threshold/150/background_lightness_threshold/205',
      ],
    },
  },
  globalSetup: './src/support/global-setup.ts',
  globalTeardown: './src/support/global-teardown.ts',
});
