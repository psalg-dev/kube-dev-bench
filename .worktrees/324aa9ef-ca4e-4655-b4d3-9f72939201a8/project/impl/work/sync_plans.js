const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname);
const WORK = path.join(ROOT);
const today = '2026-02-06'; // fixed per user context

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(d => {
    const full = path.join(dir, d.name);
    if (d.isDirectory()) return walk(full);
    return full;
  }).filter(p => p.endsWith('.plan.md'));
}

function read(p) { return fs.readFileSync(p, 'utf8'); }
function write(p, s) { fs.writeFileSync(p, s, 'utf8'); }
function remove(p) { fs.unlinkSync(p); }

const files = walk(WORK);
const byBase = new Map();
for (const f of files) {
  const base = path.basename(f);
  if (!byBase.has(base)) byBase.set(base, []);
  byBase.get(base).push(f);
}

function stripFences(s) {
  // remove leading/trailing ```markdown or ```
  return s.replace(/^```(?:markdown)?\n/, '').replace(/\n```\s*$/,'');
}

for (const [base, paths] of byBase.entries()) {
  // pick the longest file as canonical
  let canonical = paths[0];
  let maxLen = read(paths[0]).length;
  for (const p of paths) {
    const len = read(p).length;
    if (len > maxLen) { maxLen = len; canonical = p; }
  }

  // read canonical content and clean
  let content = read(canonical);
  content = stripFences(content).trimStart();

  // ensure there's a title line
  const lines = content.split(/\r?\n/);
  let titleIdx = lines.findIndex(l => /^#/.test(l));
  if (titleIdx === -1) {
    // synthesize title from filename
    const title = '# ' + base.replace(/\.plan\.md$/,'').replace(/[-_]/g,' ');
    lines.unshift(title);
    titleIdx = 0;
  }

  // check for metadata block (Status/Created/Updated)
  const metaIdx = lines.slice(titleIdx+1, titleIdx+8).findIndex(l => /Status:/i.test(l));
  let hasStatus = metaIdx !== -1;
  if (!hasStatus) {
    // determine status from path (prefer done > wip > todo)
    const rel = path.relative(WORK, canonical).split(path.sep);
    const folder = rel[0] || 'todo';
    let status = 'TODO';
    if (/done/i.test(folder)) status = 'DONE';
    else if (/wip/i.test(folder)) status = 'WIP';
    // insert metadata after title
    const meta = [];
    meta.push('');
    meta.push(`**Status:** ${status}`);
    meta.push(`**Created:** ${today}`);
    meta.push(`**Updated:** ${today}`);
    lines.splice(titleIdx+1,0,...meta);
  } else {
    // update Updated line and ensure Created exists
    const start = titleIdx+1;
    for (let i=start; i<start+8 && i<lines.length; i++) {
      if (/^\*\*Updated:\*\*/i.test(lines[i])) {
        lines[i] = `**Updated:** ${today}`;
      }
      if (/^\*\*Created:/i.test(lines[i])) {
        // keep existing
      }
    }
    // if Created not found, insert it
    const hasCreated = lines.slice(start, start+8).some(l=>/^\*\*Created:/i.test(l));
    if (!hasCreated) {
      lines.splice(start,0,`**Created:** ${today}`);
    }
  }

  const newContent = lines.join('\n').replace(/\r/g,'') + '\n';

  // write canonical back into its target 'done' location
  const doneDir = path.join(WORK,'done');
  if (!fs.existsSync(doneDir)) fs.mkdirSync(doneDir, { recursive: true });
  const target = path.join(doneDir, base);
  write(target, newContent);

  // remove other duplicates (including original canonical if it's not in done)
  for (const p of paths) {
    if (p === target) continue;
    try { remove(p); } catch (e) { /* ignore */ }
  }
}

console.log('Sync complete. Files normalized and duplicates moved to done/. Updated date:', today);
