# Code Quality Toolchain

Docker/Docker Compose-based code quality analysis for KubeDevBench.

## Quick Start

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
open reports/combined/index.html

# View JSON report
cat reports/combined/quality-report.json | jq .
```

### Run with SonarQube Dashboard

```bash
cd quality
docker compose --profile full up -d sonarqube
# Wait for SonarQube to start (~2 minutes)
docker compose --profile full run sonar-scanner
# Access at http://localhost:9000
```

## Quality Gates

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

## Tools Included

### Go Analysis
- **golangci-lint** - Comprehensive linter aggregator
- **gocyclo** - Cyclomatic complexity
- **gocognit** - Cognitive complexity
- **gosec** - Security scanner
- **govulncheck** - Known vulnerability scanner
- **dupl** - Code duplication detector
- **ineffassign** - Ineffective assignment detector
- **go test -cover** - Test coverage

### JavaScript Analysis
- **ESLint** - Linting and code quality
- **Vitest** - Test coverage
- **jscpd** - Code duplication detector
- **plato** - Complexity analysis
- **npm audit** - Dependency vulnerabilities

### Cross-Language
- **Trivy** - Vulnerability scanning
- **gitleaks** - Secrets detection
- **CLOC** - Lines of code metrics
- **SonarQube** (optional) - Persistent dashboard

## Directory Structure

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
│   ├── run-quick.sh            # Quick checks
│   ├── analyze-go.sh           # Go analysis script
│   ├── analyze-js.sh           # JS analysis script
│   └── aggregate-reports.js    # Report aggregator
├── thresholds.json             # Quality gate thresholds
└── reports/                    # Generated reports (gitignored)
```

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
