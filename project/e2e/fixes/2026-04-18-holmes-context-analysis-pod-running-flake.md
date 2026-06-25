# 2026-04-18 – Holmes context analysis flake (pod running gate)

## Failing CI signal
- Workflow: `build.yml`
- Run: `24613440423`
- Job: `e2e-shard-1`
- Test: `tests/holmes/10-context-analysis.spec.ts` (`Ask Holmes from resource details opens Holmes tab`)
- Failure point: `e2e/tests/holmes/10-context-analysis.spec.ts:48`
- Symptom: first attempt failed waiting for pod status `Running` in the Pods section:
  `Status 'Running' did not appear in section 'pods' for /e2e-holmes-deploy-.../`

## Hypothesis
- This test uses the Holmes mock and only verifies that the Holmes tab opens from row actions.
- Requiring the pod row to reach exact UI status `Running` is stricter than the behavior under test.
- On cold CI runs the pod can still be pulling or transitioning even though the row already exists and the row actions are usable, which makes the spec flaky.

## Changes tried
1. Removed the pod `Running` wait from `tests/holmes/10-context-analysis.spec.ts`.
2. Kept the existing row-presence retry path (`waitForHolmesRowWithRefresh`) before opening row actions.
3. Removed the now-unused `waitForResourceStatus` import and helper from that spec.

## Validation
- CI evidence from run `24613440423`: shard 1 reported the test as **flaky** and then completed successfully after retry.
- Targeted local validation:
  - Command: `cd e2e && npm test -- tests/holmes/10-context-analysis.spec.ts`
  - Result: attempted, but did not reach Playwright execution during this session because the local Wails dev instance remained in startup/readiness waiting.

## Outcome
- Expected to reduce shard 1 flakiness by removing a readiness gate that is not required for the mocked Holmes-tab assertion.
- Needs confirmation from the next `build.yml` run or a completed targeted local rerun.