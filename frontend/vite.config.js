import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';

// Create logs directory if it doesn't exist
async function ensureLogsDirectory() {
  const logsDir = path.join(process.cwd(), 'logs');
  try {
    await fsp.mkdir(logsDir, {recursive: true});
  } catch (error) {
    console.error('Failed to create logs directory:', error);
    throw error;
  }
}

// Create log file path with timestamp
function getLogFilePath() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return path.join(process.cwd(), 'logs', `vite-${timestamp}.log`);
}

function stripAnsi(s) {
  return typeof s === 'string' ? s.replace(/\x1b\[[0-9;]*m/g, '') : s;
}

async function setupLogging(configEnv) {
  await ensureLogsDirectory();
  const logFile = getLogFilePath();
  const stream = fs.createWriteStream(logFile, { flags: 'a' });
  const prefix = `[${configEnv.mode}]`;
  const once = new Set();

  const write = (level, message) => {
    const ts = new Date().toISOString();
    const clean = stripAnsi(message);
    stream.write(`${ts} ${prefix} ${level.toUpperCase()} ${clean}\n`);
  };

  // Close stream on exit
  process.on('exit', () => {
    try { stream.end(); } catch (_) {}
  });
  process.on('SIGINT', () => { try { stream.end(); } catch (_) {} process.exit(); });

  // Custom logger that writes to file and mirrors to console
  const customLogger = {
    hasWarned: false,
    info(message, options) {
      console.log(message);
      write('info', String(message));
    },
    warn(message, options) {
      this.hasWarned = true;
      console.warn(message);
      write('warn', String(message));
    },
    warnOnce(message) {
      if (once.has(message)) return;
      once.add(message);
      this.warn(message);
    },
    error(message, options) {
      console.error(message);
      write('error', String(message));
    },
    clearScreen(type) {
      // Preserve Vite default behavior of not clearing if LOG_LEVEL is debug
      // No-op to avoid erasing previous console logs
    },
  };

  return { customLogger };
}

export default defineConfig(async ({ command, mode }) => {
  const { customLogger } = await setupLogging({ command, mode });
  const hostOverride = process.env.VITE_HOST;
  const cacheDirOverride = process.env.VITE_CACHE_DIR;
  const isE2E = Boolean(cacheDirOverride);
  const allowOutsideRoot = process.env.E2E_VITE_ALLOW_OUTSIDE_ROOT === '1' || process.env.VITE_FS_STRICT === '0';

  return {
    plugins: [react()],
    customLogger,
    // Allow E2E runs to isolate Vite's dependency optimization cache per process.
    // This prevents flake when multiple Wails instances start Vite concurrently.
    cacheDir: cacheDirOverride || undefined,
    // In E2E, keep dependency optimization enabled with an isolated cache dir.
    // This avoids ESM default export issues when deps import React as default.
    optimizeDeps: isE2E ? { include: ['react', 'react-dom'], force: true } : undefined,
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            // CodeMirror in separate chunks (loaded on demand)
            'codemirror-core': [
              '@codemirror/view',
              '@codemirror/state',
              '@codemirror/language',
            ],
            'codemirror-lang': [
              '@codemirror/lang-yaml',
              '@codemirror/autocomplete',
              '@codemirror/lint',
            ],
            'codemirror-extras': [
              '@codemirror/commands',
              '@codemirror/search',
              '@codemirror/theme-one-dark',
            ],

            // Holmes/markdown rendering
            'markdown': ['react-markdown', 'react-syntax-highlighter'],

            // Terminal
            'terminal': ['xterm', 'xterm-addon-fit'],

            // React core (vendor chunk)
            'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          },
        },
      },
      reportCompressedSize: true,
    },
    server: {
      host: hostOverride || undefined,
      fs: allowOutsideRoot ? { strict: false } : undefined,
      watch: {
        ignored: [
          '**/coverage/**',
          '**/__tests__/**',
          '**/e2e/test-results/**',
          '**/test-results/**',
          '**/.playwright-artifacts-*/**',
          '**/node_modules/**'
        ]
      }
    }
  };
});
