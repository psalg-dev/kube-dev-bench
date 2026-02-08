---
title: "Go Coverage Baseline and 5% Increase Plan (2026-02-08)"   # Card title (string)
status: wip
priority: high                            # low | medium | high | critical (default: medium)
assignedAgent: add08a1d-3217-437d-8a94-1ff1f83366f7
branch: agent/6e2ea7f87709c4c71fea6abd705c8e0e/1770513916633
projectRoot: "Z:\\development\\git\\psalg-dev\\kube-dev-bench"       # Optional — explicit repo root for the agent to work in
---

# Go Coverage Baseline and 5% Increase Plan (2026-02-08)

## Current Coverage (Measured)
- Command: `go test ./pkg/app/... -coverprofile=coverage_profiles/app_coverage`
- Command: `go tool cover -func coverage_profiles/app_coverage | Select-String -Pattern 'total:'`
- Total coverage: **46.1% of statements**

### Per-Package Snapshot (from go test output)
- `pkg/app`: 42.8%
- `pkg/app/docker`: 53.7%
- `pkg/app/docker/registry`: 48.2%
- `pkg/app/docker/topology`: 85.7%
- `pkg/app/holmesgpt`: 45.4%
- `pkg/app/jobs`: 100.0%
- `pkg/app/mcp`: 59.4%

## Target
- Raise total coverage by **+5.0%** to **>= 51.1%**.

## High-Impact Coverage Plan (Prioritized)

### 1) Core Wails RPC handlers for K8s resources (highest product impact)
**Focus**: `pkg/app/*.go` handlers that back the main UI tables and bottom panels.
- Add table-driven tests for list/get paths and error paths (client errors, empty results).
- Prioritize: pods, deployments, statefulsets, daemonsets, jobs, configmaps, secrets.
- Mock k8s client responses to avoid live cluster dependency.
- Expected impact: **+2.0% to +3.0%**.

### 2) Workload logs aggregation and parsing
**Focus**: `pkg/app/workload_logs.go` and helper functions.
- Cover log aggregation for multiple pods, empty logs, and error propagation.
- Include edge cases: partial pod failures and zero-log workloads.
- Expected impact: **+0.6% to +1.0%**.

### 3) Tab counts and event polling (UI responsiveness)
**Focus**: `pkg/app/tab_counts.go`, `pkg/app/wails_events.go`.
- Add tests for count aggregation and namespace polling selection.
- Include branch coverage for empty/unknown namespaces and partial counts.
- Expected impact: **+0.5% to +0.8%**.

### 4) HolmesGPT context helpers (diagnostics path)
**Focus**: `pkg/app/holmes_context.go`, `pkg/app/holmes_logs.go`.
- Test context enrichment for events, related resources, and log slicing.
- Validate error handling when upstream log/event fetches fail.
- Expected impact: **+0.5% to +0.8%**.

### 5) MCP integration wrappers (low effort, quick wins)
**Focus**: `pkg/app/mcp_integration.go` (many 0% wrappers).
- Add lightweight tests that validate wrapper passthrough and error propagation.
- Mock the MCP server dependency to avoid network.
- Expected impact: **+0.5% to +0.8%**.

## Execution Notes
- Use table-driven tests with fakes/mocks to keep tests deterministic.
- Prefer package-level tests in `pkg/app` to avoid Wails runtime dependency.
- Keep fixtures minimal and reuse across tests.

## Success Check
- Re-run the measurement commands and confirm **>= 51.1%** total coverage.
