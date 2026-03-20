---
layout: default
title: MCP Integration
nav_order: 5
---

# MCP Server Integration

KubeDevBench includes a built-in [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) server that enables AI assistants like Claude, ChatGPT, and other MCP-compatible clients to interact directly with your Kubernetes clusters and Docker Swarm environments.

## Overview

The MCP server exposes 14 consolidated tools and 5 resources that give AI assistants full read access (and optional write access) to your cluster state. This allows natural language interactions like:

- "List all pods in the production namespace"
- "Describe the nginx deployment"
- "Show me the rollout history for my-app"
- "Scale the worker deployment to 3 replicas"

## Quick Start

### Enable via GUI

1. Open KubeDevBench and connect to a cluster
2. Click the **🔌 MCP** button in the sidebar header
3. Toggle **Enable MCP Server**
4. Click **Save**
5. Click **Start** to launch the server

### Enable via Config File

Edit `~/.KubeDevBench/config.json`:

```json
{
  "mcpConfig": {
    "enabled": true,
    "host": "localhost",
    "port": 3000,
    "transportMode": "http",
    "allowDestructive": false,
    "requireConfirm": true,
    "maxLogLines": 1000
  }
}
```

## Transport Modes

### Streamable HTTP (Default)

The server listens on `http://localhost:3000/mcp` using the MCP Streamable HTTP transport. This is the default mode and is suitable for browser-based and network-connected MCP clients.

```
Host: localhost (configurable)
Port: 3000 (configurable)
Endpoint: /mcp
Health check: /health
```

### stdio (Claude Desktop)

For Claude Desktop and other subprocess-based MCP clients, the server can run in stdio mode. In this mode, KubeDevBench communicates via standard input/output using the MCP stdio transport protocol.

#### Claude Desktop Configuration

Add this to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "kubedevbench": {
      "command": "C:\\Program Files\\KubeDevBench\\KubeDevBench.exe",
      "args": ["--mcp-stdio"],
      "env": {}
    }
  }
}
```

On macOS:
```json
{
  "mcpServers": {
    "kubedevbench": {
      "command": "/Applications/KubeDevBench.app/Contents/MacOS/KubeDevBench",
      "args": ["--mcp-stdio"],
      "env": {}
    }
  }
}
```

## Available Tools (14)

### Kubernetes Read Tools

| # | Tool | Description | Parameters |
|---|------|-------------|------------|
| 1 | `k8s_list` | List resources by kind | `kind` (required), `namespace`, `labelSelector`, `limit` |
| 2 | `k8s_describe` | Get detailed resource info | `kind` (required), `name` (required), `namespace` |
| 3 | `k8s_get_resource_yaml` | Get YAML manifest | `kind` (required), `name` (required), `namespace` |
| 4 | `k8s_get_pod_logs` | Retrieve pod logs | `name` (required), `namespace`, `container`, `lines`, `previous` |
| 5 | `k8s_get_events` | Get cluster events | `namespace`, `kind`, `name` |
| 6 | `k8s_get_resource_counts` | Aggregated resource counts | *(none)* |
| 7 | `k8s_top` | CPU/memory metrics | `kind` (required: `pods`\|`nodes`), `namespace` |
| 8 | `k8s_rollout` | Rollout status/history | `action` (required: `status`\|`history`), `kind` (required), `name` (required), `namespace` |

### Kubernetes Write Tools

| # | Tool | Description | Parameters |
|---|------|-------------|------------|
| 9 | `k8s_scale_deployment` | Scale deployment replicas | `name` (required), `replicas` (required), `namespace`, `confirmed` |
| 10 | `k8s_restart_deployment` | Rolling restart | `name` (required), `namespace` |

### Docker Swarm Tools

| # | Tool | Description | Parameters |
|---|------|-------------|------------|
| 11 | `swarm_list` | List Swarm resources | `kind` (required) |
| 12 | `swarm_inspect` | Inspect Swarm resource | `kind` (required), `id` (required) |
| 13 | `swarm_get_service_logs` | Service logs | `serviceId` (required), `tail` |
| 14 | `swarm_scale_service` | Scale Swarm service | `serviceId` (required), `replicas` (required), `confirmed` |

## Tool Reference

### k8s_list

List Kubernetes resources by kind with optional filtering and pagination.

**Supported kinds:**
`pods`, `deployments`, `statefulsets`, `daemonsets`, `jobs`, `cronjobs`, `configmaps`, `secrets`, `services`, `endpoints`, `ingresses`, `network_policies`, `replicasets`, `persistent_volumes`, `persistent_volume_claims`, `storage_classes`, `nodes`, `service_accounts`, `roles`, `role_bindings`, `cluster_roles`, `cluster_role_bindings`, `crds`

**Example request:**
```json
{
  "kind": "pods",
  "namespace": "production",
  "labelSelector": "app=nginx",
  "limit": 10
}
```

**Example response:**
```json
{
  "items": [...],
  "total": 25,
  "truncated": true,
  "namespace": "production"
}
```

### k8s_describe

Get detailed information about a specific resource including spec, status, and related objects.

**Supported kinds:**
`pod`, `deployment`, `service`, `ingress`, `node`, `pvc`, `pv`, `statefulset`, `daemonset`, `replicaset`, `job`, `cronjob`

**Example request:**
```json
{
  "kind": "deployment",
  "name": "nginx",
  "namespace": "default"
}
```

### k8s_get_pod_logs

Retrieve logs from a pod, supporting both current and previous container instances.

**Example request:**
```json
{
  "name": "nginx-abc123",
  "namespace": "default",
  "container": "nginx",
  "lines": 50,
  "previous": false
}
```

### k8s_top

Get CPU and memory usage metrics. Requires metrics-server in the cluster.

**Example requests:**
```json
{"kind": "pods", "namespace": "default"}
{"kind": "nodes"}
```

### k8s_rollout

Get rollout status or revision history for Deployments, StatefulSets, or DaemonSets.

**Example request:**
```json
{
  "action": "history",
  "kind": "Deployment",
  "name": "my-app",
  "namespace": "production"
}
```

### swarm_list

List Docker Swarm resources by kind.

**Supported kinds:** `services`, `tasks`, `nodes`, `stacks`, `networks`, `volumes`, `secrets`, `configs`

### swarm_inspect

Inspect a specific Docker Swarm resource.

**Supported kinds:** `service`, `task`, `node`

## Available Resources (5)

MCP resources provide contextual information that AI assistants can read on demand.

| Resource URI | Description |
|---|---|
| `resource://cluster/connection` | Current cluster connection info (context, namespace, Swarm status) |
| `resource://k8s/namespaces` | Available and selected Kubernetes namespaces |
| `resource://k8s/contexts` | Available kubeconfig contexts and active context |
| `resource://swarm/connection` | Docker Swarm connection status |
| `resource://mcp/config` | Current MCP server security configuration |

## Security Model

The MCP server implements a three-tier security model:

### Tier 1: Configuration-Level

The `allowDestructive` and `requireConfirm` settings in the MCP configuration control what operations are permitted globally.

| Setting | Default | Effect |
|---------|---------|--------|
| `allowDestructive` | `false` | Blocks all scale-to-zero operations |
| `requireConfirm` | `true` | Requires `confirmed: true` parameter for destructive ops |

### Tier 2: Tool-Level Classification

Each tool has a security classification:

| Level | Tools | Behavior |
|-------|-------|----------|
| **Safe** (read-only) | `k8s_list`, `k8s_describe`, `k8s_get_resource_yaml`, `k8s_get_pod_logs`, `k8s_get_events`, `k8s_get_resource_counts`, `k8s_top`, `k8s_rollout`, `swarm_list`, `swarm_inspect`, `swarm_get_service_logs` | Always allowed |
| **Write** | `k8s_scale_deployment`, `k8s_restart_deployment`, `swarm_scale_service` | Allowed, but scale-to-zero requires destructive permission |

### Tier 3: Runtime Checks

When a write tool is called:

1. **Scale-to-zero detection** — If `replicas: 0`, the operation is classified as destructive
2. **Destructive gate** — If `allowDestructive` is `false`, the operation is rejected
3. **Confirmation gate** — If `requireConfirm` is `true`, the `confirmed: true` parameter must be set

**Example: Protected scale-to-zero**
```json
{
  "name": "k8s_scale_deployment",
  "arguments": {
    "name": "my-app",
    "namespace": "production",
    "replicas": 0,
    "confirmed": true
  }
}
```

Without `"confirmed": true`, this returns:
```
Error: Confirmation required. Re-run with confirmed=true to confirm this operation.
```

## Configuration Reference

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `enabled` | boolean | `false` | Master on/off switch |
| `host` | string | `"localhost"` | HTTP server bind address |
| `port` | integer | `3000` | HTTP server port (1–65535) |
| `transportMode` | string | `"http"` | Transport: `"http"` or `"stdio"` |
| `allowDestructive` | boolean | `false` | Allow scale-to-zero operations |
| `requireConfirm` | boolean | `true` | Require confirmation for destructive ops |
| `maxLogLines` | integer | `1000` | Max log lines returned (10–50000) |

## Architecture

```
┌─────────────────────────────────────────────┐
│                   Frontend                   │
│  MCPConfigModal ← MCPContext ← mcpApi.ts    │
│        ↕ Wails Bindings (GetMCPConfig, etc.)│
├─────────────────────────────────────────────┤
│                   Backend                    │
│  mcp_integration.go (MCPServerAdapter)      │
│        ↕                                     │
│  pkg/app/mcp/                                │
│  ├── server.go    (SDK lifecycle, transport) │
│  ├── tools.go     (14 tool handlers)        │
│  ├── resources.go (5 resource handlers)     │
│  ├── security.go  (3-tier security model)   │
│  ├── config.go    (MCPConfigData)           │
│  ├── types.go     (MCPStatus, definitions)  │
│  └── errors.go    (standard error types)    │
├─────────────────────────────────────────────┤
│              mcp-go SDK v0.43.2              │
│  StreamableHTTPServer | ServeStdio           │
└─────────────────────────────────────────────┘
```

## Troubleshooting

### Server won't start
- Ensure no other process is using port 3000 (or your configured port)
- Check that the application is connected to a cluster
- Verify the config in `~/.KubeDevBench/config.json` is valid JSON

### Claude Desktop can't connect
- Ensure `transportMode` is set to `"stdio"` in the config
- Verify the executable path in `claude_desktop_config.json` is correct
- Restart Claude Desktop after modifying the config

### Tools return empty results
- Verify you're connected to a cluster with the correct context
- Check namespace selection — some tools default to the current namespace
- For metrics (`k8s_top`), ensure metrics-server is installed

### Write operations blocked
- Check `allowDestructive` is `true` in config if you need scale-to-zero
- Include `"confirmed": true` in the tool call if `requireConfirm` is enabled
- Check the MCP status in health endpoint: `GET http://localhost:3000/health`

### Performance
- Use `labelSelector` to filter large resource lists
- Set `limit` parameter to cap result sizes
- Log output is automatically truncated to `maxLogLines`
