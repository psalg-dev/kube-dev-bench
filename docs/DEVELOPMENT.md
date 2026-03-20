---
layout: default
title: Development Guide
nav_order: 3
---

# Development Guide

This document describes how to set up your local development environment for the kube-dev-bench project.

Prerequisites
- Git
- Go (version 1.25+ recommended)
- Node.js and npm (for frontend)
- Docker (optional, for integration/e2e)
- Wails (optional, for building desktop frontend)

Quick start
1. Clone the repository and switch to dev branch:
   - git checkout dev
2. Create a feature branch for your task:
   - git checkout -b task-01-<your-name> dev
3. Install Go modules:
   - go mod download
4. Verify tests run:
   - go test ./...
5. Frontend (if changing ui):
   - cd frontend
   - npm ci
   - npm test

Running coverage
- The project includes multiple coverage artifacts in the repository for analysis.
- To run a fresh coverage run for Go packages:
  - go test ./... -coverprofile=coverage.out

Notes
- This repository is large. Running full test suites may take several minutes and require network access to fetch modules.
- The included scripts/setup-dev.ps1 performs basic checks and prints helpful commands.
