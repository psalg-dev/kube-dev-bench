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

  // Cyclomatic Complexity (gocyclo) - parse from text file
  // Format: <complexity> <package> <function> <file:line:column>
  try {
    const gocycloText = fs.readFileSync(path.join(REPORTS_DIR, 'go', 'gocyclo.txt'), 'utf8');
    const lines = gocycloText.trim().split('\n').filter(l => l.trim() && !l.startsWith('Average:'));
    const functions = lines.map(line => {
      const match = line.match(/^(\d+)\s+(\w+)\s+(.+?)\s+(.+:\d+:\d+)$/);
      if (match) {
        return {
          Complexity: parseInt(match[1]),
          Package: match[2],
          Function: match[3],
          Location: match[4]
        };
      }
      return null;
    }).filter(f => f !== null);
    
    const highComplexity = functions.filter(f => f.Complexity > 15);
    const avgComplexity = functions.length > 0 
      ? (functions.reduce((sum, f) => sum + f.Complexity, 0) / functions.length).toFixed(1)
      : 0;
    report.summary.cyclomaticComplexity = {
      average: parseFloat(avgComplexity),
      highComplexityFunctions: highComplexity.length,
      totalFunctions: functions.length
    };
    report.details.highComplexityFunctions = highComplexity.slice(0, 20); // Top 20
  } catch (e) {
    // gocyclo.txt not found or parse error
  }

  // Cognitive Complexity (gocognit) - read from text file
  try {
    const gocognitText = fs.readFileSync(path.join(REPORTS_DIR, 'go', 'gocognit.txt'), 'utf8');
    const cognitLines = gocognitText.trim().split('\n').filter(l => l.trim());
    report.summary.cognitiveComplexity = {
      highComplexityFunctions: cognitLines.length
    };
    report.details.cognitiveFunctions = cognitLines.slice(0, 20);
  } catch (e) {
    // gocognit.txt not found or empty
  }

  // Code Duplication (dupl) - read from text file
  try {
    const duplText = fs.readFileSync(path.join(REPORTS_DIR, 'go', 'duplication.txt'), 'utf8');
    const duplBlocks = (duplText.match(/duplicate of/g) || []).length;
    report.summary.codeDuplication = {
      duplicateBlocks: duplBlocks
    };
  } catch (e) {
    // duplication.txt not found or empty
  }

  // JS Code Duplication (jscpd)
  const jscpd = readJsonSafe(path.join(REPORTS_DIR, 'js', 'jscpd-report.json'));
  if (jscpd?.statistics) {
    report.summary.jsDuplication = {
      percentage: jscpd.statistics.total?.percentage || 0,
      duplicates: jscpd.statistics.total?.duplicatedLines || 0,
      clones: jscpd.duplicates?.length || 0
    };
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
