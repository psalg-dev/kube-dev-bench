import { test as base, expect } from '@playwright/test';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { getRepoRoot, resetAppStateOnDisk } from './helpers';

type ExecFn = (command: string) => Promise<{ stdout: string; stderr: string }>;

// Helper to run a command with optional stdin input
function execWithStdin(cmd: string, args: string[], options: { cwd?: string; input?: string }): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd: options.cwd, shell: false });
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => { stdout += data.toString(); });
    child.stderr.on('data', (data) => { stderr += data.toString(); });

    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        const error = new Error(`Command failed with exit code ${code}: ${stderr}`);
        (error as any).stdout = stdout;
        (error as any).stderr = stderr;
        reject(error);
      }
    });

    if (options.input) {
      child.stdin.write(options.input);
      child.stdin.end();
    } else {
      child.stdin.end();
    }
  });
}

// Auto-fixture that prepares HOME state used by wails dev (worker-scoped for speed)
// Also provides exec fixture for running kubectl commands via docker compose
export const test = base.extend<{ _isolate: void; _clearStorage: void; exec: ExecFn }>({
  _isolate: [async ({}, use) => {
    await resetAppStateOnDisk();
    await use();
  }, { auto: true, scope: 'worker' }],

  _clearStorage: [async ({ page }, use) => {
    await page.context().clearCookies();
    // Clear in-page storage to avoid leaking UI state across tests
    // Note: about:blank doesn't have storage access, so we navigate to the app first
    try {
      await page.goto('http://localhost:34115');
      await page.evaluate(() => {
        localStorage.clear();
        sessionStorage.clear();
      });
    } catch {
      // Storage access may fail on certain pages (e.g., about:blank) - that's OK
    }
    await use();
  }, { auto: true }],

  exec: async ({}, use) => {
    const repoRoot = getRepoRoot();
    const composeFile = path.join(repoRoot, 'kind', 'docker-compose.yml');
    const kubeconfigInternal = '/kind/output/kubeconfig.internal';

    // Prepend kubeconfig flag to kubectl commands
    const addKubeconfig = (cmd: string) => {
      // Replace kubectl with kubectl --kubeconfig <path>
      return cmd.replace(/^kubectl\b/, `kubectl --kubeconfig ${kubeconfigInternal}`);
    };

    const execFn: ExecFn = async (command: string) => {
      // Check if command uses heredoc syntax (kubectl apply -f - <<EOF ... EOF)
      const heredocMatch = command.match(/^(.+?)\s+-f\s+-\s+<<EOF\n([\s\S]*?)\nEOF$/);

      if (heredocMatch) {
        // Extract the base command and the manifest content
        const baseCmd = addKubeconfig(heredocMatch[1].trim()); // e.g., "kubectl --kubeconfig ... apply"
        const manifest = heredocMatch[2];

        // Run docker compose exec with stdin piping for the manifest
        return execWithStdin('docker', [
          'compose', '-f', composeFile, 'exec', '-T', '-i', 'kind',
          'sh', '-c', `${baseCmd} -f -`
        ], { cwd: repoRoot, input: manifest });
      }

      // For regular commands, add kubeconfig if it's a kubectl command
      const modifiedCommand = addKubeconfig(command);

      // Run via docker compose exec
      return execWithStdin('docker', [
        'compose', '-f', composeFile, 'exec', '-T', 'kind',
        'sh', '-c', modifiedCommand
      ], { cwd: repoRoot });
    };

    await use(execFn);
  },
});

export { expect };
