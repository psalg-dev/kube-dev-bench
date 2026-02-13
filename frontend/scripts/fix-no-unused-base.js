import fs from 'fs';
import path from 'path';

const report = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'lint-report.json'), 'utf8'));

const idChar = /[A-Za-z0-9_$]/;
const parseUnusedName = (message) => {
  const match = String(message || '').match(/'([^']+)' is defined but never used/);
  return match ? match[1] : null;
};

const updatesByFile = new Map();

for (const file of report) {
  for (const msg of file.messages || []) {
    if (msg.ruleId !== 'no-unused-vars') continue;
    const name = parseUnusedName(msg.message);
    if (!name || name.startsWith('_')) continue;

    const key = path.resolve(file.filePath);
    if (!updatesByFile.has(key)) updatesByFile.set(key, []);
    updatesByFile.get(key).push({ line: msg.line, column: msg.column, name });
  }
}

let touched = 0;
let replacements = 0;

for (const [filePath, entries] of updatesByFile.entries()) {
  if (!fs.existsSync(filePath)) continue;
  const text = fs.readFileSync(filePath, 'utf8');
  const lines = text.split(/\r?\n/);

  entries.sort((a, b) => (b.line - a.line) || (b.column - a.column));

  let changed = false;
  for (const { line, column, name } of entries) {
    const index = line - 1;
    if (index < 0 || index >= lines.length) continue;

    const lineText = lines[index];
    let pos = Math.max(0, column - 1);
    if (pos >= lineText.length) pos = lineText.length - 1;
    if (pos < 0) continue;

    let start = pos;
    while (start > 0 && idChar.test(lineText[start - 1])) start -= 1;

    let end = pos;
    while (end < lineText.length && idChar.test(lineText[end])) end += 1;

    const token = lineText.slice(start, end);
    if (token !== name) {
      const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`\\b${escaped}\\b`);
      const match = regex.exec(lineText.slice(Math.max(0, pos - 40), Math.min(lineText.length, pos + 80)));
      if (!match) continue;
      const offsetBase = Math.max(0, pos - 40);
      start = offsetBase + match.index;
      end = start + name.length;
      if (lineText[start - 1] === '_') continue;
    }

    if (start > 0 && lineText[start - 1] === '_') continue;

    lines[index] = `${lineText.slice(0, start)}_${lineText.slice(start)}`;
    changed = true;
    replacements += 1;
  }

  if (changed) {
    fs.writeFileSync(filePath, lines.join('\n'));
    touched += 1;
  }
}

console.log(`Touched ${touched} files, replacements ${replacements}`);
