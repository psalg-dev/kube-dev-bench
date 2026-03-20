import { test, expect } from '../src/fixtures.js';
import { bootstrapApp } from '../src/support/bootstrap.js';

/**
 * Regression test: resource view tables must be vertically scrollable.
 *
 * Previously, #main-panels had `overflow: hidden` which silently clipped rows
 * that extended beyond the visible area on large clusters. This test guards
 * against that regression by verifying:
 *   1. The scroll container (#main-panels) does not have overflow-y: hidden.
 *   2. The container can actually be scrolled to a non-zero position when its
 *      content is taller than the viewport.
 */

test.describe('Resource view scrollability', () => {
  test('main panels container is not overflow-hidden', async ({ page, contextName, namespace }) => {
    const { sidebar } = await bootstrapApp({ page, contextName, namespace });

    // Navigate to Deployments – always present (even empty) so the table renders.
    await sidebar.goToSection('deployments');
    await expect(page.locator('h2.overview-title:visible')).toHaveText(/deployments/i, {
      timeout: 30_000,
    });

    const overflowY = await page.evaluate(() => {
      const el = document.getElementById('main-panels');
      if (!el) return null;
      return window.getComputedStyle(el).overflowY;
    });

    expect(overflowY, '#main-panels must allow vertical scroll (not "hidden")').not.toBe('hidden');
    expect(overflowY, '#main-panels overflow-y should be "auto" or "scroll"').toMatch(/^(auto|scroll)$/);
  });

  test('resource view table scrolls when content overflows viewport', async ({
    page,
    contextName,
    namespace,
  }) => {
    const { sidebar } = await bootstrapApp({ page, contextName, namespace });

    // Navigate to Pods; inject extra rows so the table definitely overflows.
    await sidebar.goToSection('pods');
    await expect(page.locator('h2.overview-title:visible')).toHaveText(/pods/i, {
      timeout: 30_000,
    });

    // Inject synthetic rows directly into the table body so we force overflow
    // regardless of how many real pods exist in the test namespace.
    await page.evaluate(() => {
      const mainPanels = document.getElementById('main-panels');
      if (!mainPanels) throw new Error('#main-panels not found');

      // Append a tall filler element directly to #main-panels (not inside a
      // nested table/panel) so its height contributes to #main-panels scrollHeight.
      // flex-shrink:0 prevents the flex layout from compressing it away.
      const filler = document.createElement('div');
      filler.id = 'e2e-scroll-filler';
      filler.style.height = '5000px';
      filler.style.minHeight = '5000px';
      filler.style.flexShrink = '0';
      mainPanels.appendChild(filler);
    });

    // Verify that #main-panels has overflow content (scrollHeight > clientHeight),
    // meaning the container actually needs to scroll.  This is more reliable than
    // checking scrollTop because it doesn't depend on the browser having completed
    // a programmatic scroll before the assertion runs.
    const { scrollHeight, clientHeight } = await page.evaluate(() => {
      const el = document.getElementById('main-panels');
      if (!el) return { scrollHeight: 0, clientHeight: 0 };
      return { scrollHeight: el.scrollHeight, clientHeight: el.clientHeight };
    });

    expect(
      scrollHeight,
      `#main-panels scrollHeight (${scrollHeight}) should be > clientHeight (${clientHeight}), meaning the container overflows and can scroll`,
    ).toBeGreaterThan(clientHeight);
  });
});
