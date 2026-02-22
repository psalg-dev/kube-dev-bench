Test Plan: task-05 — Detailed unit tests for prioritized untested paths

Goal
- Increase combined coverage by >= 2 percentage points by adding focused unit tests.
- This document maps prioritized untested paths (from docs/COVERAGE_PRIORITIES.md and coverage CSVs) to concrete unit tests, including inputs, expected outputs, mocks, and fixtures.

How to use this plan
- For each target file below, create a *_test.go in the same package (or a *_test package if black-box testing is preferred).
- Follow the indicated mocks/fixtures. Use existing testutils in gowails/tests where possible.
- Run go test ./... and regenerate coverage with: go test ./... -covermode=atomic -coverprofile=coverage/go-coverage

Acceptance criteria
- New tests should be deterministic and not require network/docker unless explicitly marked (those should be unit-only with fakes/mocks).
- Combined coverage must increase by at least 2 percentage points (use scripts/parse-coverage.ps1 to measure combined result).

Prioritized targets and concrete tests
1) gowails/pkg/app/docker/registry/v2_features.go
- Rationale: small file, uncovered helpers.
- Tests to add:
  - TestDetectV2FeatureFlags_Empty: call the exported function(s) with an empty registry features map / nil input; expect default false flags.
    - Inputs: nil or empty map[string]bool
    - Expected: zero/false feature flags returned, no panic.
    - Mocks: none.
  - TestDetectV2FeatureFlags_AllTrue: map with known v2 feature keys set to true; expect returned struct has corresponding true fields.
    - Inputs: map[string]bool{"blobs":true,"mounts":true, ...}
    - Expected: struct fields true.
- Fixtures: simple in-test maps.
- Estimated effort: 1-2 hours. Estimated lines covered: 20-40.

2) gowails/pkg/app/docker/events.go
- Rationale: event parsing and routing has branches for different event types.
- Tests to add:
  - TestHandleDockerEvent_Create: simulate a create event payload, validate event handler enqueues/dispatches the expected internal event.
    - Inputs: DockerEvent{Type: "create", Action: "start", Actor: {...}}
    - Expected: handler returns nil error and internal event type set.
    - Mocks: replace event bus with test stub capturing published events.
  - TestHandleDockerEvent_Unknown: unknown action must be handled gracefully.
- Fixtures: small JSON payloads for events; use test stub for bus.
- Notes: If code uses package-level global event bus, wrap/restore in test to avoid cross-test leakage.
- Estimated effort: 2-3 hours. Estimated lines covered: 30-60.

3) gowails/pkg/app/docker/stacks_deploy.go
- Rationale: small deployment orchestration; branches for invalid manifests and success path.
- Tests to add:
  - TestDeployStack_InvalidManifest: call deploy with malformed manifest and expect an error.
    - Inputs: invalid YAML string or []byte
    - Expected: non-nil error and no side-effects.
    - Mocks: stub file reads or manifest parser via dependency injection if available; otherwise create temp file with bad content.
  - TestDeployStack_SuccessPath: provide minimal valid manifest and mock underlying Docker client to simulate successful deploy.
    - Inputs: minimal manifest, mocked client returning success
    - Expected: no error, return values match mocks.
- Fixtures: temp files, test double for docker client.
- Estimated effort: 2-4 hours. Estimated lines covered: 10-30.

4) gowails/pkg/app/pvc_files.go
- Rationale: file I/O and temporary file helpers have multiple branches (exists, not exists, read error).
- Tests to add:
  - TestLoadPVCFile_NotFound: simulate missing file path -> expect NotFound/empty behavior.
    - Inputs: path to temp nonexistent file
    - Expected: error or empty result depending on function contract.
  - TestLoadPVCFile_ReadError: create a directory where file expected and ensure read fails -> expect graceful error.
  - TestLoadPVCFile_Success: create temp file with sample PVC contents and validate parsing.
    - Inputs: temp file with YAML representing a PVC
    - Expected: parsed object matches expected fields.
- Mocks: none, use ioutil.TempFile and os.Chmod to simulate read errors if needed.
- Estimated effort: 3-4 hours. Estimated lines covered: 60-120 (high payoff).

5) gowails/pkg/app/pod_details.go and gowails/pkg/app/pods.go
- Rationale: many helpers, formatters, and conditional branches converting kube objects into UI models.
- Tests to add:
  - TestPodModel_FromSimplePod: build a minimal corev1.Pod object (using k8s.io/api types) and assert resulting model fields.
    - Inputs: &v1.Pod{ObjectMeta: ..., Spec: ..., Status: ...}
    - Expected: model.ID, Names, Phase mapping, container summaries.
  - TestPodModel_WithInitContainers,WithRestartCount: include init containers and non-zero restart counts to trigger branches.
  - TestPodModel_ContainerStatusesEdgeCases: statuses with nil fields, waiting/running/terminated states.
- Mocks: create kube types in test; no external cluster required.
- Fixtures: builder helper functions in test to construct pods quickly; consider adding test helper in gowails/pkg/app/testutils.
- Estimated effort: 4-6 hours. Estimated lines covered: 80-140.

6) gowails/pkg/app/kind_cluster.go
- Rationale: utilities around building CLI args and reading streams; good candidate to unit-test argument building and small parsing helpers.
- Tests to add:
  - TestBuildKindArgs_Defaults: assert the CLI args built for creating cluster match expectations given default options.
  - TestStreamReader_ReadUntilEOF: use a bytes.Buffer as fake stream and ensure reader reads correctly and handles partial lines.
- Mocks: use in-memory buffers and tmp files.
- Estimated effort: 2-3 hours. Estimated lines covered: 30-60.

7) Higher-effort, high-payoff candidates (pick one if needed)
- docker_integration.go, holmes_deployment.go, helm.go
- Approach: extract small pure functions; wrap external calls behind interfaces to allow fast unit tests; add integration-style tests as optional longer tasks.
- Tests to add:
  - For each, identify 2-3 small helpers with clear inputs/outputs and write unit tests with mocks.
- Estimated effort per file: 6-16 hours depending on required refactors. Estimated lines covered: 100+ per file.

Test naming conventions and structure
- Package tests: prefer using package name (not _test) when assertions need access to unexported helpers; otherwise use foo_test package for black-box tests.
- File names: <component>_test.go (e.g., registry_v2_features_test.go).
- Use table-driven tests for variants.
- Ensure tests clean up temp files and restore any global state.

Mocks & test utilities
- Re-use gowails/tests and any existing testutils in gowails/pkg/app/testutils.
- For event buses or clients that are package-level globals, add helper functions in tests to temporarily replace them with test doubles and restore after test.
- For Docker/K8s clients: define small interfaces in the component package that wrap the minimal methods used; implement in tests as fakes.

Measuring progress
- After adding tests for a target set, run parse-coverage.ps1 and inspect coverage/combined-coverage-summary.txt.
- Use the per-file CSV outputs to confirm the intended files gained coverage.
- Aim to add tests in small batches: implement tests for 1-3 small files first, verify +0.3–0.6% gain, then continue to medium targets.

Milestones & timebox
- Day 1 (quick wins): v2_features.go, events.go, stacks_deploy.go (expected combined +0.3–0.6%).
- Day 2: pvc_files.go and kind_cluster.go (+0.6–0.9%).
- Day 3: pods/pod_details.go (+0.6–1.2%).
- If still short, spend additional day on holmes_deployment or docker_integration helpers.

Deliverables for each PR (local branch)
- *_test.go files for added tests
- small test fakes in a test-only file (e.g., fakes_test.go)
- update to docs/COVERAGE_PROGRESS.md (optional) with before/after numbers produced by scripts/parse-coverage.ps1

Example concrete test template (to copy into new _test.go)
- Setup: create temp dir, instantiate any fakes, replace package globals if needed.
- Execution: call function under test.
- Assertions: use testify/assert or testing package to verify outputs and side-effects.
- Teardown: restore globals, remove temp files.

Non-goals / caveats
- This plan focuses on unit tests only — e2e failures seen earlier are environment-specific and out-of-scope for this task.
- If any code is tightly coupled to external systems, prefer small refactors to introduce interfaces for easier unit testing rather than adding heavy integration tests.

Contact points
- If you want, I can implement the Day 1 quick-win tests now (create tests, run coverage, iterate) — pick that option and I will proceed with changes, commits, and merges.

End of plan
