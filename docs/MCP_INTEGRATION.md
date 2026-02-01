# MCP Server Integration for KubeDevBench

KubeDevBench includes a built-in Model Context Protocol (MCP) server that allows AI assistants like Claude to interact with your Kubernetes and Docker Swarm clusters for troubleshooting and diagnostics.

## Overview

The MCP server enables AI assistants to:
- List and inspect Kubernetes resources (pods, deployments, services, etc.)
- Retrieve pod and container logs
- Get cluster events for debugging
- Scale deployments (with security controls)
- Restart deployments
- Interact with Docker Swarm services

All operations use your currently connected cluster and namespace in KubeDevBench.

## Enabling the MCP Server

1. Open KubeDevBench
2. Click on **Settings** → **MCP Server Configuration**
3. Check **Enable MCP Server**
4. Configure security settings as needed
5. Click **Save**

### Security Settings

| Setting | Default | Description |
|---------|---------|-------------|
| **Enable MCP Server** | Off | Master switch to enable/disable the MCP server |
| **Allow Destructive Operations** | Off | Allow delete and scale-to-zero operations |
| **Require Confirmation** | On | Require explicit confirmation for destructive ops |
| **Max Log Lines** | 1000 | Maximum log lines returned by log tools |

## Connecting AI Clients

### Claude Desktop

To connect Claude Desktop to KubeDevBench, add the following to your `claude_desktop_config.json`:

**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`
**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "kubedevbench": {
      "command": "C:\\Program Files\\KubeDevBench\\KubeDevBench.exe",
      "args": ["--mcp-server"]
    }
  }
}
```

**For macOS:**
```json
{
  "mcpServers": {
    "kubedevbench": {
      "command": "/Applications/KubeDevBench.app/Contents/MacOS/KubeDevBench",
      "args": ["--mcp-server"]
    }
  }
}
```

After updating the configuration:
1. Restart Claude Desktop
2. Ensure KubeDevBench is running and connected to a cluster
3. Claude will now have access to the KubeDevBench tools

### Other MCP-Compatible Clients

KubeDevBench uses STDIO transport for MCP. Any MCP-compatible client that supports STDIO can connect using the same pattern as Claude Desktop.

## Available Tools

### Kubernetes Read-Only Tools

| Tool | Description |
|------|-------------|
| `k8s_list_pods` | List pods in a namespace with status, restarts, and uptime |
| `k8s_get_pod_logs` | Retrieve logs from a specific pod (optionally a specific container) |
| `k8s_get_events` | Get Kubernetes events for debugging |
| `k8s_describe_pod` | Get detailed pod information including spec and status |
| `k8s_list_deployments` | List deployments with replicas and status |
| `k8s_describe_deployment` | Get detailed deployment information |
| `k8s_list_statefulsets` | List StatefulSets in a namespace |
| `k8s_list_daemonsets` | List DaemonSets in a namespace |
| `k8s_list_jobs` | List Jobs in a namespace |
| `k8s_list_cronjobs` | List CronJobs in a namespace |
| `k8s_list_configmaps` | List ConfigMaps in a namespace |
| `k8s_list_secrets` | List Secrets (metadata only, values not exposed) |
| `k8s_get_resource_counts` | Get aggregated counts of all resource types |

### Kubernetes Mutation Tools

| Tool | Security | Description |
|------|----------|-------------|
| `k8s_scale_deployment` | Write/Destructive | Scale a deployment (scale-to-zero requires confirmation) |
| `k8s_restart_deployment` | Write | Trigger a rolling restart of a deployment |

### Docker Swarm Tools

| Tool | Description |
|------|-------------|
| `swarm_list_services` | List Swarm services with replicas and status |
| `swarm_list_tasks` | List Swarm tasks (containers) |
| `swarm_list_nodes` | List Swarm nodes with status and availability |
| `swarm_get_service_logs` | Retrieve logs from a Swarm service |
| `swarm_scale_service` | Scale a Swarm service (Write security) |

## Available Resources

MCP resources provide context about the current connection:

| Resource URI | Description |
|--------------|-------------|
| `resource://cluster/connection` | Current cluster connection info |
| `resource://k8s/namespaces` | Available Kubernetes namespaces |
| `resource://k8s/contexts` | Available kubeconfig contexts |
| `resource://swarm/connection` | Docker Swarm connection status |
| `resource://mcp/config` | Current MCP server configuration |

## Security Model

### Three-Tier Security

1. **Configuration Level:** The `allowDestructive` setting blocks all destructive operations when disabled
2. **Tool Level:** Each tool is tagged with a security level (safe/write/destructive)
3. **Runtime Level:** Confirmation required for scale-to-zero and delete operations when `requireConfirm` is enabled

### Security Levels

| Level | Description | Examples |
|-------|-------------|----------|
| **Safe** | Read-only operations | `k8s_list_pods`, `k8s_get_pod_logs` |
| **Write** | Create/update operations | `k8s_restart_deployment` |
| **Destructive** | Delete/scale-to-zero | `k8s_scale_deployment` (when replicas=0) |

### Default Security (Safe by Default)

- **Enabled:** false (user must explicitly enable)
- **AllowDestructive:** false (blocks delete/scale-to-zero)
- **RequireConfirm:** true (requires confirmation when destructive is enabled)

## Example Usage

Once connected, you can ask Claude things like:

> "List all pods in the production namespace"

> "Show me the logs for the nginx-deployment pod"

> "What events have occurred in the last hour for the payment-service?"

> "Scale the web-frontend deployment to 3 replicas"

> "Restart the api-gateway deployment"

## Troubleshooting

### MCP Server Not Connecting

1. Ensure KubeDevBench is running
2. Verify the MCP server is enabled in settings
3. Check the executable path in your client configuration
4. Restart your AI client after configuration changes

### Operations Failing

1. Ensure you're connected to a cluster in KubeDevBench
2. Check that the namespace you're querying exists
3. For mutation operations, verify security settings allow the operation
4. Check the KubeDevBench logs for detailed error messages

### Permission Errors

1. Ensure your kubeconfig has appropriate RBAC permissions
2. For destructive operations, enable "Allow Destructive Operations" in settings
3. For scale-to-zero, pass `confirmed: true` in the tool arguments

## Architecture

The MCP server:
- Runs embedded within KubeDevBench (not a separate process)
- Uses STDIO transport for local communication
- Reuses existing cluster connections from the GUI
- Shares the same security context and permissions
- Only runs when KubeDevBench is open and MCP is enabled

## Configuration Storage

MCP configuration is stored in:
- **Windows:** `%USERPROFILE%\KubeDevBench\config.json`
- **macOS/Linux:** `~/KubeDevBench/config.json`

The configuration is stored alongside other KubeDevBench settings:

```json
{
  "currentContext": "prod-cluster",
  "mcpConfig": {
    "enabled": true,
    "allowDestructive": false,
    "requireConfirm": true,
    "maxLogLines": 1000
  }
}
```

## Future Enhancements

Planned features for future releases:
- Headless mode (`--mcp-server` CLI flag for standalone operation)
- Advanced tools (Helm operations, kubectl exec)
- Audit logging of MCP operations
- Multiple simultaneous MCP clients
- HTTP/SSE transport for remote access
