// Market shares of every brand and of the car groups, January to the latest month of each year,
// from data/brands.csv (every brand total in KBA FZ10). Run: node scripts/competitors.js
// Exports the functions so check-memo-numbers.js and the dashboard build use the same arithmetic.
const path = require('path');
const { readTable } = require('./table');

const ROOT = path.join(__dirname, '..');
const rows = readTable(path.join(ROOT, 'data', 'brands.csv'));
const LAST = rows.map(r => r.month).sort().at(-1);
const MM = LAST.slice(5);

const { GROUPS } = require('./groups');

// Sum of the monthly values, January to the same month as the latest file, for one brand or a group.
function jan(brands, year, field, mm = MM) {
  const list = [].concat(brands);
  return rows.filter(r => list.includes(r.brand) && r.month.startsWith(year) && r.month.slice(5) <= mm)
    .reduce((s, r) => s + Number(r[field] || 0), 0);
}
const members = name => GROUPS[name] || [name];
const share = (name, year, field = 'bev') => 100 * jan(members(name), year, field) / jan('MARKET', year, field);

// Sum over an arbitrary month range (inclusive), e.g. range('MARKET','2026','06','09','bev').
function range(brands, year, from, to, field) {
  const list = [].concat(members(brands)).flat();
  return rows.filter(r => list.includes(r.brand) && r.month.startsWith(year) && r.month.slice(5) >= from && r.month.slice(5) <= to)
    .reduce((s, r) => s + Number(r[field] || 0), 0);
}

// Share change split into two parts that add up exactly:
//   own growth   = (units this year - units last year) / market this year
//   market growth = units last year / market this year - units last year / market last year (negative when the market grows)
function decompose(name, year, field = 'bev') {
  const p = String(+year - 1);
  const b0 = jan(members(name), p, field), b1 = jan(members(name), year, field);
  const m0 = jan('MARKET', p, field), m1 = jan('MARKET', year, field);
  const own = 100 * (b1 - b0) / m1, market = 100 * (b0 / m1 - b0 / m0), total = 100 * (b1 / m1 - b0 / m0);
  return { own, market, total, b0, b1, m0, m1 };
}

// Growth of a drive type over a month range against the same months a year earlier, for the market.
const growthRange = (year, from, to, field) => 100 * (range('MARKET', year, from, to, field) / range('MARKET', String(+year - 1), from, to, field) - 1);

// Difference-in-differences around the 19 May 2026 bonus: change in growth from January-May to
// June-latest for BEV and PHEV (eligible) against diesel and all registrations (not or less eligible).
function bonusDiD(year = LAST.slice(0, 4)) {
  const before = f => growthRange(year, '01', '05', f), after = f => growthRange(year, '06', MM, f);
  const t = Object.fromEntries(['bev', 'phev', 'diesel', 'registrations'].map(f => [f, { before: before(f), after: after(f), diff: after(f) - before(f) }]));
  return { ...t, didBevDiesel: t.bev.diff - t.diesel.diff, didPhevDiesel: t.phev.diff - t.diesel.diff };
}

// Self-registration robustness (review item P-135). KBA FZ8 gives, per brand and all drive types, how many
// cars the maker itself or its dealers registered; there is no split by drive type, so two bounds are used:
//   proportional: a brand's electric cars are reduced by its self-registration rate;
//   worst case:   every self-registered car is assumed to be electric (BEV minus self-registrations, not below 0).
// The market is adjusted the same way (sum of the adjusted brands), over the months FZ8 covers in both years.
function robust(year, mode) {
  const { readTable: rt } = require('./table');
  const kp = rt(path.join(ROOT, 'data', 'keepers.csv'));
  // Both years over the same months: January to the latest FZ8 month of the latest year.
  const mm = kp.map(r => r.month).filter(m => m.startsWith(LAST.slice(0, 4))).sort().at(-1).slice(5);
  const kMonth = `${year}-${mm}`;
  if (!kp.some(r => r.month === kMonth)) throw new Error(`no FZ8 file for ${kMonth}`);
  const brands = [...new Set(rows.filter(r => r.month.startsWith(year) && r.brand !== 'MARKET').map(r => r.brand))];
  const adj = {};
  for (const b of brands) {
    const bev = jan(b, year, 'bev', mm), k = kp.find(r => r.month === kMonth && r.brand === b);
    const self = k ? Number(k.manufacturer) + Number(k.dealer) : 0, total = k ? Number(k.total) : 0;
    adj[b] = mode === 'raw' ? bev : mode === 'proportional' ? (total ? bev * (1 - self / total) : bev) : Math.max(0, bev - self);
  }
  const market = Object.values(adj).reduce((s, v) => s + v, 0);
  return { months: `01-${mm}`, kMonth, share: name => 100 * members(name).reduce((s, b) => s + (adj[b] || 0), 0) / market };
}

// Seasonality check for the October-December test (review item P-193): a unit's BEV share in January to
// the latest month against the rest of the same year. If October-December routinely differs from
// January-September, a Q4 share should be compared with last year's Q4, never with this year's Jan-Sep.
function season(name, year) {
  const nx = String(+MM + 1).padStart(2, '0');
  const q = (a, b) => 100 * range(members(name), year, a, b, 'bev') / range('MARKET', year, a, b, 'bev');
  return { first: q('01', MM), rest: MM === '12' ? null : q(nx, '12'), months: [`01-${MM}`, `${nx}-12`] };
}

// Headline under other definitions (review item P-193 / run 4 D5): each claim of the answer recomputed
// with the brand instead of the group, Leapmotor counted with Stellantis instead of the Chinese brands,
// Porsche counted inside VW Group, and self-registrations removed in proportion (January to the latest FZ8 month).
function sensitivity() {
  const y = LAST.slice(0, 4), p = String(+y - 1);
  const ch = n => [share(n, p), share(n, y)];
  const rb = n => { const a = robust(p, 'proportional'), b = robust(y, 'proportional'); return [a.share(n), b.share(n)]; };
  return [
    ['VW Group lost share', 'VW Group (VW, Audi, Skoda, Seat, Bentley, Lamborghini)', ch('VW GROUP'), -1],
    ['VW Group lost share', 'VW Group including Porsche', ch('VW GROUP INCL. PORSCHE'), -1],
    ['VW Group lost share', 'VW brand only', ch('VW'), -1],
    ['VW Group lost share', `self-registrations removed in proportion (Jan-${robust(y, 'raw').months.slice(3)})`, rb('VW GROUP'), -1],
    ['Mercedes-Benz gained share', 'Mercedes-Benz', ch('MERCEDES-BENZ'), 1],
    ['Mercedes-Benz gained share', 'self-registrations removed in proportion', rb('MERCEDES-BENZ'), 1],
    ['BMW Group lost share', 'BMW Group (BMW, MINI)', ch('BMW GROUP'), -1],
    ['BMW Group lost share', 'BMW brand only', ch('BMW'), -1],
    ['BMW Group lost share', 'MINI only', ch('MINI'), -1],
    ['BMW Group lost share', 'self-registrations removed in proportion', rb('BMW GROUP'), -1],
    ['Chinese brands gained share', 'Chinese brands including Leapmotor', ch('CHINESE BRANDS'), 1],
    ['Chinese brands gained share', 'Chinese brands without Leapmotor', ch('CHINESE BRANDS EXCL. LEAPMOTOR'), 1],
    ['Stellantis gained share', 'Stellantis without Leapmotor', ch('STELLANTIS'), 1],
    ['Stellantis gained share', 'Stellantis including Leapmotor', ch('STELLANTIS INCL. LEAPMOTOR'), 1],
  ].map(([claim, def, [a, b], dir]) => ({ claim, def, a, b, holds: Math.sign(b - a) === dir }));
}

module.exports = { GROUPS, LAST, jan, share, members, rows, range, decompose, growthRange, bonusDiD, robust, season, sensitivity };

if (require.main === module) {
  const y = LAST.slice(0, 4), p = String(+y - 1);
  const pct = v => v.toFixed(1).padStart(5) + '%';
  const readTableK = f => readTable(f).map(r => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, /^\d+$/.test(v) ? +v : v])));
  console.log(`Battery-electric (BEV) and plug-in hybrid (PHEV) registrations, January-${MM} ${p} and ${y}, sum of monthly KBA FZ10 values`);
  console.log(`Market BEV: ${jan('MARKET', p, 'bev')} -> ${jan('MARKET', y, 'bev')}; market PHEV: ${jan('MARKET', p, 'phev')} -> ${jan('MARKET', y, 'phev')}`);
  const names = [...new Set(rows.filter(r => r.month === LAST && r.brand !== 'MARKET' && r.brand !== 'SONSTIGE').map(r => r.brand))]
    .filter(b => share(b, y) >= 0.5 || share(b, p) >= 0.5 || share(b, y, 'phev') >= 1 || share(b, p, 'phev') >= 1)
    .sort((a, b) => jan(b, y, 'bev') - jan(a, y, 'bev'));
  console.log(['brand'.padEnd(24), `BEV ${p}`.padStart(9), `BEV ${y}`.padStart(9), 'share', '  share', ' change', ' PHEV sh', ' PHEV sh'].join(' '));
  for (const n of [...names, ...Object.keys(GROUPS)]) {
    const a = share(n, p), b = share(n, y);
    console.log([n.padEnd(24), String(jan(members(n), p, 'bev')).padStart(9), String(jan(members(n), y, 'bev')).padStart(9), pct(a), pct(b), ((b - a >= 0 ? '+' : '') + (b - a).toFixed(1)).padStart(6), pct(share(n, p, 'phev')), pct(share(n, y, 'phev'))].join(' '));
  }
  for (const [g, list] of Object.entries(GROUPS)) console.log(`  ${g} = ${list.join(' + ')}`);

  const sign = v => (v >= 0 ? '+' : '') + v.toFixed(2);
  console.log(`\nBEV share change ${p} -> ${y} (January-${MM}), split into own growth and the market's growth (points; parts add up to the total)`);
  for (const n of ['BMW GROUP', 'BMW', 'MERCEDES-BENZ', 'PORSCHE', 'VW GROUP', 'TESLA']) {
    const d = decompose(n, y);
    console.log(`${n.padEnd(16)} own growth ${sign(d.own).padStart(7)}  market growth ${sign(d.market).padStart(7)}  total ${sign(d.total).padStart(7)}  (units ${d.b0} -> ${d.b1}, ${sign(100 * (d.b1 / d.b0 - 1))}%)  check ${Math.abs(d.own + d.market - d.total) < 1e-9 ? 'adds up' : 'DOES NOT ADD UP'}`);
  }

  const did = bonusDiD(y);
  console.log(`\nMarket growth against the same months of ${p}, before and after the new bonus opened on 19 May ${y}`);
  for (const f of ['bev', 'phev', 'diesel', 'registrations']) console.log(`${f.padEnd(14)} Jan-May ${sign(did[f].before).padStart(7)}%  Jun-${MM} ${sign(did[f].after).padStart(7)}%  change ${sign(did[f].diff).padStart(7)} points`);
  console.log(`difference-in-differences, BEV minus diesel: ${sign(did.didBevDiesel)} points; PHEV minus diesel: ${sign(did.didPhevDiesel)} points`);

  console.log(`\nShare of all plug-in hybrid (PHEV) registrations, January-May and June-${MM}`);
  for (const n of ['BMW GROUP', 'MERCEDES-BENZ', 'PORSCHE', 'VW GROUP', 'BYD', 'CHINESE BRANDS']) {
    const s = (yy, a, b) => 100 * range(n, yy, a, b, 'phev') / range('MARKET', yy, a, b, 'phev');
    console.log(`${n.padEnd(16)} ${p}: ${pct(s(p, '01', '05'))} / ${pct(s(p, '06', MM))}   ${y}: ${pct(s(y, '01', '05'))} / ${pct(s(y, '06', MM))}`);
  }

  // Keeper groups from KBA FZ8 (all drive types; the latest FZ8 file may end a month before FZ10).
  const kp = readTableK(path.join(ROOT, 'data', 'keepers.csv'));
  const kMonths = [...new Set(kp.map(r => r.month))].sort();
  const kNow = kMonths.at(-1), kPrev = kMonths.filter(m => m.slice(0, 4) === String(+kNow.slice(0, 4) - 1) && m.slice(5) === kNow.slice(5))[0];
  console.log(`\nWho registers the cars (KBA FZ8, all drive types, January-${kNow.slice(5)}; % of the brand's registrations): private / dealer / manufacturer`);
  for (const b of ['BMW', 'MINI', 'MERCEDES', 'PORSCHE', 'TESLA', 'VW', 'MARKET']) {
    const f = m => { const r = kp.find(x => x.month === m && x.brand === b); return r ? ['private', 'dealer', 'manufacturer'].map(k => pct(100 * r[k] / r.total)).join(' /') : 'n/a'; };
    console.log(`${b.padEnd(9)} ${kNow.slice(0, 4)}: ${f(kNow)}   ${kPrev ? kPrev.slice(0, 4) + ': ' + f(kPrev) : ''}`);
  }

  // Self-registration robustness: do the headline's directions survive?
  {
    const modes = ['raw', 'proportional', 'worst case'];
    const R = Object.fromEntries(modes.map(m => [m, [robust(p, m), robust(y, m)]]));
    console.log(`\nSelf-registration robustness, January-${R.raw[1].months.slice(3)} (the months KBA FZ8 covers in both years): share of BEV registrations ${p} -> ${y}`);
    console.log('unit'.padEnd(18) + modes.map(m => m.padStart(24)).join(''));
    const units = [...Object.keys(GROUPS).filter(g => !require('./groups').isVariant(g)), 'TESLA', 'PORSCHE'];
    for (const u of units) console.log(u.padEnd(18) + modes.map(m => { const a = R[m][0].share(u), b = R[m][1].share(u); return `${a.toFixed(1)} -> ${b.toFixed(1)} (${sign(b - a).replace(/(\.\d)\d$/, '$1')})`.padStart(24); }).join(''));
    for (const m of modes) {
      const d = u => R[m][1].share(u) - R[m][0].share(u);
      const order = units.filter(u => d(u) > 0).sort((a, b) => d(b) - d(a)).slice(0, 3);
      const loser = units.reduce((a, u) => (d(u) < d(a) ? u : a));
      console.log(`${m.padEnd(13)} top 3 gainers: ${order.join(', ')}; largest loser: ${loser}; Mercedes-Benz ${d('MERCEDES-BENZ') > 0 ? 'gained' : 'lost'}, BMW Group ${d('BMW GROUP') > 0 ? 'gained' : 'lost'}, Porsche ${d('PORSCHE') > 0 ? 'gained' : 'lost'}`);
    }
  }

  {
    const S = ['VW GROUP', 'BMW GROUP', 'MERCEDES-BENZ', 'PORSCHE', 'TESLA', 'CHINESE BRANDS', 'STELLANTIS'];
    const yrs = [3, 2, 1].map(k => String(+y - k));
    console.log(`\nSeasonality: BEV share January-${MM} against ${season('MARKET', p).months[1]} of the same year (points: later months minus January-${MM})`);
    console.log('unit'.padEnd(16) + yrs.map(yy => `${yy}: Jan-${MM} / rest / diff`.padStart(30)).join(''));
    for (const u of S) console.log(u.padEnd(16) + yrs.map(yy => { const s = season(u, yy); return `${pct(s.first)} / ${pct(s.rest)} / ${sign(s.rest - s.first).replace(/(\.\d)\d$/, '$1')}`.padStart(30); }).join(''));
  }
  console.log(`\nHeadline under other definitions, BEV share January-${MM} ${p} -> ${y}`);
  for (const r of sensitivity()) console.log(`${r.claim.padEnd(28)} ${r.def.padEnd(58)} ${pct(r.a)} -> ${pct(r.b)}  ${sign(r.b - r.a).replace(/(\.\d)\d$/, '$1').padStart(5)}  ${r.holds ? 'holds' : 'DOES NOT HOLD'}`);

  // Top battery-electric model series per brand (FZ10 groups by series; a series can mix generations and drives).
  const models = readTable(path.join(ROOT, 'data', 'models.csv'));
  const mj = (b, mo, yy) => models.filter(r => r.brand === b && r.model === mo && r.month.startsWith(yy) && r.month.slice(5) <= MM).reduce((s, r) => s + Number(r.bev || 0), 0);
  console.log(`\nTop 5 battery-electric model series per brand, January-${MM} ${y} (${p} in brackets)`);
  for (const b of ['BMW', 'MINI', 'MERCEDES', 'PORSCHE', 'TESLA', 'VW', 'SKODA']) {
    const names = [...new Set(models.filter(r => r.brand === b && r.month.startsWith(y)).map(r => r.model))];
    const top = names.map(mo => [mo, mj(b, mo, y), mj(b, mo, p)]).filter(t => t[1] > 0).sort((a, c) => c[1] - a[1]).slice(0, 5);
    const total = jan(b, y, 'bev'), modelSum = names.reduce((s, mo) => s + mj(b, mo, y), 0);
    console.log(`${b.padEnd(9)} ${top.map(([mo, v1, v0]) => `${mo} ${v1} (${v0}, ${sign(v1 - v0).replace('.00', '')})`).join('; ')}   [model sum ${modelSum} = brand ${total}: ${modelSum === total ? 'yes' : 'NO'}]`);
  }
}
