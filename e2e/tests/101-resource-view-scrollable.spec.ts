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

      // Find the first table body in main-panels
      const tbody = mainPanels.querySelector('table tbody');
      if (!tbody) {
        // Fallback: create a tall filler div if no table is present
        const filler = document.createElement('div');
        filler.id = 'e2e-scroll-filler';
        filler.style.height = '5000px';
        filler.style.flexShrink = '0';
        mainPanels.appendChild(filler);
        return;
      }

      // Add enough rows to guarantee overflow (50 rows × ~42px ≈ 2100px)
      const FILLER_ROWS = 50;
      const colCount = tbody.querySelector('tr')?.querySelectorAll('td')?.length ?? 5;
      for (let i = 0; i < FILLER_ROWS; i++) {
        const tr = document.createElement('tr');
        tr.className = 'e2e-scroll-filler-row';
        for (let c = 0; c < colCount; c++) {
          const td = document.createElement('td');
          td.textContent = `filler-${i}-${c}`;
          tr.appendChild(td);
        }
        tbody.appendChild(tr);
      }
    });

    // Scroll to the bottom of #main-panels
    await page.evaluate(() => {
      const el = document.getElementById('main-panels');
      if (el) el.scrollTop = el.scrollHeight;
    });

    // The scroll position must be greater than 0, proving the element scrolls.
    const scrollTop = await page.evaluate(() => document.getElementById('main-panels')?.scrollTop ?? 0);
    expect(scrollTop, '#main-panels scrollTop should be > 0 after scrolling').toBeGreaterThan(0);
  });
});
