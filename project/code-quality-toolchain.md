# Code Quality Toolchain Implementation Plan

## Overview

This document outlines a Docker/Docker Compose-based code quality toolchain for KubeDevBench. Since this codebase is entirely LLM-generated, comprehensive quality metrics are essential to ensure maintainability for human developers.

## Goals

1. **Quantify code health** with objective metrics
2. **Establish quality gates** with enforceable thresholds
3. **Generate actionable reports** for continuous improvement
4. **Integrate with CI/CD** for automated quality checks
5. **Provide unified dashboard** for all metrics

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Code Quality Toolchain                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │  Go Analyzer │  │  JS Analyzer │  │  Cross-Language      │  │
│  │              │  │              │  │                      │  │
│  │ • golangci   │  │ • ESLint     │  │ • SonarQube          │  │
│  │ • go test    │  │ • Vitest     │  │ • Trivy              │  │
│  │ • gocyclo    │  │ • npm audit  │  │ • CLOC               │  │
│  │ • gosec      │  │ • plato      │  │ • gitleaks           │  │
│  │ • dupl       │  │              │  │                      │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
│                              │                                   │
│                              ▼                                   │
│                    ┌──────────────────┐                         │
│                    │  Report Aggregator │                        │
│                    │  (JSON + HTML)     │                        │
│                    └──────────────────┘                         │
│                              │                                   │
│                              ▼                                   │
│                    ┌──────────────────┐                         │
│                    │  Quality Gates    │                         │
│                    │  (Pass/Fail)      │                         │
│                    └──────────────────┘                         │
└─────────────────────────────────────────────────────────────────┘
```

---

## Quality Metrics to Measure

### 1. Code Complexity

| Metric | Tool | Target Threshold |
|--------|------|------------------|
| Cyclomatic Complexity (Go) | gocyclo | ≤ 15 per function |
| Cognitive Complexity (Go) | golangci-lint/gocognit | ≤ 20 per function |
| Halstead Complexity (JS) | plato | Report only |
| Maintainability Index (JS) | plato | ≥ 70 |

### 2. Code Duplication

| Metric | Tool | Target Threshold |
|--------|------|------------------|
| Duplicate Lines (Go) | dupl | ≤ 3% of codebase |
| Duplicate Lines (JS) | jscpd | ≤ 5% of codebase |
| Clone Coverage | SonarQube | ≤ 3% |

### 3. Test Coverage

| Metric | Tool | Target Threshold |
|--------|------|------------------|
| Go Unit Test Coverage | go test -cover | ≥ 70% |
| JS Unit Test Coverage | vitest --coverage | ≥ 70% |
| Branch Coverage | Combined | ≥ 60% |

### 4. Static Analysis & Linting

| Metric | Tool | Target Threshold |
|--------|------|------------------|
| Go Lint Issues | golangci-lint | 0 errors, warnings tracked |
| JS Lint Issues | ESLint | 0 errors, ≤ 50 warnings |
| Code Smells | SonarQube | Severity-weighted |

### 5. Security Vulnerabilities

| Metric | Tool | Target Threshold |
|--------|------|------------------|
| Go Security Issues | gosec | 0 high/critical |
| Dependency Vulnerabilities | Trivy, npm audit | 0 high/critical |
| Secrets in Code | gitleaks | 0 findings |

### 6. Codebase Metrics

| Metric | Tool | Purpose |
|--------|------|---------|
| Lines of Code | CLOC | Track growth |
| Files by Language | CLOC | Language distribution |
| Comment Ratio | CLOC | Documentation level |

---

## Implementation

### Directory Structure

```
quality/
├── docker-compose.yml          # Main orchestration
├── Dockerfile.go-analyzer      # Go analysis tools
├── Dockerfile.js-analyzer      # JS analysis tools
├── config/
│   ├── golangci.yml            # golangci-lint config
│   ├── eslint.config.js        # ESLint config
│   ├── sonar-project.properties
│   └── trivy.yaml              # Trivy config
├── scripts/
│   ├── run-all.sh              # Run full analysis
│   ├── run-go.sh               # Go-only analysis
│   ├── run-js.sh               # JS-only analysis
│   ├── aggregate-reports.js    # Combine all reports
│   └── check-gates.js          # Quality gate checker
├── reports/                    # Generated reports (gitignored)
│   ├── go/
│   ├── js/
│   ├── combined/
│   └── index.html              # Dashboard
└── thresholds.json             # Quality gate thresholds
```

### Phase 1: Core Docker Setup

#### docker-compose.yml

```yaml
version: "3.8"

services:
  # Go Analysis Service
  go-analyzer:
    build:
      context: .
      dockerfile: Dockerfile.go-analyzer
    volumes:
      - ..:/workspace:ro
      - ./reports/go:/reports
      - ./config:/config:ro
    environment:
      - GOPROXY=https://proxy.golang.org,direct
    working_dir: /workspace
    command: /scripts/analyze-go.sh

  # JavaScript Analysis Service
  js-analyzer:
    build:
      context: .
      dockerfile: Dockerfile.js-analyzer
    volumes:
      - ../frontend:/workspace:ro
      - ./reports/js:/reports
      - ./config:/config:ro
    working_dir: /workspace
    command: /scripts/analyze-js.sh

  # Security Scanner
  security-scanner:
    image: aquasec/trivy:latest
    volumes:
      - ..:/workspace:ro
      - ./reports/security:/reports
      - ./config/trivy.yaml:/trivy.yaml:ro
    command: >
      fs --config /trivy.yaml
      --format json
      --output /reports/trivy-report.json
      /workspace

  # Secrets Scanner
  secrets-scanner:
    image: zricethezav/gitleaks:latest
    volumes:
      - ..:/workspace:ro
      - ./reports/security:/reports
    command: >
      detect --source /workspace
      --report-format json
      --report-path /reports/gitleaks-report.json
      --no-git

  # Lines of Code Counter
  cloc:
    image: aldanial/cloc:latest
    volumes:
      - ..:/workspace:ro
      - ./reports:/reports
    command: >
      /workspace
      --exclude-dir=node_modules,vendor,wailsjs,reports,dist,build
      --json
      --out=/reports/cloc-report.json

  # Report Aggregator
  report-aggregator:
    image: node:20-alpine
    volumes:
      - ./reports:/reports
      - ./scripts:/scripts:ro
      - ./thresholds.json:/thresholds.json:ro
    working_dir: /reports
    command: node /scripts/aggregate-reports.js
    depends_on:
      go-analyzer:
        condition: service_completed_successfully
      js-analyzer:
        condition: service_completed_successfully
      security-scanner:
        condition: service_completed_successfully
      secrets-scanner:
        condition: service_completed_successfully
      cloc:
        condition: service_completed_successfully

  # SonarQube (optional, for persistent dashboard)
  sonarqube:
    image: sonarqube:community
    profiles: ["full"]
    ports:
      - "9000:9000"
    volumes:
      - sonarqube_data:/opt/sonarqube/data
      - sonarqube_logs:/opt/sonarqube/logs

  sonar-scanner:
    image: sonarsource/sonar-scanner-cli:latest
    profiles: ["full"]
    volumes:
      - ..:/usr/src
      - ./config/sonar-project.properties:/opt/sonar-scanner/conf/sonar-project.properties
    depends_on:
      - sonarqube

volumes:
  sonarqube_data:
  sonarqube_logs:
```

### Phase 2: Go Analyzer Container

#### Dockerfile.go-analyzer

```dockerfile
FROM golang:1.24-alpine

# Install analysis tools
RUN apk add --no-cache git bash curl jq

# Install golangci-lint
RUN curl -sSfL https://raw.githubusercontent.com/golangci/golangci-lint/master/install.sh | \
    sh -s -- -b /usr/local/bin v1.62.2

# Install additional Go tools
RUN go install github.com/fzipp/gocyclo/cmd/gocyclo@latest && \
    go install github.com/securego/gosec/v2/cmd/gosec@latest && \
    go install github.com/mibk/dupl@latest && \
    go install github.com/uudashr/gocognit/cmd/gocognit@latest

# Copy analysis scripts
COPY scripts/analyze-go.sh /scripts/
RUN chmod +x /scripts/*.sh

ENTRYPOINT ["/bin/bash"]
```

#### scripts/analyze-go.sh

```bash
#!/bin/bash
set -e

REPORT_DIR="/reports"
mkdir -p "$REPORT_DIR"

echo "=== Running Go Analysis ==="

# 1. Test Coverage
echo "Running test coverage..."
go test -coverprofile="$REPORT_DIR/coverage.out" -covermode=atomic ./pkg/app/... 2>&1 | tee "$REPORT_DIR/test-output.txt"
go tool cover -func="$REPORT_DIR/coverage.out" > "$REPORT_DIR/coverage-summary.txt"
go tool cover -html="$REPORT_DIR/coverage.out" -o "$REPORT_DIR/coverage.html"

# Extract coverage percentage
COVERAGE=$(go tool cover -func="$REPORT_DIR/coverage.out" | grep total | awk '{print $3}' | sed 's/%//')
echo "{\"coverage\": $COVERAGE}" > "$REPORT_DIR/coverage.json"

# 2. golangci-lint
echo "Running golangci-lint..."
golangci-lint run --config /config/golangci.yml --out-format json ./... > "$REPORT_DIR/golangci-lint.json" 2>&1 || true
golangci-lint run --config /config/golangci.yml ./... > "$REPORT_DIR/golangci-lint.txt" 2>&1 || true

# 3. Cyclomatic Complexity
echo "Running gocyclo..."
gocyclo -over 10 -avg ./pkg/app/ > "$REPORT_DIR/gocyclo.txt" 2>&1 || true
gocyclo -json ./pkg/app/ > "$REPORT_DIR/gocyclo.json" 2>&1 || true

# 4. Cognitive Complexity
echo "Running gocognit..."
gocognit -over 15 ./pkg/app/ > "$REPORT_DIR/gocognit.txt" 2>&1 || true

# 5. Code Duplication
echo "Running dupl..."
dupl -t 100 -html > "$REPORT_DIR/duplication.html" 2>&1 || true
dupl -t 100 ./pkg/app/ > "$REPORT_DIR/duplication.txt" 2>&1 || true

# 6. Security Analysis
echo "Running gosec..."
gosec -fmt json -out "$REPORT_DIR/gosec.json" ./... 2>&1 || true
gosec -fmt html -out "$REPORT_DIR/gosec.html" ./... 2>&1 || true

echo "=== Go Analysis Complete ==="
```

### Phase 3: JavaScript Analyzer Container

#### Dockerfile.js-analyzer

```dockerfile
FROM node:20-alpine

# Install global tools
RUN npm install -g eslint jscpd plato

# Copy analysis scripts
COPY scripts/analyze-js.sh /scripts/
RUN chmod +x /scripts/*.sh

ENTRYPOINT ["/bin/sh"]
```

#### scripts/analyze-js.sh

```bash
#!/bin/sh
set -e

REPORT_DIR="/reports"
mkdir -p "$REPORT_DIR"

echo "=== Running JavaScript Analysis ==="

# Install dependencies (needed for ESLint plugins)
npm ci --ignore-scripts 2>/dev/null || npm install --ignore-scripts

# 1. Test Coverage
echo "Running vitest coverage..."
npm run test -- --coverage --coverage.reporter=json --coverage.reporter=html --coverage.reportsDirectory="$REPORT_DIR/coverage" || true

# 2. ESLint
echo "Running ESLint..."
npx eslint src/ --format json --output-file "$REPORT_DIR/eslint.json" || true
npx eslint src/ --format stylish > "$REPORT_DIR/eslint.txt" 2>&1 || true

# 3. Code Duplication
echo "Running jscpd..."
npx jscpd src/ --reporters json --output "$REPORT_DIR" || true

# 4. Complexity Analysis
echo "Running plato..."
npx plato -r -d "$REPORT_DIR/plato" src/ || true

# 5. npm audit
echo "Running npm audit..."
npm audit --json > "$REPORT_DIR/npm-audit.json" 2>&1 || true

# 6. Bundle Analysis (optional)
echo "Analyzing bundle size..."
npm run build -- --report 2>/dev/null || true

echo "=== JavaScript Analysis Complete ==="
```

### Phase 4: Configuration Files

#### config/golangci.yml

```yaml
run:
  timeout: 5m
  tests: true

linters:
  enable:
    - gocyclo
    - gocognit
    - goconst
    - gocritic
    - gofmt
    - goimports
    - gosec
    - gosimple
    - govet
    - ineffassign
    - misspell
    - nakedret
    - prealloc
    - revive
    - staticcheck
    - typecheck
    - unconvert
    - unparam
    - unused

linters-settings:
  gocyclo:
    min-complexity: 15
  gocognit:
    min-complexity: 20
  goconst:
    min-len: 3
    min-occurrences: 3
  gocritic:
    enabled-tags:
      - diagnostic
      - style
      - performance
  revive:
    rules:
      - name: blank-imports
      - name: context-as-argument
      - name: context-keys-type
      - name: dot-imports
      - name: error-return
      - name: error-strings
      - name: error-naming
      - name: exported
      - name: if-return
      - name: increment-decrement
      - name: var-naming
      - name: package-comments
      - name: range
      - name: receiver-naming
      - name: time-naming
      - name: unexported-return
      - name: indent-error-flow
      - name: errorf
      - name: empty-block
      - name: superfluous-else
      - name: unused-parameter
      - name: unreachable-code

issues:
  exclude-rules:
    - path: _test\.go
      linters:
        - gocyclo
        - gocognit
        - dupl
    - path: wailsjs/
      linters:
        - all

output:
  formats:
    - format: colored-line-number
  print-issued-lines: true
  print-linter-name: true
```

#### config/eslint.config.js

```javascript
export default [
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/wailsjs/**',
      '**/*.test.{js,jsx}',
      '**/__tests__/**'
    ]
  },
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: {
          jsx: true
        }
      }
    },
    rules: {
      'complexity': ['warn', 15],
      'max-depth': ['warn', 4],
      'max-lines-per-function': ['warn', 100],
      'max-params': ['warn', 5],
      'no-console': 'warn',
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'prefer-const': 'error',
      'no-var': 'error'
    }
  }
];
```

#### config/trivy.yaml

```yaml
severity:
  - CRITICAL
  - HIGH
  - MEDIUM

vulnerability:
  type:
    - os
    - library

scan:
  scanners:
    - vuln
    - secret
    - misconfig

format: json

exit-code: 0  # Don't fail, just report
```

#### thresholds.json

```json
{
  "version": "1.0",
  "thresholds": {
    "coverage": {
      "go": {
        "minimum": 70,
        "target": 80
      },
      "js": {
        "minimum": 70,
        "target": 80
      }
    },
    "complexity": {
      "cyclomatic": {
        "maximum": 15,
        "warning": 10
      },
      "cognitive": {
        "maximum": 20,
        "warning": 15
      }
    },
    "duplication": {
      "maximum_percent": 5,
      "warning_percent": 3
    },
    "security": {
      "critical": 0,
      "high": 0,
      "medium": 10
    },
    "linting": {
      "errors": 0,
      "warnings": 50
    }
  }
}
```

### Phase 5: Report Aggregation

#### scripts/aggregate-reports.js

```javascript
#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const REPORTS_DIR = '/reports';
const OUTPUT_FILE = path.join(REPORTS_DIR, 'combined', 'quality-report.json');
const HTML_OUTPUT = path.join(REPORTS_DIR, 'combined', 'index.html');
const THRESHOLDS = JSON.parse(fs.readFileSync('/thresholds.json', 'utf8'));

function readJsonSafe(filepath) {
  try {
    return JSON.parse(fs.readFileSync(filepath, 'utf8'));
  } catch (e) {
    console.warn(`Warning: Could not read ${filepath}`);
    return null;
  }
}

function aggregateReports() {
  const report = {
    timestamp: new Date().toISOString(),
    summary: {},
    details: {},
    gates: { passed: true, failures: [] }
  };

  // Go Coverage
  const goCoverage = readJsonSafe(path.join(REPORTS_DIR, 'go', 'coverage.json'));
  if (goCoverage) {
    report.summary.goCoverage = goCoverage.coverage;
    if (goCoverage.coverage < THRESHOLDS.thresholds.coverage.go.minimum) {
      report.gates.passed = false;
      report.gates.failures.push(`Go coverage ${goCoverage.coverage}% < ${THRESHOLDS.thresholds.coverage.go.minimum}%`);
    }
  }

  // JS Coverage
  const jsCoveragePath = path.join(REPORTS_DIR, 'js', 'coverage', 'coverage-summary.json');
  const jsCoverage = readJsonSafe(jsCoveragePath);
  if (jsCoverage?.total?.lines) {
    report.summary.jsCoverage = jsCoverage.total.lines.pct;
    if (jsCoverage.total.lines.pct < THRESHOLDS.thresholds.coverage.js.minimum) {
      report.gates.passed = false;
      report.gates.failures.push(`JS coverage ${jsCoverage.total.lines.pct}% < ${THRESHOLDS.thresholds.coverage.js.minimum}%`);
    }
  }

  // golangci-lint
  const golangciLint = readJsonSafe(path.join(REPORTS_DIR, 'go', 'golangci-lint.json'));
  if (golangciLint?.Issues) {
    const errors = golangciLint.Issues.filter(i => i.Severity === 'error').length;
    const warnings = golangciLint.Issues.length - errors;
    report.summary.goLintErrors = errors;
    report.summary.goLintWarnings = warnings;
    report.details.goLintIssues = golangciLint.Issues;
    if (errors > THRESHOLDS.thresholds.linting.errors) {
      report.gates.passed = false;
      report.gates.failures.push(`Go lint errors: ${errors}`);
    }
  }

  // ESLint
  const eslint = readJsonSafe(path.join(REPORTS_DIR, 'js', 'eslint.json'));
  if (eslint) {
    let errors = 0, warnings = 0;
    eslint.forEach(file => {
      errors += file.errorCount;
      warnings += file.warningCount;
    });
    report.summary.jsLintErrors = errors;
    report.summary.jsLintWarnings = warnings;
    if (errors > THRESHOLDS.thresholds.linting.errors) {
      report.gates.passed = false;
      report.gates.failures.push(`JS lint errors: ${errors}`);
    }
  }

  // Security - Trivy
  const trivy = readJsonSafe(path.join(REPORTS_DIR, 'security', 'trivy-report.json'));
  if (trivy?.Results) {
    let critical = 0, high = 0, medium = 0;
    trivy.Results.forEach(result => {
      (result.Vulnerabilities || []).forEach(vuln => {
        if (vuln.Severity === 'CRITICAL') critical++;
        else if (vuln.Severity === 'HIGH') high++;
        else if (vuln.Severity === 'MEDIUM') medium++;
      });
    });
    report.summary.vulnerabilities = { critical, high, medium };
    if (critical > THRESHOLDS.thresholds.security.critical) {
      report.gates.passed = false;
      report.gates.failures.push(`Critical vulnerabilities: ${critical}`);
    }
    if (high > THRESHOLDS.thresholds.security.high) {
      report.gates.passed = false;
      report.gates.failures.push(`High vulnerabilities: ${high}`);
    }
  }

  // Secrets - gitleaks
  const gitleaks = readJsonSafe(path.join(REPORTS_DIR, 'security', 'gitleaks-report.json'));
  if (gitleaks) {
    report.summary.secretsFound = gitleaks.length || 0;
    if (report.summary.secretsFound > 0) {
      report.gates.passed = false;
      report.gates.failures.push(`Secrets found in code: ${report.summary.secretsFound}`);
    }
  }

  // CLOC
  const cloc = readJsonSafe(path.join(REPORTS_DIR, 'cloc-report.json'));
  if (cloc) {
    report.summary.linesOfCode = cloc;
  }

  // Gosec
  const gosec = readJsonSafe(path.join(REPORTS_DIR, 'go', 'gosec.json'));
  if (gosec?.Issues) {
    report.summary.goSecurityIssues = gosec.Issues.length;
    report.details.gosecIssues = gosec.Issues;
  }

  // Write combined report
  fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(report, null, 2));

  // Generate HTML dashboard
  generateHtmlDashboard(report);

  console.log('\n=== Quality Report Summary ===');
  console.log(JSON.stringify(report.summary, null, 2));
  console.log('\n=== Quality Gates ===');
  console.log(`Status: ${report.gates.passed ? 'PASSED ✓' : 'FAILED ✗'}`);
  if (!report.gates.passed) {
    console.log('Failures:');
    report.gates.failures.forEach(f => console.log(`  - ${f}`));
  }

  return report.gates.passed ? 0 : 1;
}

function generateHtmlDashboard(report) {
  const html = `<!DOCTYPE html>
<html>
<head>
  <title>KubeDevBench Code Quality Report</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 40px; background: #f5f5f5; }
    .container { max-width: 1200px; margin: 0 auto; }
    h1 { color: #333; }
    .card { background: white; border-radius: 8px; padding: 20px; margin: 20px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .metric { display: inline-block; margin: 10px 20px 10px 0; }
    .metric-value { font-size: 32px; font-weight: bold; }
    .metric-label { color: #666; font-size: 14px; }
    .pass { color: #22c55e; }
    .fail { color: #ef4444; }
    .warn { color: #f59e0b; }
    .gate-status { font-size: 24px; padding: 20px; border-radius: 8px; text-align: center; }
    .gate-passed { background: #dcfce7; color: #166534; }
    .gate-failed { background: #fee2e2; color: #991b1b; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #eee; }
    th { background: #f9fafb; }
  </style>
</head>
<body>
  <div class="container">
    <h1>KubeDevBench Code Quality Report</h1>
    <p>Generated: ${report.timestamp}</p>

    <div class="gate-status ${report.gates.passed ? 'gate-passed' : 'gate-failed'}">
      Quality Gates: ${report.gates.passed ? 'PASSED ✓' : 'FAILED ✗'}
    </div>

    ${!report.gates.passed ? `
    <div class="card">
      <h2>Gate Failures</h2>
      <ul>
        ${report.gates.failures.map(f => `<li>${f}</li>`).join('')}
      </ul>
    </div>
    ` : ''}

    <div class="card">
      <h2>Test Coverage</h2>
      <div class="metric">
        <div class="metric-value ${(report.summary.goCoverage || 0) >= 70 ? 'pass' : 'fail'}">${report.summary.goCoverage || 'N/A'}%</div>
        <div class="metric-label">Go Coverage</div>
      </div>
      <div class="metric">
        <div class="metric-value ${(report.summary.jsCoverage || 0) >= 70 ? 'pass' : 'fail'}">${report.summary.jsCoverage || 'N/A'}%</div>
        <div class="metric-label">JavaScript Coverage</div>
      </div>
    </div>

    <div class="card">
      <h2>Linting</h2>
      <div class="metric">
        <div class="metric-value ${report.summary.goLintErrors === 0 ? 'pass' : 'fail'}">${report.summary.goLintErrors || 0}</div>
        <div class="metric-label">Go Lint Errors</div>
      </div>
      <div class="metric">
        <div class="metric-value warn">${report.summary.goLintWarnings || 0}</div>
        <div class="metric-label">Go Lint Warnings</div>
      </div>
      <div class="metric">
        <div class="metric-value ${report.summary.jsLintErrors === 0 ? 'pass' : 'fail'}">${report.summary.jsLintErrors || 0}</div>
        <div class="metric-label">JS Lint Errors</div>
      </div>
      <div class="metric">
        <div class="metric-value warn">${report.summary.jsLintWarnings || 0}</div>
        <div class="metric-label">JS Lint Warnings</div>
      </div>
    </div>

    <div class="card">
      <h2>Security</h2>
      <div class="metric">
        <div class="metric-value ${(report.summary.vulnerabilities?.critical || 0) === 0 ? 'pass' : 'fail'}">${report.summary.vulnerabilities?.critical || 0}</div>
        <div class="metric-label">Critical Vulnerabilities</div>
      </div>
      <div class="metric">
        <div class="metric-value ${(report.summary.vulnerabilities?.high || 0) === 0 ? 'pass' : 'fail'}">${report.summary.vulnerabilities?.high || 0}</div>
        <div class="metric-label">High Vulnerabilities</div>
      </div>
      <div class="metric">
        <div class="metric-value warn">${report.summary.vulnerabilities?.medium || 0}</div>
        <div class="metric-label">Medium Vulnerabilities</div>
      </div>
      <div class="metric">
        <div class="metric-value ${(report.summary.secretsFound || 0) === 0 ? 'pass' : 'fail'}">${report.summary.secretsFound || 0}</div>
        <div class="metric-label">Secrets Found</div>
      </div>
      <div class="metric">
        <div class="metric-value warn">${report.summary.goSecurityIssues || 0}</div>
        <div class="metric-label">Go Security Issues</div>
      </div>
    </div>

    <div class="card">
      <h2>Codebase Metrics</h2>
      <table>
        <tr><th>Language</th><th>Files</th><th>Lines</th><th>Code</th><th>Comments</th></tr>
        ${Object.entries(report.summary.linesOfCode || {})
          .filter(([k]) => !['header', 'SUM'].includes(k))
          .map(([lang, data]) => `
            <tr>
              <td>${lang}</td>
              <td>${data.nFiles}</td>
              <td>${data.blank + data.comment + data.code}</td>
              <td>${data.code}</td>
              <td>${data.comment}</td>
            </tr>
          `).join('')}
      </table>
    </div>
  </div>
</body>
</html>`;

  fs.writeFileSync(HTML_OUTPUT, html);
}

process.exit(aggregateReports());
```

### Phase 6: Runner Scripts

#### scripts/run-all.sh

```bash
#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
QUALITY_DIR="$(dirname "$SCRIPT_DIR")"

cd "$QUALITY_DIR"

echo "╔══════════════════════════════════════════╗"
echo "║   KubeDevBench Code Quality Analysis     ║"
echo "╚══════════════════════════════════════════╝"

# Clean previous reports
rm -rf reports/go reports/js reports/security reports/combined
mkdir -p reports/{go,js,security,combined}

# Run all analyzers
echo ""
echo "Starting analysis containers..."
docker compose up --build --abort-on-container-exit

# Check quality gates
EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
    echo ""
    echo "✓ All quality gates passed!"
    echo "  View report: reports/combined/index.html"
else
    echo ""
    echo "✗ Quality gates failed!"
    echo "  View report: reports/combined/index.html"
fi

exit $EXIT_CODE
```

#### scripts/run-quick.sh (lightweight checks)

```bash
#!/bin/bash
# Quick checks for pre-commit or rapid feedback

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
QUALITY_DIR="$(dirname "$SCRIPT_DIR")"

cd "$QUALITY_DIR"

echo "Running quick quality checks..."

# Run only fast checks (lint + security scan)
docker compose run --rm go-analyzer bash -c "golangci-lint run --fast ./..."
docker compose run --rm js-analyzer npm run lint
docker compose run --rm secrets-scanner

echo "Quick checks complete!"
```

---

## CI/CD Integration

### GitHub Actions Workflow

```yaml
# .github/workflows/quality.yml
name: Code Quality

on:
  push:
    branches: [main, dev]
  pull_request:
    branches: [main, dev]

jobs:
  quality:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Run Quality Analysis
        working-directory: quality
        run: |
          chmod +x scripts/*.sh
          ./scripts/run-all.sh

      - name: Upload Quality Reports
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: quality-reports
          path: quality/reports/
          retention-days: 30

      - name: Publish Report to PR
        if: github.event_name == 'pull_request'
        uses: actions/github-script@v7
        with:
          script: |
            const fs = require('fs');
            const report = JSON.parse(fs.readFileSync('quality/reports/combined/quality-report.json'));

            const body = `## Code Quality Report

            | Metric | Value | Status |
            |--------|-------|--------|
            | Go Coverage | ${report.summary.goCoverage || 'N/A'}% | ${(report.summary.goCoverage || 0) >= 70 ? '✅' : '❌'} |
            | JS Coverage | ${report.summary.jsCoverage || 'N/A'}% | ${(report.summary.jsCoverage || 0) >= 70 ? '✅' : '❌'} |
            | Go Lint Errors | ${report.summary.goLintErrors || 0} | ${(report.summary.goLintErrors || 0) === 0 ? '✅' : '❌'} |
            | JS Lint Errors | ${report.summary.jsLintErrors || 0} | ${(report.summary.jsLintErrors || 0) === 0 ? '✅' : '❌'} |
            | Critical Vulns | ${report.summary.vulnerabilities?.critical || 0} | ${(report.summary.vulnerabilities?.critical || 0) === 0 ? '✅' : '❌'} |
            | Secrets Found | ${report.summary.secretsFound || 0} | ${(report.summary.secretsFound || 0) === 0 ? '✅' : '❌'} |

            **Overall: ${report.gates.passed ? '✅ PASSED' : '❌ FAILED'}**
            `;

            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body
            });
```

---

## Implementation Phases

### Phase 1: Core Setup (Week 1)
- [ ] Create `quality/` directory structure
- [ ] Implement `docker-compose.yml`
- [ ] Create Go analyzer Dockerfile and scripts
- [ ] Create JS analyzer Dockerfile and scripts
- [ ] Add configuration files (golangci.yml, eslint.config.js)

### Phase 2: Analysis Tools (Week 2)
- [ ] Integrate golangci-lint with full config
- [ ] Set up Vitest coverage reporting
- [ ] Add Trivy vulnerability scanning
- [ ] Add gitleaks secrets scanning
- [ ] Integrate CLOC for codebase metrics

### Phase 3: Reporting (Week 3)
- [ ] Implement report aggregation script
- [ ] Create HTML dashboard generator
- [ ] Define quality thresholds in JSON
- [ ] Add quality gate checker

### Phase 4: CI Integration (Week 4)
- [ ] Create GitHub Actions workflow
- [ ] Add PR comment reporting
- [ ] Configure artifact storage
- [ ] Test full pipeline

### Phase 5: Enhancements (Optional)
- [ ] Add SonarQube for persistent dashboard
- [ ] Implement trend tracking over time
- [ ] Add complexity heatmaps
- [ ] Create pre-commit hooks

---

## Usage

### Run Full Analysis
```bash
cd quality
./scripts/run-all.sh
```

### Run Quick Checks (Pre-commit)
```bash
cd quality
./scripts/run-quick.sh
```

### View Reports
```bash
# Open HTML dashboard
open quality/reports/combined/index.html

# View JSON report
cat quality/reports/combined/quality-report.json | jq .
```

### Run with SonarQube Dashboard
```bash
cd quality
docker compose --profile full up -d sonarqube
# Wait for SonarQube to start (~2 minutes)
docker compose --profile full run sonar-scanner
# Access at http://localhost:9000
```

---

## Quality Gate Thresholds

| Gate | Threshold | Severity |
|------|-----------|----------|
| Go Test Coverage | ≥ 70% | Blocking |
| JS Test Coverage | ≥ 70% | Blocking |
| Lint Errors | 0 | Blocking |
| Critical Vulnerabilities | 0 | Blocking |
| High Vulnerabilities | 0 | Blocking |
| Secrets in Code | 0 | Blocking |
| Cyclomatic Complexity | ≤ 15 | Warning |
| Cognitive Complexity | ≤ 20 | Warning |
| Code Duplication | ≤ 5% | Warning |
| Lint Warnings | ≤ 50 | Warning |

---

## Maintenance

### Updating Tool Versions
1. Update versions in Dockerfiles
2. Test locally with `docker compose build --no-cache`
3. Verify all reports generate correctly

### Adjusting Thresholds
1. Edit `thresholds.json`
2. Run analysis to verify new thresholds
3. Commit changes

### Adding New Analyzers
1. Add service to `docker-compose.yml`
2. Update aggregation script to parse new reports
3. Add to HTML dashboard generation
4. Update documentation
