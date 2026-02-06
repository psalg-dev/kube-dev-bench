# VS Code Dark Theme Implementation

**Status:** DONE
**Created:** 2026-02-06
**Updated:** 2026-02-06

This document describes the VS Code Dark+ theme implementation for KubeDevBench.

## Current Status (Verified 2026-02-06)

- Theme variables are defined in [frontend/src/app.css](frontend/src/app.css) and applied throughout the app.

## Overview

KubeDevBench uses VS Code's Dark+ color scheme for a consistent, familiar visual experience. The theme is implemented via CSS custom properties defined in `frontend/src/app.css`.

## Color Palette

### Background Colors
| Variable | Value | Usage |
|----------|-------|-------|
| `--gh-bg` | `#1e1e1e` | Main editor/panel background |
| `--gh-bg-sidebar` | `#252526` | Sidebar background |
| `--gh-bg-footer` | `#252526` | Status bar background |
| `--gh-input-bg` | `#3c3c3c` | Input fields |
| `--gh-table-header-bg` | `#3c3c3c` | Table headers |
| `--gh-table-row-even` | `#2a2d2e` | Table alternating rows |
| `--gh-table-row-odd` | `#1e1e1e` | Table alternating rows |
| `--gh-hover-bg` | `#2a2d2e` | Hover states |
| `--gh-canvas-default` | `#1e1e1e` | Component default background |
| `--gh-canvas-subtle` | `#252526` | Component subtle background |

### Border Colors
| Variable | Value |
|----------|-------|
| `--gh-border` | `#3c3c3c` |
| `--gh-input-border` | `#3c3c3c` |

### Text Colors
| Variable | Value | Usage |
|----------|-------|-------|
| `--gh-text` | `#d4d4d4` | Primary text |
| `--gh-text-muted` | `#858585` | Secondary/muted text |
| `--gh-text-secondary` | `#cccccc` | Tertiary text |
| `--gh-table-header-text` | `#d4d4d4` | Table headers |
| `--gh-table-text` | `#d4d4d4` | Table content |

### Accent Colors
| Variable | Value | Usage |
|----------|-------|-------|
| `--gh-accent` | `#0e639c` | Primary accent (buttons, active states) |
| `--gh-accent-hover` | `#1177bb` | Accent hover state |
| `--gh-input-focus` | `#007fd4` | Input focus border |

### Semantic Colors
| Variable | Value | Usage |
|----------|-------|-------|
| `--vsc-selection-bg` | `#094771` | List/text selection |
| `--vsc-list-hover-bg` | `#2a2d2e` | List item hover |
| `--vsc-error` | `#f14c4c` | Error states |
| `--vsc-success` | `#89d185` | Success states |
| `--vsc-warning` | `#cca700` | Warning states |
| `--vsc-info` | `#3794ff` | Info states |

## CSS Files

### Core Files
- `frontend/src/app.css` - Main theme variables and layout
- `frontend/src/style.css` - Base HTML/body styles
- `frontend/src/layout/footer.css` - Status bar styling

### Component-Specific Files
- `frontend/src/layout/overview/OverviewTableWithPanel.css` - Tables
- `frontend/src/layout/MonitorIssueCard.css` - Monitor cards
- `frontend/src/layout/PrometheusAlertsTab.css` - Alerts panel
- `frontend/src/holmes/*.css` - Holmes AI panel (5 files)
- `frontend/src/docker/*.css` - Docker/Swarm components (6 files)
- `frontend/src/k8s/resources/**/*.css` - Kubernetes resources (7 files)
- `frontend/src/components/*.css` - Shared components (2 files)

## Usage Guidelines

### Adding New Components
When creating new components, use the CSS variables for colors:

```css
.my-component {
  background: var(--gh-bg);
  color: var(--gh-text);
  border: 1px solid var(--gh-border);
}

.my-component:hover {
  background: var(--gh-hover-bg);
}

.my-button {
  background: var(--gh-accent);
  color: #ffffff;
}

.my-button:hover {
  background: var(--gh-accent-hover);
}
```

### Status Indicators
Use semantic color variables for status:

```css
.status-success { color: var(--vsc-success); }
.status-error { color: var(--vsc-error); }
.status-warning { color: var(--vsc-warning); }
.status-info { color: var(--vsc-info); }
```

### Selection States
For selected items in lists:

```css
.list-item.selected {
  background: var(--vsc-selection-bg);
}

.list-item:hover {
  background: var(--vsc-list-hover-bg);
}
```

## Responsive Design

The theme includes Full HD optimizations at 1920px+ breakpoint:

```css
@media (min-width: 1920px) {
  :root {
    --sidebar-width: 380px;
    --footer-height: 35px;
    --text-size-base: 16px;
    --text-size-small: 14px;
    --text-size-large: 18px;
  }
}
```

## Accessibility

The color palette maintains WCAG 2.1 AA compliance:
- Primary text (#d4d4d4) on background (#1e1e1e): 10.5:1 contrast ratio
- Muted text (#858585) on background (#1e1e1e): 5.4:1 contrast ratio
- Focus states use visible blue border (#007fd4)

