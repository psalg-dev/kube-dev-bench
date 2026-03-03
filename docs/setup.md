---
layout: default
title: Setup
nav_order: 2
---

# Local Development Setup

This repository uses Go for the backend, React (Vite) for the frontend, and Wails for the desktop app shell.

Prerequisites
- Go 1.21+
- Node 20+
- npm (bundled with Node)
- Wails CLI v2 (optional for desktop builds)
- Docker (optional for Swarm/E2E)

Quick start
1. Run the automated checker:
   powershell -ExecutionPolicy Bypass -File scripts/setup-dev.ps1
2. If all checks pass:
   - go mod download
   - cd frontend && npm install
3. Run unit tests:
   - go test ./...
   - cd frontend && npm test

Notes
- The setup script only checks for installed tools and prints guidance; it does not attempt to install software.
- For CI-specific coverage tooling, see the repository's .github workflows and coverage scripts.
