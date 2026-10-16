// Requests every http(s) link in README.md, SOURCES.md and the dashboard (docs/index.html, docs/app.js) and fails if any does not return a page.
// Run: node scripts/check-links.js
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const files = ['README.md', 'SOURCES.md', 'docs/index.html', 'docs/app.js'];
const urls = new Set();
for (const f of files) {
  const text = fs.readFileSync(path.join(ROOT, f), 'utf8');
  for (const m of text.matchAll(/https?:\/\/[^\s)<>"'`\]]+/g)) urls.add(m[0].replace(/[.,;:]+$/, ''));
}
// XML namespace identifiers look like URLs but are names, not pages a reader follows.
urls.delete('http://www.w3.org/2000/svg');

// What a link should return, from its path: xlsx, pdf, png or a web page.
function kindOf(url, finalUrl = url) {
  const p = decodeURIComponent(new URL(finalUrl || url).pathname + ' ' + new URL(url).pathname).toLowerCase();
  return /\.xlsx\b/.test(p) ? 'xlsx' : /\.pdf\b/.test(p) ? 'pdf' : /\.png\b/.test(p) ? 'png' : 'page';
}

const UA ='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36';
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function check(url) {
  // Three tries with a growing pause, because some servers answer a burst with 503.
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, { redirect: 'follow', headers: { 'User-Agent': UA, Accept: '*/*' }, signal: AbortSignal.timeout(30000) });
      // Only the first chunk is read: a link works if it answers with content, and the large report
      // PDFs (up to 18 MB) would otherwise hit the timeout on a slow connection.
      const reader = res.body ? res.body.getReader() : null;
      const first = reader ? await reader.read() : { value: undefined };
      if (reader) await reader.cancel();
      const head = first.value ? Buffer.from(first.value) : Buffer.alloc(0);
      const type = (res.headers.get('content-type') || '').split(';')[0].trim() || 'no content type';
      const kind = kindOf(url, res.url);
      // The file must be what the link promises: an xlsx starts with "PK" (zip), a PDF with "%PDF",
      // a page is HTML. A server that answers a missing file with an HTML error page then fails.
      const content = kind === 'xlsx' ? head.subarray(0, 2).toString() === 'PK'
        : kind === 'pdf' ? head.subarray(0, 4).toString() === '%PDF'
        : kind === 'png' ? head.subarray(1, 4).toString() === 'PNG'
        : /html|xml|json|text/.test(type) || /<(!doctype|html)/i.test(head.toString('latin1', 0, 512));
      if (res.ok && head.length > 0 && content) return { ok: true, status: res.status, type, kind };
      if (attempt === 3) return { ok: false, status: res.status, type, kind, why: res.ok ? `content is not ${kind}` : 'HTTP error' };
    } catch (e) {
      if (attempt === 3) return { ok: false, status: e.name === 'TimeoutError' ? 'timeout' : e.message };
    }
    await sleep(2000 * attempt);
  }
}

// node scripts/check-links.js --self-test: a local stub server proves that an HTML error page served
// under an .xlsx or .pdf link fails, and that real file types pass.
async function selfTest() {
  const http = require('http');
  const PK = Buffer.from('PK\x03\x04 rest of a zip', 'latin1'), PDF = Buffer.from('%PDF-1.7 rest', 'latin1');
  const html = '<!doctype html><html><body>Seite nicht gefunden</body></html>';
  const routes = {
    '/good.xlsx': ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', PK],
    '/error-page.xlsx': ['text/html', html],
    '/good.pdf': ['application/pdf', PDF],
    '/error-page.pdf': ['text/html', html],
    '/page.html': ['text/html', html],
  };
  const server = http.createServer((q, r) => { const [t, b] = routes[q.url.split('?')[0]] || ['text/plain', 'missing']; r.writeHead(routes[q.url.split('?')[0]] ? 200 : 404, { 'content-type': t }); r.end(b); });
  await new Promise(res => server.listen(0, '127.0.0.1', res));
  const base = `http://127.0.0.1:${server.address().port}`;
  const want = { '/good.xlsx': true, '/error-page.xlsx': false, '/good.pdf': true, '/error-page.pdf': false, '/page.html': true, '/missing.xlsx': false };
  let wrong = 0;
  for (const [p, ok] of Object.entries(want)) {
    const r = await check(base + p);
    if (r.ok !== ok) wrong++;
    console.log(`${r.ok === ok ? 'PASS' : 'FAIL'}  ${p.padEnd(18)} expected ${ok ? 'page' : 'failure'}, got ${r.ok ? 'page' : 'failure'} (${r.status} ${r.type}${r.why ? ', ' + r.why : ''})`);
  }
  server.close();
  console.log(wrong ? `${wrong} self-test case(s) wrong` : 'self-test passed');
  process.exit(wrong ? 1 : 0);
}

(async () => {
  if (process.argv.includes('--self-test')) return selfTest();
  let failed = 0;
  const list = [...urls];
  // At most 4 requests at a time, so the check does not look like a burst to the servers.
  const results = new Array(list.length);
  let next = 0;
  await Promise.all(Array.from({ length: 4 }, async () => { while (next < list.length) { const i = next++; results[i] = await check(list[i]); } }));
  // The page's own GitHub Pages address (link-preview tags) and the repository's CI badge answer only
  // once the repository is public and Pages is switched on; until then GitHub returns 404.
  const PENDING = ['https://jtmf-beep.github.io/german-ev-shift-public/', 'https://github.com/jtmf-beep/german-ev-shift-public/'];
  let pending = 0;
  list.forEach((u, i) => {
    const r = results[i];
    if (!r.ok && PENDING.some(p => u.startsWith(p)) && r.status === 404) { pending++; console.log(`PENDING ${u}  (repository private or Pages not switched on yet; must pass after publishing)`); return; }
    if (!r.ok) failed++;
    console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${String(r.status).padEnd(4)} ${(r.kind || '').padEnd(5)} ${String(r.type || '').padEnd(28)} ${u}${r.why ? '  (' + r.why + ')' : ''}`);
  });
  console.log(`\n${list.length - failed - pending} of ${list.length} links returned the expected content; ${pending} pending publication; ${failed} failed`);
  process.exit(failed ? 1 : 0);
})();
