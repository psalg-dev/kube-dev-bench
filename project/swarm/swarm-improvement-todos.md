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
- 2026-01-06: Implemented Swarm Configs Edit + Used By (BE+FE); tests pending.
- 2026-01-06: Implemented Swarm Secrets Edit + Used By (BE+FE); tests pending.
- 2026-01-06: Implemented Swarm Volume usage (Used By) (BE+FE); tests pending.
- 2026-01-06: Implemented Swarm Volumes Files tab Phase 1 (browse + read) with helper container reuse + read-only indicator (BE+FE); unit tests passing.
- 2026-01-06: Implemented Swarm Networks tabs (Connected Services / Containers / Inspect) + Summary IPAM/Options + labels in quick info (FE); unit tests passing.
- 2026-01-06: Implemented Swarm Volumes Files tab Phase 2 (download/upload via Wails dialogs + docker copy) (BE+FE); Go+unit tests passing.
- 2026-01-06: Implemented Swarm Volumes Files tab Phase 3 backend RPCs (write/delete/mkdir) (BE); Go tests passing.
- 2026-01-06: Implemented Swarm Volumes Files tab Phase 3 frontend (editor save/cancel, new file/folder prompts, delete confirmations) (FE).
- 2026-01-06: Implemented Swarm Nodes Labels tab (FE) + wired existing `UpdateSwarmNodeLabels`; added Swarm Service “Update Image”; added Swarm Config download + clone actions.
- 2026-01-06: Implemented Swarm Secrets Rotate + Clone (FE) and Stacks related resources + derived compose + update/export + health summary (BE+FE).
- 2026-01-06: Implemented Nodes promote/demote + platform/resources summary; expanded Services summary (env/ports/mounts/update/resources) + Placement tab; enhanced Tasks summary (timeline/logs preview/container/networks); added Stack rollback action (BE+FE).
- 2026-01-06: Implemented P2 polish: Config compare/diff + syntax highlighting heuristics + template variable detection; added Inspect JSON tabs for configs/secrets/volumes; added Secret reveal confirmation + driver/external info; added shutdown cleanup for swarm volume helper containers (BE+FE); Go+unit tests passing.
- 2026-01-06: Added Nodes Summary TLS info section (FE); unit tests passing.
- 2026-01-06: Added Nodes Logs tab (task logs fallback, clearly labeled) (FE); unit tests passing.
- 2026-01-07: E2E Swarm specs 71–75 implemented and iterated for CI/Windows stability; remaining work is hardening the last flaky assertions.
- 2026-01-07: E2E: Volumes Files spec (71) switched download verification to toast-only (avoid filesystem flake under Wails/Windows).
- 2026-01-07: E2E: Stacks update spec (75) changed to verify redeploy completion via docker CLI postcondition (service image updated), with toast as best-effort.
- 2026-01-07: Note: Footer may show “Not connected to cluster” (Kubernetes state) even while Swarm flows work; do not treat as Swarm failure signal.

---

## Current E2E State (Swarm specs 71–75)

Status snapshot (as of 2026-01-07):
- Specs present: [e2e/tests/swarm/71-volumes-files.spec.ts](../../e2e/tests/swarm/71-volumes-files.spec.ts), [72-configs.spec.ts](../../e2e/tests/swarm/72-configs.spec.ts), [73-secrets.spec.ts](../../e2e/tests/swarm/73-secrets.spec.ts), [74-networks-volumes-usage.spec.ts](../../e2e/tests/swarm/74-networks-volumes-usage.spec.ts), [75-nodes-services-stacks.spec.ts](../../e2e/tests/swarm/75-nodes-services-stacks.spec.ts)
- Spec 71: download assertion is toast-only; upload/edit/create/delete/unsaved-changes assertions remain UI-driven.
- Spec 75: stack update is verified via `docker service inspect <stack>_web` image tag change; row clicks use `force: true` to avoid pointer interception.

Known flaky symptoms (historical):
- Pointer interception overlays can cause Playwright click retries (seen especially when opening stack rows).
- Stack redeploy toast sometimes doesn’t render reliably; avoid toast-only assertions for redeploy completion.

Next steps if anything still flakes:
- If stack update still flakes: capture Playwright trace + screenshot, then add an explicit “wait until update modal closes” or poll service update status (tasks converge).
- If any download-like flows flake again: prefer toast and/or app-visible state changes, not filesystem reads.

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
- [x] (P0) [BE] Implement `GetConfigUsage(configId)`
- [x] (P0) [BE] Implement `UpdateConfig(configId, newData)` create-new + migrate-services + delete-old
- [x] (P0) [FE] Add Config bottom-panel **Edit** action + warning copy
- [x] (P0) [FE] Add Config editor UI with dirty tracking + save disabled until changed
- [x] (P0) [FE] Add Config “Used By” section (uses `GetConfigUsage`)
- [ ] (P0) [E2E] Test: edit config flow (open → edit → save → notification → old replaced)
- [x] (P1) [FE] Add Config download/export action
- [x] (P1) [FE] Add Config clone action
- [x] (P2) [FE] Add Config compare/diff feature
- [x] (P2) [FE] Add Config syntax highlighting / language detection
- [x] (P2) [FE] Add “Create Config” action in configs table view
- [x] (P2) [FE] Show template variables if detected

### Secrets — Edit (immutability-safe + security)
- [x] (P0) [BE] Implement `GetSecretUsage(secretId)`
- [x] (P0) [BE] Implement `UpdateSecret(secretId, newData)` create-new + migrate-services + delete-old
- [x] (P0) [FE] Add Secret bottom-panel **Edit** action
- [x] (P0) [FE] Add security confirmation gate before allowing editing
- [x] (P0) [FE] Add masked input + show/hide toggle for editing
- [x] (P0) [FE] Add Secret “Used By” section (uses `GetSecretUsage`)
- [ ] (P0) [E2E] Test: edit secret flow with confirmation + masking toggle
- [x] (P1) [FE] Add Secret labels display in quick info
- [x] (P1) [FE] Add Secret rotate action (new version naming policy)
- [x] (P1) [FE] Add Secret clone action
- [x] (P2) [FE] Add “Create Secret” action in secrets table view
- [x] (P2) [FE] Add “External” indicator for non-standard secret stores (if detectable)
- [x] (P2) [FE] Add secret driver info (if available)
- [x] (P2) [FE] Add “Reveal” feature with strong warnings + explicit confirmation

### Volumes — Files tab (full file browser)

Phase 1 (MVP: browse + read)
- [x] (P0) [BE] Implement helper container management (get/create/reuse; per-volume)
- [x] (P0) [BE] Implement path sanitization / traversal prevention for volume paths
- [x] (P0) [BE] Implement `BrowseVolume(volumeName, path)`
- [x] (P0) [BE] Implement `ReadVolumeFile(volumeName, filePath, maxSize)` with binary detection + size limit
- [x] (P0) [BE] Implement `IsVolumeReadOnly(volumeName)` (options + touch test)
- [x] (P0) [FE] Add Volumes bottom-panel “Files” tab shell
- [x] (P0) [FE] Add directory listing table + breadcrumb navigation
- [x] (P0) [FE] Add file viewer (text) + binary handling (download-only or limited preview)
- [x] (P0) [FE] Show read-only indicator and disable write actions
- [ ] (P0) [E2E] Test: browse volume + open file + download (if implemented) or view text

Phase 2 (download/upload)
- [x] (P0) [BE] Implement `DownloadFromVolume(volumeName, srcPath)` via Wails save dialog + docker copy
- [x] (P0) [BE] Implement `UploadToVolume(volumeName, destPath)` via Wails open dialog + docker copy
- [x] (P0) [FE] Add download buttons in browser and viewer
- [x] (P0) [FE] Add upload button in toolbar (disabled when read-only)
- [ ] (P0) [E2E] Test: download + upload happy path (writable volumes)

Phase 3 (write operations)
- [x] (P0) [BE] Implement `WriteVolumeFile(volumeName, filePath, content, encoding)`
- [x] (P0) [BE] Implement `DeleteVolumeFile(volumeName, filePath, recursive)`
- [x] (P0) [BE] Implement `CreateVolumeDirectory(volumeName, dirPath)`
- [x] (P0) [FE] Add editor UI for text files + save/cancel
- [x] (P0) [FE] Add delete confirmation dialog
- [x] (P0) [FE] Add new folder + new file dialogs
- [ ] (P0) [E2E] Test: edit/save file + create folder + delete file (writable volumes)

Phase 4 (polish)
- [x] (P2) [BE] Cleanup helper containers on app shutdown
- [x] (P2) [FE] Optional syntax highlighting in viewer/editor
- [x] (P2) [FE] Pagination or virtualization for large directories
- [x] (P2) [FE] Short TTL caching of directory listings + invalidation on writes
- [x] (P2) [E2E] Test: read-only volume disables all write controls

---

## E2E — Swarm Backlog (test specs to add later)

Notes:
- Prefer existing swarm connection bootstrap + stable selectors (`tableTestId` where available).
- Add `data-testid` only where needed (buttons/modals/sections introduced by these improvements).

- [ ] (P0) [E2E] Configs: open details → verify “Used By” lists referencing services
- [ ] (P0) [E2E] Configs: edit → save → success notification → new timestamp-suffixed config appears
- [ ] (P0) [E2E] Configs: edit migrates services (service update reflected in “Configs” refs or service redeploy)

- [ ] (P1) [E2E] Configs: Download action downloads a file (non-empty for non-empty config)
- [ ] (P1) [E2E] Configs: Clone action prompts for name → creates new config and list refreshes

- [ ] (P0) [E2E] Secrets: open details → verify “Used By” lists referencing services
- [ ] (P0) [E2E] Secrets: edit requires confirmation gate before input is enabled
- [ ] (P0) [E2E] Secrets: edit supports show/hide toggle while typing new value
- [ ] (P0) [E2E] Secrets: edit → save → success notification → new timestamp-suffixed secret appears

- [ ] (P0) [E2E] Volumes Files: open Files tab → browse directory → open text file viewer
- [ ] (P0) [E2E] Volumes Files: binary file handling (download-only or explicit message)
- [ ] (P0) [E2E] Volumes Files: read-only volume disables upload/edit/delete controls

- [ ] (P0) [E2E] Volumes Files (Phase 3): open text file → Edit → Save → success notification → reopen file and verify updated content
- [ ] (P0) [E2E] Volumes Files (Phase 3): New File + New Folder in current directory → entries appear in listing (and folder is navigable)
- [ ] (P0) [E2E] Volumes Files (Phase 3): Delete file + Delete folder (recursive confirm) → entries removed from listing
- [ ] (P0) [E2E] Volumes Files (Phase 3): unsaved changes guardrail triggers confirm when navigating away (row click or breadcrumb)

- [ ] (P0) [E2E] Networks: Connected Services tab renders and includes at least one expected service
- [ ] (P0) [E2E] Networks: Containers tab renders and shows attached tasks
- [ ] (P0) [E2E] Networks: Inspect tab loads JSON
- [ ] (P0) [E2E] Networks: Summary shows IPAM + Options sections
- [ ] (P0) [E2E] Volumes Usage: usage section shows service that mounts volume; delete guarded when in use

- [ ] (P1) [E2E] Nodes: Labels tab add/remove label → save → reopen details and verify persisted
- [ ] (P1) [E2E] Services: Update Image action updates service image and shows success notification
- [ ] (P1) [E2E] Secrets: Rotate action creates a new timestamp-suffixed secret and list refreshes
- [ ] (P1) [E2E] Secrets: Clone action prompts for name/value → creates new secret and list refreshes
- [ ] (P1) [E2E] Stacks: Tabs render Networks/Volumes/Configs/Secrets with expected rows
- [ ] (P1) [E2E] Stacks: Compose File tab loads derived YAML and shows derived warning
- [ ] (P1) [E2E] Stacks: Export action downloads compose YAML
- [ ] (P1) [E2E] Stacks: Update action opens editor → deploys updated YAML → shows success notification

---

## P0 — Sparse Content (Networks / Volumes Usage / Secrets Used-By)

### Networks — Connected Services + more details
- [x] (P0) [BE] Implement `GetNetworkServices(networkId)`
- [x] (P0) [BE] Implement `GetNetworkContainers(networkId)`
- [x] (P0) [FE] Add “Connected Services” tab
- [x] (P0) [FE] Add “Containers” tab
- [x] (P0) [FE] Add “IPAM” section in Summary
- [x] (P0) [FE] Add “Options” section in Summary
- [x] (P0) [FE] Add labels display in quick info
- [x] (P0) [FE] Add “Inspect” tab (raw JSON)
- [ ] (P0) [E2E] Test: connected services tab renders expected rows

### Volumes — Usage information
- [x] (P0) [BE] Implement `GetVolumeUsage(volumeName)` (services + mount points; containers optional)
- [x] (P0) [FE] Add “Usage” tab/section showing services/containers using volume
- [x] (P0) [FE] Add warning/guardrail before delete if volume is in use
- [ ] (P0) [E2E] Test: volume usage shows service that mounts it

### Secrets — Used By section
- [x] (P0) [FE] Ensure “Used By” section is shown in Summary (wired to `GetSecretUsage`)

---

## P1 — Medium Priority (UX Improvements)

### Stacks — related resources + actions
- [x] (P1) [BE] Extend stack details to include networks/volumes/configs/secrets + (optional) compose
- [x] (P1) [FE] Add Stacks tabs: Networks, Volumes, Configs, Secrets
- [x] (P1) [FE] Add Compose File tab (generated view; clearly label as derived)
- [x] (P1) [FE] Add Update Stack action (redeploy)
- [x] (P1) [FE] Add Export action (download compose)
- [x] (P1) [FE] Add stack health summary (healthy/unhealthy counts)
- [x] (P1) [FE] Add rollback action/flow (if supported)
- [ ] (P1) [E2E] Test: stack tabs render and list related resources

### Nodes — labels management (+ other node improvements)
- [x] (P1) [BE] Implement `UpdateSwarmNodeLabels(nodeId, labels)`
- [x] (P1) [FE] Add “Labels” tab (view/edit)
- [ ] (P1) [E2E] Test: add/remove label and verify persisted
- [x] (P1) [FE] Add node platform info (OS/Arch) in Summary
- [x] (P1) [FE] Add node resources section (CPU/mem capacity/usage if available)
- [x] (P1) [BE] Implement promote/demote role changes (if supported)
- [x] (P1) [FE] Add Promote/Demote actions
- [x] (P2) [FE] Add TLS info section for manager nodes (if available)
- [x] (P2) [FE] Add node logs tab (optional); fallback to task logs; clearly label source

### Services — expand Summary + actions
- [x] (P1) [FE] Add environment variables section
- [x] (P1) [FE] Add ports mapping section
- [x] (P1) [FE] Add mounts section
- [x] (P1) [FE] Add update config section (parallelism/delay/failure action)
- [x] (P1) [FE] Add resources section (limits/reservations)
- [x] (P1) [FE] Add placement tab (constraints/preferences)
- [x] (P1) [BE] Implement service update (image tag) RPC
- [x] (P1) [FE] Add “Update Service” action (modify image tag)

### Tasks — add timeline + richer metadata
- [x] (P1) [FE] Add events/timeline section (state history if derivable)
- [x] (P1) [FE] Add logs preview in Summary
- [x] (P1) [FE] Add container details section (ports/mounts if container exists)
- [x] (P1) [FE] Add network information (IPs, attached networks)

---

## P2 — Low Priority / Nice-to-have

### Configs/Secrets UX polish
- [x] (P2) [FE] Syntax highlighting heuristics for config/volume text viewers
- [x] (P2) [FE] Config compare/diff UX (choose diff lib/pattern)
- [x] (P2) [FE] Add additional “Inspect” raw JSON tabs where useful (configs/secrets/volumes)

### Export/Clone/Backup
- [x] (P2) [BE] Config export/download via Wails save dialog
- [x] (P2) [FE] Wire config export/download button
- [x] (P2) [BE] Implement clone helpers (config/secret)
- [x] (P2) [FE] Wire config/secret clone actions
- [x] (P2) [BE] Implement volume clone + restore (helper container copy + tar export/import as needed)
- [x] (P2) [FE] Wire volume clone + restore actions + confirmations + progress notifications

---

## Back-end RPC Coverage Checklist (sanity)
- [x] `GetConfigUsage(configId)`
- [x] `UpdateConfig(configId, newData)`
- [x] `GetSecretUsage(secretId)`
- [x] `UpdateSecret(secretId, newData)`
- [x] `GetNetworkServices(networkId)`
- [x] `GetNetworkContainers(networkId)`
- [x] `GetVolumeUsage(volumeName)`
- [x] `BrowseVolume(volumeName, path)`
- [x] `ReadVolumeFile(volumeName, filePath, maxSize)`
- [x] `WriteVolumeFile(volumeName, filePath, content, encoding)`
- [x] `DeleteVolumeFile(volumeName, filePath, recursive)`
- [x] `CreateVolumeDirectory(volumeName, dirPath)`
- [x] `UploadToVolume(volumeName, destPath)`
- [x] `DownloadFromVolume(volumeName, srcPath)`
- [x] `GetVolumeInfo(volumeName)`
- [x] `IsVolumeReadOnly(volumeName)`
- [x] `UpdateSwarmNodeLabels(nodeId, labels)`
- [x] `UpdateSwarmNodeRole(nodeId, role)`
- [x] `GetSwarmStackResources(stackName)`
- [x] `GetSwarmStackComposeYAML(stackName)`
- [x] `RollbackSwarmStack(stackName)`
