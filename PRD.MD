# KubeDevBench Product Requirements Document (PRD)

Last updated: 2026-01-03

## Overview
KubeDevBench is a desktop Kubernetes client. It targets developers and DevOps engineers who need fast, repeatable workflows for inspecting and operating common Kubernetes resources.

## Stack
- Frontend: React (Vite)
- Backend: Go
- Desktop framework: Wails (https://wails.io/)

## Development
- IDE: JetBrains IntelliJ IDEA
- Console: Git Bash / MINGW64

## Goals
- Make “connect to a cluster → pick namespaces → inspect resources” quick and reliable.
- Provide consistent UX across resource views (same interaction patterns, bottom panel details).
- Keep actions discoverable, with clear feedback via notifications.

## Non-goals (current scope)
- Replacing `kubectl` for all workflows.
- Full-featured observability/metrics dashboards.

## Core UX Requirements

### Layout
- The app is composed of:
  - A collapsible left sidebar
  - A footer
  - A main content area

### Sidebar: cluster selection
- Users can select a Kubernetes context.
- Users can select one or more namespaces.
- The sidebar contains navigation entries for the supported resource views.
- The sidebar displays basic counts for resources (pods include a status breakdown).

### Resource views: shared behaviors
All resource views follow the same interaction model:
- The main content area shows a table of resources.
- There is a filter box above the table to filter visible rows.
- Rows are clickable.
- Clicking a row opens a bottom panel showing details for that resource.
- When the bottom panel is open:
  - Clicking outside of it closes it.
  - Pressing Escape closes it.
- A create (“+”) button is shown above the table.
  - Clicking it opens the Create Manifest overlay.
  - The overlay can be closed by pressing Escape or clicking the X.
  - Creating a resource refreshes the table automatically.

### Notifications
- User actions that cause state changes show a notification in the main content area.
- Notifications auto-dismiss after ~3 seconds.
- Notifications can be dismissed manually and are draggable.

## Functional Requirements

### Connection Wizard
The application provides a Connection Wizard that enables connecting to a cluster via kubeconfig.

Must support:
- Discover kubeconfig files (e.g., from the user’s environment).
- Browse for a kubeconfig file and add it to the discovered list.
- Select which kubeconfig file the app uses.
- First-run flow when no kubeconfigs exist:
  - Allow pasting kubeconfig YAML and saving it as the primary kubeconfig.
- Switching kubeconfigs without restarting the app.

Proxy configuration (part of connection setup):
- Support proxy modes: none, system proxy, and basic auth.
- Support detecting and displaying system proxy information.

### Supported resource views
Navigation and overview tables exist for:
- Pods
- Deployments
- Jobs
- CronJobs
- DaemonSets
- StatefulSets
- ReplicaSets
- ConfigMaps
- Secrets
- Ingresses
- PersistentVolumeClaims
- PersistentVolumes
- Helm Releases

### Pods
Pods view must support:
- Listing pods across selected namespaces.
- Filtering and sorting.
- Per-pod details via bottom panel tabs including:
  - Summary
  - Logs
  - Events
  - YAML
  - Console (exec)
  - Port Forward
  - Files
  - Mounts
- Pod actions:
  - Restart
  - Delete
- Create flow:
  - A “Create” control exists above the table and can open a menu of common resource kinds to create.

### Workloads / batch / config / storage / networking
For other resources, the overview table + bottom panel pattern must apply, with:
- A summary tab.
- A YAML tab.
- Additional tabs as appropriate for the resource (e.g., events, consumers, data).
- Delete actions where supported.

### Helm Releases
Helm Releases view must support:
- Listing releases and showing key metadata (name, namespace, chart, versions, status, revision, age).
- Opening a bottom panel with tabs:
  - Summary
  - Values
  - History
  - Notes
  - Resources
  - Manifest
- Uninstalling a release via the UI.
- Navigating from a Helm release’s “Resources” tab to a specific resource view.

## Acceptance Criteria (product-level)
- A user can:
  - Connect via the Connection Wizard
  - Select a context and namespaces
  - Navigate through each supported resource view
  - Open/close bottom panels consistently
  - Create a resource from the create overlay and see it appear
  - Receive notifications for create/delete/restart/uninstall actions

## Notes
- End-to-end tests (Playwright) are expected to cover the above user flows against a real KinD cluster.
