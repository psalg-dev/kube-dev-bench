import { test, expect } from '../src/fixtures.js';
import { bootstrapApp } from '../src/support/bootstrap.js';
import { CreateOverlay } from '../src/pages/CreateOverlay.js';
import { Notifications } from '../src/pages/Notifications.js';
import { kubectl } from '../src/support/kind.js';

function uniqueName(prefix: string) {
  const rand = Math.random().toString(16).slice(2, 8);
  return `${prefix}-${Date.now()}-${rand}`.toLowerCase();
}

async function expectRbacResourceExists(
  kubeconfigPath: string,
  kind: 'role' | 'clusterrole' | 'rolebinding' | 'clusterrolebinding',
  name: string,
  namespace?: string,
) {
  await expect
    .poll(async () => {
      const args = namespace
        ? ['get', kind, name, '-n', namespace, '-o', 'name', '--ignore-not-found']
        : ['get', kind, name, '-o', 'name', '--ignore-not-found'];
      const res = await kubectl(args, { kubeconfigPath, timeoutMs: 15_000 });
      return (res.stdout || '').trim();
    }, { timeout: 90_000, intervals: [1000, 2000, 5000] })
    .toBeTruthy();
}

async function expectRbacResourceRemoved(
  kubeconfigPath: string,
  kind: 'role' | 'clusterrole' | 'rolebinding' | 'clusterrolebinding',
  name: string,
  namespace?: string,
) {
  await expect
    .poll(async () => {
      const args = namespace
        ? ['get', kind, name, '-n', namespace, '-o', 'name', '--ignore-not-found']
        : ['get', kind, name, '-o', 'name', '--ignore-not-found'];
      const res = await kubectl(args, { kubeconfigPath, timeoutMs: 15_000 });
      return (res.stdout || '').trim();
    }, { timeout: 90_000, intervals: [1000, 2000, 5000] })
    .toBe('');
}

async function deleteRbacResource(
  kubeconfigPath: string,
  kind: 'role' | 'clusterrole' | 'rolebinding' | 'clusterrolebinding',
  name: string,
  namespace?: string,
) {
  const args = namespace
    ? ['delete', kind, name, '-n', namespace, '--ignore-not-found']
    : ['delete', kind, name, '--ignore-not-found'];
  await kubectl(args, { kubeconfigPath, timeoutMs: 30_000 });
}

test.describe('RBAC resources', () => {
  test('creates and deletes RBAC resources via overlay', async ({ page, contextName, namespace, kubeconfigPath }) => {
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
      await expectRbacResourceExists(kubeconfigPath, 'role', roleName, namespace);
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
      await expectRbacResourceExists(kubeconfigPath, 'clusterrole', clusterRoleName);
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
      await expectRbacResourceExists(kubeconfigPath, 'rolebinding', roleBindingName, namespace);
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
      await expectRbacResourceExists(kubeconfigPath, 'clusterrolebinding', clusterRoleBindingName);
    });

    await test.step('cleanup created RBAC resources via kubectl', async () => {
      await deleteRbacResource(kubeconfigPath, 'clusterrolebinding', clusterRoleBindingName);
      await deleteRbacResource(kubeconfigPath, 'rolebinding', roleBindingName, namespace);
      await deleteRbacResource(kubeconfigPath, 'clusterrole', clusterRoleName);
      await deleteRbacResource(kubeconfigPath, 'role', roleName, namespace);

      await expectRbacResourceRemoved(kubeconfigPath, 'clusterrolebinding', clusterRoleBindingName);
      await expectRbacResourceRemoved(kubeconfigPath, 'rolebinding', roleBindingName, namespace);
      await expectRbacResourceRemoved(kubeconfigPath, 'clusterrole', clusterRoleName);
      await expectRbacResourceRemoved(kubeconfigPath, 'role', roleName, namespace);
    });
  });
});
