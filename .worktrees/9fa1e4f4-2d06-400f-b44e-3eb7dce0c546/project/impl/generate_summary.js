const fs = require('fs');
const path = require('path');

const WORK_DIR = path.join(__dirname, 'work');
const OUT_FILE = path.join(__dirname, 'summary.html');

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  let results = [];
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      results = results.concat(walk(full));
    } else if (e.isFile() && e.name.endsWith('.plan.md')) {
      results.push(full);
    }
  }
  return results;
}

function extractMeta(content) {
  const lines = content.split(/\r?\n/);
  const meta = { title: '', status: '', created: '', updated: '', excerpt: '' };
  for (let i = 0; i < Math.min(lines.length, 30); i++) {
    const l = lines[i].trim();
    if (!meta.title && l.startsWith('#')) meta.title = l.replace(/^#+\s*/, '');
    if (!meta.status) {
      const statusMatchers = [
        /\*\*Status:\*\*\s*(.*)/i,
        /^\s*>?\s*\*\*Status:\s*(.+?)\*\*\s*$/i,
        /^>?\s*Status:\s*(.*)/i,
      ];
      for (const matcher of statusMatchers) {
        const m = l.match(matcher);
        if (m && m[1] && m[1].trim()) {
          meta.status = m[1].trim();
          break;
        }
      }
    }
    if (!meta.created) {
      const m = l.match(/\*\*Created:\*\*\s*(.*)/i);
      if (m) meta.created = m[1].trim();
    }
    if (!meta.updated) {
      const m = l.match(/\*\*Updated:\*\*\s*(.*)/i) || l.match(/\*\*Last Updated:\*\*\s*(.*)/i);
      if (m) meta.updated = m[1].trim();
    }
  }

  // excerpt: first non-empty paragraph after header lines
  const afterHeader = content.replace(/^.*?\n/, '');
  const paras = afterHeader.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
  if (paras.length) meta.excerpt = paras[0].replace(/\n/g, ' ').slice(0, 300);

  return meta;
}

function makeHtml(items) {
  const now = new Date().toISOString();

  function bucketStatus(s) {
    if (!s) return 'Todo';
    const t = s.toLowerCase();
    // Classify WIP / partial statuses first so strings like "not started" in a WIP note don't override
    if (t.includes('partially') || t.includes('mostly') || t.includes('wip') || t.includes('in progress') || t.includes('in-progress')) return 'WIP';
    if (t.startsWith('todo') || t.includes('not started') || t.includes('not implemented') || t.includes('nothing implemented') || /(^|[^0-9])0%/.test(t)) return 'Todo';
    if (t.includes('implemented') || t.includes('done') || t.includes('complete')) return 'Done';
    return 'Todo';
  }

  const groups = { Todo: [], WIP: [], Done: [] };
  for (const it of items) groups[bucketStatus(it.meta.status)].push(it);

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>Work</title>
  <style>
    body{font-family:system-ui,Segoe UI,Roboto,Helvetica,Arial;line-height:1.4;padding:20px;margin:0}
    header{padding:16px;border-bottom:1px solid #eee;background:#fafafa}
    .board{display:flex;gap:16px;padding:20px}
    .column{flex:1;min-width:260px;background:#f7f7f8;border-radius:6px;padding:12px}
    .col-title{font-weight:600;margin-bottom:8px}
    .card{background:#fff;border:1px solid #e1e4e8;border-radius:6px;padding:10px;margin-bottom:10px;box-shadow:0 1px 0 rgba(27,31,35,0.04)}
    .card h3{margin:0 0 6px 0;font-size:16px}
    .meta{font-size:12px;color:#586069;margin-bottom:6px}
    .path{font-family:monospace;font-size:12px;color:#0366d6}
    .dates{font-size:12px;color:#6a737d;margin-top:6px}
    .empty{color:#6a737d;font-size:13px;padding:8px}
  </style>
</head>
<body>
  <header>
    <h1 style="margin:0">Work</h1>
    <div style="margin-top:6px;font-size:13px;color:#444">Generated: ${now}</div>
  </header>
  <div class="board">
    ${['Todo','WIP','Done'].map(col => `
      <section class="column">
        <div class="col-title">${col}</div>
        ${groups[col].length===0?'<div class="empty">No items</div>':''}
        ${groups[col].map(it=>`<article class="card">
          <h3>${escapeHtml(it.meta.title || path.basename(it.file))}</h3>
          <div class="meta">${escapeHtml(it.meta.excerpt || '')}</div>
          <div class="path">${escapeHtml(path.relative(path.join(__dirname, '..'), it.file)).replace(/\\/g,'/')}</div>
          <div class="dates">Status: ${escapeHtml(it.meta.status||'')} · Created: ${escapeHtml(it.meta.created||'')} · Updated: ${escapeHtml(it.meta.updated||'')}</div>
        </article>`).join('\n')}
      </section>`).join('\n')}
  </div>
</body>
</html>`;
}

function escapeHtml(s){
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function main(){
  if (!fs.existsSync(WORK_DIR)){
    console.error('Work directory not found:', WORK_DIR);
    process.exit(1);
  }

  const files = walk(WORK_DIR).sort();
  const items = files.map(f => {
    const content = fs.readFileSync(f, 'utf8');
    const meta = extractMeta(content);
    return { file: f, meta };
  });

  const html = makeHtml(items);
  fs.writeFileSync(OUT_FILE, html, 'utf8');
  console.log('Wrote summary to', OUT_FILE);
}

if (require.main === module) main();

module.exports = { walk, extractMeta, makeHtml };
