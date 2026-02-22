# Holmes Onboard Plan

**Status:** DONE
**Created:** 2026-02-06
**Updated:** 2026-02-06

When the user is connected to a k8s cluster and clicks the Holmes button and Holmes is not yet configured, we should offer the option to automatically deploy HolmesGPT via Helm chart to the connected cluster. Ask the user for their OpenAI key (or provider credentials) and guide them through a minimal, secure deployment flow. The deployment should be configured so the application's Holmes integration connects to the instance automatically once running. Provide robust error handling, progress indicators, and clear UX.

## Current Status (Verified 2026-02-06)

- Backend deployment helpers are implemented in [pkg/app/holmes_deployment.go](pkg/app/holmes_deployment.go) with tests in [pkg/app/holmes_deployment_test.go](pkg/app/holmes_deployment_test.go). Primary RPCs include `DeployHolmesGPT` and `UndeployHolmesGPT`.
- Frontend onboarding UI is implemented in [frontend/src/holmes/HolmesOnboardingWizard.tsx](frontend/src/holmes/HolmesOnboardingWizard.tsx) with styling in [frontend/src/holmes/HolmesOnboardingWizard.css](frontend/src/holmes/HolmesOnboardingWizard.css).
- E2E coverage is present in [e2e/tests/holmes/60-holmes-onboarding-deploy.spec.ts](e2e/tests/holmes/60-holmes-onboarding-deploy.spec.ts).

---

## Goals
- Provide one-click onboarding for Holmes (deploy via Helm)
- Securely collect provider credentials and store them in app config
- Show deployment progress and logs
- Auto-configure Holmes endpoint in app settings after successful install
- Provide rollback and cleanup actions

## Steps
1. Add onboarding UI in `frontend/src/holmes/OnboardOverlay.jsx`
2. Add backend Helm deploy helper in `pkg/app/holmes_onboard.go`
3. Add Wails bindings to invoke deploy/rollback/status
4. Add unit tests and E2E flow

