---
agent: agent
description: This prompt describes the Helm Support of KubeDevBench (Kubernetes Client Application).
---
# Agent Instructions for Helm Support Task
This application is a kubernetes client application built with Wails.io. Your task is to implement Helm chart support in KubeDevBench. This includes the ability to manage Helm repositories, search for charts, install, upgrade, and uninstall charts, as well as view chart details and values. Rollback functionality should also be included to revert to previous chart versions if needed. 
Follow established UI patterns in the application for a consistent user experience.

Keep iterating on your own until all objectives are met.

## Objectives
1. Implement Helm repository management (add, remove, list).
2. Implement chart search functionality across added repositories.
3. Implement chart installation with customizable values.
4. Implement chart upgrade functionality with version selection.
5. Implement chart uninstallation functionality.
6. Implement rollback functionality to revert to previous chart versions.
7. Create a user-friendly UI for all Helm operations.
8. Ensure proper error handling and user feedback for all operations.