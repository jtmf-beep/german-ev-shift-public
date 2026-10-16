// Downloads the company reports, the policy pages and the two KBA press releases into data/cache/ (not in
// git: the publishers' terms do not clearly allow redistribution, and the KBA releases name a press officer
// with phone, fax and e-mail) and checks each file against the SHA-256 recorded
// on 8 October 2026. A changed hash means the publisher replaced the file; the script says so and
// keeps the new copy aside instead of using it.
// Run: node scripts/fetch-sources.js   then: uv run --with "pypdf==6.19.0" --with "cryptography==46.0.3" python -I scripts/extract_pdf_text.py
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const [, ...lines] = fs.readFileSync(path.join(ROOT, 'data', 'sources_fetch.tsv'), 'utf8').trim().split(/\r?\n/);
const sha = buf => crypto.createHash('sha256').update(buf).digest('hex');
// Some servers refuse a browser-like User-Agent, others refuse a missing one; try both.
const AGENTS = ['Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36', 'curl/8.0'];

(async () => {
  let bad = 0;
  for (const line of lines) {
    const [local, url, want] = line.split('\t');
    const file = path.join(ROOT, local);
    // HTML pages change with every load (session tokens), so they have no pinned hash ('-'); the quoted
    // sentence in data/facts.tsv is what validate.js checks on them.
    const pinned = want !== '-';
    if (fs.existsSync(file) && (!pinned || sha(fs.readFileSync(file)) === want)) { console.log(`ok       ${local} (already present)`); continue; }
    let buf = null, status = '';
    // Each user agent is tried up to three times, 10 s and 30 s apart: government servers answer 503 now
    // and then (bundesfinanzministerium.de did on a CI run on 9 October 2026), and that is not a changed source.
    // FETCH_SIMULATE_DOWN=<local_file> skips the publisher, to test the archive fallback below.
    const down = process.env.FETCH_SIMULATE_DOWN === local;
    if (down) status = 'simulated publisher outage';
    for (const ua of down ? [] : AGENTS.flatMap(a => [a, a, a])) {
      if (status === 503 || status === 502 || status === 429) await new Promise(r => setTimeout(r, status === 429 ? 30000 : 10000));
      try {
        // The EU publications server chooses the format from the Accept header: */* returns RDF metadata,
        // application/xhtml+xml the Official Journal text that was pinned.
        const accept = local.endsWith('.xhtml') ? 'application/xhtml+xml' : '*/*';
        // It also needs a language to choose among the language versions (400 without one).
        const res = await fetch(url, { headers: { 'User-Agent': ua, Accept: accept, ...(local.endsWith('.xhtml') ? { 'Accept-Language': 'en' } : {}) }, redirect: 'follow', signal: AbortSignal.timeout(120000) });
        status = res.status;
        if (res.ok) { buf = Buffer.from(await res.arrayBuffer()); break; }
      } catch (e) { status = e.message; }
    }
    // An unpinned web page that the publisher will not serve (bundesfinanzministerium.de answers 503 to
    // GitHub's runners) is taken from the Internet Archive's latest copy instead; what validate.js checks
    // on such a page is its quoted sentence, so an archived copy without that sentence still fails there.
    if (!buf && !pinned) {
      try {
        const j = await (await fetch(`https://archive.org/wayback/available?url=${encodeURIComponent(url.replace(/^https?:\/\//, ''))}`, { signal: AbortSignal.timeout(60000) })).json();
        const snap = j.archived_snapshots && j.archived_snapshots.closest;
        if (snap && snap.available) {
          // "id_" asks for the page as archived, without the archive's toolbar.
          const res = await fetch(snap.url.replace(/^http:/, 'https:').replace(/\/web\/(\d+)\//, '/web/$1id_/'), { signal: AbortSignal.timeout(120000) });
          if (res.ok) { buf = Buffer.from(await res.arrayBuffer()); console.log(`archive  ${local}: publisher answered ${status}; using Internet Archive copy of ${snap.timestamp.slice(0, 8)}`); }
        }
      } catch (e) { status += `; archive: ${e.message}`; }
    }
    if (!buf) { bad++; console.log(`FAILED   ${local}: download failed (${status}) from ${url}`); continue; }
    fs.mkdirSync(path.dirname(file), { recursive: true });
    if (pinned && sha(buf) !== want) {
      bad++;
      fs.writeFileSync(file + '.changed', buf);
      console.log(`CHANGED  ${local}: the publisher's file no longer matches the recorded hash; saved as ${local}.changed for review`);
      continue;
    }
    fs.writeFileSync(file, buf);
    console.log(`fetched  ${local} (${buf.length} bytes, hash matches)`);
  }
  console.log(bad ? `\n${bad} file(s) not available as recorded` : '\nall source files present and unchanged');
  process.exit(bad ? 1 : 0);
})();
