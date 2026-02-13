import fs from 'node:fs/promises';
import path from 'node:path';
import { e2eRoot } from './paths.js';

export type RunState = {
  runId: string;
  // Kubernetes-related fields. Present for KinD-backed E2E runs.
  // Swarm-only runs may omit these when `E2E_SKIP_KIND=1`.
  clusterName?: string;
  contextName?: string;
  kubeconfigYaml?: string;
  wailsInstances?: Array<{ baseURL: string; pid?: number; port?: number; homeDir?: string; dialogDir?: string }>;
  frontendBaseURL?: string;
  frontendPid?: number;
  sharedBaseURL?: string;
  sharedWailsPid?: number;
  sharedVitePid?: number;
  sharedHomeDir?: string;
  sharedDialogDir?: string;
  proxyBaseURL?: string;
  proxyPid?: number;
  jfrogLogPath?: string;
  // Holmes mock server for deterministic AI testing
  holmesMockBaseURL?: string;
  holmesMockPid?: number;
};

const runRootDir = path.join(e2eRoot, '.run');

function stateToken(): string {
  const raw =
    process.env.E2E_RUN_STATE_ID ||
    process.env.E2E_RUN_ID ||
    process.env.E2E_REPORT_PREFIX ||
    'default';

  const cleaned = raw.replace(/[^a-zA-Z0-9_.-]/g, '-');
  return cleaned.length > 0 ? cleaned : 'default';
}

function stateDirPath(): string {
  return path.join(runRootDir, stateToken());
}

function stateFilePath(): string {
  return path.join(stateDirPath(), 'state.json');
}

export async function writeRunState(state: RunState) {
  const stateDir = stateDirPath();
  const stateFile = stateFilePath();
  await fs.mkdir(stateDir, { recursive: true });
  await fs.writeFile(stateFile, JSON.stringify(state, null, 2), 'utf-8');
}

export async function readRunState(): Promise<RunState> {
  const stateFile = stateFilePath();
  const raw = await fs.readFile(stateFile, 'utf-8');
  return JSON.parse(raw) as RunState;
}

export async function clearRunState() {
  try {
    await fs.rm(stateDirPath(), { recursive: true, force: true });
  } catch {}
}
