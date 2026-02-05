---
description: 'KubeDevBench Development instructions'
applyTo: '**'
---

# KubeDevBench Development Instructions
This document provides instructions for effective development within the KubeDevBench project. Follow these guidelines to ensure consistency and quality across the codebase.

## Project Overview
- Desktop Kubernetes + Docker Swarm client built with Wails (Go backend) and React/Vite frontend.
- Backend lives in pkg/app/, frontend in frontend/src/.
- Frontend calls Go via Wails bindings in frontend/wailsjs/go/main/App.

## Development Environments
- Local development: Windows 11 using Visual Studio Code with GitHub Copilot and PowerShell.
- Cloud development: Linux-based environments used by coding agents.

## Architecture & Data Flow
- Frontend imports Wails bindings and calls Go functions to retrieve or mutate state.
- Go exposes functions via Wails; any signature changes require regenerating bindings (run wails dev).
- Resource views follow a standard pattern: sidebar → table → bottom-panel details.

## Stable DOM Selectors (Do Not Break)
E2E tests depend on these IDs. If you must change them, update all usages and tests.
- #show-wizard-btn
- #primaryConfigContent
- #sidebar
- #maincontent
- #connections-sidebar
- #connections-main
- #kubernetes-section
- #docker-swarm-section

## Notifications
- Any user action that changes state must trigger a notification.
- Notifications must be draggable, dismissible, and auto-disappear after 3 seconds.

## Frontend Guidelines
- Keep CSS component-scoped; avoid global CSS bloat.
- Use @tanstack/react-table for tables.
- Use @codemirror/lang-yaml for manifest editing.
- Avoid UI flicker: prefer stable layout and state updates.

## Backend Guidelines (Go)
- Follow idiomatic Go; prefer table-driven tests.
- Validate inputs early and return explicit errors.
- Keep handlers focused by resource type and avoid duplication.

## Kubernetes Resource UI Pattern
- Each resource type should have a table view with a bottom panel.
- CreateManifestOverlay must be supported consistently across resource types.
- Resource age should auto-refresh for newly created resources.

## Holmes Integration
- Holmes analysis is initiated from the bottom panel.
- Backend must enrich context (events, logs, related resources) before calling HolmesGPT.
- Streaming responses should render progressively in the frontend.

## Testing Expectations
- Frontend: Vitest + React Testing Library.
- Backend: Go testing with table-driven tests, target ≥70% coverage.
- E2E: Playwright tests in e2e/tests/, rely on stable selectors.
- When fixing tests, especially E2E tests, document the approaches tried and whether they were successful so we avoid repeating non-working approaches. Record these notes as Markdown files under project/e2e/fixes.

## Common Commands
- Dev: wails dev
- Build: wails build
- Frontend tests: cd frontend; npm test
- Backend tests: go test ./pkg/app/...
- E2E: cd e2e; npx playwright test

## Change Management
- Keep changes minimal and consistent with existing patterns.
- Update related tests when altering UI, selectors, or API contracts.
- Regenerate Wails bindings after changing backend signatures.
- When working from a planning document, keep it up to date as implementation progresses so we can always track work and resume later if interrupted.

## Additional Instructions
Make sure to refer to other instruction files in the .github/instructions/ directory for specific guidelines on testing, code style, and other best practices.