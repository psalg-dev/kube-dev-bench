import { test, expect } from '../../src/fixtures.js';
import { bootstrapApp } from '../../src/support/bootstrap.js';
import { ensureNamespace, kubectl } from '../../src/support/kind.js';

const HOLMES_NAMESPACE = 'holmesgpt';
const HOLMES_POD_PREFIXES = ['holmesgpt', 'holmes'];

test.describe('HolmesGPT onboarding', () => {
  test('deploys HolmesGPT and surfaces auth error without a real API key', async ({ page, contextName, namespace, kubeconfigPath }) => {
    test.setTimeout(12 * 60_000);

    await bootstrapApp({ page, contextName, namespace });


    await test.step('Open Holmes onboarding wizard', async () => {
      await page.locator('#holmes-toggle-btn').click();
      const panel = page.locator('#holmes-panel');
      await expect(panel).toBeVisible({ timeout: 10_000 });

      const deployButton = panel.getByRole('button', { name: /Deploy Holmes/i });
      if (!(await deployButton.isVisible().catch(() => false))) {
        await page.locator('#holmes-config-btn').click();
        await expect(page.locator('#holmes-config-modal')).toBeVisible({ timeout: 10_000 });
        await page.getByRole('button', { name: /Clear Config/i }).click();
        await page.getByRole('button', { name: /Cancel/i }).click();
        await expect(page.locator('#holmes-config-modal')).toBeHidden({ timeout: 10_000 });
        await expect(panel).toContainText(/Holmes AI is not configured/i, { timeout: 10_000 });
      }

      await deployButton.click();
      await expect(page.locator('#holmes-onboarding-wizard')).toBeVisible({ timeout: 10_000 });
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

      await expect(wizard).toContainText(/Holmes is Ready!/i, { timeout: 8 * 60_000 });
      await wizard.getByRole('button', { name: /Start Using Holmes/i }).click();
      await expect(wizard).toBeHidden({ timeout: 10_000 });
    });

    await test.step('Verify HolmesGPT is deployed in the cluster', async () => {
      await expect.poll(async () => {
        const res = await kubectl(
          ['get', 'pods', '-n', HOLMES_NAMESPACE, '-o', 'jsonpath={range .items[*]}{.metadata.name}{"\t"}{.status.phase}{"\n"}{end}'],
          { kubeconfigPath, timeoutMs: 60_000 }
        );
        if (res.code !== 0) {
          return false;
        }
        return res.stdout
          .split(/\r?\n/)
          .some((line) => {
            const [name, phase] = line.split(/\t/);
            if (!name || !phase) return false;
            return HOLMES_POD_PREFIXES.some((prefix) => name.startsWith(prefix)) && phase === 'Running';
          });
      }, {
        timeout: 5 * 60_000, // Increased to 5 minutes for CI
        intervals: [2000, 5000, 10000],
      }).toBe(true);
    });

    await test.step('Ask Holmes and expect auth error', async () => {
      const input = page.getByPlaceholder('Ask about your cluster...');
      await expect(input).toBeVisible({ timeout: 20_000 });
      await input.fill('What is wrong with my cluster?');
      await page.getByRole('button', { name: '→' }).click();

      await expect(page.locator('#holmes-panel')).toContainText(/Authentication failed|api key|OpenAI/i, { timeout: 60_000 });
    });
  });
});
