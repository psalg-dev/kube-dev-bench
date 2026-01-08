# Connection Hooks Implementation Checklist

## Phase 1: Backend Foundation

### Types & Core Execution (`pkg/app/hooks.go`)
- [ ] Create `HookConfig` struct with all fields (ID, Name, Type, ScriptPath, TimeoutSeconds, AbortOnFailure, Enabled, Scope, ConnectionID, ConnectionType)
- [ ] Create `HookExecutionResult` struct (HookID, HookName, Success, ExitCode, Stdout, Stderr, Duration, TimedOut, Error)
- [ ] Create `HooksConfig` struct (container for all hooks)
- [ ] Implement `executeHook()` - execute single hook with timeout using `os/exec` and `context.WithTimeout`
- [ ] Add platform detection for Windows vs Unix
- [ ] Implement Windows script execution (`.bat`/`.cmd` via `cmd /c`, `.ps1` via PowerShell)
- [ ] Implement Unix script execution (shell scripts via `sh -c`, direct execution for binaries)
- [ ] Capture stdout/stderr from script execution
- [ ] Implement environment variable injection for connection details

### Unit Tests (`pkg/app/hooks_test.go`)
- [ ] Test `HookConfig` JSON marshal/unmarshal
- [ ] Test `executeHook()` with successful script
- [ ] Test `executeHook()` with timeout
- [ ] Test `executeHook()` with script not found
- [ ] Test `executeHook()` with non-zero exit code
- [ ] Test environment variables passed correctly

---

## Phase 2: Configuration Persistence

### Config Load/Save (`pkg/app/hooks.go`)
- [ ] Implement `loadHooksConfig()` - load from `~/.KubeDevBench/hooks-config.json`
- [ ] Implement `saveHooksConfig()` - save to `~/.KubeDevBench/hooks-config.json`
- [ ] Handle missing config file (return empty hooks list)
- [ ] Generate UUID for new hooks

### Wails-Exposed Methods (`pkg/app/hooks.go`)
- [ ] Implement `GetHooksConfig()` - return all hooks
- [ ] Implement `SaveHook(hook HookConfig)` - create or update hook
- [ ] Implement `DeleteHook(hookID string)` - remove hook by ID
- [ ] Implement `TestHook(hookID string)` - execute hook for testing, return result
- [ ] Implement `SelectHookScript()` - open file dialog for script selection

### Unit Tests
- [ ] Test `loadHooksConfig()` with non-existent file
- [ ] Test `loadHooksConfig()` with valid file
- [ ] Test `saveHooksConfig()` creates file
- [ ] Test `SaveHook()` creates new hook
- [ ] Test `SaveHook()` updates existing hook
- [ ] Test `DeleteHook()` removes hook

---

## Phase 3: Connection Flow Integration

### Hook Runner Functions (`pkg/app/hooks.go`)
- [ ] Implement `getApplicableHooks(hookType, connectionType, connectionID)` - filter hooks by scope
- [ ] Implement `runPreConnectHooks(connectionType, connectionID, connectionDetails)` - run all pre-connect hooks
- [ ] Implement `runPostConnectHooks(connectionType, connectionID, connectionDetails)` - run all post-connect hooks
- [ ] Add abort-on-failure logic for pre-connect hooks
- [ ] Emit `hook:started` Wails event when hook begins
- [ ] Emit `hook:completed` Wails event when hook finishes

### Kubernetes Integration (`pkg/app/config.go`)
- [ ] Add hook execution before connection validation in `SetKubeConfigPath()`
- [ ] Check abort conditions after pre-connect hooks
- [ ] Add async post-connect hook execution after successful connection
- [ ] Pass K8s environment variables (KUBECONFIG, KUBE_CONTEXT)

### Docker Swarm Integration (`pkg/app/docker_integration.go`)
- [ ] Add hook execution at start of `ConnectToDocker()` (before line 54)
- [ ] Check abort conditions after pre-connect hooks
- [ ] Add async post-connect hook execution after event emit (after line 84)
- [ ] Pass Docker environment variables (DOCKER_HOST, DOCKER_TLS_VERIFY)

### Unit Tests
- [ ] Test `getApplicableHooks()` returns global hooks
- [ ] Test `getApplicableHooks()` returns connection-specific hooks
- [ ] Test `runPreConnectHooks()` with abort-on-failure
- [ ] Test `runPreConnectHooks()` continues on failure when abort disabled

---

## Phase 4: Frontend UI

### Hooks Settings Component (`frontend/src/layout/connection/ConnectionHooksSettings.jsx`)
- [ ] Create overlay component (follow `ConnectionProxySettings.jsx` pattern)
- [ ] Add header with title and close button
- [ ] Add tab selector: Pre-Connect / Post-Connect
- [ ] Add hook list with enable/disable toggles
- [ ] Add "Add Hook" button
- [ ] Create add/edit form:
  - [ ] Hook name input
  - [ ] Script path input with browse button
  - [ ] Timeout input (seconds)
  - [ ] Abort on failure checkbox (pre-connect only)
  - [ ] Scope radio: Global / This Connection
- [ ] Add "Test Hook" button with result display
- [ ] Add "Save" and "Cancel" buttons
- [ ] Add delete functionality with confirmation
- [ ] Implement all stable DOM IDs from plan

### State Management (`frontend/src/layout/connection/ConnectionsStateContext.jsx`)
- [ ] Add `hooks: []` to initial state
- [ ] Add `showHooksSettings: false` to initial state
- [ ] Add `editingHook: null` to initial state
- [ ] Add `editingConnectionHooks: null` to initial state (for per-connection hooks)
- [ ] Implement `loadHooks()` action - call `GetHooksConfig()`
- [ ] Implement `saveHook(hook)` action - call `SaveHook()`
- [ ] Implement `deleteHook(hookId)` action - call `DeleteHook()`
- [ ] Implement `testHook(hookId)` action - call `TestHook()`
- [ ] Implement `toggleHooksSettings(show, connection)` action
- [ ] Implement `browseHookScript()` action - call `SelectHookScript()`
- [ ] Load hooks on context mount

### Connection Card Integration
- [ ] Add hooks button to `KubernetesConnectionsList.jsx` (next to proxy button)
- [ ] Add hooks button to `DockerSwarmConnectionsList.jsx` (next to proxy button)
- [ ] Show hook count badge on buttons

### Notification Integration
- [ ] Subscribe to `hook:started` event, show info notification
- [ ] Subscribe to `hook:completed` event, show success/warning based on result
- [ ] Show error notification when connection aborts due to hook failure

### Wails Mocks (`frontend/src/__tests__/wailsMocks.js`)
- [ ] Add mock for `GetHooksConfig()`
- [ ] Add mock for `SaveHook()`
- [ ] Add mock for `DeleteHook()`
- [ ] Add mock for `TestHook()`
- [ ] Add mock for `SelectHookScript()`

### Frontend Unit Tests (`frontend/src/__tests__/connectionHooksSettings.test.jsx`)
- [ ] Test hook list renders correctly
- [ ] Test add hook form opens
- [ ] Test form validation (name, script path required)
- [ ] Test save hook calls backend
- [ ] Test delete hook with confirmation
- [ ] Test hook test execution shows result
- [ ] Test tab switching (pre-connect/post-connect)
- [ ] Test scope selector (global/connection)

---

## Phase 5: E2E Testing & Polish

### E2E Tests (`e2e/tests/86-connection-hooks.spec.ts`)
- [ ] Test opening hooks settings from connection wizard
- [ ] Test adding a new pre-connect hook
- [ ] Test adding a new post-connect hook
- [ ] Test editing an existing hook
- [ ] Test deleting a hook
- [ ] Test hook execution notification appears
- [ ] Test abort on failure blocks connection

### Page Objects
- [ ] Create `HooksSettingsPage.ts` page object (if needed)
- [ ] Add hooks-related methods to existing page objects

### Documentation
- [ ] Update `CLAUDE.md` with hooks feature documentation
- [ ] Document new Wails-exposed methods
- [ ] Document DOM IDs for testing

### Final Verification
- [ ] Run all Go unit tests (`go test ./pkg/app/...`)
- [ ] Verify Go test coverage >= 70%
- [ ] Run all frontend unit tests (`cd frontend && npm test`)
- [ ] Run E2E tests (`cd e2e && npx playwright test`)
- [ ] Verify CI pipeline passes
- [ ] Test on Windows (batch/PowerShell scripts)
- [ ] Test on macOS/Linux (shell scripts)
