// Run: node frontend/content-map.test.cjs
// The links from the app back to the site (frontend/content-map.json) must point at pages and anchors that exist in site/,
// and the PSI accessions of a story must be the ones its basis lists in site/data/stories.json.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const map = JSON.parse(fs.readFileSync(path.join(__dirname, 'content-map.json'), 'utf8'));
const stories = JSON.parse(fs.readFileSync(path.join(root, 'site/data/stories.json'), 'utf8'));

function pageFile(href) {
  const [p, hash] = href.split('#');
  const rel = p.replace(/^\//, '');
  const file = path.join(root, 'site', rel, rel === '' || rel.endsWith('/') ? 'index.html' : '');
  return { file: rel.endsWith('.html') ? path.join(root, 'site', rel) : file, hash };
}

for (const [id, page] of Object.entries(map.pages)) {
  assert.ok(['story', 'section', 'examples'].includes(page.kind), `${id}: kind`);
  assert.ok(page.title && page.about, `${id}: title and about are shown to the reader`);
  const { file, hash } = pageFile(page.href);
  assert.ok(fs.existsSync(file), `${id}: ${page.href} has no page at ${path.relative(root, file)}`);
  if (hash) assert.match(fs.readFileSync(file, 'utf8'), new RegExp(`id="${hash}"`), `${id}: no #${hash} in ${page.href}`);
}

// A story page lists its sources; the map must say the same, so a record links to the story that explains it.
for (const [id, page] of Object.entries(map.pages)) {
  if (!page.basis) continue;
  const m = page.href.match(/^\/stories\/([^/#]+)\/$/);
  assert.ok(m, `${id}: basis only on a story page`);
  const entry = stories.find(s => s.id === m[1]);
  assert.ok(entry, `${id}: no story ${m[1]} in site/data/stories.json`);
  assert.deepEqual([...page.basis].sort(), entry.basis.map(b => b.accession).sort(), `${id}: basis differs from stories.json`);
  assert.equal(entry.state, 'published', `${id}: the story is not published`);
}

for (const t of map.topics) {
  assert.ok(t.pages.length && t.when, `${t.id}: needs pages and when`);
  for (const id of t.pages) assert.ok(map.pages[id], `${t.id}: unknown page ${id}`);
}
for (const [key, ids] of Object.entries(map.records)) for (const id of ids) assert.ok(map.pages[id], `${key}: unknown page ${id}`);
for (const t of map.topics) if (t.when.text) new RegExp(t.when.text, 'i');
assert.ok(map.topics.some(t => t.when.always), 'one topic is always shown, so the reader always has a way to more examples');
console.log('content map ok');
