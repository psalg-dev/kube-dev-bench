import { test, expect } from '../src/fixtures.js';
import { bootstrapApp } from '../src/support/bootstrap.js';
import { CreateOverlay } from '../src/pages/CreateOverlay.js';
import { Notifications } from '../src/pages/Notifications.js';
import { waitForTableRow, waitForTableRowRemoved, openRowDetailsByName } from '../src/support/wait-helpers.js';

function uniqueName(prefix: string) {
  const rand = Math.random().toString(16).slice(2, 8);
  return `${prefix}-${Date.now()}-${rand}`.toLowerCase();
}

test.describe('RBAC resources', () => {
  test('creates and deletes RBAC resources via overlay', async ({ page, contextName, namespace }) => {
    test.setTimeout(180_000);
    const { sidebar } = await bootstrapApp({ page, contextName, namespace });
    const overlay = new CreateOverlay(page);
    const notifications = new Notifications(page);

    const roleName = uniqueName('e2e-role');
    const roleYaml = `apiVersion: rbac.authorization.k8s.io/v1\nkind: Role\nmetadata:\n  name: ${roleName}\n  namespace: ${namespace}\nrules:\n  - apiGroups: [\"\"]\n    resources: [\"pods\"]\n    verbs: [\"get\", \"list\"]\n`;

    await test.step('create role', async () => {
      await sidebar.goToRbacSection('roles');
      await overlay.openFromOverviewHeader();
      await overlay.fillYaml(roleYaml);
      await overlay.create();
      await notifications.expectSuccessContains('created successfully');
      await notifications.waitForClear();
      await waitForTableRow(page, new RegExp(roleName));
    });

    await test.step('open role details and YAML', async () => {
      await openRowDetailsByName(page, roleName);
      const panel = page.locator('.bottom-panel');
      await panel.getByRole('button', { name: /^rules$/i }).click();
      await expect(panel.getByText('Verbs')).toBeVisible();
      await panel.getByRole('button', { name: /^yaml$/i }).click();
      await expect(panel.locator('.cm-editor')).toBeVisible({ timeout: 30_000 });
    });

    await test.step('delete role', async () => {
      const panel = page.locator('.bottom-panel');
      await panel.getByRole('button', { name: /^summary$/i }).click();
      await panel.getByRole('button', { name: /^delete$/i }).click();
      await expect(panel.getByRole('button', { name: /^confirm$/i })).toBeVisible();
      await panel.getByRole('button', { name: /^confirm$/i }).click();
      await notifications.expectSuccessContains(`role '${roleName}' deleted`);
      await notifications.waitForClear();
      await waitForTableRowRemoved(page, new RegExp(roleName));
    });

    const clusterRoleName = uniqueName('e2e-cr');
    const clusterRoleYaml = `apiVersion: rbac.authorization.k8s.io/v1\nkind: ClusterRole\nmetadata:\n  name: ${clusterRoleName}\nrules:\n  - apiGroups: [\"\"]\n    resources: [\"pods\"]\n    verbs: [\"get\", \"list\"]\n`;

    await test.step('create cluster role', async () => {
      await sidebar.goToRbacSection('clusterroles');
      await overlay.openFromOverviewHeader();
      await overlay.fillYaml(clusterRoleYaml);
      await overlay.create();
      await notifications.expectSuccessContains('created successfully');
      await notifications.waitForClear();
      await waitForTableRow(page, new RegExp(clusterRoleName));
    });

    await test.step('open cluster role details', async () => {
      await openRowDetailsByName(page, clusterRoleName);
      const panel = page.locator('.bottom-panel');
      await panel.getByRole('button', { name: /^rules$/i }).click();
      await expect(panel.getByText('Verbs')).toBeVisible();
    });

    const roleBindingName = uniqueName('e2e-rb');
    const roleBindingYaml = `apiVersion: rbac.authorization.k8s.io/v1\nkind: RoleBinding\nmetadata:\n  name: ${roleBindingName}\n  namespace: ${namespace}\nsubjects:\n  - kind: User\n    name: e2e-user\n    apiGroup: rbac.authorization.k8s.io\nroleRef:\n  kind: Role\n  name: ${roleName}\n  apiGroup: rbac.authorization.k8s.io\n`;

    await test.step('create role binding', async () => {
      await sidebar.goToRbacSection('rolebindings');
      await overlay.openFromOverviewHeader();
      await overlay.fillYaml(roleBindingYaml);
      await overlay.create();
      await notifications.expectSuccessContains('created successfully');
      await notifications.waitForClear();
      await waitForTableRow(page, new RegExp(roleBindingName));
    });

    await test.step('open role binding subjects', async () => {
      await openRowDetailsByName(page, roleBindingName);
      const panel = page.locator('.bottom-panel');
      await panel.getByRole('button', { name: /^subjects$/i }).click();
      await expect(panel.getByRole('cell', { name: 'User', exact: true })).toBeVisible();
    });

    const clusterRoleBindingName = uniqueName('e2e-crb');
    const clusterRoleBindingYaml = `apiVersion: rbac.authorization.k8s.io/v1\nkind: ClusterRoleBinding\nmetadata:\n  name: ${clusterRoleBindingName}\nsubjects:\n  - kind: User\n    name: e2e-user\n    apiGroup: rbac.authorization.k8s.io\nroleRef:\n  kind: ClusterRole\n  name: ${clusterRoleName}\n  apiGroup: rbac.authorization.k8s.io\n`;

    await test.step('create cluster role binding', async () => {
      await sidebar.goToRbacSection('clusterrolebindings');
      await overlay.openFromOverviewHeader();
      await overlay.fillYaml(clusterRoleBindingYaml);
      await overlay.create();
      await notifications.expectSuccessContains('created successfully');
      await notifications.waitForClear();
      await waitForTableRow(page, new RegExp(clusterRoleBindingName));
    });

    await test.step('open cluster role binding subjects', async () => {
      await openRowDetailsByName(page, clusterRoleBindingName);
      const panel = page.locator('.bottom-panel');
      await panel.getByRole('button', { name: /^subjects$/i }).click();
      await expect(panel.getByRole('cell', { name: 'User', exact: true })).toBeVisible();
    });

    await test.step('delete role binding and cluster role binding', async () => {
      let panel = page.locator('.bottom-panel');
      await panel.getByRole('button', { name: /^summary$/i }).click();
      await panel.getByRole('button', { name: /^delete$/i }).click();
      await expect(panel.getByRole('button', { name: /^confirm$/i })).toBeVisible();
      await panel.getByRole('button', { name: /^confirm$/i }).click();
      await notifications.expectSuccessContains(`clusterrolebinding '${clusterRoleBindingName}' deleted`);
      await notifications.waitForClear();
      await waitForTableRowRemoved(page, new RegExp(clusterRoleBindingName));

      await sidebar.goToRbacSection('rolebindings');
      await openRowDetailsByName(page, roleBindingName);
      panel = page.locator('.bottom-panel');
      await panel.getByRole('button', { name: /^summary$/i }).click();
      await panel.getByRole('button', { name: /^delete$/i }).click();
      await expect(panel.getByRole('button', { name: /^confirm$/i })).toBeVisible();
      await panel.getByRole('button', { name: /^confirm$/i }).click();
      await notifications.expectSuccessContains(`rolebinding '${roleBindingName}' deleted`);
      await notifications.waitForClear();
      await waitForTableRowRemoved(page, new RegExp(roleBindingName));
    });

    await test.step('delete cluster role', async () => {
      await sidebar.goToRbacSection('clusterroles');
      await openRowDetailsByName(page, clusterRoleName);
      const panel = page.locator('.bottom-panel');
      await panel.getByRole('button', { name: /^summary$/i }).click();
      await panel.getByRole('button', { name: /^delete$/i }).click();
      await expect(panel.getByRole('button', { name: /^confirm$/i })).toBeVisible();
      await panel.getByRole('button', { name: /^confirm$/i }).click();
      await notifications.expectSuccessContains(`clusterrole '${clusterRoleName}' deleted`);
      await notifications.waitForClear();
      await waitForTableRowRemoved(page, new RegExp(clusterRoleName));
    });
  });
});
