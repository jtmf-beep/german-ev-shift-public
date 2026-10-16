// Turns the unchanged KBA FZ10 files in data/raw/kba/ into data/clean.csv.
// One row per month and brand. Run: node scripts/build.js
const fs = require('fs');
const path = require('path');
const { readSheet } = require('./xlsx');
const { readTable } = require('./table');

const ROOT = path.join(__dirname, '..');
const RAW = path.join(ROOT, 'data', 'raw', 'kba');
const OUT = path.join(ROOT, 'data', 'clean.csv');

// Label of the brand-total row in FZ10 -> name used in clean.csv
const BRANDS = {
  'BMW ZUSAMMEN': 'BMW',
  'MINI ZUSAMMEN': 'MINI',
  'MERCEDES ZUSAMMEN': 'MERCEDES',
  'PORSCHE ZUSAMMEN': 'PORSCHE',
  'NEUZULASSUNGEN INSGESAMT': 'MARKET',
};
// Header text of each drive-type column group. Each group has 3 columns: month, Jan-to-month, share.
const COLUMNS = {
  registrations: /^Insgesamt$/,
  diesel: /^mit Dieselantrieb$/,
  phev: /^Plug-in-Hybridantrieb$/,
  bev: /^mit Elektroantrieb \(BEV\)$/,
};

// KBA marks "nothing" as '-'. Any other non-number ('.', '/', 'X') is a gap and must stop the build.
function num(v, where) {
  const s = String(v).trim();
  if (s === '-') return 0;
  if (!/^\d+$/.test(s)) throw new Error(`${where}: unexpected value "${s}"`);
  return Number(s);
}

// Returns the exact text of data/clean.csv and docs/data.js. validate.js calls this too, to prove
// that the committed files are what the raw files produce.
function build() {
const files = fs.readdirSync(RAW).filter(f => /^fz10_\d{4}_\d{2}\.xlsx$/.test(f)).sort();
const out = [], allBrands = [], models = [];
for (const f of files) {
  const [, y, m] = f.match(/fz10_(\d{4})_(\d{2})/);
  const month = `${y}-${m}`;
  const { rows } = readSheet(path.join(RAW, f), n => /^FZ ?10\.1/.test(n));
  const h = rows.findIndex(r => r.some(c => /^Insgesamt/.test(c.trim())));
  if (h < 0) throw new Error(`${f}: header row not found`);
  const col = {};
  for (const [key, re] of Object.entries(COLUMNS)) {
    const i = rows[h].findIndex(c => re.test(c.replace(/\s+/g, ' ').trim()));
    if (i < 0) throw new Error(`${f}: column ${key} not found`);
    col[key] = i;
  }
  // Every brand total ("X ZUSAMMEN") and every model-series row, for data/brands.csv and data/models.csv.
  // The brand name stands only on a brand's first model row, so it is carried down.
  let current = '';
  for (const r of rows.slice(h + 2)) {
    const a = (r[1] || '').trim(), b = (r[2] || '').trim();
    if (!a && !b) continue;
    // "/" (value withheld as not reliable enough) and "X" (cell blocked) occur in model rows of the
    // 2021-2024 files, and "X" once in a brand total (MG ROEWE, November 2021). They stay blank, never 0.
    const gapOrNum = (cell, where) => /^[/X.]$/.test(String(cell).trim()) ? '' : num(cell, where);
    const vals = key => [0, 1].map(off => {
      const cell = r[col[key] + off];
      if (off === 1 && m === '01' && String(cell).trim() === '') return gapOrNum(r[col[key]], `${f} ${a || current} ${b} ${key}`);
      return gapOrNum(cell, `${f} ${a || current} ${b} ${key}`);
    });
    const v = Object.fromEntries(Object.keys(COLUMNS).map(k => [k, vals(k)]));
    const rec = { registrations: v.registrations[0], bev: v.bev[0], phev: v.phev[0], diesel: v.diesel[0],
      ytd_registrations: v.registrations[1], ytd_bev: v.bev[1], ytd_phev: v.phev[1], ytd_diesel: v.diesel[1] };
    // Older files list a brand with no model series as one row with an empty model cell; that row is the brand total.
    if (/ ZUSAMMEN$/.test(a) || (a && !b && a !== 'NEUZULASSUNGEN INSGESAMT')) { allBrands.push({ month, brand: a.replace(/ ZUSAMMEN$/, ''), ...rec }); current = ''; continue; }
    if (a === 'NEUZULASSUNGEN INSGESAMT') { allBrands.push({ month, brand: 'MARKET', ...rec }); break; }
    if (a) current = a;
    if (!current || !b) throw new Error(`${f}: row without brand or model: ${JSON.stringify(r.slice(0, 4))}`);
    models.push({ month, brand: current, model: b, ...rec });
  }
  const found = new Set();
  for (const r of rows) {
    const label = r.map(c => c.trim()).find(c => BRANDS[c]);
    if (!label) continue;
    const brand = BRANDS[label];
    if (found.has(brand)) throw new Error(`${f}: ${label} appears twice`);
    found.add(brand);
    // January files leave the Jan-to-month column blank because it equals the month column.
    const g = (key, off) => {
      const cell = r[col[key] + off];
      if (off === 1 && m === '01' && String(cell).trim() === '') return num(r[col[key]], `${f} ${label} ${key}`);
      return num(cell, `${f} ${label} ${key}${off ? ' (Jan-to-month)' : ''}`);
    };
    out.push({
      month, brand,
      registrations: g('registrations', 0), bev: g('bev', 0), phev: g('phev', 0), diesel: g('diesel', 0),
      ytd_registrations: g('registrations', 1), ytd_bev: g('bev', 1),
      source_file: `data/raw/kba/${f}`,
    });
  }
  for (const b of Object.values(BRANDS)) if (!found.has(b)) throw new Error(`${f}: ${b} row missing`);
}

const toCsv = rs => { const hd = Object.keys(rs[0]); return [hd.join(','), ...rs.map(o => hd.map(k => /[",]/.test(o[k]) ? `"${String(o[k]).replace(/"/g, '""')}"` : o[k]).join(','))].join('\n') + '\n'; };
const csv = toCsv(out), brandsCsv = toCsv(allBrands), modelsCsv = toCsv(models);
// Keeper groups (private, dealer, manufacturer, ...) per brand from KBA FZ8, January to the file's month.
const keepersCsv = toCsv(require('./fz8').buildKeepers());
// Keeper groups of all cars and of battery-electric cars, market level (KBA FZ28.3).
const keepersBevCsv = toCsv(require('./fz8').buildBevKeepers());

// The dashboard reads the same rows, inlined as a script so it also works when opened from disk.
const irPath = path.join(ROOT, 'data', 'ir_figures.csv');
const ir = fs.existsSync(irPath) ? readTable(irPath).map(r => ({ ...r, value: Number(r.value) })) : [];
// Where a company publishes segment EBIT and revenue but no reported margin, compute it and say so.
for (const e of ir.filter(r => r.metric === 'cars_ebit')) {
  const rev = ir.find(r => r.metric === 'cars_revenue' && r.company === e.company && r.period === e.period);
  if (!rev || ir.some(r => r.metric === 'auto_margin' && r.company === e.company && r.period === e.period)) continue;
  ir.push({ company: e.company, period: e.period, metric: 'auto_margin', value: Math.round(1000 * e.value / rev.value) / 10, unit: '%',
    label: `${e.label.replace(' EBIT', '')} return on sales (computed: EBIT ${e.value} / revenue ${rev.value})`, source_file: e.source_file, page: e.page, computed: true });
}
// Download date of the newest KBA file, from the download log, so the page does not state it by hand.
const log = fs.readFileSync(path.join(RAW, '_download_log.tsv'), 'utf8').trim().split(/\r?\n/).map(l => l.split('\t'));
const unlogged = files.filter(f => !log.some(r => r[0] === f));
if (unlogged.length) throw new Error(`add these files to data/raw/kba/_download_log.tsv (file, URL, HTTP status, download date): ${unlogged.join(', ')}`);
const downloaded = log.filter(r => files.includes(r[0])).map(r => r[3]).sort().pop() || '';
// Competitor summary for the page (the full brand table is too large to inline): every brand's BEV,
// PHEV and total registrations from January to the latest month, in the latest two years; monthly
// BEV and PHEV of the groups since January of last year; keeper groups from FZ8.
const { GROUPS } = require('./groups');
const lastM = out.map(r => r.month).sort().at(-1), MMm = lastM.slice(5), yNow = lastM.slice(0, 4), yPrev = String(+yNow - 1);
const sumB = (list, y, f, from = '01', to = MMm) => allBrands.filter(r => list.includes(r.brand) && r.month.startsWith(y) && r.month.slice(5) >= from && r.month.slice(5) <= to).reduce((s, r) => s + Number(r[f] || 0), 0);
const names = [...new Set(allBrands.filter(r => r.month === lastM && r.brand !== 'MARKET' && r.brand !== 'SONSTIGE').map(r => r.brand))];
const triple = list => Object.fromEntries(['bev', 'phev', 'registrations'].map(f => [f, [yPrev, yNow].map(y => sumB(list, y, f))]));
const compMonths = [...new Set(allBrands.map(r => r.month))].filter(m => m >= `${yPrev}-01`).sort();
const comp = {
  years: [yPrev, yNow], lastMonth: lastM,
  market: triple(['MARKET']),
  brands: names.map(b => ({ brand: b, ...triple([b]) })).filter(b => b.bev[0] + b.bev[1] + b.phev[0] + b.phev[1] > 0),
  groups: Object.fromEntries(Object.entries(GROUPS).map(([g, list]) => [g, { members: list, ...triple(list) }])),
  monthly: compMonths.map(m => ({ month: m, ...Object.fromEntries(['MARKET', ...Object.keys(GROUPS), 'PORSCHE', 'TESLA'].map(g => [g, { bev: sumB(GROUPS[g] || [g], m.slice(0, 4), 'bev', m.slice(5), m.slice(5)), phev: sumB(GROUPS[g] || [g], m.slice(0, 4), 'phev', m.slice(5), m.slice(5)) }])) })),
  // Battery-electric registrations per model series for the three makers, January to the latest month.
  models: ['BMW', 'MINI', 'MERCEDES', 'PORSCHE'].flatMap(b => [...new Set(models.filter(r => r.brand === b && r.month >= `${yPrev}-01`).map(r => r.model))]
    .map(mo => ({ brand: b, model: mo, bev: [yPrev, yNow].map(y => models.filter(r => r.brand === b && r.model === mo && r.month.startsWith(y) && r.month.slice(5) <= MMm).reduce((s, r) => s + Number(r.bev || 0), 0)) }))
    .filter(r => r.bev[0] + r.bev[1] > 0)),
  // Self-registration robustness (same method as scripts/competitors.js robust()): January to the latest
  // FZ8 month of both years; shares raw, with each brand's BEV reduced by its self-registration rate
  // (proportional), and with every self-registered car counted as electric (worst case).
  robust: (() => {
    const kp = require('./fz8').buildKeepers();
    const kNow = kp.map(r => r.month).filter(m => m.startsWith(yNow)).sort().at(-1);
    if (!kNow) return null;
    const mm = kNow.slice(5), out = { months: mm, modes: {} };
    for (const mode of ['raw', 'proportional', 'worst']) {
      out.modes[mode] = [yPrev, yNow].map(y => {
        const k = kp.filter(r => r.month === `${y}-${mm}`);
        const adj = {};
        for (const b of [...new Set(allBrands.filter(r => r.month.startsWith(y) && r.brand !== 'MARKET').map(r => r.brand))]) {
          const bev = sumB([b], y, 'bev', '01', mm), kr = k.find(r => r.brand === b);
          const self = kr ? kr.manufacturer + kr.dealer : 0;
          adj[b] = mode === 'raw' ? bev : mode === 'proportional' ? (kr && kr.total ? bev * (1 - self / kr.total) : bev) : Math.max(0, bev - self);
        }
        const mk = Object.values(adj).reduce((s, v) => s + v, 0);
        return Object.fromEntries([...Object.keys(GROUPS), 'TESLA', 'PORSCHE'].map(g => [g, 100 * (GROUPS[g] || [g]).reduce((s, b) => s + (adj[b] || 0), 0) / mk]));
      });
    }
    const kn = kp.filter(r => r.month === kNow), bevK = require('./fz8').buildBevKeepers().filter(r => r.month === kNow);
    out.selfAllBrands = kn.filter(r => r.brand !== 'MARKET').reduce((s, r) => s + r.manufacturer + r.dealer, 0);
    out.selfBev = bevK.length ? bevK.find(r => r.keeper_group === 'dealer').bev + bevK.find(r => r.keeper_group === 'manufacturer').bev : null;
    out.bevTotal = bevK.length ? bevK.find(r => r.keeper_group === 'total').bev : null;
    return out;
  })(),
  // Seasonality check (same method as scripts/competitors.js season()): BEV share January to the latest
  // month against the rest of the year, for the three years before last year's comparison year and that year.
  season: MMm === '12' ? null : [3, 2, 1].map(k => String(+yNow - k)).map(y => ({ year: y, ...Object.fromEntries(['VW GROUP', 'BMW GROUP', 'MERCEDES-BENZ', 'PORSCHE', 'TESLA', 'CHINESE BRANDS', 'STELLANTIS'].map(g => {
    const nx = String(+MMm + 1).padStart(2, '0');
    const q = (a, b) => 100 * sumB(GROUPS[g] || [g], y, 'bev', a, b) / sumB(['MARKET'], y, 'bev', a, b);
    return [g, [q('01', MMm), q(nx, '12')]];
  })) })),
  keepers: require('./fz8').buildKeepers().filter(r => ['BMW', 'MINI', 'MERCEDES', 'PORSCHE', 'TESLA', 'VW', 'SKODA', 'AUDI', 'MARKET'].includes(r.brand)),
};
const dataJs = '// Generated by scripts/build.js from data/clean.csv, data/brands.csv, data/keepers.csv and data/ir_figures.csv. Do not edit.\n' +
  `window.KBA = ${JSON.stringify(out.map(({ source_file, ...r }) => r))};\nwindow.IR = ${JSON.stringify(ir)};\n` +
  `window.COMP = ${JSON.stringify(comp)};\n` +
  `window.META = ${JSON.stringify({ downloaded })};\n` +
  // Context figures (EU anchor, fleet CO2, list prices); validate.js checks each against its quoted source.
  `window.CTX = ${JSON.stringify(Object.fromEntries(readTable(path.join(ROOT, 'data', 'context_figures.tsv'), '\t').map(({ key, quote, ...r }) => [key, r])))};\n`;
return { csv, dataJs, brandsCsv, modelsCsv, keepersCsv, keepersBevCsv, rows: out.length, files: files.length, ir: ir.length, brandRows: allBrands.length, modelRows: models.length };
}

const BRANDS_OUT = path.join(ROOT, 'data', 'brands.csv'), MODELS_OUT = path.join(ROOT, 'data', 'models.csv');
module.exports = { build, OUT, BRANDS_OUT, MODELS_OUT, DATA_JS: path.join(ROOT, 'docs', 'data.js') };

if (require.main === module) {
  const r = build();
  fs.writeFileSync(OUT, r.csv);
  fs.writeFileSync(BRANDS_OUT, r.brandsCsv);
  fs.writeFileSync(MODELS_OUT, r.modelsCsv);
  fs.writeFileSync(path.join(ROOT, 'data', 'keepers.csv'), r.keepersCsv);
  fs.writeFileSync(path.join(ROOT, 'data', 'keepers_bev.csv'), r.keepersBevCsv);
  fs.writeFileSync(module.exports.DATA_JS, r.dataJs);
  console.log(`wrote ${r.rows} rows from ${r.files} files to data/clean.csv`);
  console.log(`wrote ${r.brandRows} brand-total rows to data/brands.csv and ${r.modelRows} model-series rows to data/models.csv`);
  console.log(`wrote docs/data.js (${r.rows} KBA rows, ${r.ir} IR figures)`);
}
