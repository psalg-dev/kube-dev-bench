import { test, expect } from '../setup/fixtures';
import { connectWithKindKubeconfig, selectNamespace } from '../setup/helpers';

test.describe('Connection Wizard with KinD kubeconfig', () => {
  test('pastes kubeconfig and connects', async ({ page, baseURL }) => {
    await connectWithKindKubeconfig(page, baseURL);

    // If KinD is available, select the 'test' namespace and verify connection
    if (process.env.KIND_AVAILABLE === '1') {
      await selectNamespace(page, 'test');

      // Verify connection status
      const footerDot = page.locator('#footer-dot');
      await expect(footerDot).toHaveAttribute('title', /Connected|Insecure connection/i);
    } else {
      test.info().annotations.push({
        type: 'note',
        description: 'KinD not available; skipped namespace selection & connection assertion.'
      });
    }
  });
});
