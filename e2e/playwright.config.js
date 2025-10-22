import { defineConfig } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
export default defineConfig({
    testDir: path.join(__dirname, 'tests'),
    timeout: 120000,
    expect: { timeout: 30000 },
    retries: process.env.CI ? 1 : 0,
    use: {
        baseURL: 'http://localhost:34115',
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',
        video: 'retain-on-failure',
    },
    // Start KinD first (docker compose) and export kubeconfig path for tests
    globalSetup: path.join(__dirname, 'setup', 'global-setup.ts'),
    globalTeardown: path.join(__dirname, 'setup', 'global-teardown.ts'),
});
