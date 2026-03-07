# Worklog: Enterprise Readiness Fixes

**Branch:** `feature/enterprise-readiness-fixes`  
**Source:** `project/todo/ENTERPRISE_READINESS_REVIEW.md`

## Progress

- [x] CRIT-2: Fix holmesConfig race — move into App struct with mutex (pre-existing)
- [x] CRIT-3: PVC helper pod cleanup on shutdown
- [x] CRIT-4: Scope allowInsecure per-context
- [ ] CRIT-1: Credential encryption at rest (OS keyring) — out of scope, recommend separate branch
- [x] IMP-1: Fix context.Background() in Helm operations
- [x] IMP-2: Rate limit probe clients (QPS=50, Burst=100)
- [x] IMP-3: Add pagination to list operations (Limit=500)
- [x] IMP-3 (follow-up): Fix 11 missed unpaginated getter fallback paths
- [x] IMP-4: Cap secret value size in GetSecretData (64KiB)
- [x] IMP-5: Hook script path validation (validateHookScriptPath)
- [x] IMP-6: Fix monitor polling timer (time.After → ticker + backpressure)
- [ ] IMP-7: K8s version compatibility guard — out of scope
- [ ] IMP-8: Auth plugin support — out of scope
- [x] IMP-9: Configurable Swarm helper image (KDB_SWARM_HELPER_IMAGE env)
- [x] SUG-1: Add audit log for mutating operations (JSONL)
- [x] SUG-2: Cap informer namespace count (max 10, emit warning)
- [x] SUG-3: Shell session reaper (30min idle, 20 max)
- [x] SUG-5: Graph cache eviction sweep (60s interval)
- [x] SUG-7: Log stream rate limiting (5ms min interval)
- [x] SUG-9: Fix insecureWarnOnce not resetting between contexts
- [x] Tests for all changes (13 new tests + 12 pre-existing test fixes)
- [x] CI green — Build #817 backend passed on Linux CI

## Commits

1. `c749c2c` — fix: enterprise readiness batch 1 (CRIT-3,4 IMP-1,2,4,5,6,9 SUG-9)
2. `0994cb4` — fix: enterprise readiness batch 2 (SUG-3,5,7 IMP-3)
3. `57bd93f` — feat: SUG-1 audit log for mutating operations
4. `c8ba643` — test: add tests and fix pre-existing test issues
5. `a00f943` — docs: update enterprise readiness worklog with progress
6. `649bad5` — fix: hooks tests place scripts under HOME for Linux CI compatibility

## Pre-existing Test Fixes

- Fixed `disableWailsEvents` pattern in `logs_multicontainer_test.go` (9 tests reset global guard)
- Added `defer Shutdown()` to startup tests missing cleanup
- Added `disableWailsEvents` guard to monitor_actions tests calling emitEvent

