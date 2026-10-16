// Every number in memo.md and OUTREACH.md must belong to a claim (data/memo_claims.tsv,
// data/outreach_claims.tsv). A claim is a pattern that matches the text around the number, usually
// including the brand it belongs to. If the pattern has a capture group, the captured value must equal
// the claim's formula, recomputed from data/clean.csv, the company figures (docs/data.js, which
// validate.js proves is a fresh rebuild) and data/facts.tsv (which validate.js checks against the
// sources). A pattern without a capture group pins the text itself; if it has a formula, that formula
// is a condition on the data and must return '' (true). Bold text must also belong to a claim.
// Run: node scripts/check-memo-numbers.js
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

// A number in prose: 1,234,567 or 12.5 or 7, also right after a letter or hyphen ("FY2021", "Jan-2025").
const NUM = /(?<![\d.,])(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?(?!\d)/g;
// German text (memo.de.md): 37.462 or 42,5 — a point groups thousands, a comma marks decimals.
const NUM_DE = /(?<![\d.,])(?:\d{1,3}(?:\.\d{3})+|\d+)(?:,\d+)?(?!\d)/g;
// Formulas must read the data; a bare constant would let any memo text pass.
const DATA_FN = /\b(j|fy|mo|share|segB|seg|growth|threeGrowth|bmwGroup|irv|fact|leader|notLead|firstMonth|lastMonth|monthCount|jr|seg12|fyseg|csh|cun|keep|kmonth|model|mg|units|mdelta|rowsIn|groupSize|robustHolds|noiseOk|dsh|qsh|rob|selfAll|selfBev|ctx)\(/;

// ---------- data ----------
const { readTable } = require('./table');
const rows = readTable(path.join(ROOT, 'data', 'clean.csv')).map(r => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, /^\d+$/.test(v) ? +v : v])));
const IR = JSON.parse(read('docs/data.js').match(/window\.IR = (\[.*\]);/)[1]);
const facts = Object.fromEntries(readTable(path.join(ROOT, 'data', 'facts.tsv'), '\t').map(r => [r.key, r.value]));
const lastMM = rows.reduce((m, r) => (r.month > m ? r.month : m), '').slice(5);
const comp = require('./competitors');
// Same months every year (January to the latest month), as on the dashboard.
const j = (b, y, f) => rows.filter(r => r.brand === b && r.month.startsWith(y) && r.month.slice(5) <= lastMM).reduce((s, r) => s + r[f], 0);
const fns = {
  j,
  fy: (b, y, f) => rows.filter(r => r.brand === b && r.month.startsWith(y)).reduce((s, r) => s + r[f], 0),
  fact: k => { if (!(k in facts)) throw new Error(`no fact ${k}`); return facts[k]; },
  mo: (b, month, f) => rows.find(r => r.brand === b && r.month === month)[f],
  share: (b, y) => 100 * j(b, y, 'bev') / j(b, y, 'registrations'),
  segB: (b, y) => 100 * j(b, y, 'bev') / j('MARKET', y, 'bev'),
  seg: y => ['BMW', 'MERCEDES', 'PORSCHE'].reduce((s, b) => s + 100 * j(b, y, 'bev') / j('MARKET', y, 'bev'), 0),
  growth: (b, y) => 100 * (j(b, y, 'bev') / j(b, String(+y - 1), 'bev') - 1),
  bmwGroup: y => 100 * (j('BMW', y, 'bev') + j('MINI', y, 'bev')) / (j('BMW', y, 'registrations') + j('MINI', y, 'registrations')),
  irv: (c, p, m) => { const r = IR.find(x => x.company === c && x.period === p && x.metric === m); if (!r) throw new Error(`no figure ${c} ${p} ${m}`); return r.value; },
  firstMonth: () => rows.reduce((m, r) => (r.month < m ? r.month : m), '9999'),
  lastMonth: () => rows.reduce((m, r) => (r.month > m ? r.month : m), ''),
  // Display name of the brand with the highest value of f(brandKey); key() maps a display name back.
  leader: f => { const k = ['BMW', 'MERCEDES', 'PORSCHE'].reduce((a, b) => (f(b) > f(a) ? b : a)); return { BMW: 'BMW', MERCEDES: 'Mercedes-Benz', PORSCHE: 'Porsche' }[k]; },
  threeGrowth: y => { const t = yy => ['BMW', 'MERCEDES', 'PORSCHE'].reduce((s, b) => s + j(b, yy, 'bev'), 0); return 100 * (t(y) / t(String(+y - 1)) - 1); },
  monthCount: () => new Set(rows.map(r => r.month)).size,
  // Months fromMM..toMM of year y, e.g. January-May: jr('MARKET','2026','01','05','bev').
  jr: (b, y, from, to, f) => rows.filter(r => r.brand === b && r.month.startsWith(y) && r.month.slice(5) >= from && r.month.slice(5) <= to).reduce((s, r) => s + r[f], 0),
  // The three brands' slice over a full calendar year.
  fyseg: y => { const f = b => rows.filter(r => r.brand === b && r.month.startsWith(y)).reduce((t, r) => t + r.bev, 0); return 100 * (f('BMW') + f('MERCEDES') + f('PORSCHE')) / f('MARKET'); },
  // The three brands' slice over the 12 months ending at endMonth (YYYY-MM).
  seg12: endMonth => {
    const ms = [...new Set(rows.map(r => r.month))].sort().filter(m => m <= endMonth).slice(-12);
    const s = b => rows.filter(r => r.brand === b && ms.includes(r.month)).reduce((t, r) => t + r.bev, 0);
    return 100 * (s('BMW') + s('MERCEDES') + s('PORSCHE')) / s('MARKET');
  },
  // Every brand and owner group (data/brands.csv, scripts/groups.js), January to the latest month:
  // csh = share of the market in % (field bev or phev), cun = cars.
  csh: (u, y, f = 'bev') => comp.share(u, y, f),
  cun: (u, y, f = 'bev') => comp.jan(comp.members(u), y, f),
  // Units whose share rose, largest first (owner groups plus brands outside them): units('gain', n).
  units: (dir, n) => {
    const { GROUPS } = require('./groups');
    const y = lastMM && fns.lastMonth().slice(0, 4), p = String(+y - 1);
    const brandsNow = [...new Set(comp.rows.filter(r => r.month === fns.lastMonth() && !['MARKET', 'SONSTIGE'].includes(r.brand)).map(r => r.brand))];
    const list = [...Object.keys(GROUPS).filter(g => !require('./groups').isVariant(g)), ...brandsNow.filter(b => !Object.values(GROUPS).some(m => m.includes(b)))];
    const d = u => comp.share(u, y) - comp.share(u, p);
    return list.filter(u => (dir === 'gain' ? d(u) > 0 : d(u) < 0)).sort((a, b) => (dir === 'gain' ? d(b) - d(a) : d(a) - d(b))).slice(0, n);
  },
  // Keeper group k (manufacturer, dealer, private) as % of the brands' registrations, latest FZ8 file.
  keep: (brands, k) => { const ks = readTable(path.join(ROOT, 'data', 'keepers.csv')); const m = ks.map(r => r.month).sort().at(-1); const rs = ks.filter(r => r.month === m && [].concat(brands).includes(r.brand)); return 100 * rs.reduce((s, r) => s + +r[k], 0) / rs.reduce((s, r) => s + +r.total, 0); },
  // Model series of the brands, largest increase in battery-electric cars first: [[model, change], ...].
  mdelta: brands => { const y = fns.lastMonth().slice(0, 4), p = String(+y - 1); const ms = [...new Set(readTable(path.join(ROOT, 'data', 'models.csv')).filter(r => [].concat(brands).includes(r.brand) && r.month >= `${p}-01`).map(r => `${r.brand}|${r.model}`))]; return ms.map(k => { const [b, mo] = k.split('|'); return [mo, fns.model(b, mo, y) - fns.model(b, mo, p)]; }).sort((a, c) => c[1] - a[1]); },
  // Number of data rows in a CSV/TSV file of the project, and the number of brands in an owner group.
  rowsIn: f => readTable(path.join(ROOT, f), f.endsWith('.tsv') ? '\t' : ',').length,
  groupSize: g => require('./groups').GROUPS[g].length,
  // '' when the self-registration test holds (competitors.js robust(), proportional mode): same three gainers,
  // VW Group the largest loser, Mercedes-Benz up, BMW Group and Porsche down.
  robustHolds: () => {
    const y = fns.lastMonth().slice(0, 4), p = String(+y - 1), G = Object.keys(require('./groups').GROUPS).filter(g => !require('./groups').isVariant(g));
    const units = [...G, 'TESLA', 'PORSCHE'];
    const d = mode => u => comp.robust(y, mode).share(u) - comp.robust(p, mode).share(u);
    const top = f => units.filter(u => f(u) > 0).sort((a, b) => f(b) - f(a)).slice(0, 3).sort().join();
    const raw = d('raw'), pr = d('proportional');
    const ok = top(pr) === top(raw) && units.reduce((a, u) => (pr(u) < pr(a) ? u : a)) === 'VW GROUP' && pr('MERCEDES-BENZ') > 0 && pr('BMW GROUP') < 0 && pr('PORSCHE') < 0;
    return ok ? '' : 'self-registration test does not hold';
  },
  // '' when every named group's change has |paired t| above the 5% threshold (same months, this year vs last).
  noiseOk: units => {
    const y = fns.lastMonth().slice(0, 4), p = String(+y - 1), mm = fns.lastMonth().slice(5);
    const TC = { 1: 12.71, 2: 4.30, 3: 3.18, 4: 2.78, 5: 2.57, 6: 2.45, 7: 2.36, 8: 2.31, 9: 2.26, 10: 2.23, 11: 2.20 };
    const sh = (u, yy, m) => 100 * comp.range(u, yy, m, m, 'bev') / comp.range('MARKET', yy, m, m, 'bev');
    const bad = units.filter(u => {
      const d = []; for (let m = 1; m <= +mm; m++) { const k = String(m).padStart(2, '0'); d.push(sh(u, y, k) - sh(u, p, k)); }
      const n = d.length, mean = d.reduce((s, x) => s + x, 0) / n, sd = Math.sqrt(d.reduce((s, x) => s + (x - mean) ** 2, 0) / (n - 1));
      return !(Math.abs(mean / (sd / Math.sqrt(n))) > TC[n - 1]);
    });
    return bad.length ? 'within noise: ' + bad.join(', ') : '';
  },
  // Self-registration test numbers (competitors.js robust()): proportional share of a group in year y;
  // all brands' maker-plus-dealer registrations (FZ8) and the market's electric ones (FZ28), latest month.
  rob: (u, y) => comp.robust(y, 'proportional').share(u),
  selfAll: () => { const ks = readTable(path.join(ROOT, 'data', 'keepers.csv')); const m = ks.map(r => r.month).sort().at(-1); return ks.filter(r => r.month === m && r.brand !== 'MARKET').reduce((s, r) => s + +r.manufacturer + +r.dealer, 0); },
  selfBev: () => { const kb = readTable(path.join(ROOT, 'data', 'keepers_bev.csv')); const m = kb.map(r => r.month).sort().at(-1); return kb.filter(r => r.month === m && ['dealer', 'manufacturer'].includes(r.keeper_group)).reduce((s, r) => s + +r.bev, 0); },
  // Share of a group over months from..to of year y (e.g. October-December), in % of all BEV registrations.
  qsh: (u, y, from, to) => 100 * comp.range(u, y, from, to, 'bev') / comp.range('MARKET', y, from, to, 'bev'),
  // Share change of a group in points, January to the latest month, last year to this year.
  dsh: u => { const y = fns.lastMonth().slice(0, 4); return comp.share(u, y) - comp.share(u, String(+y - 1)); },
  // Month of the latest FZ8 file as "August 2026".
  // A context figure (data/context_figures.tsv, checked against its quoted source by validate.js).
  ctx: k => { const r = readTable(path.join(ROOT, 'data', 'context_figures.tsv'), '\t').find(x => x.key === k); if (!r) throw new Error('no context figure ' + k); return Number(r.value); },
  kmonth: () => { const m = readTable(path.join(ROOT, 'data', 'keepers.csv')).map(r => r.month).sort().at(-1); return new Date(m + '-01T00:00Z').toLocaleString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }); },
  // Battery-electric cars of one KBA model series, January to the latest month.
  model: (b, mo, y) => readTable(path.join(ROOT, 'data', 'models.csv')).filter(r => r.brand === b && r.model === mo && r.month.startsWith(y) && r.month.slice(5) <= lastMM).reduce((s, r) => s + +(r.bev || 0), 0),
  // Market growth in % over months from..to of year y against the same months a year earlier (field bev, phev, diesel).
  mg: (y, from, to, f) => 100 * (fns.jr('MARKET', y, from, to, f) / fns.jr('MARKET', String(+y - 1), from, to, f) - 1),
  key: name => ({ BMW: 'BMW', 'Mercedes-Benz': 'MERCEDES', Porsche: 'PORSCHE' }[name]),
  notLead: () => [...new Set(rows.map(r => r.month.slice(0, 4)))].filter(y => !(j('BMW', y, 'bev') > j('MERCEDES', y, 'bev') && j('BMW', y, 'bev') > j('PORSCHE', y, 'bev'))).join(' and '),
};

let failed = 0;
const fail = msg => { failed++; console.log(`FAIL  ${msg}`); };

// reference: a README-style file. Link targets, URLs, code and HTML comments are left out of the number
// scan (check-links.js covers links; code holds versions and commands, not findings); bold labels and
// *italic* terms are allowed. Every other number still needs a claim.
function checkFile(textFile, claimsFile, allowedHeadings, { reference = false, de = false } = {}) {
  console.log(`\n== ${textFile} (claims: ${claimsFile})`);
  let raw = read(textFile).normalize('NFKC'); // full-width and other compatibility digits become plain digits
  if (reference) raw = raw.replace(/^\d+\. /gm, '').replace(/```[\s\S]*?```/g, ' ').replace(/`[^`\n]*`/g, ' ').replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/\]\([^)\s]*\)/g, ']').replace(/https?:\/\/[^\s)]+/g, ' ').replace(/^---\s*$/m, ' ');
  // Only "# title", the listed "## " sections and **bold** are allowed, so emphasis cannot hide outside the checks.
  raw.split(/\r?\n/).forEach((l, i) => {
    // Markdown also renders headings with up to 3 leading spaces and a tab after the #s.
    const hm = l.match(/^ {0,3}(#{1,6})[ \t]+(.*)$/);
    if (hm && (hm[1].length > 2 || (hm[1].length === 1 && i > 0))) fail(`${textFile}:${i + 1}: heading level not allowed: ${l}`);
    if (hm && hm[1].length === 2 && !allowedHeadings.includes(hm[2].trim())) fail(`${textFile}:${i + 1}: section heading not in the allowed list: ${l}`);
  });
  if (!reference && /__|<\/?[a-z][a-z0-9]*\b[^>]*>|(?<!\*)\*(?!\*)[^*\n]+(?<!\*)\*(?!\*)/i.test(raw)) fail(`${textFile}: emphasis other than **bold** (__, *x*, any HTML tag) is not allowed`);
  raw.split(/\r?\n/).forEach((l, i) => {
    if (/^\s*(=+|-+)\s*$/.test(l)) fail(`${textFile}:${i + 1}: setext heading or rule not allowed`);
    if (/^\s*>/.test(l)) fail(`${textFile}:${i + 1}: blockquote not allowed`);
  });
  // Digits from other scripts (e.g. Arabic-Indic) survive NFKC; refuse them rather than miss them.
  const foreign = raw.match(/(?![0-9])\p{Nd}/u);
  if (foreign) fail(`${textFile}: digit outside 0-9 found ("${foreign[0]}")`);
  const body = raw.replace(/\*\*\d\. /g, '**').replace(/\s+/g, ' ');
  // In a reference file a number glued to a letter is a name (FZ10, X3, iX3, CO2), not a value.
  const tokens = [...body.matchAll(de ? NUM_DE : NUM)].filter(m => !(reference && /[A-Za-z]/.test(body[m.index - 1] || ''))).map(m => ({ text: m[0], start: m.index, end: m.index + m[0].length, covered: false }));
  const spans = [];
  const [, ...cl] = read(claimsFile).trim().split(/\r?\n/);
  for (const line of cl) {
    const [label, pattern, formula] = line.split('\t');
    let re;
    try { re = new RegExp(pattern); } catch (e) { fail(`${label}: invalid pattern: ${e.message}`); continue; }
    const m = re.exec(body);
    if (!m) { fail(`${label}: text not found /${pattern}/`); continue; }
    spans.push([m.index, m.index + m[0].length]);
    for (const t of tokens) if (t.start >= m.index && t.end <= m.index + m[0].length) t.covered = true;
    if (formula && !DATA_FN.test(formula)) { fail(`${label}: formula does not read the data: ${formula}`); continue; }
    let value;
    if (formula) {
      // Formulas come from this repository's own claim files and run with the same trust as this script.
      try { value = Function(...Object.keys(fns), `return (${formula});`)(...Object.values(fns)); }
      catch (e) { fail(`${label}: cannot compute ${formula}: ${e.message}`); continue; }
    }
    if (m[1] === undefined) {
      const ok = !formula || value === '';
      if (!ok) failed++;
      console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}: "${m[0].slice(0, 90)}"${formula ? (ok ? ' (condition holds)' : ' (condition does not hold in the data)') : ''}`);
      continue;
    }
    if (!formula) { fail(`${label}: captures a value but has no formula`); continue; }
    const shown = de ? m[1].replace(/\./g, '').replace(',', '.') : m[1].replace(/,/g, '');
    const dec = (shown.split('.')[1] || '').length;
    // Report figures (a bare irv(...) call) must match exactly; computed ones at the precision shown AND
    // within 10% of the true value, so rounding a small number to "0" cannot pass.
    const exact = /^irv\([^()]*\)$/.test(formula.trim());
    const near = Number(value) === 0 ? Number(shown) === 0 : Math.abs(Number(shown) - Number(value)) / Math.abs(Number(value)) <= 0.1;
    // Text values (names, dates) compare as written; only numbers drop their thousands commas.
    const ok = typeof value === 'string' ? value === m[1]
      : exact ? Number(shown) === Number(value)
      : Number(shown) === Number(Number(value).toFixed(dec)) && near;
    if (!ok) failed++;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}: text ${m[1]}, data ${typeof value === 'string' ? value : Number(value).toFixed(dec + 2)}  [${formula}]`);
  }
  if (!reference) for (const b of body.matchAll(/\*\*([^*]+)\*\*/g)) {
    if (!spans.some(([s, e]) => b.index >= s && b.index + b[0].length <= e)) fail(`bold text is not part of any claim: ${b[0]}`);
  }
  const loose = tokens.filter(t => !t.covered);
  for (const t of loose) fail(`number "${t.text}" is not part of any claim: "...${body.slice(Math.max(0, t.start - 50), t.end + 20)}..."`);
  console.log(`${tokens.length - loose.length} of ${tokens.length} numbers in ${textFile} belong to a claim`);
}

checkFile('memo.md', 'data/memo_claims.tsv', ['Four findings', 'What it costs the premium makers', 'What would change the conclusion', 'Sources']);
checkFile('memo.de.md', 'data/memo_de_claims.tsv', ['Vier Ergebnisse', 'Was es die Premiumhersteller kostet', 'Was das Ergebnis ändern würde', 'Quellen'], { de: true });
// OUTREACH.md and its claim file are kept out of the public repository; checked whenever both exist.
if (fs.existsSync(path.join(ROOT, 'OUTREACH.md')) && fs.existsSync(path.join(ROOT, 'data/outreach_claims.tsv'))) checkFile('OUTREACH.md', 'data/outreach_claims.tsv', ['CV line', 'LinkedIn post draft']);
else console.log('SKIP  OUTREACH.md: not in this repository');
checkFile('README.md', 'data/readme_claims.tsv', ['What this means for each company', 'Watch-list (educational)', 'Method', 'How this was made', 'Limitations'], { reference: true });
console.log(`\n${failed} failure(s)`);
process.exit(failed ? 1 : 0);
