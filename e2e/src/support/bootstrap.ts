import { type Page } from '@playwright/test';
import { ConnectionWizardPage } from '../pages/ConnectionWizardPage.js';
import { SidebarPage } from '../pages/SidebarPage.js';
import { readRunState } from './run-state.js';

export async function bootstrapApp(opts: {
  page: Page;
  contextName: string;
  namespace: string;
}) {
  const { page, contextName, namespace } = opts;
  const state = await readRunState();

  if (!state.kubeconfigYaml) {
    throw new Error(
      'Missing kubeconfig in E2E run state. ' +
        'This usually means KinD setup was skipped (set `E2E_SKIP_KIND=1`) or failed. ' +
        'Kubernetes E2E tests require KinD/kubeconfig; Swarm-only tests should use `bootstrapSwarm()`.'
    );
  }

  await page.goto('/');

  const wizard = new ConnectionWizardPage(page);
  await wizard.openWizardIfHidden();
  await wizard.pastePrimaryKubeconfigAndContinue(state.kubeconfigYaml);

  const sidebar = new SidebarPage(page);
  await sidebar.selectContext(contextName);
  await sidebar.selectNamespace(namespace);

  return { sidebar };
}
