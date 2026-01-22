# KubeDevBench

KubeDevBench is a desktop Kubernetes and Docker Swarm client built with a Go backend (Wails) and a React frontend. It focuses on fast cluster connection setup and consistent "table + bottom panel" workflows for common resources.

## Stack
- Frontend: React + Vite
- Backend: Go
- Desktop framework: Wails (https://wails.io/)

## Key features (current)

### Kubernetes
- Connection Wizard for discovering/selecting kubeconfigs, plus a first-run flow to paste kubeconfig YAML.
- Context and multi-namespace selection.
- Resource views with consistent UX: filterable table, clickable rows, bottom-panel details, and create via manifest overlay.
- Resource navigation for: Pods, Deployments, Jobs, CronJobs, DaemonSets, StatefulSets, ReplicaSets, ConfigMaps, Secrets, Ingresses, PV/PVC, Helm Releases.
- Holmes AI: context-aware analysis tabs for workloads (Pods, Deployments, StatefulSets, DaemonSets) and Services, plus a conversation panel with history, export, and markdown rendering.

### Docker Swarm
- Docker Swarm Connection Wizard for local socket, TCP, and TLS connections.
- Auto-detection of platform-specific Docker socket paths (Windows npipe, Unix socket).
- Swarm resource views: Services, Tasks, Nodes, Networks, Configs, Secrets, Stacks, Volumes.
- Service management: scale replicas, restart, view logs.
- Node management: drain, pause, activate, remove nodes.
- Stack deployment support with service listing.

## Development

Prereqs:
- Go toolchain
- Wails CLI v2
- Node 20+
- Docker (for Swarm features)

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
