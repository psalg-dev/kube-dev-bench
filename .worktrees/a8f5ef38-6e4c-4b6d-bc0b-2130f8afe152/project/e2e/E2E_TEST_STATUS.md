# E2E Test Status and Implementation Plan

## Current Status Summary

| Component | Status | Notes |
|-----------|--------|-------|
| Kubernetes E2E Tests | **PASSING** | dev branch run #120 passed |
| Docker Swarm E2E Tests | **NOT RUNNING IN CI** | CI lacks Docker Swarm initialization |
| swarm branch | **FAILED** | Run #121 failed due to missing Swarm support in CI |

---

## Test Coverage Analysis

### Kubernetes Tests (18 spec files)

All K8s tests are working and pass in CI. Coverage includes:

| Test File | Feature Tested |
|-----------|---------------|
| `00-connect-and-select.spec.ts` | KinD cluster connection |
| `10-create-deployment-and-open-details.spec.ts` | Deployment creation & details panel |
| `20-create-configmap.spec.ts` | ConfigMap creation |
| `30-create-job-and-cronjob.spec.ts` | Job/CronJob creation |
| `40-create-secret-and-pvc.spec.ts` | Secret & PVC creation |
| `50-create-daemonset-and-open-details.spec.ts` | DaemonSet creation |
| `50-bottom-panels-workloads.spec.ts` | Workload panels (Deployment, Pod, etc.) |
| `60-create-statefulset-and-replicaset.spec.ts` | StatefulSet/ReplicaSet creation |
| `60-bottom-panels-batch.spec.ts` | Batch resource panels (Job, CronJob) |
| `61-bottom-panels-config.spec.ts` | Config resource panels |
| `62-bottom-panels-storage.spec.ts` | Storage resource panels |
| `70-create-and-delete-configmap-from-details.spec.ts` | Delete from details panel |
| `80-create-pod-open-yaml-and-delete.spec.ts` | Pod lifecycle with YAML |
| `85-proxy-settings.spec.ts` | Proxy configuration |
| `90-overlay-closes-with-escape.spec.ts` | Overlay escape key handling |
| `95-helm-releases-view.spec.ts` | Helm releases feature |
| `98-sidebar-navigation-renders-correct-view.spec.ts` | Sidebar navigation |
| `99-navigate-sections.spec.ts` | Section navigation |

### Docker Swarm Tests (7 spec files)

Swarm tests exist but **cannot run in CI** due to missing Docker Swarm initialization:

| Test File | Feature Tested | Local Status |
|-----------|---------------|--------------|
| `swarm/00-connect-to-swarm.spec.ts` | Swarm connection wizard | Works locally |
| `swarm/10-view-services.spec.ts` | Services listing & details | Works locally |
| `swarm/20-scale-service.spec.ts` | Service scaling | Works locally |
| `swarm/30-view-tasks-logs.spec.ts` | Tasks & logs viewing | Works locally |
| `swarm/40-manage-nodes.spec.ts` | Node management (drain/activate) | Works locally |
| `swarm/50-navigate-sections.spec.ts` | Sidebar navigation | Works locally |
| `swarm/60-create-service.spec.ts` | Service creation | Works locally |

---

## Features NOT Yet E2E Tested

### Docker Swarm Features (High Priority)

1. **Resource Creation** (partial coverage):
   - [ ] Config creation via overlay
   - [ ] Secret creation via overlay
   - [ ] Network creation via overlay
   - [ ] Volume creation via overlay
   - [ ] Stack deployment via overlay

2. **Resource Management**:
   - [ ] Service restart
   - [ ] Service deletion
   - [ ] Config deletion
   - [ ] Secret deletion
   - [ ] Network deletion
   - [ ] Volume deletion

3. **Details Panel Features**:
   - [ ] Service YAML tab
   - [ ] Service Tasks tab
   - [ ] Node details panel
   - [ ] Config data viewing
   - [ ] Secret data viewing (masked)

4. **Connection Wizard (new refactored layout)**:
   - [ ] Unified connection wizard sidebar sections
   - [ ] Kubernetes connections list in wizard
   - [ ] Docker Swarm connections list in wizard
   - [ ] Pinned connections
   - [ ] Add Swarm connection overlay (TCP/TLS)
   - [ ] Connection proxy settings

### Kubernetes Features (Lower Priority - Good Coverage)

1. **Resource Operations**:
   - [ ] Scale Deployment/StatefulSet
   - [ ] Restart Deployment
   - [ ] Delete resources from table (not just details)

2. **Bottom Panel**:
   - [ ] Events tab validation
   - [ ] Logs streaming verification

---

## Root Cause: CI Failure on swarm Branch

The CI workflow (`.github/workflows/build.yml`) does NOT initialize Docker Swarm:

```yaml
# Current workflow - MISSING Docker Swarm init
- name: Create KinD cluster
  run: |
    kind create cluster --name kdb-e2e --wait 120s
# NO docker swarm init!
```

### Required Fix

Add Docker Swarm initialization to the CI workflow:

```yaml
- name: Initialize Docker Swarm
  run: |
    docker swarm init --advertise-addr 127.0.0.1 || true
```

---

## Implementation Plan

### Phase 1: Fix CI to Support Swarm Tests

**Priority: CRITICAL - Must be done first**

1. Update `.github/workflows/build.yml`:
   - Add `docker swarm init` step before E2E tests
   - Create test services for Swarm E2E tests

2. Verify Swarm tests pass in CI:
   - Tests should connect to local Docker socket
   - Tests should use skip pattern for unavailable Swarm

### Phase 2: Add Missing Swarm E2E Tests

**Priority: HIGH**

Add tests for creation overlays:

```
e2e/tests/swarm/70-create-config.spec.ts    # Config creation
e2e/tests/swarm/71-create-secret.spec.ts    # Secret creation
e2e/tests/swarm/72-create-network.spec.ts   # Network creation
e2e/tests/swarm/73-create-volume.spec.ts    # Volume creation
e2e/tests/swarm/74-deploy-stack.spec.ts     # Stack deployment
```

Add tests for resource management:

```
e2e/tests/swarm/80-delete-service.spec.ts   # Service deletion
e2e/tests/swarm/81-restart-service.spec.ts  # Service restart
```

### Phase 3: Test Connection Wizard Refactoring

**Priority: MEDIUM**

The connection wizard was refactored to a unified layout. Update page objects and tests:

1. Update `ConnectionWizardPage.ts` for new layout
2. Add tests for:
   - Switching between K8s and Swarm sections
   - Pinning connections
   - Proxy settings per connection

### Phase 4: Improve Test Stability

**Priority: MEDIUM**

1. Add retry logic for flaky Swarm connections
2. Improve service creation wait times
3. Add cleanup for created test resources

---

## CI Workflow Changes Required

```yaml
# Add to .github/workflows/build.yml BEFORE e2e tests

- name: Initialize Docker Swarm
  run: |
    docker swarm init --advertise-addr 127.0.0.1 2>/dev/null || true

- name: Verify Swarm is active
  run: |
    docker info --format '{{.Swarm.LocalNodeState}}'
```

---

## Recommended Execution Order

1. **Immediate**: Update CI workflow with Docker Swarm init
2. **This Sprint**: Add remaining Swarm creation tests
3. **Next Sprint**: Update connection wizard tests
4. **Ongoing**: Improve test stability and coverage

---

## Running Tests Locally

### Prerequisites
```bash
# Initialize Docker Swarm if not active
docker swarm init --advertise-addr 127.0.0.1 2>/dev/null || true

# Start KinD cluster for K8s tests
cd kind && docker compose up -d

# Build frontend
cd frontend && npm install && npm run build
```

### Run All Tests
```bash
cd e2e && npm install && npx playwright install && npx playwright test
```

### Run Only Swarm Tests
```bash
cd e2e && npx playwright test tests/swarm/
```

### Run Only K8s Tests
```bash
cd e2e && npx playwright test --ignore-pattern="**/swarm/**"
```

---

## Metrics

- **Total E2E Test Files**: 25
- **K8s Test Files**: 18
- **Swarm Test Files**: 7
- **Estimated Coverage**: ~60% of UI features
- **Target Coverage**: 80%+
