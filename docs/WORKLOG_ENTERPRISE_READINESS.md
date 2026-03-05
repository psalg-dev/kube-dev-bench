# Worklog: Enterprise Readiness Fixes

**Branch:** `feature/enterprise-readiness-fixes`  
**Source:** `project/todo/ENTERPRISE_READINESS_REVIEW.md`

## Progress

- [x] CRIT-2: Fix holmesConfig race — move into App struct with mutex
- [ ] CRIT-3: PVC helper pod cleanup on shutdown
- [ ] CRIT-4: Scope allowInsecure per-context
- [ ] CRIT-1: Credential encryption at rest (OS keyring)
- [ ] IMP-1: Fix context.Background() in Helm operations
- [ ] IMP-2: Rate limit probe clients
- [ ] IMP-3: Add pagination to list operations  
- [ ] IMP-5: Hook script path validation
- [ ] IMP-4: Cap secret value size in GetSecretData
- [ ] IMP-6: Fix monitor polling timer (time.After → ticker)
- [ ] IMP-9: Configurable Swarm helper image
- [ ] SUG-1: Add audit log for mutating operations
- [ ] SUG-3: Shell session reaper
- [ ] SUG-5: Graph cache eviction sweep
- [ ] SUG-7: Log stream rate limiting
- [ ] SUG-9: Fix insecureWarnOnce not resetting between contexts
- [ ] Tests for all changes
- [ ] CI green
