# KubeDevBench

KubeDevBench is a desktop Kubernetes client built with a Go backend (Wails) and a React frontend. It focuses on fast cluster connection setup and consistent “table + bottom panel” workflows for common Kubernetes resources.

## Stack
- Frontend: React + Vite
- Backend: Go
- Desktop framework: Wails (https://wails.io/)

## Key features (current)
- Connection Wizard for discovering/selecting kubeconfigs, plus a first-run flow to paste kubeconfig YAML.
- Context and multi-namespace selection.
- Resource views with consistent UX: filterable table, clickable rows, bottom-panel details, and create via manifest overlay.
- Resource navigation for: Pods, Deployments, Jobs, CronJobs, DaemonSets, StatefulSets, ReplicaSets, ConfigMaps, Secrets, Ingresses, PV/PVC, Helm Releases.

## Development

Prereqs:
- Go toolchain
- Wails CLI v2
- Node 20+

Run the app (dev mode):

```bash
wails dev
```

Build a production app:

```bash
wails build
```

Frontend-only dev server:

```bash
cd frontend && npm install && npm run dev
```

## Tests

Frontend unit tests (Vitest):

```bash
cd frontend && npm test
```

E2E tests (Playwright + KinD):

See E2E.MD for full details.
