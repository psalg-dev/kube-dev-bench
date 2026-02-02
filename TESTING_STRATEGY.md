# Testing Strategy for OverviewTableWithPanel Components

## Executive Summary

This document outlines the testing strategy for OverviewTableWithPanel components in the KubeDevBench frontend, based on hands-on experience testing both Swarm and Kubernetes components.

## Current State

### Test Coverage
- **Starting Coverage:** 55.01%
- **Current Coverage:** 55.19% (+0.18%)
- **Test Files:** 141 total (140 passing)
- **Test Cases:** 1345 total (1340 passing)

### Components Using OverviewTableWithPanel
- **Swarm (8 components):** ✅ Fully tested with comprehensive coverage
- **K8s (11 components):** ❌ No unit tests, complex architecture makes unit testing difficult

## Architecture Analysis

### Swarm Components (Successfully Tested)
**Pattern:**
```javascript
// Clean import path
import { EventsOn } from '../../wailsjs/runtime/runtime.js';

// Straightforward data flow
const [data, setData] = useState([]);
useEffect(() => {
  GetSwarmServices().then(setData);
}, []);
```

**Advantages:**
- Direct `runtime.js` import path (easy to mock)
- Simple data fetching without complex polling
- Minimal event subscriptions
- Holmes integration is optional
- Straightforward to test with standard mocking

### K8s Components (Challenging to Test)
**Pattern:**
```javascript
// Directory import (package.json resolution)
import { EventsOn, EventsOff } from '../../../../wailsjs/runtime';

// Complex polling and event handling
useEffect(() => {
  const fastPoll = setInterval(fetch, 1000);
  const slowPoll = setTimeout(() => setInterval(fetch, 60000), 60000);
  EventsOn('resource-updated', handler);
  EventsOn('configmaps:update', handler);
  return () => { /* cleanup */ };
}, []);
```

**Challenges:**
1. **Module Resolution:** Directory imports resolve via `package.json` "main" field, which vitest may not follow consistently
2. **Complex State Management:** Multiple timers, intervals, and event subscriptions
3. **Deep Integration:** Holmes AI, port forwarding, bottom panels all integrated
4. **Polling Logic:** Fast initial polling transitioning to slow polling
5. **Event Handling:** Multiple runtime event types to mock

## Testing Approaches Evaluated

### Approach 1: Unit Tests (Attempted)
**Goal:** Test K8s OverviewTableWithPanel components with mocked dependencies

**Attempt:**
```javascript
vi.mock('../../../../wailsjs/runtime', () => ({
  EventsOn: vi.fn(),
  EventsOff: vi.fn(),
}));
```

**Result:** ❌ Failed
- Module resolution issues (`../../wailsjs/runtime/runtime.js` vs `../../../../wailsjs/runtime`)
- Vitest couldn't properly mock the directory import
- Complex timer/event cleanup caused test hangs
- Deep mocking required for all child components

**Lessons Learned:**
- Directory imports don't mock cleanly in vitest
- Components with side effects need architectural changes to be testable
- Complex state machines are better tested as integration tests

### Approach 2: E2E Tests (Recommended) ⭐
**Goal:** Test full user workflows with Playwright

**Advantages:**
- Tests actual user experience
- No mocking required
- Catches real integration issues
- Infrastructure already exists (`e2e/` directory)
- Proven to work well

**Implementation:**
```javascript
test('User can view and delete a ConfigMap', async ({ page }) => {
  await page.goto('/');
  await page.click('text=Config Maps');
  await page.waitForSelector('[data-testid="overview-table"]');
  await page.click('text=app-config');
  // ... assertions
});
```

**Coverage Impact:** High confidence, real UX validation

### Approach 3: Extract Testable Functions (Pragmatic)
**Goal:** Extract pure functions from components for unit testing

**Example:**
```javascript
// Extract from component
export function normalizeConfigMaps(arr) {
  return (arr || []).map(cm => ({
    ...cm,
    name: cm.name ?? cm.Name,
    namespace: cm.namespace ?? cm.Namespace,
    keys: cm.keys ?? cm.Keys ?? '-',
    // ...
  }));
}

// Easy to test
describe('normalizeConfigMaps', () => {
  it('handles different casing', () => {
    const input = [{ Name: 'test', Namespace: 'default' }];
    const result = normalizeConfigMaps(input);
    expect(result[0].name).toBe('test');
  });
});
```

**Advantages:**
- Tests business logic without UI complexity
- No mocking required
- Fast test execution
- Improves code organization

**Coverage Impact:** Moderate, focuses on logic not integration

## Recommended Strategy

### Priority 1: E2E Tests for Critical Workflows ⭐
Focus on high-value user journeys:

1. **Pods Management**
   - View pod list
   - Click pod to open details
   - View logs
   - Delete pod
   - Restart pod

2. **Deployments Management**
   - View deployment list
   - Scale deployment
   - View rollout status
   - View deployment logs

3. **Services Management**
   - View services
   - Navigate to endpoints
   - View service details

**Estimated Effort:** 2-3 days
**Coverage Impact:** High confidence in UX
**ROI:** Excellent

### Priority 2: Extract and Test Business Logic
Refactor components to separate concerns:

1. **Data Normalization Functions**
   - `normalizeConfigMaps`
   - `normalizePods`
   - `normalizeDeployments`

2. **Formatters and Utilities**
   - Duration parsing
   - Status badge logic
   - Port formatting

3. **Action Handlers**
   - Delete confirmation logic
   - Scale validation
   - Error handling

**Estimated Effort:** 1 week
**Coverage Impact:** +5-10% code coverage
**ROI:** Good (improves architecture + testability)

### Priority 3: Refactor for Testability (Long-term)
Standardize K8s components to match Swarm pattern:

1. **Simplify Runtime Imports**
   ```javascript
   // Current (problematic)
   import { EventsOn } from '../../../../wailsjs/runtime';
   
   // Better
   import { EventsOn } from '../../../../wailsjs/runtime/runtime.js';
   ```

2. **Extract Side Effects**
   - Create custom hooks for data fetching
   - Separate polling logic from components
   - Use dependency injection for testability

3. **Standardize Architecture**
   - Common patterns across all overview tables
   - Shared hooks and utilities
   - Clear separation of concerns

**Estimated Effort:** 3-4 weeks
**Coverage Impact:** +15-20% code coverage
**ROI:** Excellent long-term

## Quick Wins

### Immediate Actions (Can Do Today)
1. ✅ Document testing challenges (done)
2. ✅ Identify testable utility functions (done)
3. Test existing utility modules:
   - `resourceNavigation.js` (simple, no dependencies)
   - `codeMirrorLanguage.js` (pure functions)
   - `logger.js` (simple utilities)

### This Week
1. Add E2E tests for top 3 resource types (Pods, Deployments, Services)
2. Extract and test normalization functions
3. Test column formatter functions

### This Month
1. Complete E2E coverage for all resource types
2. Refactor one K8s component as a pattern
3. Extract all business logic to testable modules

## Technical Recommendations

### For New Components
1. **Use explicit imports:** `import from './runtime.js'` not `'./runtime'`
2. **Separate concerns:** Pure functions, custom hooks, presentational components
3. **Dependency injection:** Pass dependencies as props for easier testing
4. **Document:** Clear JSDoc for all exported functions

### For Existing Components
1. **Don't rewrite:** Focus on new features and extracted functions
2. **E2E first:** Add E2E tests for critical paths
3. **Gradual refactor:** Extract one function at a time
4. **Maintain compatibility:** Don't break existing functionality

## Measuring Success

### Short-term Metrics (Next Sprint)
- [ ] +5 E2E test scenarios added
- [ ] +10 utility functions tested
- [ ] 0 regression bugs from changes
- [ ] Test execution time < 2 minutes

### Medium-term Metrics (Next Month)
- [ ] +5% code coverage
- [ ] All critical user flows have E2E tests
- [ ] 90%+ of utility functions tested
- [ ] <5 skipped or TODO tests

### Long-term Metrics (Next Quarter)
- [ ] 65%+ code coverage
- [ ] All overview tables follow consistent pattern
- [ ] <1 minute test execution time
- [ ] 100% of new PRs include tests

## Conclusion

**Key Takeaway:** Focus testing efforts where they provide the most value - E2E tests for integration confidence and unit tests for extracted business logic.

**Anti-patterns to Avoid:**
- ❌ Trying to unit test complex integrated components
- ❌ Over-mocking (leads to brittle tests)
- ❌ Testing implementation details instead of behavior
- ❌ Rewriting working code just to make it "more testable"

**Success Patterns:**
- ✅ E2E tests for user-facing functionality
- ✅ Unit tests for pure functions and utilities
- ✅ Extract logic before testing
- ✅ Test behavior, not implementation
- ✅ Focus on high-value, frequently-used features

**Next Steps:**
1. Review and approve this strategy
2. Create E2E test plan for Pods, Deployments, Services
3. Begin extracting normalization functions
4. Set up regular coverage monitoring
