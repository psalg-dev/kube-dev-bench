import { test as base, expect } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';
import { spawn } from 'node:child_process';
import { getRepoRoot } from './helpers';

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

// Auto-fixture that clears per-test HOME state used by wails dev
// Also provides exec fixture for running kubectl commands via docker compose
export const test = base.extend<{ _isolate: void; exec: ExecFn }>({
  _isolate: [async ({ page }, use) => {
    const repoRoot = getRepoRoot();
    const tempHome = path.join(repoRoot, 'e2e', '.home-e2e');
    // Clean app state and kube dir to avoid cross-test leakage
    try { await fs.promises.rm(path.join(tempHome, 'KubeDevBench'), { recursive: true, force: true }); } catch {}
    try { await fs.promises.rm(path.join(tempHome, '.kube'), { recursive: true, force: true }); } catch {}
    
    // Clear browser storage to reset any cached UI state
    await page.context().clearCookies();
    
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
