# Registry E2E Suite

## Overview

Registry integration tests run in their own Playwright suite so the default E2E run stays fast and does not bootstrap registry infrastructure.

- Standard E2E run (no registry tests): uses e2e/playwright.config.ts
- Registry E2E run: uses e2e/playwright.registry.config.ts and matches registry/**/*.spec.ts

## Running Locally

### Standard E2E (no registry)

```bash
cd e2e
npm test
```

### Registry E2E Suite

```bash
cd e2e
npm run test:registry
```

## Environment Variables

### Suite Flags

- E2E_REGISTRY_SUITE=1
  - Enables registry bootstrap and registry-only tests.
  - Automatically set by e2e/src/support/global-setup-registry.ts.
- E2E_SKIP_REGISTRY=1
  - Skips Docker Registry v2 bootstrap when you already have a registry running.
- E2E_SKIP_JFROG=1
  - Skips JFrog/JCR bootstrap (used by Artifactory tests).
- E2E_SKIP_ARTIFACTORY=1
  - Skips Artifactory health checks entirely.

### Docker Registry v2 Overrides

- E2E_REGISTRY_URL (default: http://localhost:5000)
- E2E_REGISTRY_USERNAME (default: admin)
- E2E_REGISTRY_PASSWORD (default: password)
- E2E_REGISTRY_READY_TIMEOUT_MS (default: 30000)

### Artifactory / JFrog Overrides

- E2E_ARTIFACTORY_REGISTRY_BASE_URL
- E2E_ARTIFACTORY_REGISTRY_V2_URL
- E2E_ARTIFACTORY_HEALTH_URL
- E2E_ARTIFACTORY_USERNAME
- E2E_ARTIFACTORY_PASSWORD
- E2E_ARTIFACTORY_READY_TIMEOUT_MS
- E2E_ARTIFACTORY_UI_BOOTSTRAP (set to 0 to disable UI bootstrap)
- E2E_ARTIFACTORY_UI_TIMEOUT_MS
- E2E_JFROG_ADMIN_PASSWORD
- E2E_JFROG_RESET=1 (reset JFrog data before bootstrap)

## CI Usage

- Standard CI runs the default E2E suite (registry tests excluded).
- Registry tests run in the dedicated e2e-registry matrix job with:
  - E2E_REGISTRY_SUITE=1
  - E2E_SKIP_KIND=1

You can also trigger the manual workflow:
- .github/workflows/registry-e2e.yml

## Troubleshooting

- Docker Registry v2 setup scripts live in registry/ (start-registry.sh / start-registry.ps1).
- Artifactory setup scripts live in jfrog/ (start-jcr.sh / start-jcr.ps1).
- Registry tests live under e2e/tests/registry/.
