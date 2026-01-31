import { test, expect } from '../src/fixtures.js';
import { CreateOverlay } from '../src/pages/CreateOverlay.js';
import { Notifications } from '../src/pages/Notifications.js';
import { bootstrapApp } from '../src/support/bootstrap.js';

function uniqueName(prefix: string) {
  const rand = Math.random().toString(16).slice(2, 8);
  return `${prefix}-${Date.now()}-${rand}`.toLowerCase();
}

/**
 * Creates a pod using the create overlay
 */
async function createPod(page: any, namespace: string, name: string) {
  const yaml = `apiVersion: v1
kind: Pod
metadata:
  name: ${name}
  namespace: ${namespace}
spec:
  containers:
    - name: nginx
      image: nginx:alpine
`;
  const overlay = new CreateOverlay(page);
  await overlay.openFromOverviewHeader();
  await overlay.fillYaml(yaml);
  await overlay.create();
  
  const notifications = new Notifications(page);
  await notifications.expectSuccessContains('created successfully');
  
  // Wait for pod to appear in table
  await expect(page.getByRole('row', { name: new RegExp(name) })).toBeVisible({ timeout: 60_000 });
}

test.describe('Bulk Operations', () => {
  test.describe('Kubernetes Pods', () => {
    test('can select multiple pods and bulk delete them', async ({ page, contextName, namespace }) => {
      const { sidebar } = await bootstrapApp({ page, contextName, namespace });

      await test.step('Navigate to Pods section', async () => {
        await sidebar.goToSection('pods');
        await expect(page.locator('h2', { hasText: /pods/i })).toBeVisible({ timeout: 10_000 });
      });

      // Create test pods
      const pod1 = uniqueName('bulk-pod');
      const pod2 = uniqueName('bulk-pod');
      const pod3 = uniqueName('bulk-pod');

      await test.step('Create first test pod', async () => {
        await createPod(page, namespace, pod1);
      });

      await test.step('Create second test pod', async () => {
        await createPod(page, namespace, pod2);
      });

      await test.step('Create third test pod', async () => {
        await createPod(page, namespace, pod3);
      });

      await test.step('Select multiple pods using checkboxes', async () => {
        // Find and click checkboxes for pods
        const row1 = page.getByRole('row', { name: new RegExp(pod1) });
        const row2 = page.getByRole('row', { name: new RegExp(pod2) });

        // Click the checkboxes
        await row1.locator('input[type="checkbox"]').click();
        await row2.locator('input[type="checkbox"]').click();

        // Verify bulk action bar appears with 2 selected
        await expect(page.locator('.bulk-action-bar')).toBeVisible();
        await expect(page.locator('.bulk-action-bar')).toContainText('2');
      });

      await test.step('Click Delete action and confirm', async () => {
        // Click the delete button in the bulk action bar
        await page.locator('.bulk-action-bar button', { hasText: /delete/i }).click();

        // Confirm dialog should appear
        await expect(page.locator('.bulk-confirm-dialog')).toBeVisible();
        await expect(page.locator('.bulk-confirm-dialog')).toContainText('2');

        // Click confirm button
        await page.locator('[data-testid="bulk-confirm-submit"]').click();
      });

      await test.step('Wait for operation to complete', async () => {
        // Progress dialog should appear and complete
        await expect(page.locator('.bulk-progress-overlay')).toBeVisible({ timeout: 5_000 });
        
        // Wait for completion
        await expect(page.locator('.bulk-progress-overlay')).toContainText(/complete/i, { timeout: 30_000 });

        // Close the dialog
        await page.locator('.bulk-progress-close').click();
      });

      await test.step('Verify deleted pods are no longer in the table', async () => {
        // The deleted pods should no longer be visible
        await expect(page.getByRole('row', { name: new RegExp(pod1) })).toHaveCount(0, { timeout: 30_000 });
        await expect(page.getByRole('row', { name: new RegExp(pod2) })).toHaveCount(0, { timeout: 10_000 });

        // The third pod should still be visible
        await expect(page.getByRole('row', { name: new RegExp(pod3) })).toBeVisible();
      });

      // Cleanup: delete the remaining pod
      await test.step('Cleanup remaining pod', async () => {
        const row3 = page.getByRole('row', { name: new RegExp(pod3) });
        await row3.locator('input[type="checkbox"]').click();
        await page.locator('.bulk-action-bar button', { hasText: /delete/i }).click();
        await page.locator('[data-testid="bulk-confirm-submit"]').click();
        await expect(page.locator('.bulk-progress-overlay')).toContainText(/complete/i, { timeout: 30_000 });
        await page.locator('.bulk-progress-close').click();
      });
    });

    test('can select all pods using header checkbox', async ({ page, contextName, namespace }) => {
      const { sidebar } = await bootstrapApp({ page, contextName, namespace });

      await test.step('Navigate to Pods section', async () => {
        await sidebar.goToSection('pods');
      });

      // Create test pods
      const podNames = [uniqueName('bulk-all'), uniqueName('bulk-all')];

      for (const name of podNames) {
        await createPod(page, namespace, name);
      }

      await test.step('Click select all checkbox', async () => {
        // Find and click the header checkbox
        const headerCheckbox = page.locator('.bulk-select-header input[type="checkbox"], .bulk-checkbox-all');
        await headerCheckbox.click();

        // Verify bulk action bar shows correct count
        await expect(page.locator('.bulk-action-bar')).toBeVisible();
      });

      await test.step('Bulk delete all selected pods', async () => {
        await page.locator('.bulk-action-bar button', { hasText: /delete/i }).click();
        await page.locator('[data-testid="bulk-confirm-submit"]').click();
        await expect(page.locator('.bulk-progress-overlay')).toContainText(/complete/i, { timeout: 60_000 });
        await page.locator('.bulk-progress-close').click();
      });

      await test.step('Verify pods are deleted', async () => {
        for (const name of podNames) {
          await expect(page.getByRole('row', { name: new RegExp(name) })).toHaveCount(0, { timeout: 30_000 });
        }
      });
    });

    test('can clear selection using clear button', async ({ page, contextName, namespace }) => {
      const { sidebar } = await bootstrapApp({ page, contextName, namespace });

      await test.step('Navigate to Pods section', async () => {
        await sidebar.goToSection('pods');
      });

      const podName = uniqueName('bulk-clear');
      await createPod(page, namespace, podName);

      await test.step('Select a pod', async () => {
        const row = page.getByRole('row', { name: new RegExp(podName) });
        await row.locator('input[type="checkbox"]').click();
        await expect(page.locator('.bulk-action-bar')).toBeVisible();
      });

      await test.step('Clear selection', async () => {
        await page.locator('.bulk-action-clear').click();
        await expect(page.locator('.bulk-action-bar')).not.toBeVisible();
      });

      // Cleanup
      await test.step('Cleanup', async () => {
        const row = page.getByRole('row', { name: new RegExp(podName) });
        await row.locator('input[type="checkbox"]').click();
        await page.locator('.bulk-action-bar button', { hasText: /delete/i }).click();
        await page.locator('[data-testid="bulk-confirm-submit"]').click();
        await expect(page.locator('.bulk-progress-overlay')).toContainText(/complete/i, { timeout: 30_000 });
        await page.locator('.bulk-progress-close').click();
      });
    });
  });

  test.describe('Kubernetes Deployments', () => {
    test('can bulk delete deployments', async ({ page, contextName, namespace }) => {
      const { sidebar } = await bootstrapApp({ page, contextName, namespace });

      await test.step('Navigate to Deployments section', async () => {
        await sidebar.goToSection('deployments');
        await expect(page.locator('h2', { hasText: /deployments/i })).toBeVisible({ timeout: 10_000 });
      });

      // Create test deployments
      const deployName = uniqueName('bulk-deploy');
      const yaml = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: ${deployName}
  namespace: ${namespace}
spec:
  replicas: 1
  selector:
    matchLabels:
      app: ${deployName}
  template:
    metadata:
      labels:
        app: ${deployName}
    spec:
      containers:
        - name: nginx
          image: nginx:alpine
`;

      await test.step('Create test deployment', async () => {
        const overlay = new CreateOverlay(page);
        await overlay.openFromOverviewHeader();
        await overlay.fillYaml(yaml);
        await overlay.create();
        const notifications = new Notifications(page);
        await notifications.expectSuccessContains('created successfully');
        await expect(page.getByRole('row', { name: new RegExp(deployName) })).toBeVisible({ timeout: 60_000 });
      });

      await test.step('Select and bulk delete deployment', async () => {
        const row = page.getByRole('row', { name: new RegExp(deployName) });
        await row.locator('input[type="checkbox"]').click();
        await expect(page.locator('.bulk-action-bar')).toBeVisible();
        
        await page.locator('.bulk-action-bar button', { hasText: /delete/i }).click();
        await page.locator('[data-testid="bulk-confirm-submit"]').click();
        await expect(page.locator('.bulk-progress-overlay')).toContainText(/complete/i, { timeout: 30_000 });
        await page.locator('.bulk-progress-close').click();
      });

      await test.step('Verify deployment is deleted', async () => {
        await expect(page.getByRole('row', { name: new RegExp(deployName) })).toHaveCount(0, { timeout: 30_000 });
      });
    });
  });

  test.describe('Kubernetes ConfigMaps', () => {
    test('can bulk delete configmaps', async ({ page, contextName, namespace }) => {
      const { sidebar } = await bootstrapApp({ page, contextName, namespace });

      await test.step('Navigate to ConfigMaps section', async () => {
        await sidebar.goToSection('configmaps');
        await expect(page.locator('h2', { hasText: /configmaps/i })).toBeVisible({ timeout: 10_000 });
      });

      const cmName = uniqueName('bulk-cm');
      const yaml = `apiVersion: v1
kind: ConfigMap
metadata:
  name: ${cmName}
  namespace: ${namespace}
data:
  hello: world
`;

      await test.step('Create test configmap', async () => {
        const overlay = new CreateOverlay(page);
        await overlay.openFromOverviewHeader();
        await overlay.fillYaml(yaml);
        await overlay.create();
        const notifications = new Notifications(page);
        await notifications.expectSuccessContains('created successfully');
        await expect(page.getByRole('row', { name: new RegExp(cmName) })).toBeVisible({ timeout: 60_000 });
      });

      await test.step('Select and bulk delete configmap', async () => {
        const row = page.getByRole('row', { name: new RegExp(cmName) });
        await row.locator('input[type="checkbox"]').click();
        await expect(page.locator('.bulk-action-bar')).toBeVisible();
        
        await page.locator('.bulk-action-bar button', { hasText: /delete/i }).click();
        await page.locator('[data-testid="bulk-confirm-submit"]').click();
        await expect(page.locator('.bulk-progress-overlay')).toContainText(/complete/i, { timeout: 30_000 });
        await page.locator('.bulk-progress-close').click();
      });

      await test.step('Verify configmap is deleted', async () => {
        await expect(page.getByRole('row', { name: new RegExp(cmName) })).toHaveCount(0, { timeout: 30_000 });
      });
    });
  });

  test.describe('Kubernetes Secrets', () => {
    test('can bulk delete secrets', async ({ page, contextName, namespace }) => {
      const { sidebar } = await bootstrapApp({ page, contextName, namespace });

      await test.step('Navigate to Secrets section', async () => {
        await sidebar.goToSection('secrets');
        await expect(page.locator('h2', { hasText: /secrets/i })).toBeVisible({ timeout: 10_000 });
      });

      const secretName = uniqueName('bulk-secret');
      const yaml = `apiVersion: v1
kind: Secret
metadata:
  name: ${secretName}
  namespace: ${namespace}
type: Opaque
stringData:
  password: mysecretpassword
`;

      await test.step('Create test secret', async () => {
        const overlay = new CreateOverlay(page);
        await overlay.openFromOverviewHeader();
        await overlay.fillYaml(yaml);
        await overlay.create();
        const notifications = new Notifications(page);
        await notifications.expectSuccessContains('created successfully');
        await expect(page.getByRole('row', { name: new RegExp(secretName) })).toBeVisible({ timeout: 60_000 });
      });

      await test.step('Select and bulk delete secret', async () => {
        const row = page.getByRole('row', { name: new RegExp(secretName) });
        await row.locator('input[type="checkbox"]').click();
        await expect(page.locator('.bulk-action-bar')).toBeVisible();
        
        await page.locator('.bulk-action-bar button', { hasText: /delete/i }).click();
        await page.locator('[data-testid="bulk-confirm-submit"]').click();
        await expect(page.locator('.bulk-progress-overlay')).toContainText(/complete/i, { timeout: 30_000 });
        await page.locator('.bulk-progress-close').click();
      });

      await test.step('Verify secret is deleted', async () => {
        await expect(page.getByRole('row', { name: new RegExp(secretName) })).toHaveCount(0, { timeout: 30_000 });
      });
    });
  });

  test.describe('Kubernetes Jobs', () => {
    test('can bulk delete jobs', async ({ page, contextName, namespace }) => {
      const { sidebar } = await bootstrapApp({ page, contextName, namespace });

      await test.step('Navigate to Jobs section', async () => {
        await sidebar.goToSection('jobs');
        await expect(page.locator('h2', { hasText: /jobs/i })).toBeVisible({ timeout: 10_000 });
      });

      const jobName = uniqueName('bulk-job');
      const yaml = `apiVersion: batch/v1
kind: Job
metadata:
  name: ${jobName}
  namespace: ${namespace}
spec:
  template:
    spec:
      containers:
        - name: hello
          image: busybox
          command: ["echo", "hello"]
      restartPolicy: Never
`;

      await test.step('Create test job', async () => {
        const overlay = new CreateOverlay(page);
        await overlay.openFromOverviewHeader();
        await overlay.fillYaml(yaml);
        await overlay.create();
        const notifications = new Notifications(page);
        await notifications.expectSuccessContains('created successfully');
        await expect(page.getByRole('row', { name: new RegExp(jobName) })).toBeVisible({ timeout: 60_000 });
      });

      await test.step('Select and bulk delete job', async () => {
        const row = page.getByRole('row', { name: new RegExp(jobName) });
        await row.locator('input[type="checkbox"]').click();
        await expect(page.locator('.bulk-action-bar')).toBeVisible();
        
        await page.locator('.bulk-action-bar button', { hasText: /delete/i }).click();
        await page.locator('[data-testid="bulk-confirm-submit"]').click();
        await expect(page.locator('.bulk-progress-overlay')).toContainText(/complete/i, { timeout: 30_000 });
        await page.locator('.bulk-progress-close').click();
      });

      await test.step('Verify job is deleted', async () => {
        await expect(page.getByRole('row', { name: new RegExp(jobName) })).toHaveCount(0, { timeout: 30_000 });
      });
    });
  });

  test.describe('Kubernetes CronJobs', () => {
    test('can bulk suspend and resume cronjobs', async ({ page, contextName, namespace }) => {
      const { sidebar } = await bootstrapApp({ page, contextName, namespace });

      await test.step('Navigate to CronJobs section', async () => {
        await sidebar.goToSection('cronjobs');
        await expect(page.locator('h2', { hasText: /cronjobs/i })).toBeVisible({ timeout: 10_000 });
      });

      const cronName = uniqueName('bulk-cron');
      const yaml = `apiVersion: batch/v1
kind: CronJob
metadata:
  name: ${cronName}
  namespace: ${namespace}
spec:
  schedule: "0 0 * * *"
  jobTemplate:
    spec:
      template:
        spec:
          containers:
            - name: hello
              image: busybox
              command: ["echo", "hello"]
          restartPolicy: Never
`;

      await test.step('Create test cronjob', async () => {
        const overlay = new CreateOverlay(page);
        await overlay.openFromOverviewHeader();
        await overlay.fillYaml(yaml);
        await overlay.create();
        const notifications = new Notifications(page);
        await notifications.expectSuccessContains('created successfully');
        await expect(page.getByRole('row', { name: new RegExp(cronName) })).toBeVisible({ timeout: 60_000 });
      });

      await test.step('Select and bulk suspend cronjob', async () => {
        const row = page.getByRole('row', { name: new RegExp(cronName) });
        await row.locator('input[type="checkbox"]').click();
        await expect(page.locator('.bulk-action-bar')).toBeVisible();
        
        // Look for suspend action
        await page.locator('.bulk-action-bar button', { hasText: /suspend/i }).click();
        await page.locator('[data-testid="bulk-confirm-submit"]').click();
        await expect(page.locator('.bulk-progress-overlay')).toContainText(/complete/i, { timeout: 30_000 });
        await page.locator('.bulk-progress-close').click();
      });

      await test.step('Select and bulk resume cronjob', async () => {
        const row = page.getByRole('row', { name: new RegExp(cronName) });
        await row.locator('input[type="checkbox"]').click();
        await expect(page.locator('.bulk-action-bar')).toBeVisible();
        
        // Look for resume action
        await page.locator('.bulk-action-bar button', { hasText: /resume/i }).click();
        await page.locator('[data-testid="bulk-confirm-submit"]').click();
        await expect(page.locator('.bulk-progress-overlay')).toContainText(/complete/i, { timeout: 30_000 });
        await page.locator('.bulk-progress-close').click();
      });

      // Cleanup
      await test.step('Cleanup cronjob', async () => {
        const row = page.getByRole('row', { name: new RegExp(cronName) });
        await row.locator('input[type="checkbox"]').click();
        await page.locator('.bulk-action-bar button', { hasText: /delete/i }).click();
        await page.locator('[data-testid="bulk-confirm-submit"]').click();
        await expect(page.locator('.bulk-progress-overlay')).toContainText(/complete/i, { timeout: 30_000 });
        await page.locator('.bulk-progress-close').click();
      });
    });
  });
});
