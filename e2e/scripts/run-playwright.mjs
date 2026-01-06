import { spawn } from 'node:child_process';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

function isoNow() {
  return new Date().toISOString();
}

function ensureTrailingNewline(s) {
  return s.endsWith('\n') ? s : s + '\n';
}

function makeLinePrefixer({ stream, teeToConsole, consoleStream }) {
  let buffer = '';

  function writeLine(line) {
    const prefixed = `${isoNow()} ${line}`;
    stream.write(ensureTrailingNewline(prefixed));
    if (teeToConsole) {
      consoleStream.write(ensureTrailingNewline(prefixed));
    }
  }

  return {
    write(chunk) {
      buffer += chunk.toString('utf-8');
      // Normalize Windows CRLF and split. Keep last partial line in buffer.
      buffer = buffer.replace(/\r\n/g, '\n');
      const parts = buffer.split('\n');
      buffer = parts.pop() ?? '';
      for (const line of parts) writeLine(line);
    },
    flush() {
      if (buffer.length > 0) {
        writeLine(buffer);
        buffer = '';
      }
    },
  };
}

async function main() {
  // On Windows, `new URL(import.meta.url).pathname` yields a `/C:/...`-style path.
  // Use fileURLToPath to get a correct native path (avoids `C:\C:\...` issues).
  const e2eRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const logDir = path.join(e2eRoot, 'test-results');
  await fsp.mkdir(logDir, { recursive: true });
  const logPath = path.join(logDir, 'playwright-debug.log');

  const logStream = fs.createWriteStream(logPath, { flags: 'a' });
  logStream.write(`\n=== playwright run ${isoNow()} ===\n`);
  logStream.write(`cwd: ${e2eRoot}\n`);

  const args = process.argv.slice(2);
  if (args.length === 0) {
    logStream.end('Missing args. Example: node scripts/run-playwright.mjs test\n');
    process.exit(2);
  }

  // Always enable Playwright debug logging.
  // Convention: keep debug logs available, but avoid logging network/protocol traffic by default
  // (it is extremely noisy and can contain sensitive request/response details).
  //
  // Toggles:
  // - E2E_PW_DEBUG=1 enables richer Playwright debug logging (API + browser)
  // - E2E_PW_DEBUG_NETWORK=1 additionally enables protocol/network logging (very noisy)
  const enableDebug = process.env.E2E_PW_DEBUG === '1';
  const enableNetworkDebug = process.env.E2E_PW_DEBUG_NETWORK === '1';

  // Respect an explicit DEBUG provided by the caller; otherwise set a safe default.
  const baseDebug = process.env.DEBUG ?? (enableDebug ? 'pw:api,pw:browser' : 'pw:api');
  const effectiveDebug = enableNetworkDebug
    ? (baseDebug ? `${baseDebug},pw:protocol` : 'pw:protocol')
    : baseDebug;

  const env = {
    ...process.env,
    DEBUG: effectiveDebug,
    DEBUG_COLORS: '0',
    // Keep output stable for parsing and file logs.
    PW_TEST_SCREENSHOT_NO_FONTS_READY: process.env.PW_TEST_SCREENSHOT_NO_FONTS_READY ?? '1',
  };

  const child = spawn('npx', ['playwright', ...args], {
    cwd: e2eRoot,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: process.platform === 'win32',
  });

  logStream.write(`cmd: npx playwright ${args.join(' ')}\n`);

  const out = makeLinePrefixer({
    stream: logStream,
    teeToConsole: true,
    consoleStream: process.stdout,
  });

  const err = makeLinePrefixer({
    stream: logStream,
    teeToConsole: true,
    consoleStream: process.stderr,
  });

  child.stdout?.on('data', (d) => out.write(d));
  child.stderr?.on('data', (d) => err.write(d));

  child.once('close', (code, signal) => {
    out.flush();
    err.flush();
    logStream.write(`=== playwright exit ${isoNow()} code=${code ?? ''} signal=${signal ?? ''} ===\n`);
    logStream.end();
    process.exit(code ?? 1);
  });

  child.once('error', (e) => {
    logStream.write(`=== playwright spawn error ${isoNow()} ${String(e)} ===\n`);
    logStream.end();
    process.exit(1);
  });
}

await main();
