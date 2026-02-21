import path from 'node:path';
import fs from 'node:fs/promises';

export function getE2EDialogDir(homeDir: string) {
  return path.join(homeDir, 'tmp', 'kdb-e2e-dialogs');
}

export async function setNextSavePath(homeDir: string, destPath: string) {
  const dir = getE2EDialogDir(homeDir);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, 'save-path.txt'), destPath, 'utf-8');
}

export async function setNextOpenPath(homeDir: string, srcPath: string) {
  const dir = getE2EDialogDir(homeDir);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, 'open-path.txt'), srcPath, 'utf-8');
}
