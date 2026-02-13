# KubeDevBench

A modern desktop client for managing Kubernetes clusters and Docker Swarm environments. Built with Go (Wails) and React, KubeDevBench provides a unified interface for container orchestration with AI-powered diagnostics.

[![Build](https://github.com/psalg-dev/kube-dev-bench/actions/workflows/build.yml/badge.svg)](https://github.com/psalg-dev/kube-dev-bench/actions/workflows/build.yml)
[![Release](https://img.shields.io/github/v/release/psalg-dev/kube-dev-bench?include_prereleases)](https://github.com/psalg-dev/kube-dev-bench/releases)
[![Frontend Coverage](https://codecov.io/gh/psalg-dev/kube-dev-bench/graph/badge.svg?flag=frontend)](https://codecov.io/gh/psalg-dev/kube-dev-bench)
[![Backend Coverage](https://codecov.io/gh/psalg-dev/kube-dev-bench/graph/badge.svg?flag=backend)](https://codecov.io/gh/psalg-dev/kube-dev-bench)
[![License](https://img.shields.io/github/license/psalg-dev/kube-dev-bench)](LICENSE)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-blue)
[![Go](https://img.shields.io/badge/Go-1.21+-00ADD8?logo=go&logoColor=white)](https://go.dev/)
[![React](https://img.shields.io/badge/React-18+-61DAFB?logo=react&logoColor=black)](https://react.dev/)

## ✨ Highlights

- **Unified Container Management** — Manage both Kubernetes and Docker Swarm from a single application
- **AI-Powered Diagnostics** — Integrates with CNCF's [HolmesGPT](https://holmesgpt.dev/) for intelligent troubleshooting
- **Real-Time Monitoring** — Continuous health scanning with Prometheus alert integration
- **Cross-Platform** — Available for Windows, macOS, and Linux

## Stack

- **Frontend:** React + Vite
- **Backend:** Go
- **Desktop Framework:** [Wails](https://wails.io/)

---

## 🚀 Key Features

### Kubernetes Management

| Category | Features |
|----------|----------|
| **Workloads** | Pods, Deployments, StatefulSets, DaemonSets, ReplicaSets, Jobs, CronJobs |
| **Config & Storage** | ConfigMaps, Secrets, Persistent Volumes, PVCs with file browser |
| **Networking** | Services, Ingresses with TLS certificate expiry tracking |
| **Helm** | Release management, chart installation, rollback, repository configuration |

**Pod Features:**
- Container logs with streaming and tail configuration
- Interactive terminal access (exec/shell)
- File system browser and content viewer
- Port forwarding (single and custom ports)

**Deployment Features:**
- Scale replicas up/down
- Restart and rollback deployments
- View rollout history

### Docker Swarm Management

| Category | Features |
|----------|----------|
| **Services** | Create, scale, restart, remove; real-time replica monitoring; image update checking |
| **Nodes** | Drain, pause, activate; label management; task distribution view |
| **Stacks** | Deploy from Compose files; resource tracking; rollback support |
| **Storage** | Volume browser, upload/download, backup/restore, cloning |

### 🤖 HolmesGPT Integration

AI-powered diagnostics for intelligent troubleshooting:

- **Resource Analysis** — Analyze pods, deployments, StatefulSets, DaemonSets, services, CronJobs, Jobs, Ingresses, PVCs, PVs, ConfigMaps, Secrets, Nodes, and HPAs
- **Log Analysis** — "Explain Logs" with error pattern detection and remediation suggestions
- **Swarm Diagnostics** — Service and task analysis for Docker Swarm
- **Free-form Questions** — Ask questions about your cluster state
- **Streaming Responses** — Real-time AI response rendering with markdown

### 📊 Monitoring & Alerting

- Continuous cluster health scanning
- Centralized Monitor Panel for errors and warnings
- Prometheus alert integration
- Issue dismissal with 24-hour persistence
- AI-assisted investigation with HolmesGPT

### 🔌 Connection Management

- Multiple kubeconfig file support with context switching
- Docker socket auto-detection (local, TCP, TLS)
- Proxy support (manual and system detection)
- Pinned connections for quick access

---

## 🎯 Quick Start

1. Download and install KubeDevBench for your platform
2. Launch the application
3. Click the connection button to open the Connection Wizard
4. **Kubernetes:** Select or import a kubeconfig file
5. **Docker Swarm:** Local Docker socket is auto-detected, or configure remote
6. Start managing your containers!

---

## Holmes Quick Guide

### Explain Pod Logs
1. Open Pods and select a pod
2. Switch to the Logs tab
3. Click **Explain Logs** to run Holmes analysis

### Analyze Swarm Services
1. Connect to Docker Swarm
2. Open Services or Tasks, click a row
3. Select the Holmes tab and click **Analyze with Holmes**

### Analyze Kubernetes Nodes and HPAs
1. Open **Nodes** or **HPA** in the Kubernetes sidebar
2. Click a table row to open the bottom panel
3. Select the Holmes tab and click **Analyze with Holmes**

### Holmes Troubleshooting (Nodes / HPA)
- If the Holmes tab shows no response, verify Holmes endpoint and API key in settings.
- If Node analysis is empty, confirm the selected cluster has visible node permissions.
- If HPA analysis is empty, ensure the HPA exists in the currently selected namespace.
- If streaming appears stalled, retry after reconnecting the active Kubernetes context.

---

## Development

**Prerequisites:**
- Go toolchain
- Wails CLI v2
- Node 20+
- Docker (for Swarm features)

**Run the app (dev mode):**

```bash
wails dev
```

**Build a production app:**

```bash
wails build
```

**Frontend-only dev server:**

```bash
cd frontend && npm install && npm run dev
```

---

## Tests

**Frontend unit tests (Vitest):**

```bash
cd frontend && npm test
```

**E2E tests (Playwright + KinD):**

- Standard E2E suite: `cd e2e && npm test`
- Registry E2E suite: `cd e2e && npm run test:registry`
- Documentation: [docs/registry-e2e-suite.md](docs/registry-e2e-suite.md)

---

## System Requirements

- **OS:** Windows 10+, macOS 10.15+, or Linux (Ubuntu 20.04+, Fedora 34+)
- **Memory:** 4 GB RAM minimum, 8 GB recommended
- **Disk:** 200 MB for installation
- **Network:** Access to Kubernetes API server and/or Docker daemon

---

## License

See [LICENSE](LICENSE) for details.
