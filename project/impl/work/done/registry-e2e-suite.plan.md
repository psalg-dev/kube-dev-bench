# E2E Registry Suite Refactor Plan

**Status:** Done (100%)
**Created:** 2026-01-28
**Updated:** 2026-02-06

## Goal
Separate Docker registry integration tests (Artifactory/JFrog and Docker Registry v2) into their own Playwright suite so the default E2E run excludes registry tests and avoids bootstrapping registry infrastructure on every run.

## Current State (Verified)

The refactor is complete. All infrastructure is in place and working in CI:

- **Dedicated config**: `e2e/playwright.registry.config.ts` with `testMatch: ['registry/**/*.spec.ts']`
- **Isolated setup**: `e2e/src/support/global-setup-registry.ts` sets `E2E_REGISTRY_SUITE=1` and calls `ensureRegistry()`
- **Bootstrap utilities**: `e2e/src/support/registry-bootstrap.ts` with `RegistryConfig`, health checks, auth validation
- **Test exclusion**: Main `playwright.config.ts` has `testIgnore: ['registry/**']`
- **Test files moved**: `e2e/tests/registry/10-docker-registry.spec.ts` and `e2e/tests/registry/61-artifactory-registry.spec.ts`
- **npm script**: `"test:registry": "node ./scripts/run-playwright.mjs test -c playwright.registry.config.ts"` in `e2e/package.json` ✅
- **CI workflow**: `.github/workflows/registry-e2e.yml` exists (manual trigger via `workflow_dispatch`) ✅
- **Main CI**: `build.yml` has 5-shard E2E matrix — shards 1-3 run standard tests, `e2e-holmes-deploy` runs Holmes tests, `e2e-registry` runs registry tests with `E2E_REGISTRY_SUITE=1` and `E2E_SKIP_KIND=1` ✅
- **JFrog conditional**: `global-setup.ts` only runs JFrog bootstrap when `E2E_REGISTRY_SUITE=1` ✅

## Documentation

### Local runs
- Default suite (no registry): `cd e2e && npm test`
- Registry suite only: `cd e2e && npm run test:registry`

### Environment variables
- `E2E_REGISTRY_SUITE=1` — enables registry bootstrap and registry-only test run
- `E2E_SKIP_REGISTRY=1` — skips registry bootstrap (reuse a running instance)
- `E2E_SKIP_JFROG=1` — skips JFrog/Artifactory bootstrap specifically
- `E2E_ARTIFACTORY_*` — override Artifactory endpoints and credentials for custom environments

### CI usage
- Trigger the registry suite manually via `.github/workflows/registry-e2e.yml` (`workflow_dispatch`)
- Main CI includes `e2e-registry` in the matrix with `E2E_REGISTRY_SUITE=1` and `E2E_SKIP_KIND=1`

## Implementation Checklist

1. [x] Create `playwright.registry.config.ts` with registry-only `testMatch`. ✅ IMPLEMENTED
   - Location: `e2e/playwright.registry.config.ts`
   - Uses `testMatch: ['registry/**/*.spec.ts']`
   - Configured with platform-specific worker counts
   - 120-second timeout, 2-second expect timeout

2. [x] Extract JFrog/Artifactory bootstrap logic into registry-specific global setup. ✅ IMPLEMENTED
   - Created `e2e/src/support/global-setup-registry.ts`
   - Created `e2e/src/support/registry-bootstrap.ts` with `RegistryConfig` interface, `ensureRegistry()`, `startRegistryContainer()`
   - JFrog bootstrap in `global-setup.ts` gated by `E2E_REGISTRY_SUITE=1`

3. [x] Move registry tests into `e2e/tests/registry/`. ✅ IMPLEMENTED
   - `e2e/tests/registry/10-docker-registry.spec.ts` — Docker Registry v2 tests
   - `e2e/tests/registry/61-artifactory-registry.spec.ts` — Artifactory tests
   - `e2e/tests/registry/61-artifactory-registry.spec.DEPRECATED.md` — Deprecated marker

4. [x] Update `e2e/package.json` scripts. ✅ VERIFIED
   - `"test:registry": "node ./scripts/run-playwright.mjs test -c playwright.registry.config.ts"` exists

5. [x] Update CI workflow to default to non-registry suite, add optional registry job. ✅ VERIFIED
   - Main CI (`build.yml`): Standard shards exclude registry via `testIgnore: ['registry/**']`
   - Dedicated `e2e-registry` shard in build.yml matrix with `E2E_REGISTRY_SUITE=1`
   - Standalone `.github/workflows/registry-e2e.yml` for manual runs (workflow_dispatch)

6. [x] Update docs: registry suite usage and environment variables. ✅ COMPLETED

## Acceptance Criteria

- [x] Running `npm test` no longer starts JFrog or Artifactory bootstrap ✅
- [x] Running `npm run test:registry` boots registry and executes registry tests only ✅
- [x] Registry tests remain isolated from the standard E2E suite ✅
- [x] Logs and failure diagnostics still get captured for registry runs ✅
- [x] Documentation is written and discoverable ✅

## Remaining Work

None.