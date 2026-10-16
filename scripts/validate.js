// Checks data/clean.csv. Exits with code 1 if any check fails.
// Run: node scripts/validate.js
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const BRANDS = ['BMW', 'MINI', 'MERCEDES', 'PORSCHE', 'MARKET'];
const FIRST = '2021-01';
const LAST = '2026-09';

let failed = 0;
const check = (ok, msg) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`); if (!ok) failed++; };

const { readTable } = require('./table');
const num = r => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, /^\d+$/.test(v) ? +v : v]));
const rows = readTable(path.join(ROOT, 'data', 'clean.csv')).map(num);

// 1. Row counts and missing months
const months = [];
for (let d = new Date(FIRST + '-01T00:00Z'); d <= new Date(LAST + '-01T00:00Z'); d.setUTCMonth(d.getUTCMonth() + 1)) {
  months.push(d.toISOString().slice(0, 7));
}
console.log(`rows: ${rows.length} (expected ${months.length} months x ${BRANDS.length} series = ${months.length * BRANDS.length})`);
check(rows.length === months.length * BRANDS.length, 'row count');
for (const b of BRANDS) {
  const have = new Set(rows.filter(r => r.brand === b).map(r => r.month));
  const missing = months.filter(m => !have.has(m));
  console.log(`  ${b.padEnd(8)} ${have.size} months`);
  check(missing.length === 0 && have.size === months.length, `${b}: no missing or extra months${missing.length ? ' (missing ' + missing.join(' ') + ')' : ''}`);
}
const keys = rows.map(r => r.month + r.brand);
check(new Set(keys).size === keys.length, 'no duplicate month/brand rows');

// 2. Internal consistency
const by = (m, b) => rows.find(r => r.month === m && r.brand === b);
let bad = rows.filter(r => r.bev + r.phev + r.diesel > r.registrations);
check(bad.length === 0, `BEV + PHEV + diesel never exceed total registrations (${bad.length} violations)`);
bad = rows.filter(r => r.brand !== 'MARKET' && (r.registrations > by(r.month, 'MARKET').registrations || r.bev > by(r.month, 'MARKET').bev));
check(bad.length === 0, `no brand exceeds the market total in any month (${bad.length} violations)`);

// 3. Sum of monthly files = KBA's own Jan-to-month column in the last file of each year.
// KBA revises monthly numbers, so a small gap is expected; more than 0.5% fails.
let brandYears = 0, brandYearsOff = 0;
for (const y of [...new Set(months.map(m => m.slice(0, 4)))]) {
  const lastMonth = months.filter(m => m.startsWith(y)).at(-1);
  for (const b of BRANDS) {
    const ys = rows.filter(r => r.brand === b && r.month.startsWith(y));
    const sum = ys.reduce((s, r) => s + r.registrations, 0);
    const sumBev = ys.reduce((s, r) => s + r.bev, 0);
    const ytd = by(lastMonth, b);
    const gap = Math.max(Math.abs(sum - ytd.ytd_registrations) / ytd.ytd_registrations, Math.abs(sumBev - ytd.ytd_bev) / Math.max(ytd.ytd_bev, 1));
    if (b !== 'MARKET') { brandYears++; if (gap > 0.005) brandYearsOff++; }
    if (b === 'MARKET' || gap > 0.005) {
      check(gap <= 0.005, `${y} ${b}: sum of months ${sum} / BEV ${sumBev} vs KBA Jan-${lastMonth.slice(5)} column ${ytd.ytd_registrations} / BEV ${ytd.ytd_bev} (gap ${(gap * 100).toFixed(2)}%)`);
    }
  }
}
check(brandYearsOff === 0, `brand-years whose month sums match KBA's Jan-to-month column within 0.5%: ${brandYears - brandYearsOff} of ${brandYears}`);

// 4. Reconciliation against totals KBA publishes in its own press releases.
// The releases are not redistributed (they carry a named press officer's contact details):
// scripts/fetch-sources.js downloads them into data/cache/press. Each published figure is read out of the
// fetched release, not typed in by hand; the number and the line it stands in are also recorded in
// data/published_totals.csv, and must be what the release prints.
const pubFile = path.join(ROOT, 'data', 'published_totals.csv');
const pubRows = readTable(pubFile);
for (const p of pubRows) {
  if (!fs.existsSync(path.join(ROOT, p.source_file))) { check(false, `${p.label}: source file missing: ${p.source_file} (run node scripts/fetch-sources.js)`); continue; }
  const raw = fs.readFileSync(path.join(ROOT, p.source_file), 'utf8').replace(/<[^>]+>/g, ' ').replace(/&nbsp;| /g, ' ').replace(/\s+/g, ' ');
  const m = raw.match(new RegExp(p.pattern));
  if (!m) { check(false, `${p.label}: pattern not found in ${p.source_file}`); continue; }
  if (m[1] === undefined) { check(false, `${p.label}: pattern has no capture group for the number`); continue; }
  const published = Number(m[1].replace(/\./g, ''));
  const lineMatch = (' ' + p.source_line).match(new RegExp(p.pattern));
  const lineOk = (' ' + raw).includes(' ' + p.source_line) && lineMatch && Number(lineMatch[1].replace(/\./g, '')) === published;
  check(lineOk && String(published) === p.published, `${p.label}: recorded ${p.published} and its source line "${p.source_line}" are what ${p.source_file} prints (${published})`);
  const ours = p.period.length === 4
    ? rows.filter(r => r.brand === p.brand && r.month.startsWith(p.period)).reduce((s, r) => s + r[p.field], 0)
    : by(p.period, p.brand)[p.field];
  check(ours === published, `${p.label}: clean.csv ${ours} vs KBA press release ${published} (difference ${ours - published})`);
}
// The reconciliation must cover the latest month's market total and BEV count, so it cannot be emptied silently.
const covered = (period, brand, field) => pubRows.some(p => p.period === period && p.brand === brand && p.field === field);
// The latest complete calendar year in the data must be reconciled too (the KBA annual press release).
const FULL = [...new Set(months.filter(m => m.endsWith('-12')).map(m => m.slice(0, 4)))].pop();
const needed = [[LAST, 'MARKET', 'bev'], ...['MARKET', 'BMW', 'MERCEDES', 'PORSCHE'].flatMap(b => [[LAST, b, 'registrations'], [FULL, b, 'registrations']]), [FULL, 'MARKET', 'bev']];
const notCovered = needed.filter(n => !covered(...n)).map(n => n.join(' '));
check(notCovered.length === 0, `press-release reconciliation covers the market and all three brands for ${FULL} and ${LAST} (${pubRows.length} published figures checked)${notCovered.length ? ' — missing: ' + notCovered.join(', ') : ''}`);

// 5. The committed data/clean.csv and docs/data.js are exactly what the raw files produce today.
const { build, DATA_JS } = require('./build');
const fresh = build();
const lf = s => s.replace(/\r\n/g, '\n');
check(lf(fs.readFileSync(path.join(ROOT, 'data', 'clean.csv'), 'utf8')) === fresh.csv, 'data/clean.csv matches a fresh rebuild from data/raw');
check(lf(fs.readFileSync(DATA_JS, 'utf8')) === fresh.dataJs, 'docs/data.js matches a fresh rebuild from data/raw and data/ir_figures.csv');

// 5b. data/brands.csv (every brand total) and data/models.csv (every model series) are what the raw files
// produce, and they add up: brands to the market total, model series to their brand total, in every month
// and every column. Cells KBA withholds ("/", "X") are blank; a sum that touches one is counted as skipped.
check(lf(fs.readFileSync(path.join(ROOT, 'data', 'brands.csv'), 'utf8')) === fresh.brandsCsv, 'data/brands.csv matches a fresh rebuild from data/raw');
check(lf(fs.readFileSync(path.join(ROOT, 'data', 'models.csv'), 'utf8')) === fresh.modelsCsv, 'data/models.csv matches a fresh rebuild from data/raw');
const allB = readTable(path.join(ROOT, 'data', 'brands.csv')), allM = readTable(path.join(ROOT, 'data', 'models.csv'));
const FIELDS = ['registrations', 'bev', 'phev', 'diesel', 'ytd_registrations', 'ytd_bev', 'ytd_phev', 'ytd_diesel'];
const sumUp = (list, target, label) => {
  let ok = 0, skipped = 0; const off = [];
  for (const f of FIELDS) {
    if (list.some(r => r[f] === '') || target[f] === '') { skipped++; continue; }
    const s = list.reduce((a, r) => a + Number(r[f]), 0);
    if (s === Number(target[f])) ok++; else off.push(`${label} ${f}: ${s} vs ${target[f]}`);
  }
  return { ok, skipped, off };
};
let bm = { ok: 0, skipped: 0, off: [] }, mb = { ok: 0, skipped: 0, off: [] };
const add = (acc, r) => { acc.ok += r.ok; acc.skipped += r.skipped; acc.off.push(...r.off); };
for (const m of months) {
  const inMonth = allB.filter(r => r.month === m);
  const market = inMonth.find(r => r.brand === 'MARKET');
  add(bm, sumUp(inMonth.filter(r => r.brand !== 'MARKET'), market, `${m} brands`));
  const mm = allM.filter(r => r.month === m);
  for (const b of inMonth.filter(r => r.brand !== 'MARKET')) {
    const ms = mm.filter(r => r.brand === b.brand);
    if (ms.length) add(mb, sumUp(ms, b, `${m} ${b.brand}`));
  }
}
check(bm.off.length === 0 && bm.ok > 0, `brand totals add up to the market total: ${bm.ok} month-columns exact, ${bm.skipped} skipped (withheld cell)${bm.off.length ? ' — off: ' + bm.off.slice(0, 5).join('; ') : ''}`);
check(mb.off.length === 0 && mb.ok > 0, `model series add up to their brand total: ${mb.ok} brand-month-columns exact, ${mb.skipped} skipped (withheld cell)${mb.off.length ? ' — off: ' + mb.off.slice(0, 5).join('; ') : ''}`);
const lateSkips = [...new Set(allM.filter(r => r.month >= '2025-01' && FIELDS.some(f => r[f] === '')).map(r => r.month))];
check(lateSkips.length === 0, `no withheld model cells in 2025-2026, the years the comparison uses${lateSkips.length ? ' — found in ' + lateSkips.join(' ') : ''}`);
const cleanSame = rows.filter(r => { const b = allB.find(x => x.month === r.month && x.brand === r.brand); return b && ['registrations', 'bev', 'phev', 'diesel', 'ytd_registrations', 'ytd_bev'].every(f => Number(b[f]) === r[f]); }).length;
check(cleanSame === rows.length, `clean.csv rows equal the same brands in brands.csv: ${cleanSame} of ${rows.length}`);

// 5c. data/keepers.csv (KBA FZ8, keeper groups per brand, January to the file's month) is what the raw
// files produce; groups add up to each brand, brands to the market, and each brand total equals the
// FZ10 January-to-month total of the same brand and month (two KBA tables, one count).
check(lf(fs.readFileSync(path.join(ROOT, 'data', 'keepers.csv'), 'utf8')) === fresh.keepersCsv, 'data/keepers.csv matches a fresh rebuild from data/raw/fz8');
const kp = readTable(path.join(ROOT, 'data', 'keepers.csv')).map(num);
const kpBad = kp.filter(r => r.private + r.commercial + r.unknown !== r.total || r.dealer + r.manufacturer + r.rental + r.other_services + r.other_commercial !== r.commercial);
check(kp.length > 0 && kpBad.length === 0, `keeper groups add up to each brand's total in ${kp.length - kpBad.length} of ${kp.length} FZ8 rows${kpBad.length ? ' — off: ' + kpBad.slice(0, 3).map(r => r.month + ' ' + r.brand).join(', ') : ''}`);
for (const m of [...new Set(kp.map(r => r.month))]) {
  const s = kp.filter(r => r.month === m && r.brand !== 'MARKET').reduce((a, r) => a + r.total, 0), mk = kp.find(r => r.month === m && r.brand === 'MARKET').total;
  check(s === mk, `FZ8 ${m}: brand totals ${s} = market ${mk}`);
  let same = 0; const diff = [];
  for (const r of kp.filter(r => r.month === m)) {
    const b = allB.find(x => x.month === m && x.brand === r.brand);
    if (!b) continue;
    if (Number(b.ytd_registrations) === r.total) same++; else diff.push(`${r.brand} ${r.total} vs ${b.ytd_registrations}`);
  }
  const need = ['BMW', 'MINI', 'MERCEDES', 'PORSCHE', 'TESLA', 'VW', 'MARKET'].filter(b => !kp.some(r => r.month === m && r.brand === b));
  check(diff.length === 0 && need.length === 0, `FZ8 ${m} brand totals equal FZ10 January-to-month totals: ${same} brands identical${diff.length ? ' — differ: ' + diff.slice(0, 5).join('; ') : ''}${need.length ? ' — missing in FZ8: ' + need.join(' ') : ''}`);
}

// 5d. data/keepers_bev.csv (KBA FZ28.3, market level, all cars and battery-electric cars by keeper group):
// rebuild equality, groups add up, and the totals equal FZ10's market January-to-month totals.
check(lf(fs.readFileSync(path.join(ROOT, 'data', 'keepers_bev.csv'), 'utf8')) === fresh.keepersBevCsv, 'data/keepers_bev.csv matches a fresh rebuild from data/raw/fz28');
for (const m of [...new Set(readTable(path.join(ROOT, 'data', 'keepers_bev.csv')).map(r => r.month))]) {
  const kb = readTable(path.join(ROOT, 'data', 'keepers_bev.csv')).filter(r => r.month === m).map(num);
  const g = k => kb.find(r => r.keeper_group === k), t = g('total');
  const sumOk = ['all', 'bev'].every(f => g('private')[f] + g('commercial')[f] + g('unknown')[f] === t[f]);
  const mk = allB.find(r => r.month === m && r.brand === 'MARKET');
  check(sumOk && Number(mk.ytd_registrations) === t.all && Number(mk.ytd_bev) === t.bev, `FZ28 ${m}: keeper groups add up (${sumOk ? 'yes' : 'NO'}); totals ${t.all} cars / ${t.bev} BEV vs FZ10 January-to-month ${mk.ytd_registrations} / ${mk.ytd_bev}`);
}

// 6. The company reports are not in git (their terms do not allow redistribution). They must be in
// data/cache, fetched by scripts/fetch-sources.js, and match the hashes recorded on download.
{
  const sl = readTable(path.join(ROOT, 'data', 'sources_fetch.tsv'), '\t');
  const sha = f => require('crypto').createHash('sha256').update(fs.readFileSync(f)).digest('hex');
  const missing = sl.filter(({ local_file, sha256 }) => { const f = path.join(ROOT, local_file); return !fs.existsSync(f) || (sha256 !== '-' && sha(f) !== sha256); }).map(r => r.local_file);
  const textMissing = sl.map(r => r.local_file).filter(l => l.startsWith('data/cache/ir/') && l.endsWith('.pdf')).filter(l => !fs.existsSync(path.join(ROOT, 'data', 'cache', 'ir_text', path.basename(l, '.pdf') + '.txt')));
  check(missing.length === 0 && textMissing.length === 0, `fetched source files present and unchanged: ${sl.length - missing.length} of ${sl.length}` +
    (missing.length || textMissing.length ? ` — run: node scripts/fetch-sources.js && uv run --with "pypdf==6.19.0" --with "cryptography==46.0.3" python -I scripts/extract_pdf_text.py (missing or changed: ${[...missing, ...textMissing].join(', ')})` : ''));
  if (missing.length || textMissing.length) { console.log('\ncannot check company figures without the fetched reports'); process.exit(1); }
}

// 7. Every investor-relations figure sits in the right place on the page it cites.
// data/ir_evidence.tsv gives, per figure, an exact text fragment from that page and which number in the
// fragment is the figure (set from the table's column order: year, half-year). The check confirms the
// fragment is on the page and that the number at that position equals the value in ir_figures.csv,
// so a figure moved to the wrong year or the wrong row fails.
const irRows = readTable(path.join(ROOT, 'data', 'ir_figures.csv'));
const evidence = new Map(readTable(path.join(ROOT, 'data', 'ir_evidence.tsv'), '\t').map(e => [`${e.company}|${e.period}|${e.metric}`, e]));
const NUM = /(?<![\w.,])(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?/g;
let irOk = 0;
const irBad = [];
for (const f of irRows) {
  const key = `${f.company}|${f.period}|${f.metric}`;
  const e = evidence.get(key);
  if (!e) { irBad.push(`${key}: no evidence line`); continue; }
  const txt = fs.readFileSync(path.join(ROOT, 'data', 'cache', 'ir_text', path.basename(f.source_file, '.pdf') + '.txt'), 'utf8');
  const parts = txt.split(/=====PAGE (\d+)=====/);
  const pi = parts.findIndex((p, i) => i % 2 === 1 && p === f.page);
  const page = pi < 0 ? '' : parts[pi + 1].replace(/\s+/g, ' ');
  // A fragment must carry its row label or sentence, not just a number that could sit anywhere.
  if (!/[A-Za-zÄÖÜäöü]{3,}/.test(e.fragment)) { irBad.push(`${key}: fragment has no row label or words: "${e.fragment}"`); continue; }
  const nums = [...e.fragment.matchAll(NUM)].map(m => Number(m[0].replace(/,/g, '')));
  const atPos = nums[Number(e.pos) - 1];
  if (!page.includes(e.fragment)) irBad.push(`${key}: fragment not on p${f.page} of ${f.source_file}: "${e.fragment}"`);
  else if (atPos !== Number(f.value)) irBad.push(`${key}: value ${f.value} but number ${e.pos} of the fragment is ${atPos} ("${e.fragment}")`);
  else irOk++;
}
check(irBad.length === 0, `investor-relations figures confirmed at their position on the cited page: ${irOk} of ${irRows.length}`);
// The dashboard and memo need a margin per company for 2021-2025 and H1 2026 (directly or as segment EBIT and revenue).
const missingMargins = [];
for (const c of ['BMW', 'MERCEDES', 'PORSCHE']) for (const p of ['2021', '2022', '2023', '2024', '2025', 'H1-2026']) {
  const hasIt = m => irRows.some(r => r.company === c && r.period === p && r.metric === m);
  if (!hasIt('auto_margin') && !(hasIt('cars_ebit') && hasIt('cars_revenue'))) missingMargins.push(`${c} ${p}`);
}
check(missingMargins.length === 0, `car-business margin available for 3 companies x 6 periods${missingMargins.length ? ' (missing: ' + missingMargins.join(', ') + ')' : ''}`);
irBad.forEach(b => console.log('      ' + b));

// 8. Facts quoted in words (policy dates, report statements) exist in their source, and so do the
// statements and figures that SOURCES.md quotes. Whitespace is ignored because PDF text breaks lines.
const squash = s => s.replace(/<[^>]+>/g, ' ').replace(/&nbsp;| /g, ' ').replace(/\s+/g, '');
const sourceText = spec => {
  const [file, page] = spec.split('#');
  const full = path.join(ROOT, file);
  if (!fs.existsSync(full)) return null;
  const txt = fs.readFileSync(full, 'utf8');
  if (!page) return squash(txt);
  const parts = txt.split(/=====PAGE (\d+)=====/);
  const i = parts.findIndex((p, k) => k % 2 === 1 && p === page);
  return i < 0 ? '' : squash(parts[i + 1]);
};
const [, ...fl] = fs.readFileSync(path.join(ROOT, 'data', 'facts.tsv'), 'utf8').trim().split(/\r?\n/);
// The English value used in the memo must say what the German source says: dates, decimals with a
// comma, press-release numbers, and for report quotes the page number in the source spec.
const MONTHS = { Januar: 'January', Februar: 'February', März: 'March', April: 'April', Mai: 'May', Juni: 'June', Juli: 'July', August: 'August', September: 'September', Oktober: 'October', November: 'November', Dezember: 'December' };
const EN = Object.values(MONTHS);
// Whole-number match: "7. Dezember" must not match inside "17. Dezember", "0,3" not inside "40,3".
const has = (text, s) => new RegExp(`(?<![\\d,.])${s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\d])`).test(text);
// Descriptive values must name the German term the source uses.
const DESCRIPTIVE = { 'certain plug-in hybrids': 'bestimmte Plug-in-Hybride', 'income-tested': 'Einkommensgrenzen' };
function valueInSource(value, src, text) {
  if (/^\d+$/.test(value) && src.includes('#')) return src.split('#')[1] === value;      // page number of a report quote
  let m = value.match(/^(\d{1,2}) (\w+) (\d{4})$/);                                       // "17 December 2023"
  if (m) {
    const de = Object.keys(MONTHS).find(k => MONTHS[k] === m[2]);
    const mm = String(EN.indexOf(m[2]) + 1).padStart(2, '0'), dd = m[1].padStart(2, '0');
    return has(text, `${m[1]}. ${de} ${m[3]}`) || has(text, `${m[1]}.${EN.indexOf(m[2]) + 1}.${m[3]}`) || has(text, `${dd}/${mm}/${m[3]}`);
  }
  m = value.match(/^(\d+)–(\d+)%$/);                                                        // "10–15%" -> "10 to 15 per cent"
  if (m) return has(text, `${m[1]} to ${m[2]} per cent`) || has(text, `${m[1]} bis ${m[2]} Prozent`);
  if (/^\d+\.\d+$/.test(value)) return has(text, value.replace('.', ','));               // 40.3 -> "40,3"
  if (/^\d\d\/\d{4}$/.test(value)) return text.includes(`Nr. ${value}`);                 // 41/2026 -> "Nr. 41/2026"
  if (value in DESCRIPTIVE) return text.includes(DESCRIPTIVE[value]);
  return false;                                                                           // anything else is not a recognised fact value
}
const factBad = fl.map(l => l.split('\t')).filter(([key, value, src, text]) => {
  const t = sourceText(src);
  return !t || !t.includes(squash(text)) || !valueInSource(value, src, text);
}).map(([key, value, src]) => `${key} = "${value}" (${src})`);
check(fl.length > 0 && factBad.length === 0, `facts in data/facts.tsv found in their source: ${fl.length - factBad.length} of ${fl.length}${factBad.length ? ' — missing: ' + factBad.join(', ') : ''}`);

const sources = fs.readFileSync(path.join(ROOT, 'SOURCES.md'), 'utf8');
// Every row of the quoted-statements table must parse; a row in another shape would otherwise be skipped.
const quoteSection = (sources.split(/^## Statements quoted/m)[1] || '').split(/^## /m)[0];
const quoteRows = quoteSection.split(/\r?\n/).filter(l => /^\s*\|/.test(l) && !/^\| Claim on|^\|---/.test(l));
// A report quote must name its page; other sources (HTML pages) have none.
const ROW = /^\| [^|]+ \| (data\/cache\/(?:ir|context)\/[^\s,|]+\.pdf), p\. (\d+)[^|]*\| "([^"]+)" \|$|^\| [^|]+ \| (data\/(?:cache\/press|cache\/context)\/[^\s,|]+)[^|]*\| "([^"]+)" \|$/;
const unparsed = quoteRows.filter(l => !ROW.test(l));
check(quoteRows.length > 0 && unparsed.length === 0, `SOURCES.md quoted-statement rows in the expected format: ${quoteRows.length - unparsed.length} of ${quoteRows.length}`);
const quoted = quoteRows.map(l => l.match(ROW)).filter(Boolean).map(m => (m[1] ? [m[0], m[1], m[2], m[3]] : [m[0], m[4], undefined, m[5]]));
// Each report statement used as a fact must be quoted in SOURCES.md, so a row cannot be deleted silently.
const reportFacts = fl.map(l => l.split('\t')).filter(([, , src]) => src.includes('#'));
const unquoted = reportFacts.filter(([, , , text]) => !quoted.some(q => squash(q[3]).includes(squash(text)))).map(([k]) => k);
check(unquoted.length === 0, `report statements in data/facts.tsv quoted in SOURCES.md: ${reportFacts.length - unquoted.length} of ${reportFacts.length}${unquoted.length ? ' — not quoted: ' + unquoted.join(', ') : ''}`);
const quoteBad = quoted.filter(([, file, page, q]) => {
  // A PDF in data/cache/ir or data/cache/context is read from its page-split text (…_text/<name>.txt#page).
  const spec = /^data\/cache\/(ir|context)\/.*\.pdf$/.test(file) ? `data/cache/${file.split('/')[2]}_text/${path.basename(file, '.pdf')}.txt${page ? '#' + page : ''}` : file;
  const t = sourceText(spec); return !t || !t.includes(squash(q));
}).map(([, file, page]) => `${file} p.${page}`);
check(quoted.length > 0 && quoteBad.length === 0, `statements quoted in SOURCES.md found on their cited page: ${quoted.length - quoteBad.length} of ${quoted.length}${quoteBad.length ? ' — not found: ' + quoteBad.join(', ') : ''}`);
// Press-release table: every row has exactly 3 cells, and every number in "figures used" is found in
// the release as a whole number (thousands with dots, percentages with a comma, dates in German form).
const pressSection = (sources.split(/^Press releases used/m)[1] || '').split(/^## /m)[0];
const pressLines = pressSection.split(/\r?\n/).filter(l => /^\s*\|/.test(l) && !/^\| File \||^\|---/.test(l));
const pressBad = [];
let pressRows = 0;
for (const line of pressLines) {
  const cells = line.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim());
  if (cells.length !== 3 || !/^data\/cache\/press\/\S+$/.test(cells[0])) { pressBad.push(`row not in the 3-column format: ${line.slice(0, 60)}`); continue; }
  pressRows++;
  const [file, , used] = cells;
  const plain = (sourceText(file) === null ? '' : fs.readFileSync(path.join(ROOT, file), 'utf8')).replace(/<[^>]+>/g, ' ').replace(/&nbsp;| /g, ' ').replace(/\s+/g, ' ');
  let rest = used;
  for (const [all, d, mon, yr] of used.matchAll(/(\d{1,2}) (January|February|March|April|May|June|July|August|September|October|November|December) (\d{4})/g)) {
    const dd = d.padStart(2, '0'), mm = String(EN.indexOf(mon) + 1).padStart(2, '0');
    if (!has(plain, `${dd}.${mm}.${yr}`) && !has(plain, `${d}. ${Object.keys(MONTHS).find(k => MONTHS[k] === mon)} ${yr}`)) pressBad.push(`date ${all} not in ${file}`);
    rest = rest.replace(all, ' ');
  }
  for (const [all, p] of rest.matchAll(/(\d+\.\d+)%/g)) { if (!has(plain, p.replace('.', ',') + ' Prozent')) pressBad.push(`${p}% not in ${file}`); rest = rest.replace(all, ' '); }
  for (const [all] of rest.matchAll(/\d{1,3}(?:,\d{3})+/g)) { if (!has(plain, all.replace(/,/g, '.'))) pressBad.push(`${all} not in ${file}`); rest = rest.replace(all, ' '); }
  for (const [all] of rest.matchAll(/(?<![\d/])\d+(?![\d/])/g)) if (!has(plain, all)) pressBad.push(`${all} not in ${file}`);
}
check(pressRows > 0 && pressBad.length === 0, `SOURCES.md press-release rows (${pressRows}): every listed figure found in its release${pressBad.length ? ' — ' + pressBad.join('; ') : ''}`);

// 9. Outreach drafts may only repeat numbers that the checked memo or the README already state.
const numsIn = s => new Set([...s.matchAll(/(?<![\w.,])\d{1,3}(?:,\d{3})+(?:\.\d+)?|(?<![\w.,])\d+(?:\.\d+)?/g)].map(m => m[0].replace(/,/g, '')));
const known = new Set([...numsIn(fs.readFileSync(path.join(ROOT, 'memo.md'), 'utf8')), ...numsIn(fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8'))]);
// OUTREACH.md is kept out of the public repository; the check runs whenever the file exists.
if (fs.existsSync(path.join(ROOT, 'OUTREACH.md'))) {
  const outreachNew = [...numsIn(fs.readFileSync(path.join(ROOT, 'OUTREACH.md'), 'utf8'))].filter(n => !known.has(n));
  check(outreachNew.length === 0, `numbers in OUTREACH.md also stated in memo.md or README.md${outreachNew.length ? ' — new: ' + outreachNew.join(', ') : ''}`);
} else console.log('SKIP  numbers in OUTREACH.md: the file is not in this repository');

// 10. memo.pdf was printed from the current memo.md (check-browser.js --pdf writes the memo's hash into the PDF title).
// The same for the German translation, memo.de.pdf from memo.de.md (run 4).
for (const [src, pdf] of [['memo.md', 'memo.pdf'], ['memo.de.md', 'memo.de.pdf']]) {
  const memoHash = require('crypto').createHash('sha256').update(fs.readFileSync(path.join(ROOT, src), 'utf8').replace(/\r\n/g, '\n')).digest('hex');
  const re = new RegExp(`/Title \\(Memo: German EV shift \\\\?\\(${src.replace(/\./g, '\\.')} sha256 ([0-9a-f]{64})\\\\?\\)\\)`);
  const pdfTitle = fs.existsSync(path.join(ROOT, pdf)) ? (fs.readFileSync(path.join(ROOT, pdf), 'latin1').match(re) || [])[1] : undefined;
  check(pdfTitle === memoHash, `${pdf} was printed from the current ${src}${pdfTitle === memoHash ? '' : ' — reprint with: node scripts/check-browser.js --pdf'}`);
}

// 12. Context figures (run 4: EU anchor P-022, fleet CO2 P-144, list prices): every row's quote is on its
// cited page and contains the row's value, written in any of the forms the sources use
// (99,670 / 99.670 / 24.995 / 24.995,00 / 29450.0). Prices are dated: a price page that has changed since
// it was saved fails here, which is the signal to re-date or drop the row.
{
  const rows = require('./table').readTable(path.join(ROOT, 'data', 'context_figures.tsv'), '\t');
  // 46169.62 -> 46169.62, 46169,62, 46.169,62;  29450 -> 29450, 29.450, 29.450,00, 29450.0, 29,450;  99.670 -> 99.670, 99,670
  const forms = v => {
    const [i, d] = v.split('.');
    const de = i.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return d ? [v, `${i},${d}`, `${de},${d}`] : [i, de, `${de},00`, `${i}.0`, i.replace(/\B(?=(\d{3})+(?!\d))/g, ',')];
  };
  const bad = rows.filter(r => {
    const [file, page] = r.source.split('#');
    const spec = /\.pdf$/.test(file) ? `data/cache/${file.split('/')[2]}_text/${path.basename(file, '.pdf')}.txt${page ? '#' + page : ''}` : file;
    const t = sourceText(spec);
    const q = squash(r.quote);
    return !t || !t.includes(q) || !forms(r.value).some(f => has(r.quote.replace(/\s+/g, ' '), f));
  }).map(r => `${r.key} (${r.source})`);
  check(rows.length > 0 && bad.length === 0, `context figures in data/context_figures.tsv found in their quoted source with their value: ${rows.length - bad.length} of ${rows.length}${bad.length ? ' — not found: ' + bad.join(', ') : ''}`);
}

// 11. Data dictionary (review items P-037, P-038): every tracked data file is described in data/datapackage.json,
// its columns match the description, every value meets its type and rule, and docs/data-dictionary.md is current.
{
  const d = require('./dictionary').checkPackage();
  check(d.problems.length === 0, `data dictionary: ${d.resources} files described, ${d.tracked} tracked data files, ${d.values} values checked against their type and rule${d.problems.length ? ' — ' + d.problems.slice(0, 5).join('; ') + (d.problems.length > 5 ? `; and ${d.problems.length - 5} more` : '') : ''}`);
}

console.log(failed ? `\n${failed} check(s) failed` : '\nall checks passed');
process.exit(failed ? 1 : 0);
