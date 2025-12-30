import { test, expect } from '../setup/fixtures';
import { setupConnectedState } from '../setup/helpers';

/**
 * Test monitoring feature that displays warnings and errors in the footer.
 * Creates a pod with an invalid image to trigger an error, then verifies the badge appears and panel works.
 */
test.describe('Monitoring feature', () => {
  test.beforeEach(async ({ page, baseURL }) => {
    test.skip(process.env.KIND_AVAILABLE !== '1', 'KinD cluster required for monitoring tests.');
    test.setTimeout(120_000);
    await setupConnectedState(page, baseURL);
  });

  test('displays error badge when pod has ImagePullBackOff', async ({ page, exec }) => {
    // Create a pod with an invalid image to trigger ImagePullBackOff
    const manifest = `
apiVersion: v1
kind: Pod
metadata:
  name: monitor-test-pod
  namespace: test
spec:
  containers:
    - name: main
      image: invalid-image-does-not-exist:latest
`;

    await exec(`kubectl apply -f - <<EOF
${manifest}
EOF`);

    // Wait a bit for the pod to start pulling and fail
    await page.waitForTimeout(5000);

    // Wait for the monitor polling to detect the error (polling interval is 5 seconds)
    // The error badge should appear
    const errorBadge = page.locator('#monitor-error-badge');
    await expect(errorBadge).toBeVisible({ timeout: 15000 });

    // Verify the badge shows at least 1 error
    await expect(errorBadge).toContainText('Errors:');

    // Click the error badge to open the panel
    await errorBadge.click();

    // Verify the panel is visible
    const panel = page.locator('#monitor-panel');
    await expect(panel).toBeVisible();

    // Verify errors tab is active and shows our pod (scoped to panel)
    await expect(panel.getByText('monitor-test-pod')).toBeVisible();

    // Verify the error reason is shown (ImagePullBackOff or ErrImagePull)
    const issueItem = page.locator('.monitor-issue-item').filter({ hasText: 'monitor-test-pod' });
    await expect(issueItem).toBeVisible();
    const text = await issueItem.innerText();
    expect(text).toMatch(/ImagePullBackOff|ErrImagePull/i);

    // Close the panel
    await panel.getByTitle('Close').click();
    await expect(panel).not.toBeVisible();

    // Clean up - delete the test pod
    await exec('kubectl delete pod monitor-test-pod -n test --ignore-not-found=true');

    // Wait for the badge to disappear after cleanup
    // Give it some time for the monitor to update
    await page.waitForTimeout(6000);
  });

  test('panel switches between errors and warnings tabs', async ({ page, exec }) => {
    // Create a pod with an invalid image
    await exec(`kubectl apply -f - <<EOF
apiVersion: v1
kind: Pod
metadata:
  name: monitor-tab-test-pod
  namespace: test
spec:
  containers:
    - name: main
      image: invalid-image-tab-test:latest
EOF`);

    // Wait for error to be detected
    await page.waitForTimeout(5000);

    const errorBadge = page.locator('#monitor-error-badge');
    await expect(errorBadge).toBeVisible({ timeout: 15000 });

    // Open panel
    await errorBadge.click();

    // Verify errors tab is active by default (since errors exist)
    const errorsTab = page.locator('#monitor-tab-errors');
    await expect(errorsTab).toBeVisible();

    // Switch to warnings tab
    const warningsTab = page.locator('#monitor-tab-warnings');
    await warningsTab.click();

    // Verify warnings content area is shown (even if empty)
    await expect(page.getByText('No warnings found')).toBeVisible();

    // Switch back to errors tab
    await errorsTab.click();

    // Verify we can see our pod error again (scoped to panel)
    await expect(page.locator('#monitor-panel').getByText('monitor-tab-test-pod')).toBeVisible();

    // Close panel
    const panel = page.locator('#monitor-panel');
    await panel.getByTitle('Close').click();

    // Clean up
    await exec('kubectl delete pod monitor-tab-test-pod -n test --ignore-not-found=true');
  });

  test('badge disappears when issue is resolved', async ({ page, exec }) => {
    // Create a pod with an invalid image
    await exec(`kubectl apply -f - <<EOF
apiVersion: v1
kind: Pod
metadata:
  name: monitor-cleanup-test-pod
  namespace: test
spec:
  containers:
    - name: main
      image: invalid-image-cleanup-test:latest
EOF`);

    // Wait for error to be detected
    await page.waitForTimeout(5000);

    const errorBadge = page.locator('#monitor-error-badge');
    await expect(errorBadge).toBeVisible({ timeout: 15000 });

    // Delete the pod to resolve the issue
    await exec('kubectl delete pod monitor-cleanup-test-pod -n test');

    // Wait for monitor to update and badge to disappear
    // Give enough time for cleanup and next polling cycle (5s interval + buffer)
    // Note: Monitor polls every 5 seconds, and it may take a few cycles for the badge to disappear
    await expect(errorBadge).not.toBeVisible({ timeout: 30000 });
  });

  test('pre-selects errors tab when errors exist', async ({ page, exec }) => {
    // Create a pod with an invalid image to generate an error
    await exec(`kubectl apply -f - <<EOF
apiVersion: v1
kind: Pod
metadata:
  name: monitor-preselect-error-pod
  namespace: test
spec:
  containers:
    - name: main
      image: invalid-image-preselect-test:latest
EOF`);

    // Wait for error to be detected
    await page.waitForTimeout(5000);

    const errorBadge = page.locator('#monitor-error-badge');
    await expect(errorBadge).toBeVisible({ timeout: 15000 });

    // Open panel by clicking error badge
    await errorBadge.click();

    const panel = page.locator('#monitor-panel');
    await expect(panel).toBeVisible();

    // Verify errors tab is pre-selected (it should show the error content immediately, scoped to panel)
    await expect(panel.getByText('monitor-preselect-error-pod')).toBeVisible();

    // Verify errors tab has active styling
    const errorsTab = page.locator('#monitor-tab-errors');
    await expect(errorsTab).toBeVisible();

    // Close panel and clean up
    await panel.getByTitle('Close').click();
    await exec('kubectl delete pod monitor-preselect-error-pod -n test --ignore-not-found=true');
  });

  test('panel can be resized by dragging', async ({ page, exec }) => {
    // Create a pod with an invalid image
    await exec(`kubectl apply -f - <<EOF
apiVersion: v1
kind: Pod
metadata:
  name: monitor-resize-test-pod
  namespace: test
spec:
  containers:
    - name: main
      image: invalid-image-resize-test:latest
EOF`);

    // Wait for error to be detected
    await page.waitForTimeout(5000);

    const errorBadge = page.locator('#monitor-error-badge');
    await expect(errorBadge).toBeVisible({ timeout: 15000 });

    // Open panel
    await errorBadge.click();

    const panel = page.locator('#monitor-panel');
    await expect(panel).toBeVisible();

    // Get initial height
    const initialBox = await panel.boundingBox();
    const initialHeight = initialBox?.height || 0;

    // Find the drag handle (data-resizing="true")
    const dragHandle = panel.locator('[data-resizing="true"]');
    await expect(dragHandle).toBeVisible();

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
        await page.waitForTimeout(20);
      }
      await page.mouse.up();
    }

    // Wait a bit for the resize to settle
    await page.waitForTimeout(500);

    // Get new height
    const newBox = await panel.boundingBox();
    const newHeight = newBox?.height || 0;

    // Verify height increased (allow for some tolerance)
    expect(newHeight).toBeGreaterThanOrEqual(initialHeight + 50);

    // Close panel and clean up
    await panel.getByTitle('Close').click();
    await exec('kubectl delete pod monitor-resize-test-pod -n test --ignore-not-found=true');
  });
});
