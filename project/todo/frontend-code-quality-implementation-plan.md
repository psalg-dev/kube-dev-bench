# Frontend Code Quality Improvement: Implementation Plan

**Date**: 2026-02-03
**Status**: Planning

---

## Executive Summary

This plan addresses code quality issues identified in the frontend codebase analysis, including deprecated patterns, code smells, and bad practices. The improvements focus on stability, maintainability, and performance.

| Category | Priority | Effort | Impact |
|----------|----------|--------|--------|
| Error Boundaries | HIGH | 1 day | Prevents app crashes |
| Memory Leak Fixes (setInterval) | HIGH | 1 day | Stability |
| DOM Manipulation Refactor | HIGH | 2 days | React best practices |
| Console.log Cleanup | MEDIUM | 0.5 days | Production readiness |
| Large Component Splitting | MEDIUM | 3 days | Maintainability |
| TypeScript/PropTypes | MEDIUM | 5+ days | Type safety |
| API Timeout Protection | MEDIUM | 1 day | Reliability |
| innerHTML Replacement | MEDIUM | 0.5 days | Security |

---

## Part 1: High Priority - Stability & Best Practices

### 1.1 Add Error Boundary Components

**Priority**: HIGH
**Effort**: 1 day
**Risk**: Low
**Files Affected**: 3-5 new files, 2 modified

#### Problem Statement

The entire application has zero error boundaries. Any unhandled exception in a child component crashes the whole app with a white screen.

**Critical areas needing protection**:
- Holmes AI features (external API calls can fail)
- Resource tables (data parsing errors)
- Bottom panel tabs (log streaming, terminal)
- Connection wizard (network errors)

#### Implementation

- [ ] **Create ErrorBoundary component**

**File**: `frontend/src/components/ErrorBoundary/index.jsx`

```jsx
import { Component } from 'react';
import './ErrorBoundary.css';

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    // Log to error reporting service if configured
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.handleRetry);
      }

      return (
        <div className="error-boundary">
          <div className="error-boundary-content">
            <h3>Something went wrong</h3>
            <p className="error-message">{this.state.error?.message || 'An unexpected error occurred'}</p>
            <button className="error-retry-btn" onClick={this.handleRetry}>
              Try Again
            </button>
            {this.props.showDetails && this.state.errorInfo && (
              <details className="error-details">
                <summary>Error Details</summary>
                <pre>{this.state.errorInfo.componentStack}</pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
```

- [ ] **Create ErrorBoundary CSS**

**File**: `frontend/src/components/ErrorBoundary/ErrorBoundary.css`

- [ ] **Create PanelErrorBoundary for bottom panels**

**File**: `frontend/src/components/ErrorBoundary/PanelErrorBoundary.jsx`

```jsx
import { ErrorBoundary } from './index';

export function PanelErrorBoundary({ children, panelName }) {
  return (
    <ErrorBoundary
      fallback={(error, retry) => (
        <div className="panel-error">
          <span>Failed to load {panelName}</span>
          <button onClick={retry}>Retry</button>
        </div>
      )}
    >
      {children}
    </ErrorBoundary>
  );
}
```

- [ ] **Wrap App root with ErrorBoundary**

**File**: `frontend/src/App.jsx`

```jsx
import { ErrorBoundary } from './components/ErrorBoundary';

function App() {
  return (
    <ErrorBoundary showDetails={process.env.NODE_ENV === 'development'}>
      {/* existing app content */}
    </ErrorBoundary>
  );
}
```

- [ ] **Wrap Holmes components**
- [ ] **Wrap resource table bottom panels**
- [ ] **Write unit tests** (target: 80% coverage)

#### Files to Create
```
frontend/src/components/ErrorBoundary/
  index.jsx
  ErrorBoundary.css
  PanelErrorBoundary.jsx
frontend/src/__tests__/ErrorBoundary.test.jsx
```

#### Files to Modify
```
frontend/src/App.jsx
frontend/src/holmes/HolmesBottomPanel.jsx
frontend/src/components/GenericResourceTable/BottomPanel.jsx (if exists)
```

#### Success Criteria
- [ ] ErrorBoundary component created with retry functionality
- [ ] App root wrapped with ErrorBoundary
- [ ] Holmes features wrapped with ErrorBoundary
- [ ] Bottom panels wrapped with PanelErrorBoundary
- [ ] Unit tests pass with 80%+ coverage

---

### 1.2 Fix Memory Leaks in setInterval Hooks

**Priority**: HIGH
**Effort**: 1 day
**Risk**: Low
**Files Affected**: 10+ files

#### Problem Statement

Multiple components use `setInterval` without proper cleanup, causing:
- Memory leaks (timers accumulate)
- Multiple simultaneous API calls
- State updates on unmounted components

**Files with missing cleanup**:
- `frontend/src/k8s/resources/shared/ResourceEventsTab.jsx`
- `frontend/src/k8s/resources/shared/ResourcePodsTab.jsx`
- `frontend/src/docker/resources/stacks/StackServicesTab.jsx`
- `frontend/src/docker/resources/stacks/SwarmStacksOverviewTable.jsx`
- `frontend/src/k8s/resources/configmaps/ConfigMapsOverviewTable.jsx`

#### Implementation

- [ ] **Create useInterval hook for safe interval management**

**File**: `frontend/src/hooks/useInterval.js`

```jsx
import { useEffect, useRef } from 'react';

/**
 * Safe interval hook that automatically cleans up on unmount.
 * @param {Function} callback - Function to call on each interval
 * @param {number|null} delay - Interval in ms, or null to pause
 */
export function useInterval(callback, delay) {
  const savedCallback = useRef(callback);

  // Remember the latest callback
  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  // Set up the interval
  useEffect(() => {
    if (delay === null) return;

    const id = setInterval(() => savedCallback.current(), delay);
    return () => clearInterval(id);
  }, [delay]);
}
```

- [ ] **Fix ResourceEventsTab.jsx**

```jsx
// BEFORE (memory leak)
useEffect(() => {
  intervalRef.current = setInterval(() => fetchEvents(false), refreshInterval);
  // Missing cleanup!
}, [refreshInterval]);

// AFTER (safe)
useInterval(() => fetchEvents(false), refreshInterval);
```

- [ ] **Fix ResourcePodsTab.jsx**
- [ ] **Fix StackServicesTab.jsx**
- [ ] **Fix SwarmStacksOverviewTable.jsx**
- [ ] **Fix ConfigMapsOverviewTable.jsx**
- [ ] **Audit all files for setInterval usage**

```bash
# Find all setInterval usages
grep -r "setInterval" frontend/src --include="*.jsx" --include="*.js"
```

- [ ] **Write unit tests for useInterval hook**

#### Files to Create
```
frontend/src/hooks/useInterval.js
frontend/src/__tests__/useInterval.test.js
```

#### Files to Modify
```
frontend/src/k8s/resources/shared/ResourceEventsTab.jsx
frontend/src/k8s/resources/shared/ResourcePodsTab.jsx
frontend/src/docker/resources/stacks/StackServicesTab.jsx
frontend/src/docker/resources/stacks/SwarmStacksOverviewTable.jsx
frontend/src/k8s/resources/configmaps/ConfigMapsOverviewTable.jsx
# + any other files found in audit
```

#### Success Criteria
- [ ] useInterval hook created and tested
- [ ] All setInterval usages have proper cleanup
- [ ] No memory leak warnings in React DevTools
- [ ] Unit tests pass with 80%+ coverage

---

### 1.3 Refactor DOM Manipulation to React Patterns

**Priority**: HIGH
**Effort**: 2 days
**Risk**: Medium
**Files Affected**: 8+ files

#### Problem Statement

Multiple files use direct DOM manipulation instead of React state/refs:
- `document.getElementById()` usage
- `element.classList.toggle()`
- `element.style.display = ...`
- `element.innerHTML = ...`

This bypasses React's virtual DOM, causing:
- Side effects outside React lifecycle
- Potential memory leaks
- Difficult to test and debug
- Inconsistent UI state

**Files with DOM manipulation**:
- `frontend/src/App.jsx` (sidebar toggle)
- `frontend/src/main-content.js` (extensive DOM creation)
- `frontend/src/notification.js` (innerHTML templates)
- `frontend/src/resource-overlay.js` (overlay creation)
- `frontend/src/layout/connection/ConnectionWizard.jsx`

#### Implementation

- [ ] **Refactor App.jsx sidebar toggle**

```jsx
// BEFORE (DOM manipulation)
useEffect(() => {
  const sidebarToggleBtn = document.getElementById('sidebar-toggle');
  if (sidebarToggleBtn) {
    sidebarToggleBtn.onclick = () => {
      const sidebar = document.getElementById('sidebar');
      sidebar.classList.toggle('collapsed');
      sidebarToggleBtn.innerHTML = isCollapsed ? '...' : '...';
    };
  }
  return () => {
    if (sidebarToggleBtn) sidebarToggleBtn.onclick = null;
  };
}, []);

// AFTER (React state)
const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

const handleSidebarToggle = useCallback(() => {
  setSidebarCollapsed(prev => !prev);
}, []);

// In JSX
<div id="sidebar" className={sidebarCollapsed ? 'collapsed' : ''}>
<button id="sidebar-toggle" onClick={handleSidebarToggle}>
  {sidebarCollapsed ? '>' : '<'}
</button>
```

- [ ] **Refactor notification.js to React component**

**Create**: `frontend/src/components/Notification/index.jsx`

```jsx
import { useState, useCallback, createContext, useContext } from 'react';
import './Notification.css';

const NotificationContext = createContext(null);

export function NotificationProvider({ children }) {
  const [notifications, setNotifications] = useState([]);

  const showNotification = useCallback((message, type = 'info', duration = 5000) => {
    const id = Date.now();
    setNotifications(prev => [...prev, { id, message, type }]);

    if (duration > 0) {
      setTimeout(() => {
        setNotifications(prev => prev.filter(n => n.id !== id));
      }, duration);
    }

    return id;
  }, []);

  const dismissNotification = useCallback((id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  return (
    <NotificationContext.Provider value={{ showNotification, dismissNotification }}>
      {children}
      <div className="notification-container">
        {notifications.map(({ id, message, type }) => (
          <div key={id} className={`notification notification-${type}`}>
            <span>{message}</span>
            <button onClick={() => dismissNotification(id)}>×</button>
          </div>
        ))}
      </div>
    </NotificationContext.Provider>
  );
}

export function useNotification() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within NotificationProvider');
  }
  return context;
}
```

- [ ] **Refactor resource-overlay.js to React component**
- [ ] **Update main-content.js to use React patterns**
- [ ] **Fix ConnectionWizard.jsx innerHTML usage**
- [ ] **Update all consumers to use new components**

#### Files to Create
```
frontend/src/components/Notification/
  index.jsx
  Notification.css
frontend/src/components/ResourceOverlay/
  index.jsx
  ResourceOverlay.css
frontend/src/__tests__/Notification.test.jsx
```

#### Files to Modify/Delete
```
frontend/src/App.jsx
frontend/src/main-content.js (refactor or delete)
frontend/src/notification.js (delete after migration)
frontend/src/resource-overlay.js (delete after migration)
frontend/src/layout/connection/ConnectionWizard.jsx
```

#### Success Criteria
- [ ] No `document.getElementById()` in React components
- [ ] No `classList.toggle()` in React components
- [ ] No `innerHTML` assignments in React components
- [ ] All notifications use NotificationProvider
- [ ] All overlays use React components
- [ ] E2E tests pass
- [ ] Unit tests pass with 70%+ coverage

---

## Part 2: Medium Priority - Production Readiness

### 2.1 Remove Console.log Statements

**Priority**: MEDIUM
**Effort**: 0.5 days
**Risk**: Low
**Files Affected**: 46 files

#### Problem Statement

46 files contain console.log/warn/error statements that should not be in production code.

#### Implementation

- [ ] **Create logger utility**

**File**: `frontend/src/utils/logger.js`

```jsx
const isDev = process.env.NODE_ENV === 'development';

export const logger = {
  debug: (...args) => isDev && console.log('[DEBUG]', ...args),
  info: (...args) => isDev && console.info('[INFO]', ...args),
  warn: (...args) => console.warn('[WARN]', ...args),
  error: (...args) => console.error('[ERROR]', ...args),
};
```

- [ ] **Remove debug console.log statements**

```bash
# Find all console statements
grep -rn "console\." frontend/src --include="*.jsx" --include="*.js" | grep -v node_modules
```

- [ ] **Replace necessary warnings with logger utility**
- [ ] **Add ESLint rule to prevent future console statements**

**File**: `frontend/.eslintrc.js` (or equivalent)

```javascript
{
  rules: {
    'no-console': ['warn', { allow: ['warn', 'error'] }]
  }
}
```

#### Files to Create
```
frontend/src/utils/logger.js
```

#### Files to Modify
```
# 46 files with console statements (see grep output)
frontend/src/App.jsx
frontend/src/holmes/HolmesContext.jsx
# ... many more
```

#### Success Criteria
- [ ] Logger utility created
- [ ] All debug console.log removed
- [ ] Necessary warnings use logger utility
- [ ] ESLint rule added
- [ ] No console statements in production build

---

### 2.2 Split Large Components

**Priority**: MEDIUM
**Effort**: 3 days
**Risk**: Medium
**Files Affected**: 4 large files

#### Problem Statement

4 components exceed 1000 lines, making them hard to maintain, test, and reason about:

| File | Lines | State Variables |
|------|-------|-----------------|
| PodOverviewTable.jsx | 1,218 | 15+ |
| CreateManifestOverlay.jsx | 1,033 | 10+ |
| LogViewerTab.jsx | 1,032 | 20+ |
| SwarmServicesOverviewTable.jsx | 866 | 12+ |

#### Implementation

- [ ] **Split LogViewerTab.jsx** (highest state complexity)

Extract into:
```
frontend/src/layout/bottompanel/LogViewer/
  index.jsx              # Main component (~100 lines)
  LogViewerToolbar.jsx   # Filter, search, pause controls
  LogViewerContent.jsx   # Log content display
  LogViewerHolmes.jsx    # Holmes analysis integration
  useLogViewerState.js   # useReducer for 20+ state variables
  logViewerReducer.js    # Reducer logic
```

**State consolidation with useReducer**:

```jsx
// BEFORE (20+ useState)
const [paused, setPaused] = useState(false);
const [filter, setFilter] = useState('');
const [regexMode, setRegexMode] = useState(false);
const [holmesAnalysis, setHolmesAnalysis] = useState(null);
const [holmesLoading, setHolmesLoading] = useState(false);
// ... 15 more

// AFTER (single useReducer)
const [state, dispatch] = useLogViewerReducer(initialState);
// state.paused, state.filter, state.regexMode, etc.
```

- [ ] **Split PodOverviewTable.jsx**

Extract into:
```
frontend/src/k8s/resources/pods/
  PodOverviewTable.jsx        # Main table (~200 lines)
  PodContextMenu.jsx          # Context menu actions
  PodBottomPanelContent.jsx   # Panel tab rendering
  PodPortForwarding.jsx       # Port forward logic
  PodShellConnection.jsx      # Shell/exec logic
  PodFileManager.jsx          # File browser logic
```

- [ ] **Split CreateManifestOverlay.jsx**

Extract into:
```
frontend/src/components/CreateManifest/
  index.jsx                   # Main overlay (~100 lines)
  ManifestEditor.jsx          # CodeMirror editor
  ManifestTemplates.jsx       # Template selection
  ManifestPreview.jsx         # YAML preview
  ManifestValidation.jsx      # Validation feedback
```

- [ ] **Split SwarmServicesOverviewTable.jsx**

Extract into:
```
frontend/src/docker/resources/services/
  SwarmServicesOverviewTable.jsx  # Main table (~200 lines)
  ServiceContextMenu.jsx          # Context menu
  ServiceBottomPanel.jsx          # Panel content
  ServiceScaling.jsx              # Scale dialog
```

#### Files to Create
```
# LogViewer split
frontend/src/layout/bottompanel/LogViewer/
  index.jsx
  LogViewerToolbar.jsx
  LogViewerContent.jsx
  LogViewerHolmes.jsx
  useLogViewerState.js
  logViewerReducer.js

# Pod split
frontend/src/k8s/resources/pods/
  PodContextMenu.jsx
  PodBottomPanelContent.jsx
  PodPortForwarding.jsx
  PodShellConnection.jsx
  PodFileManager.jsx

# CreateManifest split
frontend/src/components/CreateManifest/
  index.jsx
  ManifestEditor.jsx
  ManifestTemplates.jsx
  ManifestPreview.jsx
  ManifestValidation.jsx

# SwarmServices split
frontend/src/docker/resources/services/
  ServiceContextMenu.jsx
  ServiceBottomPanel.jsx
  ServiceScaling.jsx
```

#### Files to Modify
```
frontend/src/layout/bottompanel/LogViewerTab.jsx (refactor to use new components)
frontend/src/k8s/resources/pods/PodOverviewTable.jsx
frontend/src/CreateManifestOverlay.jsx
frontend/src/docker/resources/services/SwarmServicesOverviewTable.jsx
```

#### Success Criteria
- [ ] No component file exceeds 400 lines
- [ ] State complexity reduced with useReducer where appropriate
- [ ] Each extracted component has single responsibility
- [ ] All E2E tests pass
- [ ] Unit tests for new components (70%+ coverage)

---

### 2.3 Add API Timeout Protection

**Priority**: MEDIUM
**Effort**: 1 day
**Risk**: Low
**Files Affected**: 30+ Wails API calls

#### Problem Statement

Most Wails API calls have no timeout protection. If the backend hangs, the UI freezes indefinitely.

Good pattern exists in `ConnectionsStateContext.jsx` but not used consistently.

#### Implementation

- [ ] **Create withTimeout utility**

**File**: `frontend/src/utils/apiUtils.js`

```jsx
/**
 * Wraps a promise with a timeout.
 * @param {Promise} promise - The promise to wrap
 * @param {number} timeoutMs - Timeout in milliseconds
 * @param {string} [message] - Custom timeout error message
 */
export function withTimeout(promise, timeoutMs, message = 'Request timed out') {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timeoutId));
}

/**
 * Default timeout for API calls (10 seconds)
 */
export const DEFAULT_API_TIMEOUT = 10000;

/**
 * Wraps a Wails API call with default timeout
 */
export function wailsCall(apiCall, timeoutMs = DEFAULT_API_TIMEOUT) {
  return withTimeout(apiCall, timeoutMs);
}
```

- [ ] **Update high-priority API calls**

Priority order:
1. Connection status checks
2. Resource listing calls
3. Resource detail fetches
4. Action operations (scale, delete, etc.)

```jsx
// BEFORE
const status = await GetDockerConnectionStatus();

// AFTER
import { wailsCall } from '@/utils/apiUtils';
const status = await wailsCall(GetDockerConnectionStatus());
```

- [ ] **Add retry logic for transient failures**

```jsx
export async function wailsCallWithRetry(apiCall, options = {}) {
  const { timeout = DEFAULT_API_TIMEOUT, retries = 2, retryDelay = 1000 } = options;

  let lastError;
  for (let i = 0; i <= retries; i++) {
    try {
      return await withTimeout(apiCall(), timeout);
    } catch (err) {
      lastError = err;
      if (i < retries) {
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }
  }
  throw lastError;
}
```

#### Files to Create
```
frontend/src/utils/apiUtils.js
frontend/src/__tests__/apiUtils.test.js
```

#### Files to Modify
```
# High priority (connection-related)
frontend/src/layout/connection/ConnectionsStateContext.jsx
frontend/src/state/ClusterStateContext.jsx
frontend/src/docker/SwarmStateContext.jsx

# Resource tables
frontend/src/k8s/resources/*/OverviewTable.jsx (all)
frontend/src/docker/resources/*/OverviewTable.jsx (all)
```

#### Success Criteria
- [ ] withTimeout utility created and tested
- [ ] All connection status calls have timeout
- [ ] All resource listing calls have timeout
- [ ] Unit tests pass (80%+ coverage)

---

### 2.4 Replace innerHTML with Safe Alternatives

**Priority**: MEDIUM
**Effort**: 0.5 days
**Risk**: Low
**Files Affected**: 4+ files

#### Problem Statement

`innerHTML` usage creates XSS risk if user input is ever included. Found in:
- `frontend/src/App.jsx`
- `frontend/src/notification.js`
- `frontend/src/resource-overlay.js`

#### Implementation

- [ ] **Replace innerHTML with textContent or React**

```jsx
// BEFORE (XSS risk)
sidebarToggleBtn.innerHTML = isCollapsed ? '>' : '<';

// AFTER (safe)
sidebarToggleBtn.textContent = isCollapsed ? '>' : '<';

// Or better - use React state (covered in 1.3)
```

- [ ] **Use React rendering for dynamic content**

All dynamic HTML should be rendered through React, not innerHTML.

- [ ] **Add ESLint rule to prevent innerHTML**

```javascript
{
  rules: {
    'no-restricted-properties': ['error', {
      object: 'element',
      property: 'innerHTML',
      message: 'Use textContent or React rendering instead of innerHTML'
    }]
  }
}
```

#### Files to Modify
```
frontend/src/App.jsx
frontend/src/notification.js (or delete if migrated to React)
frontend/src/resource-overlay.js (or delete if migrated to React)
```

#### Success Criteria
- [ ] No innerHTML usage in codebase
- [ ] ESLint rule added to prevent future usage
- [ ] All dynamic content uses React rendering

---

## Part 3: Low Priority - Code Quality

### 3.1 Fix JSON.stringify in useEffect Dependencies

**Priority**: LOW
**Effort**: 0.5 days
**Risk**: Low
**Files Affected**: 4+ files

#### Problem Statement

Using `JSON.stringify()` in dependency arrays creates a new string every render, causing unnecessary re-renders.

Found in:
- `ConfigMapsOverviewTable.jsx` (3 instances)
- `JobsOverviewTable.jsx`

#### Implementation

- [ ] **Replace JSON.stringify with stable key**

```jsx
// BEFORE (creates new string every render)
useEffect(() => {
  // ...
}, [JSON.stringify(namespaces)]);

// AFTER (stable primitive)
const namespacesKey = Array.isArray(namespaces) ? namespaces.sort().join(',') : '';
useEffect(() => {
  // ...
}, [namespacesKey]);
```

- [ ] **Use useMemo for complex dependency objects**

```jsx
const stableConfig = useMemo(() => ({
  namespaces: namespaces.sort().join(','),
  filters: filters.join(','),
}), [namespaces, filters]);

useEffect(() => {
  // ...
}, [stableConfig.namespaces, stableConfig.filters]);
```

#### Files to Modify
```
frontend/src/k8s/resources/configmaps/ConfigMapsOverviewTable.jsx
frontend/src/k8s/resources/jobs/JobsOverviewTable.jsx
# + any other files using JSON.stringify in deps
```

#### Success Criteria
- [ ] No JSON.stringify in useEffect dependencies
- [ ] No unnecessary re-renders (verify with React DevTools)

---

### 3.2 Extract Magic Numbers to Constants

**Priority**: LOW
**Effort**: 0.5 days
**Risk**: Low
**Files Affected**: 15+ files

#### Problem Statement

Hardcoded values scattered throughout codebase:
- `const deadline = Date.now() + 8000;` (App.jsx)
- `MAX_LINES = 10000` (LogViewerTab.jsx)
- `setInterval(loadServices, 5000)` (StackServicesTab.jsx)
- `localStorage.getItem('monitorpanel.height') || 400` (MonitorPanel.jsx)

#### Implementation

- [ ] **Create constants file**

**File**: `frontend/src/constants/index.js`

```jsx
// Timing constants
export const TIMEOUTS = {
  API_DEFAULT: 10000,
  API_LONG: 30000,
  CONNECTION_CHECK: 8000,
  POLLING_INTERVAL: 5000,
  NOTIFICATION_DURATION: 5000,
};

// Log viewer constants
export const LOG_VIEWER = {
  MAX_LINES: 10000,
  BATCH_SIZE: 100,
  UPDATE_INTERVAL: 100,
};

// UI defaults
export const UI_DEFAULTS = {
  MONITOR_PANEL_HEIGHT: 400,
  SIDEBAR_WIDTH: 250,
  BOTTOM_PANEL_HEIGHT: 300,
};

// Local storage keys
export const STORAGE_KEYS = {
  MONITOR_PANEL_HEIGHT: 'monitorpanel.height',
  LOG_VIEWER_HEIGHT: 'logviewer.height',
  SIDEBAR_COLLAPSED: 'sidebar.collapsed',
};
```

- [ ] **Update files to use constants**

```jsx
// BEFORE
const deadline = Date.now() + 8000;

// AFTER
import { TIMEOUTS } from '@/constants';
const deadline = Date.now() + TIMEOUTS.CONNECTION_CHECK;
```

#### Files to Create
```
frontend/src/constants/index.js
```

#### Files to Modify
```
frontend/src/App.jsx
frontend/src/layout/bottompanel/LogViewerTab.jsx
frontend/src/docker/resources/stacks/StackServicesTab.jsx
frontend/src/layout/MonitorPanel.jsx
# + other files with magic numbers
```

#### Success Criteria
- [ ] Constants file created
- [ ] All timeout values use constants
- [ ] All localStorage keys use constants
- [ ] All UI default values use constants

---

### 3.3 Add PropTypes Validation (Interim TypeScript Step)

**Priority**: LOW
**Effort**: 2-3 days
**Risk**: Low
**Files Affected**: All components (357 files)

#### Problem Statement

No runtime prop validation. Components accept arbitrary props without validation, leading to:
- Runtime errors in production
- Harder refactoring
- No IDE autocompletion

#### Implementation

- [ ] **Add PropTypes to high-traffic components first**

Priority order:
1. GenericResourceTable
2. BaseModal
3. ErrorBoundary
4. All context providers
5. Shared hooks

```jsx
import PropTypes from 'prop-types';

GenericResourceTable.propTypes = {
  resourceType: PropTypes.string.isRequired,
  columns: PropTypes.arrayOf(PropTypes.shape({
    key: PropTypes.string.isRequired,
    label: PropTypes.string.isRequired,
    sortable: PropTypes.bool,
  })).isRequired,
  data: PropTypes.array.isRequired,
  loading: PropTypes.bool,
  onRowSelect: PropTypes.func,
};

GenericResourceTable.defaultProps = {
  loading: false,
  onRowSelect: null,
};
```

- [ ] **Add ESLint rule to require PropTypes**

```javascript
{
  rules: {
    'react/prop-types': 'warn'
  }
}
```

- [ ] **Document migration path to TypeScript**

Create `docs/typescript-migration.md` with plan for future TS adoption.

#### Files to Modify
```
# Priority 1: Shared components
frontend/src/components/GenericResourceTable/index.jsx
frontend/src/components/BaseModal/index.jsx
frontend/src/components/ErrorBoundary/index.jsx

# Priority 2: Context providers
frontend/src/state/ClusterStateContext.jsx
frontend/src/docker/SwarmStateContext.jsx
frontend/src/holmes/HolmesContext.jsx

# Priority 3: All other components (gradual)
```

#### Success Criteria
- [ ] PropTypes added to all shared components
- [ ] PropTypes added to all context providers
- [ ] ESLint rule configured
- [ ] TypeScript migration plan documented

---

## Part 4: Testing Requirements

### 4.1 Unit Test Coverage

All new code must meet 70% coverage per CLAUDE.md:

| Component | Target Coverage |
|-----------|-----------------|
| ErrorBoundary | 80% |
| useInterval | 80% |
| Notification | 70% |
| Logger utility | 80% |
| apiUtils | 80% |
| Constants | N/A (no logic) |

### 4.2 E2E Test Verification

After each phase:
- [ ] All K8s E2E tests pass: `cd e2e && npx playwright test`
- [ ] All Swarm E2E tests pass: `cd e2e && npx playwright test tests/swarm/`

### 4.3 Manual Testing Checklist

- [ ] Error boundary shows error UI when component crashes
- [ ] Error boundary retry button works
- [ ] No memory leak warnings in React DevTools
- [ ] Sidebar toggle works correctly
- [ ] Notifications display and dismiss properly
- [ ] API timeouts show appropriate error messages
- [ ] No console.log in production build

---

## Implementation Schedule

### Phase 1: Critical Stability (Week 1)

| Day | Task | Deliverable |
|-----|------|-------------|
| 1 | Create ErrorBoundary component | Working error boundaries |
| 1 | Wrap critical components with ErrorBoundary | Protected UI |
| 2 | Create useInterval hook | Safe interval management |
| 2 | Fix all setInterval memory leaks | No memory leaks |
| 3-4 | Refactor App.jsx DOM manipulation | React-based sidebar |
| 4 | Create Notification component | React notifications |
| 5 | Testing and bug fixes | All tests passing |

### Phase 2: Production Readiness (Week 2)

| Day | Task | Deliverable |
|-----|------|-------------|
| 1 | Create logger utility | Structured logging |
| 1 | Remove console.log statements | Clean production logs |
| 2 | Create apiUtils with timeout | API timeout protection |
| 2 | Update critical API calls | Protected API calls |
| 3 | Replace innerHTML usages | XSS-safe rendering |
| 4-5 | Split LogViewerTab.jsx | Smaller components |

### Phase 3: Code Quality (Week 3)

| Day | Task | Deliverable |
|-----|------|-------------|
| 1-2 | Split remaining large components | Maintainable code |
| 3 | Extract magic numbers | Constants file |
| 3 | Fix JSON.stringify in deps | Optimized renders |
| 4-5 | Add PropTypes to shared components | Type validation |

---

## Success Metrics

### Stability
- [ ] Zero white-screen crashes (error boundaries catch all)
- [ ] No memory leak warnings in DevTools
- [ ] API calls timeout after 10s with user feedback

### Code Quality
- [ ] No component file > 400 lines
- [ ] No console.log in production
- [ ] No innerHTML in React components
- [ ] No magic numbers (use constants)

### Testing
- [ ] Unit test coverage >= 70% for new code
- [ ] All E2E tests pass
- [ ] No visual regressions

### Maintainability
- [ ] PropTypes on all shared components
- [ ] Constants file for configuration values
- [ ] Logger utility for debugging

---

## Risk Mitigation

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| ErrorBoundary doesn't catch all errors | Low | High | Test with various error types |
| DOM refactor breaks existing functionality | Medium | High | Comprehensive E2E testing |
| Component split breaks state management | Medium | Medium | Careful state lifting |
| PropTypes slow down development | Low | Low | Start with shared components only |

---

## Appendix: Files Summary

### Files to Create (18 new files)

```
# Error Boundaries
frontend/src/components/ErrorBoundary/index.jsx
frontend/src/components/ErrorBoundary/ErrorBoundary.css
frontend/src/components/ErrorBoundary/PanelErrorBoundary.jsx
frontend/src/__tests__/ErrorBoundary.test.jsx

# Hooks
frontend/src/hooks/useInterval.js
frontend/src/__tests__/useInterval.test.js

# Notification System
frontend/src/components/Notification/index.jsx
frontend/src/components/Notification/Notification.css
frontend/src/__tests__/Notification.test.jsx

# Utilities
frontend/src/utils/logger.js
frontend/src/utils/apiUtils.js
frontend/src/__tests__/apiUtils.test.js

# Constants
frontend/src/constants/index.js

# Component Splits (LogViewer)
frontend/src/layout/bottompanel/LogViewer/index.jsx
frontend/src/layout/bottompanel/LogViewer/LogViewerToolbar.jsx
frontend/src/layout/bottompanel/LogViewer/LogViewerContent.jsx
frontend/src/layout/bottompanel/LogViewer/useLogViewerState.js
frontend/src/layout/bottompanel/LogViewer/logViewerReducer.js
```

### Files to Modify (50+ files)

```
# Critical modifications
frontend/src/App.jsx
frontend/src/main-content.js
frontend/src/notification.js (or delete)
frontend/src/resource-overlay.js (or delete)

# Memory leak fixes
frontend/src/k8s/resources/shared/ResourceEventsTab.jsx
frontend/src/k8s/resources/shared/ResourcePodsTab.jsx
frontend/src/docker/resources/stacks/StackServicesTab.jsx
frontend/src/docker/resources/stacks/SwarmStacksOverviewTable.jsx
frontend/src/k8s/resources/configmaps/ConfigMapsOverviewTable.jsx

# Console.log removal (46 files - see grep output)
# API timeout additions (30+ files)
# PropTypes additions (gradual)
```

### Files to Delete (after migration)

```
frontend/src/notification.js (replaced by Notification component)
frontend/src/resource-overlay.js (replaced by React component)
```
