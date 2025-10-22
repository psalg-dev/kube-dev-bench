---
applyTo: '**'
description: 'Repository-specific guidance for AI code agents working on kube-dev-bench'
---

This project is a desktop Kubernetes client built with Go backend + Wails and a React frontend (Vite).
Keep guidance short and concrete so an AI agent can be productive immediately.

- Big picture
  - Frontend: React app lives in `frontend/`. Vite dev server is used during development (`npm run dev`).
  - Backend: Go code under `pkg/` integrates with Kubernetes APIs and exposes functions to the frontend via Wails (`wailsjs/go/main/App`).
  - Orchestration: Wails runs the Go backend and the Vite dev server during `wails dev`. The frontend is also served independently via Vite for tests.

- Key developer flows (commands)
  - Start development app (dev mode): run `wails dev` from repository root. This starts the Go backend and the Vite dev server.
  - Build production app: `wails build`.
  - Frontend dev-only: `cd frontend && npm install && npm run dev`.
  - Run unit tests (frontend): `cd frontend && npm test` (uses Vitest).

- Project-specific conventions
  - App UI elements are referenced by DOM ids in `frontend/src/layout/AppLayout.jsx` (examples: `#show-wizard-btn`, `#sidebar`, `#maincontent`). Use these stable ids in tests and automation.
  - Connection handling is centralized in `frontend/src/state/ClusterStateContext.jsx`. UI opens `ConnectionWizard` (`frontend/src/layout/connection/ConnectionWizard.jsx`) when no connection exists or when user clicks the gear button (`#show-wizard-btn`).
  - Frontend <> backend RPCs: frontend calls Go functions generated under `frontend/wailsjs/go/main/App` (e.g. `SavePrimaryKubeConfig`, `GetKubeConfigs`, `GetConnectionStatus`). Tests should trigger these via the UI, not by directly calling Go functions.

- Integration points and patterns
  - Kube configs are persisted via backend RPCs: `SavePrimaryKubeConfig` and `SetKubeConfigPath` are used to make a kubeconfig the application's primary file. The connection wizard accepts pasted kubeconfig YAML (`#primaryConfigContent`).
  - The `kind/` directory contains a Docker-based KinD manager (`kind/docker-compose.yml`, `kind/manager.sh`) which writes the host kubeconfig to `kind/output/kubeconfig` and `kubeconfig.internal`.
  - Tests and CI should prefer the KinD manager container to create kubeconfigs for deterministic clusters.

- Testing and e2e guidance
  - End-to-end tests live in `e2e/` (Playwright). They start the Kind manager (via `docker compose -f kind/docker-compose.yml up -d`), wait for `kind/output/kubeconfig`, then start `wails dev` and run browser flows against the Vite dev server.
  - Use stable selectors: `#show-wizard-btn` to open the connection wizard, `#primaryConfigContent` textarea to paste kubeconfig, and `button:has-text("Save & Continue")` to save.

- When editing code
  - Preserve existing id-based selectors and avoid refactoring them unless you update all usages (tests, DOM queries in `main-content.js` and `AppLayout.jsx`).
  - If you modify RPC names or signatures in Go (`pkg/`), update generated Wails bindings under `frontend/wailsjs/go/main/App` by rebuilding Wails or regenerating bindings.

- Files to reference when working here
  - Frontend UI and tests: `frontend/src/`, `frontend/package.json`, `frontend/test.setup.js`
  - Connection logic: `frontend/src/layout/connection/ConnectionWizard.jsx`, `frontend/src/state/ClusterStateContext.jsx`
  - KinD infra: `kind/docker-compose.yml`, `kind/manager.sh`, `kind/output/kubeconfig`
  - Wails config: `wails.json`

If anything above is unclear or you'd like me to include more examples (e.g. a Playwright test template), tell me which area to expand and I'll iterate.
---
---
applyTo: '**'
description: 'Repository-specific guidance for AI code agents working on kube-dev-bench'
---

This project is a desktop Kubernetes client built with Go backend + Wails and a React frontend (Vite).
Keep guidance short and concrete so an AI agent can be productive immediately.

- Big picture
  - Frontend: React app lives in `frontend/`. Vite dev server is used during development (`npm run dev`).
  - Backend: Go code under `pkg/` integrates with Kubernetes APIs and exposes functions to the frontend via Wails (`wailsjs/go/main/App`).
  - Orchestration: Wails runs the Go backend and the Vite dev server during `wails dev`. The frontend is also served independently via Vite for tests.

- Key developer flows (commands)
  - Start development app (dev mode): run `wails dev` from repository root. This starts the Go backend and the Vite dev server.
  - Build production app: `wails build`.
  - Frontend dev-only: `cd frontend && npm install && npm run dev`.
  - Run unit tests (frontend): `cd frontend && npm test` (uses Vitest).

- Project-specific conventions
  - App UI elements are referenced by DOM ids in `frontend/src/layout/AppLayout.jsx` (examples: <code>#show-wizard-btn</code>, <code>#sidebar</code>, <code>#maincontent</code>). Use these stable ids in tests and automation.
  - Connection handling is centralized in `frontend/src/state/ClusterStateContext.jsx`. UI opens `ConnectionWizard` (`frontend/src/layout/connection/ConnectionWizard.jsx`) when no connection exists or when user clicks the gear button (<code>#show-wizard-btn</code>).
  - Frontend &lt;&gt; backend RPCs: frontend calls Go functions generated under `frontend/wailsjs/go/main/App` (e.g. <code>SavePrimaryKubeConfig</code>, <code>GetKubeConfigs</code>, <code>GetConnectionStatus</code>). Tests should trigger these via the UI, not by directly calling Go functions.

- Integration points and patterns
  - Kube configs are persisted via backend RPCs: <code>SavePrimaryKubeConfig</code> and <code>SetKubeConfigPath</code> are used to make a kubeconfig the application's primary file. The connection wizard accepts pasted kubeconfig YAML (<code>#primaryConfigContent</code>).
  - The `kind/` directory contains a Docker-based KinD manager (`kind/docker-compose.yml`, `kind/manager.sh`) which writes the host kubeconfig to `kind/output/kubeconfig` and `kubeconfig.internal`.
  - Tests and CI should prefer the KinD manager container to create kubeconfigs for deterministic clusters.

- Testing and e2e guidance
  - End-to-end tests live in `e2e/` (Playwright). They start the Kind manager (via `docker compose -f kind/docker-compose.yml up -d`), wait for `kind/output/kubeconfig`, then start `wails dev` and run browser flows against the Vite dev server.
  - Use stable selectors: <code>#show-wizard-btn</code> to open the connection wizard, <code>#primaryConfigContent</code> textarea to paste kubeconfig, and <code>button:has-text("Save & Continue")</code> to save.

- When editing code
  - Preserve existing id-based selectors and avoid refactoring them unless you update all usages (tests, DOM queries in `main-content.js` and `AppLayout.jsx`).
  - If you modify RPC names or signatures in Go (`pkg/`), update generated Wails bindings under `frontend/wailsjs/go/main/App` by rebuilding Wails or regenerating bindings.

- Files to reference when working here
  - Frontend UI and tests: `frontend/src/`, `frontend/package.json`, `frontend/test.setup.js`
  - Connection logic: `frontend/src/layout/connection/ConnectionWizard.jsx`, `frontend/src/state/ClusterStateContext.jsx`
  - KinD infra: `kind/docker-compose.yml`, `kind/manager.sh`, `kind/output/kubeconfig`
  - Wails config: `wails.json`

If anything above is unclear or you'd like me to include more examples (e.g. a Playwright test template), tell me which area to expand and I'll iterate.
