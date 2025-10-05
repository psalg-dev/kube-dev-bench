---
applyTo: '**'
description: 'description'
---
Provide project context and coding guidelines that AI should follow when generating code, answering questions, or reviewing changes.

# Project Overview

This is a kubernetes client application for developers and devops engineers.

# Technologies Used

- Frontend: React
- Frontend DevServer: Vite
- Backend: Go
- Application Framework: Wails (https://wails.io/)
- Development Environment: IntelliJ IDEA

# General Guidelines
- The console used inside IntelliJ is a git bash console

# Development Guidelines

- When formulating commands to run in the terminal, *use bash syntax*
- When rebuilding the project, run build.sh

## Building the Project

- We develop using the Vite DevServer. To build, first kill any "wails dev" processes and then run:
```bash
wails dev
```

# Frontend Guidelines
## General Guidelines
- In the frontend/logs directory the vite devserver is logging to a file. keep track of that in case any errors occur.
- This project uses React. 
- Follow React Best Practices, especially regarding code organization
- Follow Code re-usability
- Follow separation of concerns
- Use component specific CSS files, try avoiding huge global CSS files
- We use @tanstack/table for tables.
- We use @codemirror editor for showing kubernetes manifests
- Avoid any flickering when updating components

## Frontend behaviors

- The frontend consists of a sidebar, a footer and a main content area
- The sidebar is collapsible
- The sidebar has a Dropdown through which the user can select a kubernetes context
- The sidebar has a Dropdown through which the user can select one or more kubernetes namespaces
- The sidebar contains menu entries for different kubernetes resources:
  - Pods
  - Deployments
  - Jobs
  - CronJobs
  - Daemon Sets
  - Stateful Sets
  - Replica Sets
  - Config Maps
  - Secrets
  - Persistent Volumes
  - Persistent Volume Claims
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
- When a resource is created, the table should refresh the age of the resource automatically once every second for the first minute
- User actions which cause state change always result in a notification
  - Notifications are shown top center of the main content area
  - Notifications disappear automatically after 3 seconds
  - Notifications can be dismissed by clicking an X button on the notification
  - Notifiations are draggable
  - Notifications show a progress bar in the lower border which indicates how long until the notification disappears
