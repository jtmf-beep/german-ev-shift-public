// Reads KBA FZ8 table 8.9.1 ("Neuzulassungen von Personenkraftwagen ... nach Marken und ausgewählten
// Haltergruppen", January to the report month) from data/raw/fz8 into rows for data/keepers.csv.
// Keeper groups cover all drive types: KBA publishes no brand x keeper x battery-electric table.
const fs = require('fs');
const path = require('path');
const { readSheet } = require('./xlsx');

const RAW = path.join(__dirname, '..', 'data', 'raw', 'fz8');
// Column of each count in the sheet (the next column is KBA's share in %), found by header text.
const GROUPS = [
  ['private', /Private Halter/],
  ['commercial', /Gewerbliche Halter/],
  ['dealer', /Kfz-Handel/],
  ['manufacturer', /Kfz-Herstellung/],
  ['rental', /Kfz-Vermietung/],
  ['other_services', /sonstiger Dienstleistungen/],
  ['other_commercial', /sonstige gewerbliche/],
  ['unknown', /Unbekannt/],
];
const num = (v, where) => {
  const s = String(v ?? '').trim();
  if (s === '-') return 0;
  if (!/^\d+$/.test(s)) throw new Error(`${where}: unexpected value "${s}"`);
  return Number(s);
};

function buildKeepers() {
  const out = [];
  if (!fs.existsSync(RAW)) return out;
  for (const f of fs.readdirSync(RAW).filter(f => /^fz8_\d{6}\.xlsx$/.test(f)).sort()) {
    const month = `${f.slice(4, 8)}-${f.slice(8, 10)}`;
    // January files have only the month sheet, which is then also January-to-month.
    const { rows } = readSheet(path.join(RAW, f), n => n.trim() === (month.endsWith('-01') ? 'FZ 8.9' : 'FZ 8.9.1'));
    const h = rows.findIndex(r => (r[1] || '').trim() === 'Marke');
    if (h < 0) throw new Error(`${f}: header row not found`);
    const head = rows[h].map((c, i) => `${c} ${(rows[h + 1] || [])[i] || ''}`.replace(/\s+/g, ' '));
    const total = head.findIndex(c => /^Insgesamt/.test(c.trim()));
    const col = Object.fromEntries(GROUPS.map(([k, re]) => {
      const i = head.findIndex(c => re.test(c));
      if (i < 0) throw new Error(`${f}: column ${k} not found`);
      return [k, i];
    }));
    for (const r of rows.slice(h + 2)) {
      const name = (r[1] || '').trim();
      if (!name || /^Hinweis|^©/.test(name) || String(r[total] ?? '').trim() === '') continue;
      const rec = { month, brand: name === 'INSGESAMT' ? 'MARKET' : name, total: num(r[total], `${f} ${name} total`) };
      for (const [k] of GROUPS) rec[k] = num(r[col[k]], `${f} ${name} ${k}`);
      out.push(rec);
      if (name === 'INSGESAMT') break;
    }
    if (!out.some(r => r.month === month && r.brand === 'MARKET')) throw new Error(`${f}: no INSGESAMT row`);
  }
  return out;
}

// KBA FZ28.3: all new cars and battery-electric cars by keeper group, market level only (no brands),
// January to the file's month. Gives the share of electric cars that dealers and makers register themselves.
const RAW28 = path.join(__dirname, '..', 'data', 'raw', 'fz28');
const KEEP28 = { 'Private Halterinnen und Halter': 'private', 'Gewerbliche Halterinnen und Halter': 'commercial', 'darunter Kfz-Handel': 'dealer', 'darunter Kfz-Herstellung': 'manufacturer', 'darunter Kfz-Vermietung, Carsharing': 'rental', 'Unbekannt': 'unknown' };
function buildBevKeepers() {
  const out = [];
  if (!fs.existsSync(RAW28)) return out;
  for (const f of fs.readdirSync(RAW28).filter(f => /^fz28_\d{4}_\d{2}\.xlsx$/.test(f)).sort()) {
    const month = `${f.slice(5, 9)}-${f.slice(10, 12)}`;
    const { rows } = readSheet(path.join(RAW28, f), n => /^FZ ?28\.3$/.test(n.trim()));
    const head = rows.findIndex(r => (r[7] || '').replace(/\s+/g, ' ').trim() === 'Elektro (BEV)');
    if (head < 0) throw new Error(`${f}: column "Elektro (BEV)" not found`);
    // The January-to-month block starts at the row "Januar - <Monat> <Jahr>" and ends at "Unbekannt".
    const start = rows.findIndex(r => /^Januar\s*-/.test((r[1] || '').trim()));
    if (start < 0) throw new Error(`${f}: January-to-month block not found`);
    const tot = r => ({ all: num(r[2], `${f} ${r[1]} all`), bev: num(r[7], `${f} ${r[1]} bev`) });
    out.push({ month, keeper_group: 'total', ...tot(rows[start]) });
    for (const r of rows.slice(start + 1)) {
      const k = KEEP28[(r[1] || '').replace(/\s+/g, ' ').trim()];
      if (!k) break;
      out.push({ month, keeper_group: k, ...tot(r) });
      if (k === 'unknown') break;
    }
  }
  return out;
}

module.exports = { buildKeepers, buildBevKeepers, GROUPS };
