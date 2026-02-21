# KubeDevBench E2E (Playwright + KinD)

This repo’s end-to-end tests exercise KubeDevBench as a real user would:
- the real Go backend runs via `wails dev`
- the real UI is driven via Playwright (Chromium)
- a real lightweight Kubernetes cluster is used (KinD)

The goal is integration-level confidence across the full stack (UI ↔ Wails runtime ↔ Go ↔ Kubernetes API).

## Key design decisions

### Parallel-first (4 workers)
Tests run fully in parallel (`workers=4`) to keep runtime low.

To avoid cross-test interference:
- Each Playwright **worker** runs its own `wails dev` process on its own port (`34115 + workerIndex`).
- Each worker gets its own isolated “home directory” by setting `HOME` and `USERPROFILE` for the `wails dev` process.
  - This isolates `~/KubeDevBench/config.json` and `~/.kube/*` per worker.
- Each worker uses a dedicated Kubernetes namespace: `kdb-e2e-<runId>-w<workerIndex>`.
  - Namespaced resources created by tests are automatically cleaned up by deleting that namespace.

### Real cluster, no mocks
The tests retrieve a real kubeconfig from KinD and connect through the app’s `ConnectionWizard` flow (paste kubeconfig YAML).

### Page Object Model (POM)
All non-trivial UI actions are wrapped in small page objects under `e2e/src/pages/`.

### Idempotency + cleanup
- Resource names are unique per test.
- Namespaces are deleted after each worker finishes.

## Running locally

Prereqs:
- Docker
- KinD (`kind`)
- kubectl (`kubectl`)
- Go toolchain
- Wails CLI v2
- Node 20+

1) Build the frontend once (E2E uses `wails dev -assetdir frontend/dist`, not Vite):

   `cd frontend && npm ci && npm run build`

2) Install e2e dependencies and browsers:

   `cd e2e && npm ci && npx playwright install --with-deps chromium`

3) Run tests:

   `cd e2e && npx playwright test`

Registry suite (Artifactory/JFrog):

- Run only registry tests (boots JFrog by default):

   `cd e2e && npm run test:registry`

- If you already have JFrog running and want to reuse it:

   `E2E_SKIP_JFROG=1 cd e2e && npm run test:registry`

Optional knobs:
- Override workers: `PW_WORKERS=2`
- Override KinD cluster name: `KIND_CLUSTER_NAME=kdb-e2e`
- Override KinD node image: `KIND_NODE_IMAGE=kindest/node:v1.29.4`
- On Windows, E2E defaults to `kindest/node:v1.29.4` if `KIND_NODE_IMAGE` is not set.

## CI

GitHub Actions uses Linux with the required Wails deps + `xvfb` and starts KinD.
The workflow runs Playwright in parallel and uploads the Playwright report on failures.

## Coverage (best-effort)

E2E coverage for the embedded UI is *not* guaranteed.
Playwright can capture browser-level JS coverage, but because the UI is served through `wails dev` and Wails injects runtime plumbing, coverage isn’t always meaningful.

If coverage becomes a hard requirement, the most robust approach is:
- instrument the frontend bundle (Istanbul) in a special e2e build, and
- collect window-level coverage on `page.close()`.
