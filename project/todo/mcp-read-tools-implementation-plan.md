# MCP Read-Only Tools: Multi-Phase Implementation Plan

## Goal
Add missing read-only MCP tools for Kubernetes and Docker Swarm, prioritizing high-value diagnostics and parity with common operators. This plan is meant to be handed off for implementation. It defines scope, tool schemas, output shapes, default behaviors, and concrete file-level tasks.

All tools must:
- Delegate to existing `App` methods when possible (avoid duplicating logic)
- Respect current context/namespace defaults
- Return JSON-serializable results with consistent shapes
- Enforce log limits via `MaxLogLines`
- Be registered in `pkg/app/mcp/tools.go`
- Use consistent error messages for required params
- Avoid breaking existing tool contracts

## Non-Goals
- No write operations (create/update/delete)
- No UI changes in frontend
- No changes to MCP transport

## Implementation Guidelines (Must Follow)
- Follow Go standards in `.github/instructions/go.instructions.md` for all Go changes.
- Follow Playwright guidance in `.github/instructions/playwright.instructions.md` for any E2E tests.
- Follow React standards in `.github/instructions/react.instructions.md` for any frontend changes (even though not planned here).
- Follow PowerShell guidance in `.github/instructions/powershell.instructions.md` for any `.ps1/.psm1` scripts.
- Follow repo guidance in `.github/copilot-instructions.md` (Wails/KinD/test flows, stable DOM ids, RPC bindings).

## Code Review Requirement
- Always follow `.github/instructions/review.instructions.md`.
- Perform code reviews after **bigger implementation bursts** (e.g., after completing a phase or multiple tools).
- Review must cover correctness, security, tests, performance, architecture, and documentation.

## Complexity Guideline
- Keep cognitive complexity of added code low.
- Prefer small functions, guard clauses, and reuse existing helpers over new complex logic.
- Avoid deep nesting and large switch statements; refactor into helpers if needed.

## Definitions & Conventions
- **Context**: Current kube context is derived from existing App state (same behavior as current tools).
- **Namespace defaults**: If a tool accepts `namespace` and it is omitted, use current default namespace from App state. If the resource is cluster-scoped, ignore `namespace`.
- **Cluster-scoped resources**: `nodes`, `persistent_volumes`, `storage_classes`, `cluster_roles`, `cluster_role_bindings`, `crds`.
- **MaxLogLines**: Hard limit for log tools; if not explicitly provided, use existing App default (same as current log tools).
- **Output shape**: Return plain JSON objects; avoid Go-specific types. Prefer stable field names.

## Standard Error Messages
Use these error messages for missing required params (case-sensitive):
- `missing required parameter: name`
- `missing required parameter: kind`
- `missing required parameter: namespace` (only when namespace is required by tool)

## Standard Output Shapes
Use these shapes for all tools in this plan. Adjust only when App already returns a stable shape; in that case document the deviation.

### List (namespaced)
```json
{
	"items": [ { "name": "", "namespace": "", "age": "", "labels": {}, "annotations": {}, "raw": {} } ],
	"context": "",
	"namespace": ""
}
```

### List (cluster-scoped)
```json
{
	"items": [ { "name": "", "age": "", "labels": {}, "annotations": {}, "raw": {} } ],
	"context": ""
}
```

### Describe
```json
{
	"name": "",
	"namespace": "",
	"kind": "",
	"details": "",
	"raw": {}
}
```

### YAML
```json
{
	"kind": "",
	"name": "",
	"namespace": "",
	"yaml": ""
}
```

### Metrics (top)
```json
{
	"items": [ { "name": "", "namespace": "", "cpu": "", "memory": "", "raw": {} } ],
	"context": "",
	"namespace": ""
}
```

### Rollout
```json
{
	"kind": "",
	"name": "",
	"namespace": "",
	"status": "",
	"history": [ { "revision": "", "changeCause": "", "raw": {} } ],
	"raw": {}
}
```

## Phase 0 — Discovery & API Surface Mapping (1–2 days)
**Outcomes**: Confirm existing backend capabilities and map missing tools to available `App` methods.

### Tasks
1. Inventory existing `App` methods in `pkg/app` for list/describe/metrics/logs/rollout/manifest operations.
2. Identify gaps that require new backend methods.
3. Define tool schemas (inputs/outputs) for each missing tool and map to App methods.
4. Confirm namespace/context defaulting behavior by reviewing existing tool handlers.
5. Document any deviations from the Standard Output Shapes above.

**Deliverables**
- Mapping table: `Tool → App method → Output shape → Notes`
- List of backend gaps with effort estimate and owning file(s)
- Proposed JSON schemas for tool inputs/outputs (kept in the plan or a follow-up doc)

---

## Phase 1 — Kubernetes Core Listings (Read-Only) (3–5 days)
**Why**: Basic navigation and troubleshooting rely on comprehensive listings.

### Tools to add
- `k8s_list_services`
- `k8s_list_endpoints`
- `k8s_list_ingresses`
- `k8s_list_replicasets`
- `k8s_list_nodes`
- `k8s_list_persistent_volumes`
- `k8s_list_persistent_volume_claims`
- `k8s_list_storage_classes`
- `k8s_list_service_accounts`
- `k8s_list_roles`
- `k8s_list_role_bindings`
- `k8s_list_cluster_roles`
- `k8s_list_cluster_role_bindings`
- `k8s_list_network_policies`
- `k8s_list_crds`

### Implementation Notes
- Namespace param optional for namespaced resources; default from App state when omitted.
- Cluster-scoped resources ignore namespace.
- Prefer reusing existing list methods; if a new method is needed, follow existing list method style (paging, sort order, label/annotation fields).
- For list output, include `age` as the same formatted string used elsewhere in the app (do not calculate in tool handler if App already provides it).

### Tool Schemas (inputs)
- `k8s_list_services`: `{ "namespace"?: "string" }`
- `k8s_list_endpoints`: `{ "namespace"?: "string" }`
- `k8s_list_ingresses`: `{ "namespace"?: "string" }`
- `k8s_list_replicasets`: `{ "namespace"?: "string" }`
- `k8s_list_nodes`: `{}`
- `k8s_list_persistent_volumes`: `{}`
- `k8s_list_persistent_volume_claims`: `{ "namespace"?: "string" }`
- `k8s_list_storage_classes`: `{}`
- `k8s_list_service_accounts`: `{ "namespace"?: "string" }`
- `k8s_list_roles`: `{ "namespace"?: "string" }`
- `k8s_list_role_bindings`: `{ "namespace"?: "string" }`
- `k8s_list_cluster_roles`: `{}`
- `k8s_list_cluster_role_bindings`: `{}`
- `k8s_list_network_policies`: `{ "namespace"?: "string" }`
- `k8s_list_crds`: `{}`

**Files**
- `pkg/app/mcp/tools.go`
- `pkg/app/*` (new or existing list methods)

---

## Phase 2 — Kubernetes Describe & Manifest (Read-Only) (3–5 days)
**Why**: Detailed diagnostics require describe-level information and raw YAML.

### Tools to add
- `k8s_describe_service`
- `k8s_describe_ingress`
- `k8s_describe_node`
- `k8s_describe_pvc`
- `k8s_describe_pv`
- `k8s_describe_statefulset`
- `k8s_describe_daemonset`
- `k8s_describe_replicaset`
- `k8s_describe_job`
- `k8s_describe_cronjob`
- `k8s_get_resource_yaml` (generic manifest fetch)

### Implementation Notes
- Use consistent error messages when required params are missing.
- `k8s_get_resource_yaml` should accept `kind`, `name`, `namespace` (optional) and return YAML string.
- For describe tools, prefer existing App “describe” helpers or equivalent `kubectl describe`-style output.
- If `details` is a string, keep it plain text; do not embed ANSI colors.

### Tool Schemas (inputs)
- `k8s_describe_service`: `{ "name": "string", "namespace"?: "string" }`
- `k8s_describe_ingress`: `{ "name": "string", "namespace"?: "string" }`
- `k8s_describe_node`: `{ "name": "string" }`
- `k8s_describe_pvc`: `{ "name": "string", "namespace"?: "string" }`
- `k8s_describe_pv`: `{ "name": "string" }`
- `k8s_describe_statefulset`: `{ "name": "string", "namespace"?: "string" }`
- `k8s_describe_daemonset`: `{ "name": "string", "namespace"?: "string" }`
- `k8s_describe_replicaset`: `{ "name": "string", "namespace"?: "string" }`
- `k8s_describe_job`: `{ "name": "string", "namespace"?: "string" }`
- `k8s_describe_cronjob`: `{ "name": "string", "namespace"?: "string" }`
- `k8s_get_resource_yaml`: `{ "kind": "string", "name": "string", "namespace"?: "string" }`

**Files**
- `pkg/app/mcp/tools.go`
- `pkg/app/*` (describe + manifest fetch helpers)

---

## Phase 3 — Kubernetes Diagnostics (Read-Only) (3–5 days)
**Why**: Troubleshooting workflows need metrics, rollout state, and previous logs.

### Tools to add
- `k8s_get_pod_logs_previous`
- `k8s_top_pods`
- `k8s_top_nodes`
- `k8s_get_rollout_status`
- `k8s_get_rollout_history`

### Implementation Notes
- Metrics should return CPU/memory with units (e.g., `50m`, `128Mi`).
- Rollout tools should support `Deployment`, `StatefulSet`, `DaemonSet` and return consistent `status` values (`in_progress`, `complete`, `failed`, `unknown`).
- `k8s_get_pod_logs_previous` must enforce `MaxLogLines` limit and mirror existing log formatting (timestamp? prefix?).
- Metrics tools should return empty `items` if metrics server is unavailable, with a clear `raw` error field if App provides it.

### Tool Schemas (inputs)
- `k8s_get_pod_logs_previous`: `{ "name": "string", "namespace"?: "string", "container"?: "string", "tailLines"?: "number" }`
- `k8s_top_pods`: `{ "namespace"?: "string" }`
- `k8s_top_nodes`: `{}`
- `k8s_get_rollout_status`: `{ "kind": "string", "name": "string", "namespace"?: "string" }`
- `k8s_get_rollout_history`: `{ "kind": "string", "name": "string", "namespace"?: "string" }`

**Files**
- `pkg/app/mcp/tools.go`
- `pkg/app/*` (metrics and rollout APIs)

---

## Phase 4 — Docker Swarm Listings & Inspect (Read-Only) (2–4 days)
**Why**: Achieve parity with common Swarm management capabilities.

### Tools to add
- `swarm_list_stacks`
- `swarm_list_networks`
- `swarm_list_volumes`
- `swarm_list_secrets`
- `swarm_list_configs`
- `swarm_inspect_service`
- `swarm_inspect_task`
- `swarm_inspect_node`

### Implementation Notes
- Enforce swarm connectivity check for all tools before calling App helpers.
- `inspect` tools should return raw object details in `raw` field and a minimal summary (name/id/state).
- List tools should include `id`, `name`, `createdAt`, `updatedAt` when available.

### Tool Schemas (inputs)
- `swarm_list_stacks`: `{}`
- `swarm_list_networks`: `{}`
- `swarm_list_volumes`: `{}`
- `swarm_list_secrets`: `{}`
- `swarm_list_configs`: `{}`
- `swarm_inspect_service`: `{ "id": "string" }`
- `swarm_inspect_task`: `{ "id": "string" }`
- `swarm_inspect_node`: `{ "id": "string" }`

**Files**
- `pkg/app/mcp/tools.go`
- `pkg/app/*` (Swarm API helpers)

---

## Testing Strategy
Goal: ensure every new tool handler is correct, stable, and safe without requiring a live cluster for unit tests.

### Test Layers
1. **Unit tests (tool handlers)**
	- Validate input schema enforcement (required params, optional params).
	- Validate namespace defaulting (omitted namespace resolves to App default).
	- Validate cluster-scoped tools ignore namespace.
	- Validate delegation to App methods with correct arguments.
	- Validate output normalization to Standard Output Shapes.
	- Validate error messages match Standard Error Messages.

2. **Integration tests (App + mocks or fake clients)**
	- If existing mock app patterns exist, use them to simulate App responses.
	- Validate each tool returns JSON-serializable data from realistic App output.
	- Validate `MaxLogLines` is enforced for log tools.

3. **Optional smoke tests (real cluster)**
	- Run against KinD when available to confirm end-to-end behavior for 3–5 representative tools from each phase.
	- Keep these minimal and non-blocking for CI if cluster is not available.

### Test Cases (minimum per tool)
- Missing required params → correct error
- Namespace omitted → defaults (if namespaced)
- Namespace provided → uses provided
- Cluster-scoped tool → ignores namespace
- Output shape matches standard (presence of required keys)
- JSON serializable (no functions/channels/unsafe pointers)

### Suggested Locations
- Tool handler tests near `pkg/app/mcp` (match current test layout if any)
- App method tests near corresponding `pkg/app/*` package

### CI Guidance
- Unit tests must run without external dependencies
- Integration tests can be gated with env var (e.g., `RUN_MCP_INTEGRATION=1`)
- Avoid flaky tests by mocking time and external calls

---

## Phase 5 — Tests & Docs (2–4 days)
**Why**: Avoid regressions and provide clear usage.

### Testing
- Unit tests for tool handlers (schema validation + delegation + errors)
- Integration tests with mock app (if available)
- Add regression tests for required-parameter errors
- Add tests for namespace defaulting and cluster-scoped behavior

### Documentation
- Update `docs/MCP_INTEGRATION.md` with tool list and examples
- Add a tool matrix (Implemented vs Planned)
- Add sample requests/responses for each new tool

---

## Phase 6 — Polish & Consistency (1–2 days)
- Harmonize naming conventions and output fields
- Ensure consistent namespace defaulting
- Validate error messages for missing params
- Ensure `MaxLogLines` enforcement everywhere applicable
- Verify all tool handlers return JSON-serializable data

---

## Acceptance Criteria
- All missing read-only tools are registered and callable
- Tool responses are stable and JSON-serializable
- Namespace defaults and cluster-scoped behavior are correct
- Swarm tools reject calls when Swarm is disconnected
- Unit tests cover all new tool handlers
- Docs updated with tool list and example payloads

---

## Suggested Implementation Order
1. Phase 0 (discovery/mapping)
2. Phase 1 (core lists)
3. Phase 2 (describe + yaml)
4. Phase 4 (swarm lists + inspect)
5. Phase 3 (metrics + rollout)
6. Phase 5–6 (tests/docs/polish)

## Implementation Checklist (per tool)
- [ ] Tool handler added in `pkg/app/mcp/tools.go`
- [ ] Input schema validation implemented
- [ ] Delegates to existing App method (or new method added)
- [ ] Output normalized to Standard Output Shapes
- [ ] Namespace defaulting behavior verified
- [ ] Unit tests added
- [ ] Docs updated with example request/response
