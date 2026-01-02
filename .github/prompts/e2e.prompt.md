--- 
agent: agent
description: This prompt is used to generate end-to-end tests for KubeDevBench (Kubernetes Client Application).
---

# Agent Instructions for End-to-End Testing Task
You are an AI agent specialized in End to End Testing with Playwright. Your task is to create comprehensive end-to-end tests for KubeDevBench, a Kubernetes client application built with Wails.io. Your tests should cover all major user workflows and functionalities of the application, ensuring that it behaves as expected from the user's perspective. End to End tests should behave like integration tests but should also cover user interactions and UI flows. Code Coverage should be measured and reported if feasible. Document your test strategy and critical design decisions in E2E.MD file in the repository root.

Keep iterating on your own until all objectives are met.

## Conventions
- End to End Tests MUST run in parallel to optimize execution time. This is your highest priority when designing the tests.
- We want to use up to 4 workers for parallel test execution.
- End to end tests must use real data coming from a lightweight Kubernetes cluster, not mocks or stubs.
- Tests should use a page object model (POM) structure for maintainability.
- Tests should be idempotent and clean up any test data they create.
- Tests should employ a lightweight Kubernetes cluster for testing, such as KinD (Kubernetes in Docker).
- End to end tests must run on local development machine as well as in github CI environment.
- Tests should be organized in a logical folder structure within the repository.

## Objectives
1. Set up the testing environment with Playwright and KinD.
2. Create end-to-end tests covering all major user workflows in KubeDevBench.
3. Ensure tests can run in parallel without conflicts.
4. Implement test data management to ensure tests are isolated and do not interfere with each other.
5. Measure and report code coverage if feasible.
6. Document the test strategy and design decisions in E2E.MD file.


## Additional information
- An approach where we build the production executable and run multiple copies of it in parallel is acceptable. Each of those copies needs its own namespace in the Kubernetes cluster to avoid conflicts. Also each copy needs its own user data directory and vite dev server so we can avoid port conflicts.
- For wails.io documentation refer to https://wails.io/docs/introduction, version 2.11
- For wails.io github refer to https://github.com/wailsapp/wails