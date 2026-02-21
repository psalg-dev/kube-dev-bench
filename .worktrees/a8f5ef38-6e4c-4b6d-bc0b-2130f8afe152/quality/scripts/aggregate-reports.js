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

function readJsonLines(filepath) {
  try {
    const content = fs.readFileSync(filepath, 'utf8');
    return content
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean)
      .map(line => {
        try {
          return JSON.parse(line);
        } catch (e) {
          return null;
        }
      })
      .filter(Boolean);
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
    const allVulns = [];
    trivy.Results.forEach(result => {
      (result.Vulnerabilities || []).forEach(vuln => {
        if (vuln.Severity === 'CRITICAL') critical++;
        else if (vuln.Severity === 'HIGH') high++;
        else if (vuln.Severity === 'MEDIUM') medium++;
        allVulns.push({
          id: vuln.VulnerabilityID,
          severity: vuln.Severity,
          package: vuln.PkgName,
          version: vuln.InstalledVersion,
          fixedVersion: vuln.FixedVersion,
          title: vuln.Title,
          target: result.Target
        });
      });
    });
    report.summary.vulnerabilities = { critical, high, medium };
    report.details.vulnerabilities = allVulns;
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
    report.details.secrets = (gitleaks || []).map(s => ({
      file: s.File,
      line: s.StartLine,
      rule: s.RuleID,
      description: s.Description,
      match: s.Match ? s.Match.substring(0, 50) + '...' : ''
    }));
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

  // Govulncheck
  const govulncheckEvents = readJsonLines(path.join(REPORTS_DIR, 'go', 'govulncheck.json'));
  if (govulncheckEvents) {
    const findings = govulncheckEvents
      .filter(e => e?.finding || e?.Finding || e?.type === 'finding' || e?.Type === 'finding')
      .map(e => e.finding || e.Finding || e);

    const normalizedFindings = findings.map(f => {
      const osv = f.osv || f.OSV || {};
      const module = f.module || f.Module || {};
      const pkg = f.package || f.Package || {};
      return {
        id: osv.id || osv.ID || f.id || f.ID || '-',
        module: module.path || module || '-',
        package: pkg.path || pkg || '-',
        symbol: f.symbol || f.Symbol || '-',
        details: f.details || ''
      };
    });

    report.summary.govulncheckFindings = normalizedFindings.length;
    report.details.govulncheckFindings = normalizedFindings;
  }

  // Ineffassign
  try {
    const ineffassignText = fs.readFileSync(path.join(REPORTS_DIR, 'go', 'ineffassign.txt'), 'utf8');
    const ineffassignLines = ineffassignText
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean);
    report.summary.ineffassignIssues = ineffassignLines.length;
    report.details.ineffassignIssues = ineffassignLines.slice(0, 200);
  } catch (e) {
    // ineffassign.txt not found or empty
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
    report.details.highComplexityFunctions = highComplexity.slice(0, 50); // Top 50
  } catch (e) {
    // gocyclo.txt not found or parse error
  }

  // Cognitive Complexity (gocognit) - read from text file
  // Format: <complexity> <package> <function> <file:line:column>
  try {
    const gocognitText = fs.readFileSync(path.join(REPORTS_DIR, 'go', 'gocognit.txt'), 'utf8');
    const cognitLines = gocognitText.trim().split('\n').filter(l => l.trim());
    const cognitFunctions = cognitLines.map(line => {
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
    
    report.summary.cognitiveComplexity = {
      highComplexityFunctions: cognitFunctions.length
    };
    report.details.cognitiveFunctions = cognitFunctions.slice(0, 50); // Top 50
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
  // Helper functions to build HTML sections
  const gateFailuresHtml = !report.gates.passed 
    ? `<div class="card">
        <h2>Gate Failures</h2>
        <ul>${report.gates.failures.map(f => `<li>${f}</li>`).join('')}</ul>
       </div>` 
    : '';

  const vulnsTableHtml = (report.details.vulnerabilities?.length || 0) > 0
    ? `<table>
        <tr><th>Severity</th><th>ID</th><th>Package</th><th>Installed</th><th>Fixed</th><th>Title</th></tr>
        ${(report.details.vulnerabilities || []).map(v => `
          <tr>
            <td><span class="severity-${v.severity.toLowerCase()}">${v.severity}</span></td>
            <td>${v.id}</td>
            <td>${v.package}</td>
            <td>${v.version || '-'}</td>
            <td>${v.fixedVersion || 'N/A'}</td>
            <td>${v.title || '-'}</td>
          </tr>
        `).join('')}
       </table>`
    : '<p>No vulnerabilities found.</p>';

  const secretsTableHtml = (report.details.secrets?.length || 0) > 0
    ? `<table>
        <tr><th>File</th><th>Line</th><th>Rule</th><th>Description</th></tr>
        ${(report.details.secrets || []).map(s => `
          <tr>
            <td class="file-path">${s.file}</td>
            <td>${s.line}</td>
            <td>${s.rule}</td>
            <td>${s.description}</td>
          </tr>
        `).join('')}
       </table>`
    : '<p>No secrets found.</p>';

  const gosecTableHtml = (report.details.gosecIssues?.length || 0) > 0
    ? `<table>
        <tr><th>Severity</th><th>Rule</th><th>File</th><th>Line</th><th>Details</th></tr>
        ${(report.details.gosecIssues || []).slice(0, 100).map(i => `
          <tr>
            <td><span class="severity-${(i.severity || 'medium').toLowerCase()}">${i.severity || 'MEDIUM'}</span></td>
            <td>${i.rule_id || '-'}</td>
            <td class="file-path">${(i.file || '').replace('/workspace/', '')}</td>
            <td>${i.line || '-'}</td>
            <td>${i.details || '-'}</td>
          </tr>
        `).join('')}
       </table>
       ${(report.details.gosecIssues?.length || 0) > 100 ? '<p><em>Showing first 100 of ' + report.details.gosecIssues.length + ' issues</em></p>' : ''}`
    : '<p>No Go security issues found.</p>';

  const govulncheckTableHtml = (report.details.govulncheckFindings?.length || 0) > 0
    ? `<table>
        <tr><th>ID</th><th>Package</th><th>Symbol</th><th>Module</th></tr>
        ${(report.details.govulncheckFindings || []).slice(0, 100).map(f => `
          <tr>
            <td>${f.id}</td>
            <td class="file-path">${f.package}</td>
            <td>${f.symbol}</td>
            <td class="file-path">${f.module}</td>
          </tr>
        `).join('')}
       </table>
       ${(report.details.govulncheckFindings?.length || 0) > 100 ? '<p><em>Showing first 100 of ' + report.details.govulncheckFindings.length + ' findings</em></p>' : ''}`
    : '<p>No govulncheck findings.</p>';

  const ineffassignTableHtml = (report.details.ineffassignIssues?.length || 0) > 0
    ? `<table>
        <tr><th>Issue</th></tr>
        ${(report.details.ineffassignIssues || []).map(line => `
          <tr>
            <td class="file-path">${line}</td>
          </tr>
        `).join('')}
       </table>`
    : '<p>No ineffassign issues found.</p>';

  const cycloTableHtml = (report.details.highComplexityFunctions?.length || 0) > 0
    ? `<table>
        <tr><th>Complexity</th><th>Package</th><th>Function</th><th>Location</th></tr>
        ${(report.details.highComplexityFunctions || []).map(f => `
          <tr>
            <td><strong>${f.Complexity}</strong></td>
            <td>${f.Package}</td>
            <td>${f.Function}</td>
            <td class="file-path">${f.Location}</td>
          </tr>
        `).join('')}
       </table>`
    : '<p>No high complexity functions found.</p>';

  const cognitTableHtml = (report.details.cognitiveFunctions?.length || 0) > 0
    ? `<table>
        <tr><th>Complexity</th><th>Package</th><th>Function</th><th>Location</th></tr>
        ${(report.details.cognitiveFunctions || []).map(f => `
          <tr>
            <td><strong>${f.Complexity}</strong></td>
            <td>${f.Package}</td>
            <td>${f.Function}</td>
            <td class="file-path">${f.Location}</td>
          </tr>
        `).join('')}
       </table>`
    : '<p>No high cognitive complexity functions found.</p>';

  const locTableHtml = Object.entries(report.summary.linesOfCode || {})
    .filter(([k]) => !['header', 'SUM'].includes(k))
    .map(([lang, data]) => `
      <tr>
        <td>${lang}</td>
        <td>${data.nFiles}</td>
        <td>${data.blank + data.comment + data.code}</td>
        <td>${data.code}</td>
        <td>${data.comment}</td>
      </tr>
    `).join('');

  const html = `<!DOCTYPE html>
<html>
<head>
  <title>KubeDevBench Code Quality Report</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 40px; background: #f5f5f5; }
    .container { max-width: 1400px; margin: 0 auto; }
    h1 { color: #333; }
    h2 { margin-bottom: 15px; display: flex; align-items: center; gap: 10px; }
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
    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
    th, td { padding: 10px 12px; text-align: left; border-bottom: 1px solid #eee; font-size: 13px; }
    th { background: #f9fafb; font-weight: 600; }
    .collapsible { cursor: pointer; user-select: none; }
    .collapsible:hover { background: #f0f0f0; }
    .collapsible::before { content: '▶'; display: inline-block; margin-right: 8px; transition: transform 0.2s; font-size: 12px; }
    .collapsible.open::before { transform: rotate(90deg); }
    .details { display: none; margin-top: 15px; max-height: 500px; overflow-y: auto; }
    .details.open { display: block; }
    .severity-critical { background: #fee2e2; color: #991b1b; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; }
    .severity-high { background: #fef3c7; color: #92400e; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; }
    .severity-medium { background: #fef9c3; color: #854d0e; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; }
    .severity-low { background: #e0e7ff; color: #3730a3; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; }
    .file-path { font-family: monospace; font-size: 12px; color: #6b7280; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; margin-left: 8px; }
    .badge-count { background: #e5e7eb; color: #374151; }
    .tab-container { display: flex; gap: 0; border-bottom: 2px solid #e5e7eb; margin-bottom: 15px; }
    .tab { padding: 10px 20px; cursor: pointer; border-bottom: 2px solid transparent; margin-bottom: -2px; color: #6b7280; }
    .tab:hover { color: #374151; }
    .tab.active { border-bottom-color: #3b82f6; color: #3b82f6; font-weight: 600; }
    .tab-content { display: none; }
    .tab-content.active { display: block; }
  </style>
</head>
<body>
  <div class="container">
    <h1>KubeDevBench Code Quality Report</h1>
    <p>Generated: ${report.timestamp}</p>

    <div class="gate-status ${report.gates.passed ? 'gate-passed' : 'gate-failed'}">
      Quality Gates: ${report.gates.passed ? 'PASSED ✓' : 'FAILED ✗'}
    </div>

    ${gateFailuresHtml}

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
      <h2 class="collapsible" onclick="toggleDetails('security-details', this)">
        Security
        <span class="badge badge-count">${(report.details.vulnerabilities?.length || 0) + (report.details.secrets?.length || 0) + (report.details.gosecIssues?.length || 0) + (report.details.govulncheckFindings?.length || 0)} issues</span>
      </h2>
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
      <div class="metric">
        <div class="metric-value ${(report.summary.govulncheckFindings || 0) === 0 ? 'pass' : 'warn'}">${report.summary.govulncheckFindings || 0}</div>
        <div class="metric-label">Govulncheck Findings</div>
      </div>
      
      <div id="security-details" class="details">
        <div class="tab-container">
          <div class="tab active" onclick="switchTab(this, 'vulns-tab')">Vulnerabilities (${report.details.vulnerabilities?.length || 0})</div>
          <div class="tab" onclick="switchTab(this, 'secrets-tab')">Secrets (${report.details.secrets?.length || 0})</div>
          <div class="tab" onclick="switchTab(this, 'gosec-tab')">Go Security (${report.details.gosecIssues?.length || 0})</div>
          <div class="tab" onclick="switchTab(this, 'govulncheck-tab')">Govulncheck (${report.details.govulncheckFindings?.length || 0})</div>
        </div>
        
        <div id="vulns-tab" class="tab-content active">
          ${vulnsTableHtml}
        </div>
        
        <div id="secrets-tab" class="tab-content">
          ${secretsTableHtml}
        </div>
        
        <div id="gosec-tab" class="tab-content">
          ${gosecTableHtml}
        </div>

        <div id="govulncheck-tab" class="tab-content">
          ${govulncheckTableHtml}
        </div>
      </div>
    </div>

    <div class="card">
      <h2 class="collapsible" onclick="toggleDetails('go-static-details', this)">
        Go Static Analysis
        <span class="badge badge-count">${report.summary.ineffassignIssues || 0} issues</span>
      </h2>
      <div class="metric">
        <div class="metric-value ${(report.summary.ineffassignIssues || 0) === 0 ? 'pass' : 'warn'}">${report.summary.ineffassignIssues || 0}</div>
        <div class="metric-label">Ineffassign Issues</div>
      </div>
      <div id="go-static-details" class="details">
        ${ineffassignTableHtml}
      </div>
    </div>

    <div class="card">
      <h2 class="collapsible" onclick="toggleDetails('complexity-details', this)">
        Code Complexity
        <span class="badge badge-count">${(report.summary.cyclomaticComplexity?.highComplexityFunctions || 0) + (report.summary.cognitiveComplexity?.highComplexityFunctions || 0)} high complexity</span>
      </h2>
      <div class="metric">
        <div class="metric-value ${(report.summary.cyclomaticComplexity?.average || 0) <= 15 ? 'pass' : 'warn'}">${report.summary.cyclomaticComplexity?.average || 'N/A'}</div>
        <div class="metric-label">Avg Cyclomatic Complexity</div>
      </div>
      <div class="metric">
        <div class="metric-value ${(report.summary.cyclomaticComplexity?.highComplexityFunctions || 0) === 0 ? 'pass' : 'warn'}">${report.summary.cyclomaticComplexity?.highComplexityFunctions || 0}</div>
        <div class="metric-label">High Cyclomatic (>15)</div>
      </div>
      <div class="metric">
        <div class="metric-value ${(report.summary.cognitiveComplexity?.highComplexityFunctions || 0) === 0 ? 'pass' : 'warn'}">${report.summary.cognitiveComplexity?.highComplexityFunctions || 0}</div>
        <div class="metric-label">High Cognitive Complexity</div>
      </div>
      <div class="metric">
        <div class="metric-value warn">${report.summary.codeDuplication?.duplicateBlocks || 0}</div>
        <div class="metric-label">Go Duplicate Blocks</div>
      </div>
      <div class="metric">
        <div class="metric-value ${(report.summary.jsDuplication?.percentage || 0) <= 10 ? 'pass' : 'warn'}">${report.summary.jsDuplication?.percentage || 0}%</div>
        <div class="metric-label">JS Duplication</div>
      </div>
      
      <div id="complexity-details" class="details">
        <div class="tab-container">
          <div class="tab active" onclick="switchTab(this, 'cyclo-tab')">Cyclomatic (${report.details.highComplexityFunctions?.length || 0})</div>
          <div class="tab" onclick="switchTab(this, 'cognit-tab')">Cognitive (${report.details.cognitiveFunctions?.length || 0})</div>
        </div>
        
        <div id="cyclo-tab" class="tab-content active">
          ${cycloTableHtml}
        </div>
        
        <div id="cognit-tab" class="tab-content">
          ${cognitTableHtml}
        </div>
      </div>
    </div>

    <div class="card">
      <h2>Codebase Metrics</h2>
      <table>
        <tr><th>Language</th><th>Files</th><th>Lines</th><th>Code</th><th>Comments</th></tr>
        ${locTableHtml}
      </table>
    </div>
  </div>
  
  <script>
    function toggleDetails(id, header) {
      const details = document.getElementById(id);
      details.classList.toggle('open');
      header.classList.toggle('open');
    }
    
    function switchTab(tab, contentId) {
      const container = tab.closest('.card');
      container.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      container.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(contentId).classList.add('active');
    }
  </script>
</body>
</html>`;

  fs.writeFileSync(HTML_OUTPUT, html);
}

process.exit(aggregateReports());
