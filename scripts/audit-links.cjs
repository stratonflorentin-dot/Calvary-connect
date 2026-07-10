// One-shot audit: list internal links that don't match an existing app route.
const fs = require('fs');
const path = require('path');

const APP = path.join(__dirname, '..', 'src', 'app');
const SRC = path.join(__dirname, '..', 'src');

const routes = new Set();
(function walk(dir, route) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) {
      const seg = e.name;
      if (seg.startsWith('_') || seg === 'api') continue;
      const sub = seg.startsWith('(') && seg.endsWith(')') ? route : route + '/' + seg;
      walk(path.join(dir, seg), sub);
    } else if (e.name === 'page.tsx' || e.name === 'page.ts' || e.name === 'page.jsx') {
      routes.add(route || '/');
    }
  }
})(APP, '');

function matches(href) {
  const clean = href.split('?')[0].split('#')[0].replace(/\/$/, '') || '/';
  if (routes.has(clean)) return true;
  const parts = clean.split('/').filter(Boolean);
  outer: for (const r of routes) {
    const rp = r.split('/').filter(Boolean);
    if (rp.length !== parts.length) continue;
    for (let i = 0; i < rp.length; i++) {
      if (rp[i].startsWith('[') && rp[i].endsWith(']')) continue;
      if (rp[i] !== parts[i]) continue outer;
    }
    return true;
  }
  return false;
}

const broken = {};
(function scan(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== 'node_modules') scan(p); continue; }
    if (!/\.(tsx|ts|jsx)$/.test(e.name) || e.name.endsWith('.backup')) continue;
    const text = fs.readFileSync(p, 'utf8');
    const re = /(?:href=|href:\s*|router\.push\(|redirect\()["'`](\/[a-zA-Z0-9\-_\/\[\]${}?=&#]*)["'`]/g;
    let m;
    while ((m = re.exec(text))) {
      const href = m[1];
      if (href.startsWith('/api/') || href.includes('${') || href.includes('[')) continue;
      if (!matches(href)) {
        (broken[href] = broken[href] || []).push(path.relative(SRC, p));
      }
    }
  }
})(SRC);

const entries = Object.entries(broken).sort((a, b) => b[1].length - a[1].length);
console.log('BROKEN LINKS (target -> referencing files):\n');
for (const [href, files] of entries) {
  console.log(href + '  (' + files.length + ')');
  for (const f of [...new Set(files)].slice(0, 5)) console.log('   ' + f);
}
console.log('\nTotal distinct broken targets:', entries.length);
console.log('Total routes found:', routes.size);
