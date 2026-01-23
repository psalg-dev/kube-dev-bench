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
- Holmes log analysis: “Explain Logs” button in the pod log viewer to summarize errors and remediation ideas.

### Docker Swarm
- Docker Swarm Connection Wizard for local socket, TCP, and TLS connections.
- Auto-detection of platform-specific Docker socket paths (Windows npipe, Unix socket).
- Swarm resource views: Services, Tasks, Nodes, Networks, Configs, Secrets, Stacks, Volumes.
- Service management: scale replicas, restart, view logs.
- Node management: drain, pause, activate, remove nodes.
- Stack deployment support with service listing.
- Holmes Swarm analysis: Holmes tab in Services and Tasks bottom panels for AI-guided diagnostics.

## Holmes Quick Guide

### Explain Pod Logs
1. Open Pods and select a pod.
2. Switch to the Logs tab.
3. Click Explain Logs to run Holmes analysis on recent log lines.

### Analyze Swarm Services and Tasks
1. Connect to Docker Swarm.
2. Open Services or Tasks, click a row to open the bottom panel.
3. Select the Holmes tab and click Analyze with Holmes.

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
