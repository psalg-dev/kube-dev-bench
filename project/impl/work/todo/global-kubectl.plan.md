# Implementation Plan: Global kubectl Command Palette

**Status:** Todo (0% — nothing implemented)
**Created:** 2026-02-06
**Updated:** 2026-02-06

Add a command palette to KubeDevBench enabling quick kubectl command execution with terminal output, Holmes AI analysis, and command history.

**Note:** Frontend was migrated to TypeScript in PR #104. All frontend file references use `.tsx`/`.ts` extensions.

---

## Summary

A `Ctrl+Shift+K` keyboard shortcut opens a compact modal with kubectl input, namespace dropdown, and executes commands in a pop-out xterm terminal. Users can select text in the terminal output and analyze it with Holmes AI. Command history is navigable via up/down arrows.

**Current State:** No implementation exists. `pkg/app/kubectl.go` does not exist. No frontend components exist.

---

## Features

- **Command Palette Modal**: Ctrl+Shift+K shows a 300px modal with:
  - Left side label: "kubectl"
  - Center: Input field for command arguments
  - Right side: Namespace dropdown (defaults to current namespace)

- **Terminal Output**: Enter opens xterm pop-out window with:
  - Full command display with namespace parameter
  - Command output streaming
  - Maximizable to full screen
  - Escape closes the window

- **Holmes AI Integration**: Select text in xterm and analyze with HolmesGPT

- **Command History**: Up-arrow cycles through past commands

---

## Phases

### Phase 1: Go Backend - kubectl Execution ❌ NOT STARTED
- [ ] Create `pkg/app/kubectl.go` with ExecuteKubectl, GetKubectlHistory, SaveKubectlHistory
- [ ] Add KubectlHistoryEntry type to `pkg/app/types.go`
- [ ] Create `pkg/app/kubectl_test.go` unit tests

### Phase 2: Frontend - Command Palette Modal ❌ NOT STARTED
- [ ] Create `frontend/src/components/KubectlCommandPalette/index.tsx`
- [ ] Create `frontend/src/components/KubectlCommandPalette/KubectlCommandPalette.css`
- [ ] Create `frontend/src/components/KubectlCommandPalette/KubectlContext.tsx`

### Phase 3: Terminal Pop-out Window ❌ NOT STARTED
- [ ] Create `frontend/src/components/KubectlTerminal/KubectlTerminalPopout.tsx`

### Phase 4: Keyboard Binding Integration ❌ NOT STARTED
- [ ] Modify `frontend/src/layout/AppContainer.tsx` for Ctrl+Shift+K handler

### Phase 5: Holmes Text Selection Integration ❌ NOT STARTED
- [ ] Add text selection analysis to terminal pop-out

### Phase 6: Command History ❌ NOT STARTED
- [ ] Backend history storage in `~/.KubeDevBench/kubectl_history.json`
- [ ] Frontend history navigation with Up/Down arrows

### Phase 7: Unit Tests ❌ NOT STARTED
- [ ] Create `frontend/src/__tests__/kubectlCommandPalette.test.tsx`
- [ ] Update `frontend/src/__tests__/wailsMocks.ts`

### Phase 8: E2E Tests ❌ NOT STARTED
- [ ] Create `e2e/tests/kubectl/00-command-palette.spec.ts`
- [ ] Create `e2e/src/pages/KubectlPalettePage.ts`

---

## Files Summary

### New Files (10)
- `pkg/app/kubectl.go`
- `pkg/app/kubectl_test.go`
- `frontend/src/components/KubectlCommandPalette/index.tsx`
- `frontend/src/components/KubectlCommandPalette/KubectlCommandPalette.css`
- `frontend/src/components/KubectlCommandPalette/KubectlContext.tsx`
- `frontend/src/components/KubectlTerminal/KubectlTerminalPopout.tsx`
- `frontend/src/__tests__/kubectlCommandPalette.test.tsx`
- `e2e/tests/kubectl/00-command-palette.spec.ts`
- `e2e/src/pages/KubectlPalettePage.ts`

### Modified Files (3)
- `frontend/src/layout/AppContainer.tsx`
- `frontend/src/__tests__/wailsMocks.ts`
- `pkg/app/types.go`

---

## Verification

1. `go test -cover ./pkg/app/...` - all pass, >=70% coverage
2. `cd frontend && npm test` - all pass
3. `wails dev` - Ctrl+Shift+K opens palette
4. Execute kubectl command, verify terminal output
5. Select text, analyze with Holmes
6. Up arrow navigates history
7. `cd e2e && npx playwright test tests/kubectl/` - passes
