import fs from 'fs';
import path from 'path';

const root = path.resolve(process.cwd(), 'src');

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) files.push(full);
  }
  return files;
}

const files = walk(root);
let touched = 0;

for (const file of files) {
  const original = fs.readFileSync(file, 'utf8');
  let text = original;

  text = text.replace(/catch\s*\(_\)\s*\{/g, 'catch {');
  text = text.replace(/\(_\)\s*=>/g, '() =>');
  text = text.replace(/\(_e\)\s*=>/g, '() =>');
  text = text.replace(/\(_args\)\s*=>/g, '() =>');

  text = text.replace(/^\s*void [_A-Za-z$][_A-Za-z0-9$]*;\s*\n/gm, '');

  if (text !== original) {
    fs.writeFileSync(file, text);
    touched += 1;
  }
}

console.log(`Touched ${touched} files`);
