# E2E Registry Suite Refactor Plan

Date: January 28, 2026

## Goal
Separate Docker registry integration tests (Artifactory/JFrog) into their own Playwright suite so the default E2E run excludes registry tests and avoids bootstrapping JFrog on every run.

## Current E2E Test Landscape (Analysis)
- Core Playwright configuration lives in [e2e/playwright.config.ts](e2e/playwright.config.ts).
- Global setup in [e2e/src/support/global-setup.ts](e2e/src/support/global-setup.ts) performs heavy pre-run tasks, including:
  - KinD provisioning, Swarm fixtures, and local proxy.
  - JFrog bootstrap via `ensureJFrogJcrBootstrapped()` and Artifactory readiness checks via `ensureArtifactory()`.
- The Artifactory registry test is currently located at [e2e/tests/swarm/61-artifactory-registry.spec.ts](e2e/tests/swarm/61-artifactory-registry.spec.ts).
- `shouldAutoSkipJfrog()` only skips JFrog bootstrap when the CLI target is a specific Artifactory spec. When running `npm test` with no test target, JFrog always boots.
- JFrog bootstrap uses docker compose scripts under [jfrog/start-jcr.ps1](jfrog/start-jcr.ps1) and [jfrog/start-jcr.sh](jfrog/start-jcr.sh) with a long timeout and log capture, which is the primary runtime cost.

## Root Cause
The JFrog/Artifactory bootstrap is hardwired into global setup for all E2E runs. Default runs (`npm test`) therefore pay the registry startup cost even when registry tests are not part of the run.

## Refactor Plan (Proposed)
### 1) Split Playwright configs into two suites
Create a dedicated registry suite configuration and keep the default suite registry-free.

- Default suite (non-registry):
  - Keep [e2e/playwright.config.ts](e2e/playwright.config.ts) as the default.
  - Add `testIgnore` to exclude registry specs (for example `tests/registry/**` or the single Artifactory spec file).
  - Use a global setup that does NOT start JFrog.

- Registry suite:
  - Add a new config file, e.g. [e2e/playwright.registry.config.ts](e2e/playwright.registry.config.ts) that:
    - Uses `testMatch` for registry specs only (e.g. `tests/registry/**/*.spec.ts`).
    - Uses a registry-specific global setup that includes JFrog bootstrap.

### 2) Split global setup so JFrog bootstrap is opt-in
Move registry bootstrap into a registry-only setup entrypoint.

- Keep the existing setup logic for KinD, Swarm fixtures, proxy, and Wails dev.
- Extract the JFrog bootstrap block from [e2e/src/support/global-setup.ts](e2e/src/support/global-setup.ts) into a new file (e.g. `global-setup-registry.ts`) or guard it behind `E2E_REGISTRY_SUITE=1`.
- Registry suite config explicitly sets `E2E_REGISTRY_SUITE=1` and uses the registry global setup file.
- Default suite leaves `E2E_REGISTRY_SUITE` unset, skipping JFrog entirely.

### 3) Organize registry specs into a dedicated folder
Move or add a dedicated registry folder to keep test selection simple.

- Suggested path: `e2e/tests/registry/`.
- Move [e2e/tests/swarm/61-artifactory-registry.spec.ts](e2e/tests/swarm/61-artifactory-registry.spec.ts) into `tests/registry/`.
- Update any imports or path-based assumptions.

### 4) Add npm scripts to run each suite
Update [e2e/package.json](e2e/package.json) with distinct commands.

- `npm test`: runs the default non-registry suite.
- `npm run test:registry`: runs the registry suite.

Example:
- `test`: `node ./scripts/run-playwright.mjs test -c playwright.config.ts`
- `test:registry`: `node ./scripts/run-playwright.mjs test -c playwright.registry.config.ts`

### 5) CI workflow adjustment
- Default CI uses the non-registry suite only.
- Add an optional/manual/nightly job to run the registry suite with JFrog enabled.

### 6) Documentation and environment flags
Document the registry suite and environment overrides:
- `E2E_SKIP_JFROG=1` to reuse an already running JFrog instance.
- `E2E_ARTIFACTORY_*` overrides in [e2e/src/support/artifactory-bootstrap.ts](e2e/src/support/artifactory-bootstrap.ts) for custom endpoints and credentials.

## Acceptance Criteria
- Running `npm test` no longer starts JFrog or Artifactory bootstrap.
- Running `npm run test:registry` boots JFrog and executes registry tests only.
- Registry tests remain isolated from the standard E2E suite.
- Logs and failure diagnostics still get captured in `e2e/test-results/jfrog-logs` for registry runs.

## Risks and Mitigations
- **Risk**: global setup references JFrog assumptions for all runs.
  - **Mitigation**: isolate JFrog logic into a dedicated registry setup file.
- **Risk**: path-based filtering misses new registry tests.
  - **Mitigation**: place all registry tests under `tests/registry/` and set `testMatch` accordingly.

## Implementation Checklist
1. Create `playwright.registry.config.ts` with registry-only `testMatch`.
2. Extract JFrog/Artifactory bootstrap logic into registry-specific global setup.
3. Move registry tests into `e2e/tests/registry/`.
4. Update `e2e/package.json` scripts.
5. Update CI workflow to default to non-registry suite, add optional registry job.
6. Update docs: registry suite usage and environment variables.
