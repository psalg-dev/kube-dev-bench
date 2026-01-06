# Swarm Bottom Panel Improvements — Implementation TODO Plan

This file is the **trackable todo list** for all items in `swarm-improvements.md`.

How to use:
- Mark completed items with `[x]`.
- For in-progress items, keep `[ ]` and add `(DOING)`.
- Add short notes to the **Progress Log** as work lands.

Tags:
- Priority: `P0` (High), `P1` (Medium), `P2` (Low)
- Area: `BE` (Go backend/Wails RPC), `FE` (React UI), `E2E` (Playwright), `UT` (Vitest)

---

## Progress Log
- 2026-01-06: Converted plan into trackable todo list.

---

## Open Decisions (blockers if unresolved)
- [x] (P0) Config/secret edit naming/versioning strategy: use timestamps (e.g. `name@2026-01-06T153012Z`)
- [x] (P1) “Reveal secret value” allowed behind warnings + explicit confirmation
- [x] (P1) Node Logs: optional; fallback to Task Logs; clearly label what user is seeing
- [x] (P1) Stack “Compose File” tab: treat as generated (derived from service specs), not source-of-truth
- [x] (P1) Volume clone/backup expectations: implement clone + restore (not just export)

---

## Foundation (do first)
- [ ] (P0) [FE] Inventory existing bottom-panel tab + action patterns
- [ ] (P0) [FE] Inventory existing confirmation dialog + notification patterns
- [ ] (P0) [BE] Inventory current Swarm backend layout + existing RPC exposure
- [ ] (P0) [FE] Add stable selectors for any new UI controls (as introduced)
- [ ] (P0) [E2E] Identify existing swarm e2e patterns and selectors to reuse

---

## P0 — User Requested (Configs / Secrets / Volumes)

### Configs — Edit (immutability-safe)
- [ ] (P0) [BE] Implement `GetConfigUsage(configId)`
- [ ] (P0) [BE] Implement `UpdateConfig(configId, newData)` create-new + migrate-services + delete-old
- [ ] (P0) [FE] Add Config bottom-panel **Edit** action + warning copy
- [ ] (P0) [FE] Add Config editor UI with dirty tracking + save disabled until changed
- [ ] (P0) [FE] Add Config “Used By” section (uses `GetConfigUsage`)
- [ ] (P0) [E2E] Test: edit config flow (open → edit → save → notification → old replaced)
- [ ] (P1) [FE] Add Config download/export action
- [ ] (P1) [FE] Add Config clone action
- [ ] (P2) [FE] Add Config compare/diff feature
- [ ] (P2) [FE] Add Config syntax highlighting / language detection
- [ ] (P2) [FE] Add “Create Config” action in configs table view
- [ ] (P2) [FE] Show template variables if detected

### Secrets — Edit (immutability-safe + security)
- [ ] (P0) [BE] Implement `GetSecretUsage(secretId)`
- [ ] (P0) [BE] Implement `UpdateSecret(secretId, newData)` create-new + migrate-services + delete-old
- [ ] (P0) [FE] Add Secret bottom-panel **Edit** action
- [ ] (P0) [FE] Add security confirmation gate before allowing editing
- [ ] (P0) [FE] Add masked input + show/hide toggle for editing
- [ ] (P0) [FE] Add Secret “Used By” section (uses `GetSecretUsage`)
- [ ] (P0) [E2E] Test: edit secret flow with confirmation + masking toggle
- [ ] (P1) [FE] Add Secret labels display in quick info
- [ ] (P1) [FE] Add Secret rotate action (new version naming policy)
- [ ] (P1) [FE] Add Secret clone action
- [ ] (P2) [FE] Add “Create Secret” action in secrets table view
- [ ] (P2) [FE] Add “External” indicator for non-standard secret stores (if detectable)
- [ ] (P2) [FE] Add secret driver info (if available)
- [ ] (P2) [FE] Add “Reveal” feature with strong warnings + explicit confirmation

### Volumes — Files tab (full file browser)

Phase 1 (MVP: browse + read)
- [ ] (P0) [BE] Implement helper container management (get/create/reuse; per-volume)
- [ ] (P0) [BE] Implement path sanitization / traversal prevention for volume paths
- [ ] (P0) [BE] Implement `BrowseVolume(volumeName, path)`
- [ ] (P0) [BE] Implement `ReadVolumeFile(volumeName, filePath, maxSize)` with binary detection + size limit
- [ ] (P0) [BE] Implement `IsVolumeReadOnly(volumeName)` (options + touch test)
- [ ] (P0) [FE] Add Volumes bottom-panel “Files” tab shell
- [ ] (P0) [FE] Add directory listing table + breadcrumb navigation
- [ ] (P0) [FE] Add file viewer (text) + binary handling (download-only or limited preview)
- [ ] (P0) [FE] Show read-only indicator and disable write actions
- [ ] (P0) [E2E] Test: browse volume + open file + download (if implemented) or view text

Phase 2 (download/upload)
- [ ] (P0) [BE] Implement `DownloadFromVolume(volumeName, srcPath)` via Wails save dialog + docker copy
- [ ] (P0) [BE] Implement `UploadToVolume(volumeName, destPath)` via Wails open dialog + docker copy
- [ ] (P0) [FE] Add download buttons in browser and viewer
- [ ] (P0) [FE] Add upload button in toolbar (disabled when read-only)
- [ ] (P0) [E2E] Test: download + upload happy path (writable volumes)

Phase 3 (write operations)
- [ ] (P0) [BE] Implement `WriteVolumeFile(volumeName, filePath, content, encoding)`
- [ ] (P0) [BE] Implement `DeleteVolumeFile(volumeName, filePath, recursive)`
- [ ] (P0) [BE] Implement `CreateVolumeDirectory(volumeName, dirPath)`
- [ ] (P0) [FE] Add editor UI for text files + save/cancel
- [ ] (P0) [FE] Add delete confirmation dialog
- [ ] (P0) [FE] Add new folder + new file dialogs
- [ ] (P0) [E2E] Test: edit/save file + create folder + delete file (writable volumes)

Phase 4 (polish)
- [ ] (P2) [BE] Cleanup helper containers on app shutdown
- [ ] (P2) [FE] Optional syntax highlighting in viewer/editor
- [ ] (P2) [FE] Pagination or virtualization for large directories
- [ ] (P2) [FE] Short TTL caching of directory listings + invalidation on writes
- [ ] (P2) [E2E] Test: read-only volume disables all write controls

---

## P0 — Sparse Content (Networks / Volumes Usage / Secrets Used-By)

### Networks — Connected Services + more details
- [ ] (P0) [BE] Implement `GetNetworkServices(networkId)`
- [ ] (P0) [BE] Implement `GetNetworkContainers(networkId)`
- [ ] (P0) [FE] Add “Connected Services” tab
- [ ] (P0) [FE] Add “Containers” tab
- [ ] (P0) [FE] Add “IPAM” section in Summary
- [ ] (P0) [FE] Add “Options” section in Summary
- [ ] (P0) [FE] Add labels display in quick info
- [ ] (P0) [FE] Add “Inspect” tab (raw JSON)
- [ ] (P0) [E2E] Test: connected services tab renders expected rows

### Volumes — Usage information
- [ ] (P0) [BE] Implement `GetVolumeUsage(volumeName)` (services + mount points; containers optional)
- [ ] (P0) [FE] Add “Usage” tab/section showing services/containers using volume
- [ ] (P0) [FE] Add warning/guardrail before delete if volume is in use
- [ ] (P0) [E2E] Test: volume usage shows service that mounts it

### Secrets — Used By section
- [ ] (P0) [FE] Ensure “Used By” section is shown in Summary (wired to `GetSecretUsage`)

---

## P1 — Medium Priority (UX Improvements)

### Stacks — related resources + actions
- [ ] (P1) [BE] Extend stack details to include networks/volumes/configs/secrets + (optional) compose
- [ ] (P1) [FE] Add Stacks tabs: Networks, Volumes, Configs, Secrets
- [ ] (P1) [FE] Add Compose File tab (generated view; clearly label as derived)
- [ ] (P1) [FE] Add Update Stack action (redeploy)
- [ ] (P1) [FE] Add Export action (download compose)
- [ ] (P1) [FE] Add stack health summary (healthy/unhealthy counts)
- [ ] (P1) [FE] Add rollback action/flow (if supported)
- [ ] (P1) [E2E] Test: stack tabs render and list related resources

### Nodes — labels management (+ other node improvements)
- [ ] (P1) [BE] Implement `UpdateNodeLabels(nodeId, labels)`
- [ ] (P1) [FE] Add “Labels” tab (view/edit)
- [ ] (P1) [E2E] Test: add/remove label and verify persisted
- [ ] (P1) [FE] Add node platform info (OS/Arch) in Summary
- [ ] (P1) [FE] Add node resources section (CPU/mem capacity/usage if available)
- [ ] (P1) [BE] Implement promote/demote role changes (if supported)
- [ ] (P1) [FE] Add Promote/Demote actions
- [ ] (P2) [FE] Add TLS info section for manager nodes (if available)
- [ ] (P2) [FE] Add node logs tab (optional); fallback to task logs; clearly label source

### Services — expand Summary + actions
- [ ] (P1) [FE] Add environment variables section
- [ ] (P1) [FE] Add ports mapping section
- [ ] (P1) [FE] Add mounts section
- [ ] (P1) [FE] Add update config section (parallelism/delay/failure action)
- [ ] (P1) [FE] Add resources section (limits/reservations)
- [ ] (P1) [FE] Add placement tab (constraints/preferences)
- [ ] (P1) [BE] Implement service update (image tag) RPC
- [ ] (P1) [FE] Add “Update Service” action (modify image tag)

### Tasks — add timeline + richer metadata
- [ ] (P1) [FE] Add events/timeline section (state history if derivable)
- [ ] (P1) [FE] Add logs preview in Summary
- [ ] (P1) [FE] Add container details section (ports/mounts if container exists)
- [ ] (P1) [FE] Add network information (IPs, attached networks)

---

## P2 — Low Priority / Nice-to-have

### Configs/Secrets UX polish
- [ ] (P2) [FE] Syntax highlighting heuristics for config/volume text viewers
- [ ] (P2) [FE] Config compare/diff UX (choose diff lib/pattern)
- [ ] (P2) [FE] Add additional “Inspect” raw JSON tabs where useful (configs/secrets/volumes/stacks)

### Export/Clone/Backup
- [ ] (P2) [BE] Config export/download via Wails save dialog
- [ ] (P2) [FE] Wire config export/download button
- [ ] (P2) [BE] Implement clone helpers (config/secret)
- [ ] (P2) [FE] Wire config/secret clone actions
- [ ] (P2) [BE] Implement volume clone + restore (helper container copy + tar export/import as needed)
- [ ] (P2) [FE] Wire volume clone + restore actions + confirmations + progress notifications

---

## Back-end RPC Coverage Checklist (sanity)
- [ ] `GetConfigUsage(configId)`
- [ ] `UpdateConfig(configId, newData)`
- [ ] `GetSecretUsage(secretId)`
- [ ] `UpdateSecret(secretId, newData)`
- [ ] `GetNetworkServices(networkId)`
- [ ] `GetNetworkContainers(networkId)`
- [ ] `GetVolumeUsage(volumeName)`
- [ ] `BrowseVolume(volumeName, path)`
- [ ] `ReadVolumeFile(volumeName, filePath, maxSize)`
- [ ] `WriteVolumeFile(volumeName, filePath, content, encoding)`
- [ ] `DeleteVolumeFile(volumeName, filePath, recursive)`
- [ ] `CreateVolumeDirectory(volumeName, dirPath)`
- [ ] `UploadToVolume(volumeName, destPath)`
- [ ] `DownloadFromVolume(volumeName, srcPath)`
- [ ] `GetVolumeInfo(volumeName)`
- [ ] `IsVolumeReadOnly(volumeName)`
- [ ] `UpdateNodeLabels(nodeId, labels)`
- [ ] `PromoteNode(nodeId)`
- [ ] `DemoteNode(nodeId)`
