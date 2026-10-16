// Monthly refresh: looks for the next KBA FZ10, FZ8 and FZ28 files after the newest ones in data/raw,
// downloads any that are published (checking they are xlsx files), and logs them in the folder's
// _download_log.tsv. Prints "no new month" when KBA has not published yet. Run: node scripts/refresh.js
// In GitHub Actions it writes new=true|false and month=YYYY-MM to $GITHUB_OUTPUT.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const TABLES = [
  { dir: 'data/raw/kba', re: /^fz10_(\d{4})_(\d{2})\.xlsx$/, name: (y, m) => `fz10_${y}_${m}.xlsx`, url: f => `https://www.kba.de/SharedDocs/Downloads/DE/Statistik/Fahrzeuge/FZ10/${f}` },
  { dir: 'data/raw/fz8', re: /^fz8_(\d{4})(\d{2})\.xlsx$/, name: (y, m) => `fz8_${y}${m}.xlsx`, url: f => `https://www.kba.de/SharedDocs/Downloads/DE/Statistik/Fahrzeuge/FZ8/${f}` },
  { dir: 'data/raw/fz28', re: /^fz28_(\d{4})_(\d{2})\.xlsx$/, name: (y, m) => `fz28_${y}_${m}.xlsx`, url: f => `https://www.kba.de/SharedDocs/Downloads/DE/Statistik/Fahrzeuge/FZ28/${f}` },
];
const next = (y, m) => (m === 12 ? [y + 1, 1] : [y, m + 1]);
const pad = n => String(n).padStart(2, '0');

(async () => {
  const found = [];
  for (const t of TABLES) {
    const have = fs.readdirSync(path.join(ROOT, t.dir)).map(f => f.match(t.re)).filter(Boolean).map(m => [+m[1], +m[2]]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const [y, m] = next(...have.at(-1));
    const file = t.name(y, pad(m));
    let got = null;
    // KBA versions its download links (?v=1, 2, ...); the first that answers with an xlsx is the file.
    for (let v = 1; v <= 9 && !got; v++) {
      const url = `${t.url(file)}?__blob=publicationFile&v=${v}`;
      try {
        const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (german-ev-shift refresh)' }, signal: AbortSignal.timeout(30000) });
        if (!r.ok) continue;
        const b = Buffer.from(await r.arrayBuffer());
        if (b.subarray(0, 2).toString() === 'PK') got = { url, b, status: r.status };
      } catch { /* network error: treat as not published */ }
    }
    if (!got) { console.log(`no new month  ${t.dir}: ${file} not published yet`); continue; }
    fs.writeFileSync(path.join(ROOT, t.dir, file), got.b);
    const log = path.join(ROOT, t.dir, '_download_log.tsv');
    const sha = require('crypto').createHash('sha256').update(got.b).digest('hex');
    const today = new Date().toISOString().slice(0, 10);
    const header = fs.readFileSync(log, 'utf8').split(/\r?\n/)[0].split('\t');
    // The FZ10 log has file, url, status, date; the newer logs add bytes and sha256.
    const line = header.length > 4 ? [file, got.url, got.status, today, got.b.length, sha] : [file, got.url, got.status, today];
    fs.appendFileSync(log, line.join('\t') + '\n');
    console.log(`new          ${t.dir}: ${file} (${got.b.length} bytes, sha256 ${sha.slice(0, 12)}…) from ${got.url}`);
    found.push(`${y}-${pad(m)}`);
  }
  const month = found.sort().at(-1) || '';
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `new=${found.length ? 'true' : 'false'}\nmonth=${month}\n`);
  console.log(found.length ? `${found.length} new file(s); next: node scripts/build.js, then update LAST, the press-release totals and the claim files (see docs/maintaining.md)` : 'no new month: nothing to do');
})();
