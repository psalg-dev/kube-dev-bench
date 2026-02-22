# Artifactory / JFrog Container Registry E2E Testing

This document describes the end-to-end testing strategy for Docker Swarm registry support with JFrog Artifactory/JCR integration.

## Overview

The test validates that KubeDevBench can successfully connect to and interact with a JFrog Container Registry (JCR) Docker repository, including authentication, connection testing, and basic registry operations.

## Test Objectives

1. **Primary Goal**: Verify that "Test Connection" succeeds when connecting to an Artifactory/JCR Docker registry
2. **Secondary Goals**:
   - Validate registry configuration persistence
   - Verify authentication methods (Basic auth, API tokens)
   - Confirm registry browsing capabilities
   - Test registry removal

## Prerequisites

### Infrastructure Setup

#### 1. JFrog Container Registry (JCR)

JCR must be running with a configured Docker repository:

```bash
cd jfrog
docker compose up -d
```

Wait for JCR to be healthy (~30-60 seconds):
```bash
curl http://localhost:8082/artifactory/api/system/ping
# Expected: OK
```

#### 2. Complete JCR Setup

Using automated setup (recommended):
```bash
# Windows
.\start-jcr.ps1 -Password "TestE2EPassword!"

# Linux/Mac
./start-jcr.sh "TestE2EPassword!"
```

Or manually:
1. Open http://localhost:8081
2. Login: `admin` / `password`
3. Complete setup wizard, set password
4. Create Docker repository:
   - Administration > Repositories > Add Repository > Docker
   - Type: Local
   - Key: `docker-local`
   - Docker API Version: V2

#### 3. Test Credentials

After setup, the following credentials should work:
- **Username**: `admin`
- **Password**: `TestE2EPassword!` (or the password set during setup)
- **Registry URL**: `http://localhost:8081/artifactory/api/docker/docker-local`

Verify credentials work:
```bash
curl -u admin:TestE2EPassword! \
  http://localhost:8081/artifactory/api/docker/docker-local/v2/
# Expected: HTTP 200 OK
```

## Test Scenarios

### Scenario 1: Add Artifactory Registry with Basic Authentication

**Test**: `adds artifactory registry with basic auth and tests connection`

**Steps**:
1. Navigate to Docker Swarm registries view
2. Click "Add Registry" button
3. Configure Artifactory registry:
   - **Type**: `Artifactory`
   - **Name**: `KDB E2E Artifactory`
   - **URL**: `http://localhost:8081/artifactory/api/docker/docker-local`
   - **Auth Method**: `Basic`
   - **Username**: `admin`
   - **Password**: `TestE2EPassword!`
   - **Allow Insecure HTTP**: `true` (checked)
   - **Timeout**: `30` seconds
4. Click "Test Connection"
5. Verify success notification appears: "Registry connection OK"
6. Click "Save"
7. Verify success notification: "Saved registry KDB E2E Artifactory"
8. Verify registry card appears in the list

**Expected Results**:
- ✅ Test Connection succeeds
- ✅ Registry is saved successfully
- ✅ Registry card is visible with correct name and URL
- ✅ Authentication icon shows "Basic" method
- ✅ No error notifications appear

**Assertions**:
```javascript
await notifications.expectSuccessContains('Registry connection OK');
await notifications.expectSuccessContains('Saved registry KDB E2E Artifactory');
await expect(registryCard).toBeVisible();
await expect(registryCard.getByText('http://localhost:8081/artifactory/api/docker/docker-local')).toBeVisible();
```

---

### Scenario 2: Test Connection with Invalid Credentials

**Test**: `fails test connection with invalid credentials`

**Steps**:
1. Navigate to Docker Swarm registries view
2. Click "Add Registry" button
3. Configure Artifactory registry with wrong password:
   - **Type**: `Artifactory`
   - **Name**: `KDB E2E Bad Auth`
   - **URL**: `http://localhost:8081/artifactory/api/docker/docker-local`
   - **Auth Method**: `Basic`
   - **Username**: `admin`
   - **Password**: `WrongPassword123`
   - **Allow Insecure HTTP**: `true`
4. Click "Test Connection"
5. Verify error notification appears: "Registry connection failed"
6. Dismiss error notification
7. Do not save the registry

**Expected Results**:
- ✅ Test Connection fails appropriately
- ✅ Error notification contains authentication failure message
- ✅ Registry is not saved (no card appears)

**Assertions**:
```javascript
await notifications.expectErrorContains('Registry connection failed');
await notifications.expectErrorContains(/401|unauthorized|authentication/i);
```

---

### Scenario 3: Browse Artifactory Registry

**Test**: `browses artifactory registry and lists repositories`

**Steps**:
1. Ensure registry from Scenario 1 is saved
2. Locate the registry card for "KDB E2E Artifactory"
3. Click "Browse" button on the registry card
4. Wait for registry browser to open
5. Verify catalog loads (may be empty initially)
6. Push a test image to the registry:
   ```bash
   docker login localhost:8081
   docker tag alpine:latest localhost:8081/docker-local/alpine:e2e-test
   docker push localhost:8081/docker-local/alpine:e2e-test
   ```
7. Refresh the registry browser
8. Verify `alpine` repository appears
9. Click on the repository to view tags
10. Verify `e2e-test` tag is listed

**Expected Results**:
- ✅ Registry browser opens without errors
- ✅ After pushing image, repository appears in catalog
- ✅ Tag is visible when browsing repository
- ✅ No connection errors occur

**Assertions**:
```javascript
await expect(page.locator('.registry-browser')).toBeVisible();
await expect(page.locator('.repository-item', { hasText: 'alpine' })).toBeVisible();
await expect(page.locator('.tag-item', { hasText: 'e2e-test' })).toBeVisible();
```

---

### Scenario 4: Test with API Token Authentication

**Test**: `connects to artifactory using api token`

**Prerequisites**:
Generate an API token for the admin user:
```bash
curl -u admin:TestE2EPassword! -X POST \
  http://localhost:8081/artifactory/api/security/apiKey
# Response: Your API key (e.g., "AKCp8...")
```

**Steps**:
1. Navigate to Docker Swarm registries view
2. Click "Add Registry" button
3. Configure Artifactory registry with API token:
   - **Type**: `Artifactory`
   - **Name**: `KDB E2E Artifactory Token`
   - **URL**: `http://localhost:8081/artifactory/api/docker/docker-local`
   - **Auth Method**: `Token`
   - **Token**: `<API_KEY_FROM_PREREQUISITES>`
   - **Allow Insecure HTTP**: `true`
4. Click "Test Connection"
5. Verify success notification: "Registry connection OK"
6. Click "Save"

**Expected Results**:
- ✅ Test Connection succeeds with API token
- ✅ Registry is saved successfully
- ✅ Token authentication works same as Basic auth

**Note**: This test may need to be marked as optional/manual if API token generation cannot be automated in the test setup phase.

---

### Scenario 5: Remove Artifactory Registry

**Test**: `removes artifactory registry successfully`

**Steps**:
1. Locate the registry card for "KDB E2E Artifactory"
2. Click "Remove" button
3. Accept confirmation dialog
4. Verify success notification: "Removed registry KDB E2E Artifactory"
5. Verify registry card disappears from the list

**Expected Results**:
- ✅ Confirmation dialog appears
- ✅ Registry is removed successfully
- ✅ Registry card is no longer visible
- ✅ Success notification appears

**Assertions**:
```javascript
page.once('dialog', async (dialog) => {
  expect(dialog.type()).toBe('confirm');
  await dialog.accept();
});

await registryCard.getByRole('button', { name: /^Remove$/i }).click();
await notifications.expectSuccessContains('Removed registry KDB E2E Artifactory');
await expect(registryCard).toBeHidden();
```

---

## Test Implementation

### File Structure

```
e2e/
├── tests/
│   └── swarm/
│       ├── 60-registry-config.spec.ts          # Existing generic registry test
│       └── 61-artifactory-registry.spec.ts     # New Artifactory-specific test
├── src/
│   ├── support/
│   │   ├── artifactory-bootstrap.ts            # Artifactory setup helpers
│   │   └── swarm-bootstrap.ts                  # Existing Swarm helpers
│   └── pages/
│       ├── RegistryPage.ts                     # Page object for registry operations
│       └── SwarmSidebarPage.ts                 # Existing Swarm navigation
└── artifactory-e2e.md                          # This document
```

### Test File Template

```typescript
// e2e/tests/swarm/61-artifactory-registry.spec.ts
import { test, expect } from '../../src/fixtures.js';
import { SwarmSidebarPage } from '../../src/pages/SwarmSidebarPage.js';
import { Notifications } from '../../src/pages/Notifications.js';
import { bootstrapSwarm } from '../../src/support/swarm-bootstrap.js';
import { ensureArtifactory, cleanupArtifactoryRegistry } from '../../src/support/artifactory-bootstrap.js';

test.describe('Artifactory Registry Integration', () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(180_000);
    await page.goto('/');
    await bootstrapSwarm({ page, skipIfConnected: true, ensureSeedService: false });

    // Ensure Artifactory is running and configured
    await ensureArtifactory();
  });

  test.afterEach(async () => {
    // Clean up test registries
    await cleanupArtifactoryRegistry();
  });

  test('adds artifactory registry with basic auth and tests connection', async ({ page }) => {
    const sidebar = new SwarmSidebarPage(page);
    const notifications = new Notifications(page);

    await sidebar.goToSection('swarm-registries');
    await expect(page.locator('[data-testid="swarm-registries-table"]')).toBeVisible();

    await page.locator('#swarm-registries-add-btn').click();

    // Configure Artifactory
    await page.locator('#registry-type').selectOption({ value: 'artifactory' });
    await page.locator('#registry-name').fill('KDB E2E Artifactory');
    await page.locator('#registry-url').fill('http://localhost:8081/artifactory/api/docker/docker-local');
    await page.locator('#registry-auth-method').selectOption({ value: 'basic' });
    await page.locator('#registry-username').fill('admin');
    await page.locator('#registry-password').fill('TestE2EPassword!');
    await page.locator('#registry-allow-insecure-http').check();

    // Test Connection - This is the PRIMARY TEST OBJECTIVE
    await page.getByRole('button', { name: /^Test Connection$/i }).click();
    await notifications.expectSuccessContains('Registry connection OK', { timeoutMs: 30_000 });

    // Save registry
    await page.getByRole('button', { name: /^Save$/i }).click();
    await notifications.expectSuccessContains('Saved registry KDB E2E Artifactory');

    // Verify registry card appears
    const card = page.locator('.registry-card').filter({ hasText: 'KDB E2E Artifactory' });
    await expect(card).toBeVisible({ timeout: 30_000 });
    await expect(card.getByText(/localhost:8081.*docker-local/)).toBeVisible();
  });

  test('fails test connection with invalid credentials', async ({ page }) => {
    const sidebar = new SwarmSidebarPage(page);
    const notifications = new Notifications(page);

    await sidebar.goToSection('swarm-registries');
    await page.locator('#swarm-registries-add-btn').click();

    await page.locator('#registry-type').selectOption({ value: 'artifactory' });
    await page.locator('#registry-name').fill('KDB E2E Bad Auth');
    await page.locator('#registry-url').fill('http://localhost:8081/artifactory/api/docker/docker-local');
    await page.locator('#registry-auth-method').selectOption({ value: 'basic' });
    await page.locator('#registry-username').fill('admin');
    await page.locator('#registry-password').fill('WrongPassword123');
    await page.locator('#registry-allow-insecure-http').check();

    await page.getByRole('button', { name: /^Test Connection$/i }).click();
    await notifications.expectErrorContains(/registry connection failed/i, { timeoutMs: 30_000 });
    await notifications.expectErrorContains(/401|unauthorized|authentication/i);
  });
});
```

---

## Helper Functions

### Artifactory Bootstrap Helper

```typescript
// e2e/src/support/artifactory-bootstrap.ts

/**
 * Ensures Artifactory/JCR is running and properly configured.
 * Checks health and verifies Docker repository exists.
 */
export async function ensureArtifactory(): Promise<void> {
  const healthUrl = 'http://localhost:8082/artifactory/api/system/ping';
  const registryUrl = 'http://localhost:8081/artifactory/api/docker/docker-local/v2/';

  // Check if Artifactory is running
  try {
    const healthResponse = await fetch(healthUrl);
    if (!healthResponse.ok) {
      throw new Error('Artifactory health check failed');
    }
  } catch (error) {
    throw new Error(
      'Artifactory is not running. Start it with: cd jfrog && ./start-jcr.sh TestE2EPassword!'
    );
  }

  // Verify Docker repository is configured
  try {
    const auth = Buffer.from('admin:TestE2EPassword!').toString('base64');
    const repoResponse = await fetch(registryUrl, {
      headers: { Authorization: `Basic ${auth}` }
    });

    if (!repoResponse.ok) {
      throw new Error('Docker repository not accessible');
    }
  } catch (error) {
    throw new Error(
      'Docker repository not configured. Run: cd jfrog && ./bootstrap-jcr.sh TestE2EPassword!'
    );
  }
}

/**
 * Cleans up test registries created during E2E tests.
 */
export async function cleanupArtifactoryRegistry(): Promise<void> {
  // Note: Registry cleanup happens in the app state, not in Artifactory itself
  // This could call the app's RemoveRegistry API if needed
}

/**
 * Pushes a test image to Artifactory for testing registry browsing.
 */
export async function pushTestImageToArtifactory(): Promise<void> {
  const { execSync } = require('child_process');

  try {
    // Login to registry
    execSync('docker login localhost:8081 -u admin -p TestE2EPassword!', { stdio: 'pipe' });

    // Pull Alpine image
    execSync('docker pull alpine:latest', { stdio: 'pipe' });

    // Tag and push
    execSync('docker tag alpine:latest localhost:8081/docker-local/alpine:e2e-test', { stdio: 'pipe' });
    execSync('docker push localhost:8081/docker-local/alpine:e2e-test', { stdio: 'pipe' });
  } catch (error) {
    console.error('Failed to push test image to Artifactory:', error);
    throw error;
  }
}
```

---

## Running the Tests

### Prerequisites Check

Before running E2E tests, verify prerequisites:

```bash
# 1. Check JCR is running
curl http://localhost:8082/artifactory/api/system/ping
# Expected: OK

# 2. Check Docker repository is accessible
curl -u admin:TestE2EPassword! \
  http://localhost:8081/artifactory/api/docker/docker-local/v2/
# Expected: {} or HTTP 200

# 3. Check credentials work
docker login localhost:8081 -u admin -p TestE2EPassword!
# Expected: Login Succeeded
```

### Run Tests

```bash
# Run all Swarm registry tests
cd e2e
npx playwright test tests/swarm/60-registry-config.spec.ts
npx playwright test tests/swarm/61-artifactory-registry.spec.ts

# Run only Artifactory tests
npx playwright test tests/swarm/61-artifactory-registry.spec.ts

# Run with headed browser for debugging
npx playwright test tests/swarm/61-artifactory-registry.spec.ts --headed

# Run specific test
npx playwright test tests/swarm/61-artifactory-registry.spec.ts -g "adds artifactory registry"
```

### CI/CD Integration

For automated testing in CI/CD pipelines:

```yaml
# .github/workflows/e2e-artifactory.yml
name: E2E Artifactory Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup JFrog Container Registry
        run: |
          cd jfrog
          ./start-jcr.sh "TestE2EPassword!"

      - name: Wait for JCR to be ready
        run: |
          for i in {1..30}; do
            if curl -f http://localhost:8082/artifactory/api/system/ping; then
              echo "JCR is ready"
              break
            fi
            sleep 2
          done

      - name: Build KubeDevBench
        run: wails build

      - name: Run Artifactory E2E Tests
        run: |
          cd e2e
          npm install
          npx playwright install
          npx playwright test tests/swarm/61-artifactory-registry.spec.ts
```

---

## Troubleshooting

### Common Issues

#### 1. "Artifactory is not running"

**Solution**:
```bash
cd jfrog
docker compose up -d
# Wait for startup
curl http://localhost:8082/artifactory/api/system/ping
```

#### 2. "Docker repository not accessible"

**Cause**: Repository not created or setup wizard not completed.

**Solution**:
```bash
cd jfrog
./bootstrap-jcr.sh "TestE2EPassword!"
```

Or create manually via UI:
1. Open http://localhost:8081
2. Login: admin / password
3. Complete setup wizard
4. Create docker-local repository

#### 3. "401 Unauthorized" during tests

**Cause**: Incorrect password or password changed.

**Solution**:
- Verify password: `curl -u admin:TestE2EPassword! http://localhost:8081/artifactory/api/system/ping`
- Reset JCR: `cd jfrog && docker compose down -v && ./start-jcr.sh "TestE2EPassword!"`

#### 4. "Test Connection" times out

**Causes**:
- JCR not running
- Wrong URL format
- Network issues

**Debug**:
```bash
# Check JCR is running
docker ps | grep jfrog-jcr

# Test registry endpoint directly
curl -v -u admin:TestE2EPassword! \
  http://localhost:8081/artifactory/api/docker/docker-local/v2/

# Check logs
cd jfrog && docker compose logs jfrog-jcr
```

#### 5. Registry browser shows no repositories

**Cause**: No images pushed yet.

**Solution**:
```bash
docker login localhost:8081 -u admin -p TestE2EPassword!
docker pull alpine:latest
docker tag alpine:latest localhost:8081/docker-local/alpine:test
docker push localhost:8081/docker-local/alpine:test
```

---

## Success Criteria

The Artifactory E2E test suite is considered successful when:

1. ✅ **Primary Objective Met**: "Test Connection" succeeds with valid Artifactory credentials
2. ✅ Registry can be added, saved, and persisted
3. ✅ Invalid credentials are properly rejected with appropriate error messages
4. ✅ Registry browsing works (catalog, tags)
5. ✅ Registry can be removed cleanly
6. ✅ All tests pass consistently (>95% success rate)
7. ✅ Tests run in under 3 minutes total
8. ✅ No flaky tests (intermittent failures)

---

## Future Enhancements

Potential additions to the test suite:

1. **Token Authentication Testing**: Automated generation and testing of API tokens
2. **Multi-Repository Testing**: Test with multiple Docker repositories
3. **Permission Testing**: Test with users having limited permissions
4. **TLS/HTTPS Testing**: Test with HTTPS-enabled Artifactory
5. **Proxy Configuration**: Test Artifactory access through proxy
6. **Large Catalog Testing**: Test with 100+ repositories
7. **Concurrent Operations**: Test multiple simultaneous registry operations
8. **Error Recovery**: Test connection failures and recovery mechanisms

---

## Related Documentation

- [JFrog Container Registry Setup](../jfrog/README.md)
- [Quick Reference](../jfrog/QUICK-REFERENCE.md)
- [Authentication Testing Guide](../jfrog/AUTHENTICATION-TESTING.md)
- [Existing Registry Tests](tests/swarm/60-registry-config.spec.ts)
- [Swarm E2E Bootstrap](src/support/swarm-bootstrap.ts)

---

## Appendix: Manual Test Checklist

For manual testing without automated scripts:

- [ ] JCR is running: `docker compose ps` shows `jfrog-jcr` as healthy
- [ ] Can access UI: http://localhost:8081 loads
- [ ] Can ping API: `curl http://localhost:8082/artifactory/api/system/ping` returns OK
- [ ] docker-local repo exists: visible in Administration > Repositories
- [ ] Credentials work: `curl -u admin:TestE2EPassword! http://localhost:8081/artifactory/api/docker/docker-local/v2/` returns 200
- [ ] Docker login works: `docker login localhost:8081` succeeds
- [ ] Can push image: `docker push localhost:8081/docker-local/alpine:test` succeeds
- [ ] Registry shows in app: Navigate to Swarm > Registries
- [ ] Test Connection succeeds: Click Test Connection, see success notification
- [ ] Registry can be saved: Click Save, registry card appears
- [ ] Can browse registry: Click Browse, see repository list
- [ ] Can remove registry: Click Remove, confirm, registry disappears

---

**Document Version**: 1.0
**Last Updated**: 2026-01-09
**Author**: KubeDevBench E2E Testing Team
**Review Status**: Draft - Pending Implementation
