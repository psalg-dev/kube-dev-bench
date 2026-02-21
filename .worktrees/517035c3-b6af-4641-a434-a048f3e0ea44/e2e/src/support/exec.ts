import { spawn } from 'node:child_process';

export type ExecResult = {
  code: number;
  stdout: string;
  stderr: string;
};

export async function exec(
  command: string,
  args: string[],
  opts: {
    cwd?: string;
    env?: NodeJS.ProcessEnv;
    timeoutMs?: number;
    logPrefix?: string; // This line remains unchanged
  } = {}
): Promise<ExecResult> {
  const { cwd, env, timeoutMs = 120_000 } = opts;

  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: { ...process.env, ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];

    child.stdout.on('data', (d: Buffer) => stdoutChunks.push(Buffer.from(d)));
    child.stderr.on('data', (d: Buffer) => stderrChunks.push(Buffer.from(d)));

    const timer = setTimeout(() => {
      try {
        child.kill('SIGKILL');
      } catch {}
      reject(new Error(`Command timed out after ${timeoutMs}ms: ${command} ${args.join(' ')}`));
    }, timeoutMs);

    child.on('error', (err: Error) => {
      clearTimeout(timer);
      reject(err);
    });

    child.on('close', (code: number | null) => {
      clearTimeout(timer);
      const stdout = Buffer.concat(stdoutChunks).toString('utf-8');
      const stderr = Buffer.concat(stderrChunks).toString('utf-8');
      resolve({ code: code ?? -1, stdout, stderr });
    });
  });
}
