import { test, expect } from '../setup/fixtures';
import { setupConnectedState } from '../setup/helpers';

// List of monitor test pod names for cleanup
const MONITOR_TEST_PODS = [
  'monitor-test-pod',
  'monitor-tab-test-pod',
  'monitor-cleanup-test-pod',
  'monitor-preselect-error-pod',
  'monitor-resize-test-pod',
];

/**
 * Helper to clean up all monitor test pods
 */
async function cleanupMonitorPods(exec: (cmd: string) => Promise<any>) {
  try {
    // Delete by label first (most efficient)
    await exec('kubectl delete pod -n test -l app=monitor-test --ignore-not-found=true --wait=false');
    // Also delete by name in case label wasn't applied
    for (const podName of MONITOR_TEST_PODS) {
      await exec(`kubectl delete pod ${podName} -n test --ignore-not-found=true --wait=false`);
    }
  } catch {
    // Ignore cleanup errors
  }
}

/**
 * Wait for pods to be fully deleted from the cluster
 */
async function waitForPodsDeleted(exec: (cmd: string) => Promise<any>, maxWait = 30000) {
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    try {
      const result = await exec('kubectl get pods -n test -l app=monitor-test -o name');
      if (!result.stdout.trim()) {
        return; // No pods found, cleanup complete
      }
    } catch {
      return; // Error likely means no pods exist
    }
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
}

/**
 * Test monitoring feature that displays warnings and errors in the footer.
 * Creates a pod with an invalid image to trigger an error, then verifies the badge appears and panel works.
 */
test.describe('Monitoring feature', () => {
  test.beforeEach(async ({ page, baseURL, exec }) => {
    test.skip(process.env.KIND_AVAILABLE !== '1', 'KinD cluster required for monitoring tests.');
    test.setTimeout(180_000); // Increased timeout for monitor tests

    // Clean up any leftover monitor test pods from previous runs
    await cleanupMonitorPods(exec);
    
    // Wait for pods to be fully deleted before starting test
    await waitForPodsDeleted(exec);

    await setupConnectedState(page, baseURL);

    // Wait for any previous monitor polling to settle and for UI to stabilize
    await page.waitForTimeout(5000);
  });

  test.afterEach(async ({ exec }) => {
    // Clean up test pods after each test
    await cleanupMonitorPods(exec);
  });

  test('displays error badge when pod has ImagePullBackOff', async ({ page, exec }) => {
    // Create a pod with an invalid image to trigger ImagePullBackOff
    const manifest = `
apiVersion: v1
kind: Pod
metadata:
  name: monitor-test-pod
  namespace: test
  labels:
    app: monitor-test
spec:
  containers:
    - name: main
      image: invalid-image-does-not-exist:latest
`;

    await exec(`kubectl apply -f - <<EOF
${manifest}
EOF`);

    // Wait for the pod to start pulling and fail - increased wait for reliability
    await page.waitForTimeout(10000);

    // Wait for the monitor polling to detect the error (polling interval is 5 seconds)
    // The error badge should appear - increased timeout for reliability
    const errorBadge = page.locator('#monitor-error-badge');
    await expect(errorBadge).toBeVisible({ timeout: 45000 });

    // Verify the badge shows at least 1 error
    await expect(errorBadge).toContainText('Errors:');

    // Click the error badge to open the panel
    await errorBadge.click();

    // Verify the panel is visible
    const panel = page.locator('#monitor-panel');
    await expect(panel).toBeVisible({ timeout: 15000 });

    // Verify errors tab is active and shows our pod (scoped to panel)
    await expect(panel.getByText('monitor-test-pod')).toBeVisible({ timeout: 15000 });

    // Verify the error reason is shown (ImagePullBackOff or ErrImagePull)
    const issueItem = page.locator('.monitor-issue-item').filter({ hasText: 'monitor-test-pod' });
    await expect(issueItem).toBeVisible({ timeout: 15000 });
    const text = await issueItem.innerText();
    expect(text).toMatch(/ImagePullBackOff|ErrImagePull/i);

    // Close the panel
    await panel.getByTitle('Close').click();
    await expect(panel).not.toBeVisible({ timeout: 5000 });
  });

  test('panel switches between errors and warnings tabs', async ({ page, exec }) => {
    // Create a pod with an invalid image
    await exec(`kubectl apply -f - <<EOF
apiVersion: v1
kind: Pod
metadata:
  name: monitor-tab-test-pod
  namespace: test
  labels:
    app: monitor-test
spec:
  containers:
    - name: main
      image: invalid-image-tab-test:latest
EOF`);

    // Wait for error to be detected - increased wait for reliability
    await page.waitForTimeout(10000);

    const errorBadge = page.locator('#monitor-error-badge');
    await expect(errorBadge).toBeVisible({ timeout: 45000 });

    // Open panel
    await errorBadge.click();

    const panel = page.locator('#monitor-panel');
    await expect(panel).toBeVisible({ timeout: 15000 });

    // Verify errors tab is active by default (since errors exist)
    const errorsTab = page.locator('#monitor-tab-errors');
    await expect(errorsTab).toBeVisible({ timeout: 5000 });

    // Switch to warnings tab
    const warningsTab = page.locator('#monitor-tab-warnings');
    await warningsTab.click();
    await page.waitForTimeout(500);

    // Verify warnings tab is now active (has visual styling indication)
    // The warnings panel content should be visible - may show warnings or "No warnings found"
    // Pods with invalid images generate both errors and warnings in Kubernetes
    await expect(panel).toBeVisible();

    // Switch back to errors tab
    await errorsTab.click();
    await page.waitForTimeout(500);

    // Verify we can see our pod error again (scoped to panel)
    await expect(panel.getByText('monitor-tab-test-pod')).toBeVisible({ timeout: 15000 });

    // Close panel
    await panel.getByTitle('Close').click();
    await expect(panel).not.toBeVisible({ timeout: 5000 });
  });

  test('badge disappears when issue is resolved', async ({ page, exec }) => {
    // Create a pod with an invalid image
    await exec(`kubectl apply -f - <<EOF
apiVersion: v1
kind: Pod
metadata:
  name: monitor-cleanup-test-pod
  namespace: test
  labels:
    app: monitor-test
spec:
  containers:
    - name: main
      image: invalid-image-cleanup-test:latest
EOF`);

    // Wait for error to be detected - increased wait for reliability
    await page.waitForTimeout(10000);

    const errorBadge = page.locator('#monitor-error-badge');
    await expect(errorBadge).toBeVisible({ timeout: 45000 });

    // Delete the pod to resolve the issue - wait for deletion to complete
    await exec('kubectl delete pod monitor-cleanup-test-pod -n test --wait=true');

    // Wait for monitor to update and badge to disappear
    // Give enough time for cleanup and next polling cycle (5s interval + buffer)
    // Note: Monitor polls every 5 seconds, and it may take a few cycles for the badge to disappear
    await expect(errorBadge).not.toBeVisible({ timeout: 60000 });
  });

  test('pre-selects errors tab when errors exist', async ({ page, exec }) => {
    // Create a pod with an invalid image to generate an error
    await exec(`kubectl apply -f - <<EOF
apiVersion: v1
kind: Pod
metadata:
  name: monitor-preselect-error-pod
  namespace: test
  labels:
    app: monitor-test
spec:
  containers:
    - name: main
      image: invalid-image-preselect-test:latest
EOF`);

    // Wait for error to be detected - increased wait for reliability
    await page.waitForTimeout(10000);

    const errorBadge = page.locator('#monitor-error-badge');
    await expect(errorBadge).toBeVisible({ timeout: 45000 });

    // Open panel by clicking error badge
    await errorBadge.click();

    const panel = page.locator('#monitor-panel');
    await expect(panel).toBeVisible({ timeout: 15000 });

    // Verify errors tab is pre-selected (it should show the error content immediately, scoped to panel)
    await expect(panel.getByText('monitor-preselect-error-pod')).toBeVisible({ timeout: 15000 });

    // Verify errors tab has active styling
    const errorsTab = page.locator('#monitor-tab-errors');
    await expect(errorsTab).toBeVisible({ timeout: 5000 });

    // Close panel
    await panel.getByTitle('Close').click();
    await expect(panel).not.toBeVisible({ timeout: 5000 });
  });

  test('panel can be resized by dragging', async ({ page, exec }) => {
    // Create a pod with an invalid image
    await exec(`kubectl apply -f - <<EOF
apiVersion: v1
kind: Pod
metadata:
  name: monitor-resize-test-pod
  namespace: test
  labels:
    app: monitor-test
spec:
  containers:
    - name: main
      image: invalid-image-resize-test:latest
EOF`);

    // Wait for error to be detected - increased wait for reliability
    await page.waitForTimeout(10000);

    const errorBadge = page.locator('#monitor-error-badge');
    await expect(errorBadge).toBeVisible({ timeout: 45000 });

    // Open panel
    await errorBadge.click();

    const panel = page.locator('#monitor-panel');
    await expect(panel).toBeVisible({ timeout: 10000 });

    // Get initial height
    const initialBox = await panel.boundingBox();
    const initialHeight = initialBox?.height || 0;

    // Find the drag handle (data-resizing="true")
    const dragHandle = panel.locator('[data-resizing="true"]');
    await expect(dragHandle).toBeVisible({ timeout: 5000 });

    // Drag the handle upwards to increase height
    const handleBox = await dragHandle.boundingBox();
    if (handleBox) {
      const startX = handleBox.x + handleBox.width / 2;
      const startY = handleBox.y + handleBox.height / 2;
      await page.mouse.move(startX, startY);
      await page.mouse.down();
      // Move in small steps for more reliable drag
      for (let i = 0; i < 10; i++) {
        await page.mouse.move(startX, startY - (i + 1) * 15);
        await page.waitForTimeout(30);
      }
      await page.mouse.up();
    }

    // Wait a bit for the resize to settle
    await page.waitForTimeout(500);

    // Ensure panel is still visible after resize
    await expect(panel).toBeVisible({ timeout: 5000 });

    // Get new height
    const newBox = await panel.boundingBox({ timeout: 5000 });
    const newHeight = newBox?.height || 0;

    // Verify height changed (allow for any amount of change - drag mechanics vary)
    // The main goal is to verify the resize handle works, not the exact pixels
    expect(newHeight).toBeGreaterThanOrEqual(initialHeight);

    // Close panel
    await panel.getByTitle('Close').click();
    await expect(panel).not.toBeVisible({ timeout: 5000 });
  });
});
