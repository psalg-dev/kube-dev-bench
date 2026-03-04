# Custom CA Certificate Support — Worklog

## Summary
Added support for custom root CA certificates across Kubernetes API connections
and Docker Registry connections. Users in enterprise environments with private
certificate authorities can now configure a CA bundle path so that TLS
connections trust the internal CA.

## Changes

### Backend (Go)

- [x] **pkg/app/config.go** — Added `CustomCAPath` field to `AppConfig`, load/save
  logic, `GetCustomCAPath()` / `SetCustomCAPath()` Wails-exposed methods.
- [x] **pkg/app/app_lifecycle.go** — Added `customCAPath` field to `App` struct.
- [x] **pkg/app/kube_rest.go** — Added `applyCustomCA()` that reads the PEM file,
  validates it, and merges it into `rest.TLSClientConfig.CAData`.
- [x] **pkg/app/docker/registry/types.go** — Added `CustomCACert` field to
  `RegistryConfig`.
- [x] **pkg/app/docker/registry/client.go** — Modified `NewV2Client()` to load
  custom CA into `tls.Config.RootCAs`.

### Frontend (React / TypeScript)

- [x] **frontend/wailsjs/go/main/App.js** / **App.d.ts** — Added binding stubs
  for `GetCustomCAPath` and `SetCustomCAPath`.
- [x] **frontend/wailsjs/go/models.ts** — Added `customCACert` to `RegistryConfig`.
- [x] **frontend/src/layout/connection/ConnectionProxySettings.tsx** — Added
  Custom CA Certificate section; renamed overlay title to "Connection Settings".
- [x] **frontend/src/layout/connection/ConnectionProxySettings.css** — Added
  divider and hint styles.
- [x] **frontend/src/docker/registry/AddRegistryModal.tsx** — Added custom CA
  cert path field.
- [x] **frontend/src/docker/registry/registry.css** — Added hint style.

### Tests

- [x] **pkg/app/kube_rest_test.go** — 9 tests for `applyCustomCA` and
  `SetCustomCAPath` using dynamically-generated self-signed certificates.
- [x] **pkg/app/docker/registry/client_custom_ca_test.go** — 4 tests for
  `NewV2Client` custom CA handling.
- [x] **frontend/src/__tests__/connectionWizard.test.tsx** — Updated mocks and
  assertions for the renamed overlay title.
- [x] **frontend/src/__tests__/wailsMocks.ts** — Added `GetCustomCAPath` /
  `SetCustomCAPath` to the centralized mock.
- [x] **e2e/tests/85-proxy-settings.spec.ts** — Updated heading assertions from
  `/proxy settings/i` to `/connection settings/i` to match renamed overlay.

## Test Results

- **Go backend**: All tests pass (`go test ./pkg/... -count=1`)
- **Frontend**: connectionWizard (43/43 pass), addRegistryModal (3/3 pass)
- **Pre-existing failures**: `@xyflow/react` unresolved import (10 suites) — not
  related to this change.
