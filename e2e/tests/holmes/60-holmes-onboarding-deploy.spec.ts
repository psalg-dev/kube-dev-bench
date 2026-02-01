import { test, expect } from '../../src/fixtures.js';
import { bootstrapApp } from '../../src/support/bootstrap.js';
import { ensureNamespace, deleteNamespace, kubectl, helm } from '../../src/support/kind.js';

const HOLMES_NAMESPACE = 'holmesgpt';
const HOLMES_RELEASE_NAME = 'holmesgpt';
const HOLMES_POD_PREFIXES = ['holmesgpt', 'holmes'];

// This test deploys real HolmesGPT pods which is resource-intensive.
// It runs in its own dedicated CI shard (e2e-holmes-deploy) with E2E_HOLMES_DEPLOY=1.
// To run locally: E2E_HOLMES_DEPLOY=1 npx playwright test tests/holmes/60-holmes-onboarding-deploy.spec.ts
const SHOULD_SKIP_TEST = process.env.E2E_HOLMES_DEPLOY !== '1';

test.describe('HolmesGPT onboarding', () => {
  test.skip(SHOULD_SKIP_TEST, 'Requires E2E_HOLMES_DEPLOY=1 (runs in dedicated e2e-holmes-deploy shard)');

  test('deploys HolmesGPT via helm and verifies it responds', async ({ page, contextName, namespace, kubeconfigPath, homeDir }) => {
    // Total test timeout: 5 minutes for fast iteration
    test.setTimeout(5 * 60_000);

    await test.step('Clean up any existing Holmes deployment', async () => {
      // First uninstall any existing Helm release
      await helm(['uninstall', HOLMES_RELEASE_NAME, '-n', HOLMES_NAMESPACE, '--ignore-not-found'], {
        kubeconfigPath,
        homeDir,
        timeoutMs: 60_000,
      }).catch(() => { /* ignore errors - release might not exist */ });

      // Delete the holmesgpt namespace if it exists to ensure a clean state
      await deleteNamespace(kubeconfigPath, HOLMES_NAMESPACE);

      // Wait for namespace to be fully deleted by polling
      // The namespace must not exist at all (kubectl get returns nothing or error)
      const maxWaitMs = 60_000;
      const startTime = Date.now();
      while (Date.now() - startTime < maxWaitMs) {
        const result = await kubectl(['get', 'ns', HOLMES_NAMESPACE, '-o', 'name', '--ignore-not-found'], {
          kubeconfigPath,
          timeoutMs: 10_000,
        });
        // If namespace is gone (empty output), break
        if (result.code === 0 && result.stdout.trim() === '') {
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    });

    await bootstrapApp({ page, contextName, namespace });


    await test.step('Open Holmes onboarding wizard', async () => {
      await page.locator('#holmes-toggle-btn').click();
      const panel = page.locator('#holmes-panel');
      await expect(panel).toBeVisible({ timeout: 5_000 });

      const deployButton = panel.getByRole('button', { name: /Deploy Holmes/i });
      if (!(await deployButton.isVisible().catch(() => false))) {
        await page.locator('#holmes-config-btn').click();
        await expect(page.locator('#holmes-config-modal')).toBeVisible({ timeout: 5_000 });
        await page.getByRole('button', { name: /Clear Config/i }).click();
        await page.getByRole('button', { name: /Cancel/i }).click();
        await expect(page.locator('#holmes-config-modal')).toBeHidden({ timeout: 5_000 });
        await expect(panel).toContainText(/Holmes AI is not configured/i, { timeout: 5_000 });
      }

      await deployButton.click();
      await expect(page.locator('#holmes-onboarding-wizard')).toBeVisible({ timeout: 5_000 });
    });

    await test.step('Complete deployment flow (including namespace pre-step)', async () => {
      await ensureNamespace(kubeconfigPath, HOLMES_NAMESPACE);
      const wizard = page.locator('#holmes-onboarding-wizard');

      const getStarted = wizard.getByRole('button', { name: /Get Started/i });
      if (await getStarted.isVisible().catch(() => false)) {
        await getStarted.click();
      }

      const apiKeyInput = wizard.locator('#openai-key');
      if (await apiKeyInput.isVisible().catch(() => false)) {
        await apiKeyInput.fill('sk-test-no-key');
        await wizard.getByRole('button', { name: /Deploy Holmes/i }).click();
      }

      // Wait for deployment to complete - 2 minutes should be enough for lightweight chart
      await expect(wizard).toContainText(/Holmes is Ready!/i, { timeout: 2 * 60_000 });
      await wizard.getByRole('button', { name: /Start Using Holmes/i }).click();
      await expect(wizard).toBeHidden({ timeout: 5_000 });
    });

    await test.step('Verify HolmesGPT is deployed in the cluster', async () => {
      await expect.poll(async () => {
        // Use simpler wide output format to avoid jsonpath escaping issues
        const res = await kubectl(
          ['get', 'pods', '-n', HOLMES_NAMESPACE, '-o', 'wide', '--no-headers'],
          { kubeconfigPath, timeoutMs: 30_000 }
        );
        if (res.code !== 0) {
          return false;
        }
        // Wide format: NAME READY STATUS RESTARTS AGE IP NODE ...
        const hasRunningPod = res.stdout
          .split(/\r?\n/)
          .some((line) => {
            const columns = line.trim().split(/\s+/);
            const name = columns[0];
            const status = columns[2]; // STATUS is 3rd column in wide output
            if (!name || !status) return false;
            return HOLMES_POD_PREFIXES.some((prefix) => name.startsWith(prefix)) && status === 'Running';
          });
        return hasRunningPod;
      }, {
        // 1 minute should be enough since the deployment already happened
        timeout: 60_000,
        intervals: [1000, 2000, 5000],
      }).toBe(true);
    });

    await test.step('Ask Holmes and verify response', async () => {
      const input = page.getByPlaceholder('Ask about your cluster...');
      await expect(input).toBeVisible({ timeout: 20_000 });
      await input.fill('What is wrong with my cluster?');
      await page.getByRole('button', { name: '→' }).click();

      // With real HolmesGPT: expect auth error due to fake API key
      // With lightweight mock: expect successful response
      await expect(page.locator('#holmes-panel')).toContainText(/Authentication failed|api key|OpenAI|Resource Analysis|healthy/i, { timeout: 60_000 });
    });
  });
});
