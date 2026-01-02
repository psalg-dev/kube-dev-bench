import { test, expect } from '../src/fixtures.js';
import { bootstrapApp } from '../src/support/bootstrap.js';

type SectionCheck = {
  key: string;
  title: RegExp;
  // A view-specific, "harder to fake" assertion than just the title.
  mustHave: { role: 'columnheader' | 'table' | 'button'; name?: RegExp };
};

const checks: SectionCheck[] = [
  { key: 'pods', title: /pods/i, mustHave: { role: 'table', name: /actions/i } },
  { key: 'deployments', title: /deployments/i, mustHave: { role: 'columnheader', name: /replicas/i } },
  { key: 'jobs', title: /jobs/i, mustHave: { role: 'columnheader', name: /completions/i } },
  { key: 'cronjobs', title: /cron jobs/i, mustHave: { role: 'columnheader', name: /schedule/i } },
  { key: 'daemonsets', title: /daemon sets/i, mustHave: { role: 'columnheader', name: /desired/i } },
  { key: 'statefulsets', title: /stateful sets/i, mustHave: { role: 'columnheader', name: /ready/i } },
  { key: 'replicasets', title: /replica sets/i, mustHave: { role: 'columnheader', name: /replicas/i } },
  { key: 'configmaps', title: /config maps/i, mustHave: { role: 'columnheader', name: /keys/i } },
  { key: 'secrets', title: /secrets/i, mustHave: { role: 'columnheader', name: /type/i } },
  { key: 'ingresses', title: /ingresses/i, mustHave: { role: 'columnheader', name: /hosts/i } },
  { key: 'persistentvolumeclaims', title: /persistent volume claims/i, mustHave: { role: 'columnheader', name: /storage|size|capacity/i } },
  { key: 'persistentvolumes', title: /persistent volumes/i, mustHave: { role: 'columnheader', name: /capacity/i } },
];

test('sidebar navigation renders the correct main view', async ({ page, contextName, namespace }) => {
  test.setTimeout(180_000);
  const { sidebar } = await bootstrapApp({ page, contextName, namespace });

  for (const c of checks) {
    await sidebar.goToSection(c.key);
    await expect(page.locator('h2.overview-title')).toHaveText(c.title, { timeout: 60_000 });

    if (c.mustHave.role === 'columnheader') {
      await expect(page.getByRole('columnheader', { name: c.mustHave.name! })).toBeVisible({ timeout: 60_000 });
    } else if (c.mustHave.role === 'table') {
      // Pods uses a custom table; ensure it's present and has Actions header.
      await expect(page.getByRole('table').filter({ hasText: 'Actions' }).first()).toBeVisible({ timeout: 60_000 });
    } else {
      await expect(page.getByRole('button', { name: c.mustHave.name! })).toBeVisible({ timeout: 60_000 });
    }
  }
});
