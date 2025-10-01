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
Dont Use "cmd /c" to run commands. Use git bash commands directly.

# Frontend Guidelines
## General Guidelines
- This project uses React. 
- Follow React Best Practices, especially regarding code organization
- Have a focus on re-usability and modularity
- Use component specific CSS files, try avoiding huge global CSS files
- We use @tanstack/table for tables.
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
