import { test, expect } from '../setup/fixtures';
import { setupConnectedState } from '../setup/helpers';

/**
 * Test monitoring feature that displays warnings and errors in the footer.
 * Creates a pod with an invalid image to trigger an error, then verifies the badge appears and modal works.
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

    // Click the error badge to open the modal
    await errorBadge.click();

    // Verify the modal is visible
    const modal = page.locator('#monitor-modal');
    await expect(modal).toBeVisible();

    // Verify the modal header
    await expect(page.getByText('Cluster Monitor')).toBeVisible();

    // Verify errors tab is active and shows our pod
    await expect(page.getByText('Pod: monitor-test-pod')).toBeVisible();

    // Verify the error reason is shown (ImagePullBackOff or ErrImagePull)
    const issueItem = page.locator('.monitor-issue-item').filter({ hasText: 'monitor-test-pod' });
    await expect(issueItem).toBeVisible();
    const text = await issueItem.innerText();
    expect(text).toMatch(/ImagePullBackOff|ErrImagePull/);

    // Close the modal
    await page.locator('#monitor-modal-close').click();
    await expect(modal).not.toBeVisible();

    // Clean up - delete the test pod
    await exec('kubectl delete pod monitor-test-pod -n test --ignore-not-found=true');

    // Wait for the badge to disappear after cleanup
    // Give it some time for the monitor to update
    await page.waitForTimeout(6000);
  });

  test('modal switches between errors and warnings tabs', async ({ page, exec }) => {
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

    // Open modal
    await errorBadge.click();

    // Verify errors tab is active by default
    const errorsTab = page.locator('#monitor-tab-errors');
    await expect(errorsTab).toBeVisible();

    // Switch to warnings tab
    const warningsTab = page.locator('#monitor-tab-warnings');
    await warningsTab.click();

    // Verify warnings content area is shown (even if empty)
    const modalContent = page.locator('#monitor-modal-content');
    await expect(modalContent).toBeVisible();

    // Switch back to errors tab
    await errorsTab.click();

    // Verify we can see our pod error again
    await expect(page.getByText('Pod: monitor-tab-test-pod')).toBeVisible();

    // Close modal
    await page.locator('#monitor-modal-close').click();

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
    await expect(errorBadge).not.toBeVisible({ timeout: 20000 });
  });
});
