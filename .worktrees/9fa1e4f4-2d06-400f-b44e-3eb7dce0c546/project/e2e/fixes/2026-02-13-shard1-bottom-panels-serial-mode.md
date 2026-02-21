# Fix: e2e shard-1 consistent failure – bottom-panel tests kill KinD API server

**Date:** 2026-02-13  
**CI runs analyzed:** 21985497886, 21984813202, 21981998133  
**Failing tests:** `50-bottom-panels-workloads.spec.ts`, `60-bottom-panels-batch.spec.ts`  
**Symptom:** `dial tcp 127.0.0.1:<port>: connect: connection refused` – KinD API server becomes unreachable

## Root Cause

Two heavy test files (`50-bottom-panels-workloads` and `60-bottom-panels-batch`) were assigned to separate Playwright workers and ran **simultaneously** on the CI runner. Both create multiple K8s resources (Deployments, StatefulSets, DaemonSets, Jobs, CronJobs + all their pods) on a single-node KinD cluster within a GitHub Actions runner (2 vCPU / 7 GB RAM).

The combined resource-creation pressure overwhelmed the kube-apiserver, causing it to become unresponsive. Key evidence:

- **Timeline:** 11 lighter tests pass in ~2 min → both heavy tests start simultaneously → API dies ~2 min later
- **Recovery futility:** The existing `recoverKubeconfigForApiAvailability()` only refreshed the kubeconfig (via `kind get kubeconfig`), which succeeds because the Docker container is alive. But the API server inside was unresponsive. Recovery logged "complete" but API remained dead.
- **Retry failure:** Each retry created a new worker, spent ~5 min in the namespace fixture's recovery loop, then the test body failed in ~130 ms because the API was still unreachable.
- **Pattern:** Recovery triggered every ~40 s for 7+ minutes straight, each time "completing" without fixing anything.

## Fix Applied

### 1. Merge heavy tests into serial execution (`50-bottom-panels.spec.ts`)

Merged the two test files into a single file with `test.describe.configure({ mode: 'serial' })`. This prevents Playwright from distributing them to different workers, ensuring they run sequentially on one worker and keeping peak cluster load manageable.

- Created: `e2e/tests/50-bottom-panels.spec.ts`
- Deleted: `e2e/tests/50-bottom-panels-workloads.spec.ts`, `e2e/tests/60-bottom-panels-batch.spec.ts`

### 2. Fix recovery mechanism (`kind.ts`)

Enhanced `recoverKubeconfigForApiAvailability()` to actually verify API health after kubeconfig refresh. If the API is still down, it now:

1. Restarts the KinD control-plane Docker container (`docker restart`)
2. Waits up to 60 s for the API server to become available
3. Returns `false` if the restart doesn't help (allowing the outer loop to escalate)

This makes retries genuinely effective instead of looping hopelessly.

## Approaches Considered but Not Used

| Approach | Why not |
|---|---|
| Reduce `PW_WORKERS` to 1 globally | Slows all tests, not just the heavy ones |
| Per-test namespaces (test-scoped) | Adds ~4 s overhead per test; doesn't reduce cluster load |
| Playwright project dependencies | Over-engineering; restructures the entire config |
| Cluster recreation on recovery | Too aggressive; loses all K8s state, extends recovery time significantly |

## Files Changed

- `e2e/tests/50-bottom-panels.spec.ts` – new merged file (serial mode)
- `e2e/tests/50-bottom-panels-workloads.spec.ts` – deleted
- `e2e/tests/60-bottom-panels-batch.spec.ts` – deleted
- `e2e/tests/60-bottom-panels-batch-config-storage.spec.ts` – updated comment
- `e2e/src/support/kind.ts` – enhanced recovery with API verification + container restart
