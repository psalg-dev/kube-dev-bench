import fs from 'node:fs/promises';
import path from 'node:path';
import { e2eRoot } from './paths.js';

export type RunState = {
  runId: string;
  clusterName: string;
  contextName: string;
  kubeconfigYaml: string;
  sharedBaseURL?: string;
  sharedWailsPid?: number;
  sharedVitePid?: number;
  proxyBaseURL?: string;
  proxyPid?: number;
};

const stateDir = path.join(e2eRoot, '.run');
const stateFile = path.join(stateDir, 'state.json');

export async function writeRunState(state: RunState) {
  await fs.mkdir(stateDir, { recursive: true });
  await fs.writeFile(stateFile, JSON.stringify(state, null, 2), 'utf-8');
}

export async function readRunState(): Promise<RunState> {
  const raw = await fs.readFile(stateFile, 'utf-8');
  return JSON.parse(raw) as RunState;
}

export async function clearRunState() {
  try {
    await fs.rm(stateDir, { recursive: true, force: true });
  } catch {}
}
