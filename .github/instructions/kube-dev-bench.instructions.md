---
applyTo: '**'
description: 'description'
---
Provide project context and coding guidelines that AI should follow when generating code, answering questions, or reviewing changes.

# Project Overview

This is a kubernetes client application for developers and devops engineers.

# Technologies Used

- Frontend: React
- Backend: Go
- Application Framework: Wails (https://wails.io/)

# General Guidelines
- The console used inside IntelliJ is a git bash console

# Building the Project

To build frontend or backend, navigate to project root and run:

```bash
wails build
```

# Development Guidelines
## General Guidelines
- when recompiling backend code, use "wails build" and assume that the shell is in the correct directory
- when recompiling frontend code, use "npm run build" in the "frontend" directory
  - when changing to the frontend directory, just use "cd frontend", since the shell will start in the project root

# Frontend Guidelines
## General Guidelines
- This project uses React. 
- Follow React Best Practices, especially regarding code organization
- Have a focus on re-usability and modularity
- Use component specific CSS files, try avoiding huge global CSS files
- We use @tanstack/table for tables.
- We use @codemirror editor for showing kubernetes manifests
- Avoid any flickering when updating components

## Frontend behaviors
- The application consists of a sidebar, a footer and a main content area
- The sidebar is collapsible
- The sidebar contains menu entries for different kubernetes resources:
  - Pods
  - Deployments
  - Jobs
  - CronJobs
  - Daemon Sets
  - Stateful Sets
  - Replica Sets
- All kubernetes resource views behave the same way
  - There is a hidden Bottom Panel that is opened for showing details of a resource
  - The main content area shows a table
  - Rows of the table are clickable
  - Clicking a row opens a detail view for the resource in the Bottom Panel
  - When the Bottom Panel is open, clicking outside of it closes it
- All kubernetes resource views have a "Plus" Button at the top left above the table
  - The plus button opens the CreateManifestOverlay which shows an example manifest 
    for the type of resource the user has currently selected in the sidebar
  - The user can edit the manifest and click "Create" to create the resource in the current namespace
  - The user can close the Overlay by pressing Escape or clicking the X top right
- When a resource is created, the table should refresh automatically to show the new resource
