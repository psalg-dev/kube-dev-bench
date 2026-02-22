import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const e2eRoot = path.resolve(__dirname, '../..');
export const repoRoot = path.resolve(e2eRoot, '..');

export function withinRepo(...parts: string[]) {
  return path.join(repoRoot, ...parts);
}
