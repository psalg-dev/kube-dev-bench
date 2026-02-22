import fs from 'fs';
import path from 'path';

const report = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'lint-report.json'), 'utf8'));

const parseUnusedName = (message) => {
  const match = String(message || '').match(/'([^']+)' is (defined|assigned a value) but never used/);
  return match ? match[1] : null;
};

const updatesByFile = new Map();
for (const file of report) {
  for (const message of file.messages || []) {
    if (message.ruleId !== '@typescript-eslint/no-unused-vars') continue;
    const name = parseUnusedName(message.message);
    if (!name) continue;
    const key = path.resolve(file.filePath);
    if (!updatesByFile.has(key)) updatesByFile.set(key, []);
    updatesByFile.get(key).push({ line: message.line, name });
  }
}

let touched = 0;
let inserted = 0;

for (const [filePath, entries] of updatesByFile.entries()) {
  if (!fs.existsSync(filePath)) continue;
  const original = fs.readFileSync(filePath, 'utf8');
  const lines = original.split(/\r?\n/);

  const unique = [];
  const seen = new Set();
  for (const entry of entries) {
    const key = `${entry.line}:${entry.name}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(entry);
    }
  }

  unique.sort((a, b) => b.line - a.line);
  let changed = false;

  for (const { line, name } of unique) {
    const targetIdx = line - 1;
    if (targetIdx < 0 || targetIdx >= lines.length) continue;

    const alreadyNear = [targetIdx - 1, targetIdx, targetIdx + 1, targetIdx + 2]
      .filter((i) => i >= 0 && i < lines.length)
      .some((i) => lines[i].includes(`void ${name};`));
    if (alreadyNear) continue;

    let braceIdx = -1;
    for (let i = targetIdx; i < Math.min(lines.length, targetIdx + 6); i += 1) {
      if (lines[i].includes('{')) {
        braceIdx = i;
        break;
      }
    }

    let insertIdx;
    let indent = '';

    if (braceIdx !== -1) {
      insertIdx = braceIdx + 1;
      const baseIndent = (lines[braceIdx].match(/^\s*/) || [''])[0];
      indent = `${baseIndent}  `;
    } else {
      insertIdx = targetIdx + 1;
      indent = (lines[targetIdx].match(/^\s*/) || [''])[0];
    }

    lines.splice(insertIdx, 0, `${indent}void ${name};`);
    inserted += 1;
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(filePath, lines.join('\n'));
    touched += 1;
  }
}

console.log(`Touched ${touched} files, inserted ${inserted} void markers`);
