#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function collectFromSuite(suite, acc) {
  for (const childSuite of asArray(suite?.suites)) {
    collectFromSuite(childSuite, acc);
  }

  for (const spec of asArray(suite?.specs)) {
    const tests = asArray(spec?.tests);
    for (const test of tests) {
      const results = asArray(test?.results);
      const finalResult = results[results.length - 1];
      const status = test?.status || finalResult?.status || 'unknown';
      if (status === 'passed' || status === 'skipped' || status === 'expected') {
        continue;
      }

      const errorMessages = [];
      if (Array.isArray(test?.errors)) {
        for (const err of test.errors) {
          if (err?.message) errorMessages.push(err.message);
        }
      }
      if (Array.isArray(finalResult?.errors)) {
        for (const err of finalResult.errors) {
          if (err?.message) errorMessages.push(err.message);
        }
      }
      if (finalResult?.error?.message) {
        errorMessages.push(finalResult.error.message);
      }

      acc.push({
        titlePath: [...asArray(test?.titlePath)].join(' > '),
        file: test?.location?.file || spec?.file || 'unknown',
        line: test?.location?.line || spec?.line || 0,
        status,
        retries: results.length > 0 ? results.length - 1 : 0,
        durationMs: Number(finalResult?.duration || 0),
        errors: errorMessages,
      });
    }
  }
}

async function main() {
  const inputPath = process.argv[2];
  const outputPath = process.argv[3];

  if (!inputPath || !outputPath) {
    console.error('Usage: node extract-playwright-failures.mjs <input-json> <output-md>');
    process.exit(1);
  }

  let report;
  try {
    const raw = await fs.readFile(inputPath, 'utf-8');
    report = JSON.parse(raw);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const fallback = [
      '# Playwright shard diagnostics',
      '',
      `- Report file not available: ${inputPath}`,
      `- Parser error: ${message}`,
      '',
    ].join('\n');
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, fallback, 'utf-8');
    return;
  }

  const failures = [];
  for (const suite of asArray(report?.suites)) {
    collectFromSuite(suite, failures);
  }

  const statusCounts = new Map();
  for (const failure of failures) {
    statusCounts.set(failure.status, (statusCounts.get(failure.status) || 0) + 1);
  }

  const lines = [];
  lines.push('# Playwright shard diagnostics');
  lines.push('');
  lines.push(`- Report: ${path.basename(inputPath)}`);
  lines.push(`- Total tests: ${Number(report?.stats?.expected || 0) + Number(report?.stats?.unexpected || 0) + Number(report?.stats?.skipped || 0)}`);
  lines.push(`- Unexpected: ${Number(report?.stats?.unexpected || 0)}`);
  lines.push(`- Flaky: ${Number(report?.stats?.flaky || 0)}`);
  lines.push(`- Skipped: ${Number(report?.stats?.skipped || 0)}`);
  lines.push('');

  if (failures.length === 0) {
    lines.push('## Failures');
    lines.push('');
    lines.push('- No failing/timed-out/interrupted tests found in JSON report.');
  } else {
    lines.push('## Failure summary');
    lines.push('');
    for (const [status, count] of statusCounts.entries()) {
      lines.push(`- ${status}: ${count}`);
    }
    lines.push('');
    lines.push('## Failing tests');
    lines.push('');

    for (const failure of failures) {
      lines.push(`- ${failure.titlePath || 'unknown test'} (${failure.status}, retries=${failure.retries}, durationMs=${failure.durationMs})`);
      lines.push(`  - Location: ${failure.file}:${failure.line}`);
      if (failure.errors.length > 0) {
        for (const msg of failure.errors.slice(0, 2)) {
          const compact = String(msg).replace(/\s+/g, ' ').trim();
          lines.push(`  - Error: ${compact.slice(0, 700)}`);
        }
      }
    }
  }

  lines.push('');
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, `${lines.join('\n')}\n`, 'utf-8');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
