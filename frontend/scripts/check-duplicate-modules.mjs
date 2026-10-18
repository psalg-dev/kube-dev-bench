// Fails when a module exists twice under src/ — e.g. hooks/useResourceData.ts and
// hooks/useResourceData.js. A merge once re-added the JavaScript twins that the
// TypeScript migration had deleted; Vite resolves `.js` before `.ts`, so the JS twin
// silently becomes the code that runs while `tsc` checks the other copy.
//
// Keep exactly one implementation per module: `.ts`/`.tsx` for source.
import { readdirSync, statSync } from 'node:fs';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const srcRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'src');
const groups = new Map();

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walk(full);
      continue;
    }
    const ext = extname(entry);
    if (!['.ts', '.tsx', '.js', '.jsx'].includes(ext)) continue;
    // `*.d.ts` is a declaration file, not a runtime twin of `*.js`.
    if (entry.endsWith('.d.ts')) continue;

    const stem = full.slice(0, -ext.length);
    const list = groups.get(stem) ?? [];
    list.push({ file: full, kind: ext === '.ts' || ext === '.tsx' ? 'typed' : 'plain' });
    groups.set(stem, list);
  }
}

walk(srcRoot);

const conflicts = [...groups.values()].filter(
  (list) => list.some((entry) => entry.kind === 'typed') && list.some((entry) => entry.kind === 'plain'),
);

if (conflicts.length === 0) {
  console.log('No duplicate TS/JS modules under src/.');
  process.exit(0);
}

console.error('Duplicate TS/JS modules found. Keep the typed file and delete the other:');
for (const list of conflicts) {
  const files = list.map((entry) => relative(srcRoot, entry.file).replace(/\\/g, '/')).sort();
  console.error(`  ${files.join('  <->  ')}`);
}
process.exit(1);
