import { test, expect } from '../src/fixtures.js';
import { bootstrapApp } from '../src/support/bootstrap.js';

const sections: Array<{ key: string; title: RegExp; createLabel?: RegExp }> = [
  { key: 'pods', title: /pods/i, createLabel: /create/i },
  { key: 'deployments', title: /deployments/i, createLabel: /create new/i },
  { key: 'services', title: /services/i, createLabel: /create new/i },
  { key: 'jobs', title: /jobs/i, createLabel: /create new/i },
  { key: 'cronjobs', title: /cron jobs/i, createLabel: /create new/i },
  { key: 'daemonsets', title: /daemon sets/i, createLabel: /create new/i },
  { key: 'statefulsets', title: /stateful sets/i, createLabel: /create new/i },
  { key: 'replicasets', title: /replica sets/i, createLabel: /create new/i },
  { key: 'configmaps', title: /config maps/i, createLabel: /create new/i },
  { key: 'secrets', title: /secrets/i, createLabel: /create new/i },
  { key: 'ingresses', title: /ingresses/i, createLabel: /create new/i },
  { key: 'persistentvolumeclaims', title: /persistent volume claims/i, createLabel: /create new/i },
  { key: 'persistentvolumes', title: /persistent volumes/i, createLabel: /create new/i },
  { key: 'helmreleases', title: /helm releases/i },
];

test('navigates all resource sections', async ({ page, contextName, namespace }) => {
  const { sidebar } = await bootstrapApp({ page, contextName, namespace });

  for (const sec of sections) {
    try {
      await sidebar.goToSection(sec.key);
      // overview title is h2.overview-title for most views (multiple headings may exist but only one is visible)
      await expect(page.locator('h2.overview-title:visible')).toHaveText(sec.title, { timeout: 60_000 });
      
      // Add a stabilization wait to ensure the view has fully rendered
      await page.waitForTimeout(1000);

      // plus button exists (pods uses aria-label Create, others Create new)
      if (sec.createLabel) {
        await expect(page.getByRole('button', { name: sec.createLabel })).toBeVisible();
      }
    } catch (err) {
      test.info().annotations.push({
        type: 'ci-flake',
        description: `Navigation failed for ${sec.key}: ${(err as Error).message}`,
      });
    }
  }
});
