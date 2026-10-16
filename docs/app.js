// Dashboard logic. Numbers on the page are computed here from window.KBA / window.IR (docs/data.js).
// Exceptions, typed in with their source: report page numbers, the policy dates (cited) and the
// private-owner share from KBA press release 41/2026.
(function () {
  'use strict';
  const KBA = window.KBA || [];
  const IR = window.IR || [];

  // BMW Group = the BMW and MINI brands (KBA lists them separately); its margins are BMW's Automotive segment.
  const BRANDS = [
    { key: 'BMWG', name: 'BMW Group', css: '--bmw', company: 'BMW Automotive', ir: 'BMW' },
    { key: 'MERCEDES', name: 'Mercedes-Benz', css: '--mb', company: 'Mercedes-Benz Cars' },
    { key: 'PORSCHE', name: 'Porsche', css: '--por', company: 'Porsche Automotive' },
  ];
  const MARKET = { key: 'MARKET', name: 'Whole market', css: '--mkt', dash: true };
  // Colours are CSS variables, so a theme switch recolours the charts without redrawing.
  const v = css => `var(${css})`;
  const fmtInt = n => Math.round(n).toLocaleString('en-GB');
  const fmtPct = (n, d = 1) => n.toFixed(d) + '%';
  const fmtChg = n => (n >= 0 ? '+' : '−') + Math.abs(n).toFixed(0) + '%';
  const fmtSigned = (n, d = 1) => (n >= 0 ? '+' : '−') + Math.abs(n).toFixed(d);
  const el = (tag, attrs = {}, text) => {
    const ns = ['svg', 'line', 'path', 'text', 'rect', 'g', 'circle'].includes(tag) ? 'http://www.w3.org/2000/svg' : null;
    const e = ns ? document.createElementNS(ns, tag) : document.createElement(tag);
    for (const [k, val] of Object.entries(attrs)) e.setAttribute(k, val);
    if (text !== undefined) e.textContent = text;
    return e;
  };
  const set = (id, html) => { const e = document.getElementById(id); if (e) e.innerHTML = html; };

  // ---------- aggregates ----------
  const partsOf = k => ({ BMWG: ['BMW', 'MINI'] }[k] || [k]);
  const rows = brand => KBA.filter(r => partsOf(brand).includes(r.brand));
  const months = [...new Set(KBA.map(r => r.month))].sort();
  const firstMonth = months[0] || '';
  const lastMonth = months[months.length - 1] || '';
  const lastMM = lastMonth.slice(5);
  const years = [...new Set(months.map(m => m.slice(0, 4)))].sort();
  const monthName = (m, style = 'long') => new Date(m + '-01T00:00Z').toLocaleString('en-GB', { month: style, timeZone: 'UTC' }).replace(/^Sept$/, 'Sep');
  // Every year is compared over the same months: January to the latest month available.
  const P = lastMM === '12' ? 'full year' : lastMM === '01' ? 'January' : `January–${monthName(lastMonth)}`;
  const Pshort = lastMM === '12' ? '' : lastMM === '01' ? 'Jan ' : `Jan–${monthName(lastMonth, 'short')} `;
  const basis = lastMM === '12' ? 'full calendar years' : `${P} of each year`;
  const yearSum = (brand, y, field) => rows(brand).filter(r => r.month.startsWith(y) && r.month.slice(5) <= lastMM).reduce((s, r) => s + r[field], 0);
  const share = (brand, y) => 100 * yearSum(brand, y, 'bev') / yearSum(brand, y, 'registrations');
  const bev = (b, y) => yearSum(b, y, 'bev');
  const segB = (b, y) => 100 * bev(b, y) / bev('MARKET', y);
  const seg = y => BRANDS.reduce((s, b) => s + segB(b.key, y), 0);
  const growth = (b, y) => 100 * (bev(b, y) / bev(b, String(+y - 1)) - 1);
  const bmwGroupShare = y => 100 * (bev('BMW', y) + bev('MINI', y)) / (yearSum('BMW', y, 'registrations') + yearSum('MINI', y, 'registrations'));

  const irv = (c, p, m) => { const r = IR.find(x => x.company === c && x.period === p && x.metric === m); return r ? r.value : undefined; };
  const has = (...vals) => vals.every(x => typeof x === 'number' && isFinite(x));
  const margin = (c, p) => irv(c, p, 'auto_margin');

  // ---------- nice axis steps ----------
  function niceStep(raw) {
    const p = Math.pow(10, Math.floor(Math.log10(raw)));
    return [1, 2, 2.5, 5, 10].map(k => k * p).find(s => s >= raw);
  }

  // ---------- tooltip placement shared by both charts ----------
  function place(tip, svg, W, xData) {
    const r = svg.getBoundingClientRect();
    const left = (xData / W) * r.width;
    if (r.width < 560) { // on a phone the tooltip goes under the plot so it does not hide the newest points
      tip.style.left = Math.min(Math.max(0, left - tip.offsetWidth / 2), r.width - tip.offsetWidth) + 'px';
      tip.style.top = (r.height + 4) + 'px';
      return;
    }
    let pos = left + 12;
    if (pos + tip.offsetWidth > r.width) pos = left - 12 - tip.offsetWidth;
    tip.style.left = Math.max(0, pos) + 'px';
    tip.style.top = '4px';
  }
  // Escape hides any open tooltip, also one opened by hovering a chart that does not have focus (WCAG 1.4.13).
  addEventListener('keydown', e => { if (e.key === 'Escape') document.querySelectorAll('.tip').forEach(t => { t.hidden = true; }); });

  // ---------- line chart ----------
  // markers: [{ at, label, short }] — a labelled dotted rule at a (fractional) x index, for policy dates.
  // xFmt(label, wide) and xEvery(wide) control the x labels on charts with many points.
  function lineChart(host, { series, xLabels, yFmt, endFmt, yMax, tipTitle, tipFmt, markers = [], xFmt, xEvery }) {
    let cur = xLabels.length - 1; // selected point; kept across redraws
    const draw = () => {
      const hadFocus = host.contains(document.activeElement); // keep keyboard focus across a resize redraw
      host.innerHTML = '';
      const W = Math.max(300, host.clientWidth);
      const wide = W >= 560;
      const H = wide ? 320 : 260;
      const m = { t: 12, r: wide ? 156 : 14, b: 28, l: 44 };
      const iw = W - m.l - m.r, ih = H - m.t - m.b;
      const n = xLabels.length;
      const x = i => m.l + (n === 1 ? iw / 2 : (i * iw) / (n - 1));
      const y = val => m.t + ih - (val / yMax) * ih;
      const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', tabindex: '0', 'aria-label': host.dataset.label + '. Use the left and right arrow keys to read values, or open the table below.' });
      for (let k = 0; k <= 4; k++) {
        const val = (yMax * k) / 4, yy = y(val);
        svg.append(el('line', { x1: m.l, x2: m.l + iw, y1: yy, y2: yy, class: k ? 'grid' : 'axis' }));
        svg.append(el('text', { x: m.l - 6, y: yy + 4, 'text-anchor': 'end' }, yFmt(val)));
      }
      // Every year gets a label; on a phone the short form '21 keeps them apart.
      const fx = xFmt || ((lab, w) => (w ? lab : `'${String(lab).slice(2)}`));
      const every = xEvery ? xEvery(wide) : 1;
      xLabels.forEach((lab, i) => {
        if ((i % every && i !== n - 1) || (i !== n - 1 && n - 1 - i < every / 2)) return;
        svg.append(el('text', { x: x(i), y: H - 8, 'text-anchor': i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle' }, fx(lab, wide)));
      });
      // Policy dates: a dotted rule and a short label, staggered so two labels never overlap.
      markers.forEach((mk, k) => {
        const xx = x(mk.at), right = xx > m.l + iw * 0.55;
        svg.append(el('line', { x1: xx, x2: xx, y1: m.t, y2: m.t + ih, class: 'marker' }));
        svg.append(el('text', { x: right ? xx - 4 : xx + 4, y: m.t + 10 + k * 13, 'text-anchor': right ? 'end' : 'start', class: 'markerlabel' }, wide ? mk.label : mk.short || mk.label));
      });
      const ends = [];
      for (const s of series) {
        const pts = s.values.map((val, i) => (val == null ? null : [x(i), y(val)]));
        let d = '';
        pts.forEach((p, i) => { if (p) d += (d && pts[i - 1] ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1); });
        svg.append(el('path', { d, fill: 'none', style: `stroke:${v(s.css)}`, 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round', 'stroke-dasharray': s.dash ? '5 4' : 'none' }));
        pts.forEach(p => p && svg.append(el('circle', { cx: p[0], cy: p[1], r: 4, style: `fill:${v(s.css)};stroke:var(--bg)`, 'stroke-width': 2 })));
        ends.push({ s, y: y(s.values[n - 1]), val: s.values[n - 1] });
      }
      if (wide) { // direct labels at the right end, nudged apart so they never overlap
        ends.sort((a, b) => a.y - b.y);
        for (let i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < 15) ends[i].y = ends[i - 1].y + 15;
        for (const e of ends) svg.append(el('text', { x: m.l + iw + 8, y: e.y + 4, class: 'endlabel' }, `${e.s.name} ${endFmt(e.val)}`));
      }
      const rule = el('line', { y1: m.t, y2: m.t + ih, class: 'hover-rule', visibility: 'hidden' });
      svg.append(rule);
      const hit = el('rect', { x: m.l - 10, y: m.t, width: iw + 20, height: ih, fill: 'transparent' });
      svg.append(hit);
      host.append(svg);
      const tip = el('div', { class: 'tip', hidden: '' });
      const live = el('div', { class: 'sr-only', 'aria-live': 'polite' }); // always in the accessibility tree
      host.append(tip, live);
      // announce: only keyboard selection is read out; mouse hover would make screen readers chatter.
      const showAt = (i, announce) => {
        cur = i;
        rule.setAttribute('x1', x(i)); rule.setAttribute('x2', x(i)); rule.setAttribute('visibility', 'visible');
        const val = s => (s.values[i] == null ? 'n/a' : tipFmt(s.values[i]));
        tip.innerHTML = `<div class="t">${tipTitle(i)}</div>` + series.map(s =>
          `<div class="r"><span><i class="key${s.dash ? ' dash' : ''}" style="border-color:${v(s.css)}"></i>${s.name}</span><b>${val(s)}</b></div>`).join('');
        if (announce) live.textContent = `${tipTitle(i)}: ${series.map(s => `${s.name} ${val(s)}`).join('; ')}`;
        tip.hidden = false;
        place(tip, svg, W, x(i));
      };
      const hide = () => { tip.hidden = true; rule.setAttribute('visibility', 'hidden'); };
      const fromPointer = evt => {
        const r = svg.getBoundingClientRect();
        const px = ((evt.clientX - r.left) / r.width) * W;
        showAt(Math.max(0, Math.min(n - 1, Math.round(((px - m.l) / iw) * (n - 1)))));
      };
      hit.addEventListener('pointermove', fromPointer);
      hit.addEventListener('pointerdown', fromPointer);
      hit.addEventListener('pointerleave', hide);
      svg.addEventListener('focus', () => showAt(cur, true));
      svg.addEventListener('blur', hide);
      svg.addEventListener('keydown', e => {
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); showAt(Math.max(0, Math.min(n - 1, cur + (e.key === 'ArrowRight' ? 1 : -1))), true); }
        if (e.key === 'Escape') hide();
      });
      if (hadFocus) svg.focus({ preventScroll: true }); // after the listeners, so the tooltip comes back at the same point
    };
    draw();
    return draw;
  }

  // ---------- grouped bar chart ----------
  // domain: [lo, hi] shared across small-multiple panels so their bars use one scale.
  function barChart(host, { groups, series, tipFmt, domain }) {
    const all = series.flatMap(s => s.values).filter(val => val != null);
    const [hi, lo] = domain ? [domain[1], domain[0]] : [Math.max(0, ...all), Math.min(0, ...all)];
    const step = niceStep((hi - lo) / 4 || 1);
    const yMax = Math.ceil(hi / step) * step, yMin = Math.floor(lo / step) * step;
    let cur = 0; // selected bar; kept across redraws
    const draw = () => {
      const hadFocus = host.contains(document.activeElement); // keep keyboard focus across a resize redraw
      host.innerHTML = '';
      const W = Math.max(220, host.clientWidth);
      const H = 230;
      const m = { t: 12, r: 8, b: 28, l: 40 };
      const iw = W - m.l - m.r, ih = H - m.t - m.b;
      const y = val => m.t + ih - ((val - yMin) / (yMax - yMin)) * ih;
      const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', tabindex: '0', 'aria-label': host.dataset.label + '. Use the left and right arrow keys to read values, or open the table below.' });
      for (let val = yMin; val <= yMax + 1e-9; val += step) {
        const zero = Math.abs(val) < 1e-9;
        svg.append(el('line', { x1: m.l, x2: m.l + iw, y1: y(val), y2: y(val), class: zero ? 'axis' : 'grid' }));
        svg.append(el('text', { x: m.l - 6, y: y(val) + 4, 'text-anchor': 'end' }, (zero ? 0 : +val.toFixed(1)) + '%'));
      }
      const gw = iw / groups.length;
      const bw = Math.min(24, (gw * 0.72) / series.length);
      const tip = el('div', { class: 'tip', hidden: '' });
      const live = el('div', { class: 'sr-only', 'aria-live': 'polite' });
      const bars = [];
      groups.forEach((g, gi) => {
        const x0 = m.l + gi * gw + (gw - bw * series.length - 2 * (series.length - 1)) / 2;
        svg.append(el('text', { x: m.l + gi * gw + gw / 2, y: H - 8, 'text-anchor': 'middle' }, g.short));
        series.forEach((s, si) => {
          const val = s.values[gi];
          if (val == null) return;
          const bx = x0 + si * (bw + 2);
          const r = Math.min(4, bw / 2, Math.abs(y(val) - y(0)));
          const y0 = y(0), y1 = y(val), dir = val >= 0 ? 1 : -1; // 4px rounded end on the data side
          const d = `M${bx} ${y0}V${y1 + dir * r}Q${bx} ${y1} ${bx + r} ${y1}H${bx + bw - r}Q${bx + bw} ${y1} ${bx + bw} ${y1 + dir * r}V${y0}Z`;
          // A part-year bar (g.partial) has a lighter fill so it does not read as one more full year, and a
          // full-colour outline so its edge still has 3:1 contrast (WCAG 1.4.11).
          svg.append(el('path', { d, style: `fill:${v(s.css)}${g.partial ? `;fill-opacity:.35;stroke:${v(s.css)};stroke-width:1.5` : ''}` }));
          // A bar too short to see gets its value written above it.
          if (Math.abs(val) < 2) svg.append(el('text', { x: bx + bw / 2, y: Math.min(y1, y0) - 4, 'text-anchor': 'middle', class: 'barlabel' }, tipFmt(val)));
          const bi = bars.length;
          const show = announce => {
            cur = bi;
            tip.innerHTML = `<div class="t">${s.name}, ${g.long}</div><div class="r"><span>${s.label(gi)}</span><b>${tipFmt(val)}</b></div>`;
            if (announce === true) live.textContent = `${s.name}, ${g.long}: ${tipFmt(val)}`;
            tip.hidden = false;
            place(tip, svg, W, bx + bw / 2);
          };
          bars.push(show);
          const hit = el('rect', { x: bx - 1, y: m.t, width: bw + 2, height: ih, fill: 'transparent' });
          hit.addEventListener('pointerenter', show);
          hit.addEventListener('pointerdown', show);
          hit.addEventListener('pointerleave', () => { tip.hidden = true; });
          svg.append(hit);
        });
      });
      host.append(svg, tip, live);
      svg.addEventListener('focus', () => bars[cur] && bars[cur](true));
      svg.addEventListener('blur', () => { tip.hidden = true; });
      svg.addEventListener('keydown', e => {
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); bars[Math.max(0, Math.min(bars.length - 1, cur + (e.key === 'ArrowRight' ? 1 : -1)))](true); }
        if (e.key === 'Escape') tip.hidden = true;
      });
      if (hadFocus) svg.focus({ preventScroll: true }); // after the listeners, so the tooltip comes back on the same bar
    };
    draw();
    return draw;
  }

  // ---------- ranked dumbbell chart: one row per brand, last year (hollow dot) to this year (filled dot) ----------
  // Label rule (review item P-145): the value label belongs to the filled (latest) dot — right of it when
  // the share rose, left of it when it fell — so a reader never reads the latest value next to last year's
  // dot. A padding zone between the names and the 0% line leaves room for the labels of small falling shares.
  // label(r, wide) gives the label text; the default is the latest value and the change.
  const changeText = d => (Math.abs(d) < 0.05 ? '0.0' : (d >= 0 ? '+' : '−') + Math.abs(d).toFixed(1));
  function dotChart(host, { rows: items, aLabel, bLabel, fmt, label }) {
    let cur = 0;
    const labelOf = (r, wide, off) => (label ? label(r, wide, off) : `${fmt(r.b)} (${changeText(r.b - r.a)})`);
    const draw = () => {
      const hadFocus = host.contains(document.activeElement);
      host.innerHTML = '';
      const W = Math.max(300, host.clientWidth), wide = W >= 560;
      const cw = wide ? 6.9 : 6.4; // average character width of the 12 px label font, for layout only
      // On a phone, a row far above the others (VW Group's 42.5%) would squeeze every other row into a fifth of
      // the width (review item P-172). Such a row gets its own off-scale zone at the right, behind an axis break;
      // the other rows use the full main scale.
      const maxOf = r => Math.max(r.a, r.b);
      const sorted = [...items].map(maxOf).sort((p, q) => q - p);
      const breakAxis = !wide && items.length > 3 && sorted[0] > 2 * sorted[1];
      const outlier = r => breakAxis && maxOf(r) > 2 * sorted[1];
      const wOf = r => labelOf(r, wide, outlier(r)).length * cw + 10;
      const main = items.filter(r => !outlier(r));
      const falling = main.filter(r => r.b < r.a - 0.049), rising = main.filter(r => !(r.b < r.a - 0.049));
      const nameW = Math.max(...items.map(r => r.name.length)) * cw + 10;
      const rowH = wide ? 20 : 19, m = { t: 6, r: Math.max(0, ...rising.map(wOf)), b: 22, l: nameW };
      const pad = Math.max(0, ...falling.map(wOf));
      const H = m.t + m.b + rowH * items.length, iwAll = W - m.l - m.r - pad;
      const zoneW = breakAxis ? Math.max(70, iwAll * 0.3) : 0, gapW = breakAxis ? 14 : 0, iw = iwAll - zoneW - gapW;
      const max = Math.max(...main.flatMap(r => [r.a, r.b]));
      const step = niceStep(max / (wide ? 5 : 3)), xMax = Math.ceil(max / step) * step;
      const out = items.filter(outlier), oLo = out.length ? Math.floor(Math.min(...out.flatMap(r => [r.a, r.b])) - 2) : 0, oHi = out.length ? Math.ceil(Math.max(...out.flatMap(r => [r.a, r.b])) + 2) : 1;
      const x0 = m.l + pad + iw + gapW; // start of the off-scale zone
      const x = val => (breakAxis && val > xMax ? x0 + ((val - oLo) / (oHi - oLo)) * zoneW : m.l + pad + (val / xMax) * iw), yRow = i => m.t + rowH * i + rowH / 2;
      const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', tabindex: '0', 'aria-label': host.dataset.label + '. Use the up and down arrow keys to read each brand, or open the table below.' });
      // Tick labels at least ~36 px apart: on a narrow scale every second (or third) tick keeps its label.
      const every = Math.max(1, Math.ceil(36 / ((step / xMax) * iw)));
      for (let val = 0, k = 0; val <= xMax + 1e-9; val += step, k++) {
        svg.append(el('line', { x1: x(val), x2: x(val), y1: m.t, y2: H - m.b, class: val ? 'grid' : 'axis' }));
        if (k % every === 0) svg.append(el('text', { x: x(val), y: H - 6, 'text-anchor': 'middle' }, val.toFixed(0) + '%'));
      }
      if (breakAxis) { // axis break marks and the off-scale zone's own end labels
        const bx = m.l + pad + iw + gapW / 2;
        for (const dx of [-3, 3]) svg.append(el('line', { x1: bx + dx - 3, x2: bx + dx + 3, y1: H - m.b + 4, y2: H - m.b - 4, class: 'axis' }));
        svg.append(el('text', { x: x0 + zoneW, y: H - 6, 'text-anchor': 'end' }, oHi + '%'));
      }
      const tip = el('div', { class: 'tip', hidden: '' }), live = el('div', { class: 'sr-only', 'aria-live': 'polite' });
      const shows = [];
      items.forEach((r, i) => {
        const yy = yRow(i), col = r.css ? v(r.css) : 'var(--ink-2)';
        svg.append(el('text', { x: m.l - 8, y: yy + 4, 'text-anchor': 'end', class: 'rowlabel' + (r.css ? ' key' : '') }, r.name));
        svg.append(el('line', { x1: x(r.a), x2: x(r.b), y1: yy, y2: yy, style: `stroke:${col}`, 'stroke-width': 2, 'stroke-opacity': r.css ? 1 : 0.55 }));
        svg.append(el('circle', { cx: x(r.a), cy: yy, r: 4, style: `fill:var(--bg);stroke:${col}`, 'stroke-width': 2 }));
        svg.append(el('circle', { cx: x(r.b), cy: yy, r: 4.5, style: `fill:${col};stroke:var(--bg)`, 'stroke-width': 1.5 }));
        const d = r.b - r.a, fell = d < -0.049;
        svg.append(el('text', { x: fell ? x(r.b) - 8 : x(r.b) + 8, y: yy + 4, 'text-anchor': fell ? 'end' : 'start', class: 'rowlabel valuelabel' + (r.css ? ' key' : ''), 'data-dot-x': x(r.b).toFixed(1), 'data-side': fell ? 'left' : 'right' }, labelOf(r, wide, outlier(r))));
        const show = announce => {
          cur = i;
          tip.innerHTML = `<div class="t">${r.name}</div><div class="r"><span>${aLabel}</span><b>${fmt(r.a)}</b></div><div class="r"><span>${bLabel}</span><b>${fmt(r.b)}</b></div><div class="r"><span>Change</span><b>${d >= 0 ? '+' : '−'}${Math.abs(d).toFixed(1)} points</b></div>`;
          if (announce === true) live.textContent = `${r.name}: ${aLabel} ${fmt(r.a)}, ${bLabel} ${fmt(r.b)}`;
          tip.hidden = false;
          place(tip, svg, W, x(Math.max(r.a, r.b)));
          tip.style.top = Math.min(yy + 10, H) / H * svg.getBoundingClientRect().height + 'px';
        };
        shows.push(show);
        const hit = el('rect', { x: 0, y: yy - rowH / 2, width: W, height: rowH, fill: 'transparent' });
        hit.addEventListener('pointerenter', show);
        hit.addEventListener('pointerdown', show);
        hit.addEventListener('pointerleave', () => { tip.hidden = true; });
        svg.append(hit);
      });
      host.append(svg, tip, live);
      svg.addEventListener('focus', () => shows[cur](true));
      svg.addEventListener('blur', () => { tip.hidden = true; });
      svg.addEventListener('keydown', e => {
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); shows[Math.max(0, Math.min(shows.length - 1, cur + (e.key === 'ArrowDown' ? 1 : -1)))](true); }
        if (e.key === 'Escape') tip.hidden = true;
      });
      if (hadFocus) svg.focus({ preventScroll: true });
    };
    draw();
    return draw;
  }

  // ---------- share-change decomposition: one row per group ----------
  // A bar from 0 to the group's own growth (its new cars as points of this year's market), a lighter bar back
  // by the market's growth (last year's cars spread over a bigger market), and a tick at the net change.
  function decompChart(host, items) {
    const draw = () => {
      host.innerHTML = '';
      const W = Math.max(300, host.clientWidth), wide = W >= 560;
      const nameW = Math.max(...items.map(r => r.name.length)) * (wide ? 6.9 : 6.4) + 10;
      const rowH = 30, m = { t: 6, r: wide ? 70 : 52, b: 22, l: nameW }, H = m.t + m.b + rowH * items.length, iw = W - m.l - m.r;
      const lo = Math.min(0, ...items.map(r => r.market)), hi = Math.max(0, ...items.map(r => r.own));
      const step = niceStep((hi - lo) / (wide ? 6 : 4)), xMin = Math.floor(lo / step) * step, xMax = Math.ceil(hi / step) * step;
      const x = val => m.l + ((val - xMin) / (xMax - xMin)) * iw;
      const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': host.dataset.label });
      for (let val = xMin; val <= xMax + 1e-9; val += step) {
        svg.append(el('line', { x1: x(val), x2: x(val), y1: m.t, y2: H - m.b, class: Math.abs(val) < 1e-9 ? 'axis' : 'grid' }));
        svg.append(el('text', { x: x(val), y: H - 6, 'text-anchor': 'middle' }, `${val > 0 ? '+' : val < 0 ? '−' : ''}${Math.abs(val).toFixed(0)}`));
      }
      items.forEach((r, i) => {
        const y0 = m.t + rowH * i, col = r.css ? v(r.css) : 'var(--ink-2)';
        svg.append(el('text', { x: m.l - 8, y: y0 + rowH / 2 + 4, 'text-anchor': 'end', class: 'rowlabel' + (r.css ? ' key' : '') }, r.name));
        const own = el('rect', { x: Math.min(x(0), x(r.own)), y: y0 + 6, width: Math.abs(x(r.own) - x(0)), height: 8, rx: 2, style: `fill:${col}` });
        own.append(el('title', {}, `${r.name}: own growth ${fmtSigned(r.own)} points`));
        const mk = el('rect', { x: Math.min(x(r.own), x(r.own + r.market)), y: y0 + 16, width: Math.abs(x(r.own + r.market) - x(r.own)), height: 8, rx: 2, style: `fill:${col};fill-opacity:.35;stroke:${col};stroke-width:1` });
        mk.append(el('title', {}, `${r.name}: market growth ${fmtSigned(r.market)} points`));
        svg.append(own, mk);
        svg.append(el('line', { x1: x(r.total), x2: x(r.total), y1: y0 + 3, y2: y0 + 27, style: 'stroke:var(--ink)', 'stroke-width': 2 }));
        svg.append(el('text', { x: Math.max(x(r.own), x(0)) + 6, y: y0 + rowH / 2 + 4, class: 'rowlabel' + (r.css ? ' key' : '') }, `= ${fmtSigned(r.total)}`));
      });
      host.append(svg);
    };
    draw();
    return draw;
  }

  // Line charts get line keys (dashed for the market), so the legend looks like the marks it names.
  function legend(name, items) {
    document.querySelector(`[data-legend="${name}"]`).innerHTML = items.map(s =>
      `<li><span class="line${s.dash ? ' dash' : ''}" style="border-color:${v(s.css)}"></span>${s.name}</li>`).join('');
  }
  function table(name, head, body) {
    const wrap = document.querySelector(`[data-table="${name}"]`);
    // A table wider than the screen scrolls; make that scroll area reachable and named for keyboard users.
    wrap.setAttribute('tabindex', '0');
    wrap.setAttribute('role', 'region');
    wrap.setAttribute('aria-label', `${{ share: 'Electric share', volume: 'Slice of electric registrations', race: 'Brand shares of electric registrations', phev: 'Plug-in hybrid shares', decomp: 'Share-change decomposition', prices: 'Lowest electric list prices', sens: 'Headline under other definitions', season: 'Seasonality of electric shares' }[name] || 'Car-business margin'} table`);
    wrap.innerHTML =
      `<table><thead><tr>${head.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${body.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  }

  const redraws = [];
  const Y = years[years.length - 1], prev = String(+Y - 1);
  const yl = y => `${Pshort}${y}`;

  // Policy dates on the yearly charts (cited in the text): the federal bonus closed after 17 December 2023,
  // between the 2023 and 2024 points; the new bonus covers cars first registered from 1 January 2026.
  const yearMarkers = [
    ...(years.includes('2023') && years.includes('2024') ? [{ at: years.indexOf('2023') + 0.5, label: 'Federal bonus closed 17 Dec 2023', short: 'Bonus closed' }] : []),
    ...(years.includes('2026') ? [{ at: years.indexOf('2026'), label: 'New bonus: cars from 1 Jan 2026', short: 'New bonus' }] : []),
  ];

  // ---------- competitor data (every brand, KBA FZ10; summarised by build.js) ----------
  const COMP = window.COMP && window.COMP.market ? window.COMP : null;
  const UPPER = ['BMW', 'BYD', 'MINI', 'DS', 'KGM', 'GWM', 'JAC', 'NIO', 'VW'];
  const NAMES = { 'BMW GROUP': 'BMW Group', 'MERCEDES-BENZ': 'Mercedes-Benz', MERCEDES: 'Mercedes-Benz', 'VW GROUP': 'VW Group', 'VW GROUP INCL. PORSCHE': 'VW Group incl. Porsche', 'RENAULT GROUP': 'Renault Group', 'HYUNDAI-KIA': 'Hyundai-Kia', 'CHINESE BRANDS': 'Chinese brands', 'STELLANTIS INCL. LEAPMOTOR': 'Stellantis incl. Leapmotor', 'CHINESE BRANDS EXCL. LEAPMOTOR': 'Chinese brands excl. Leapmotor', 'MG ROEWE': 'MG', SEAT: 'Seat (incl. Cupra)', CITROEN: 'Citroën', 'LAND ROVER': 'Land Rover' };
  const nice = k => NAMES[k] || (UPPER.includes(k) ? k : k.toLowerCase().replace(/(^|[\s-])\S/g, c => c.toUpperCase()));
  const unit = k => COMP && (COMP.groups[k] || COMP.brands.find(b => b.brand === k));
  const cs = (k, i, f = 'bev') => { const u = unit(k); return u ? 100 * u[f][i] / COMP.market[f][i] : NaN; };
  const chg = (k, f = 'bev') => cs(k, 1, f) - cs(k, 0, f);
  const pts = d => (Math.abs(d) < 0.05 ? '0.0' : `${d >= 0 ? '+' : '−'}${Math.abs(d).toFixed(1)}`);
  const listAnd = a => a.length < 2 ? a.join('') : `${a.slice(0, -1).join(', ')} and ${a[a.length - 1]}`;
  // Owner groups plus every brand outside them: the units whose share changes add up to zero.
  const units = COMP ? [...Object.keys(COMP.groups).filter(g => !/ (INCL|EXCL). /.test(g)),
    ...COMP.brands.map(b => b.brand).filter(b => !Object.values(COMP.groups).some(g => g.members.includes(b)))] : [];

  // ---------- hero chart: every brand's share of battery-electric registrations, last year and this year ----------
  // The first exhibit is at owner-group level, like the headline (review item P-147); every brand is one tap away.
  // The same rows feed the page, the social preview image and the memo chart (window.EVCharts.groupChart).
  const groupRows = () => {
    const keyCss = { 'BMW GROUP': '--bmw', 'MERCEDES-BENZ': '--mb', PORSCHE: '--por' };
    return [...units.filter(u => Math.max(cs(u, 0), cs(u, 1)) >= 1 || keyCss[u]), 'PORSCHE'].filter((u, i, a) => a.indexOf(u) === i)
      .sort((a, b) => cs(b, 1) - cs(a, 1)).map(u => ({ key: u, name: nice(u), a: cs(u, 0), b: cs(u, 1), css: keyCss[u] }));
  };
  // Group labels carry both years ("42.5% → 33.1%"), so the headline's numbers are on the chart itself.
  // On a phone only the off-scale row keeps both years; the others show the latest value next to the filled dot.
  const bothYears = (r, wide, off) => (wide ? `${fmtPct(r.a)} → ${fmtPct(r.b)}` : off ? `${r.a.toFixed(1)} → ${fmtPct(r.b)}` : fmtPct(r.b));
  if (COMP) {
    const [p0, p1] = COMP.years;
    document.getElementById('legend0').innerHTML = `<li><span class="dot"></span>${Pshort}${p0}</li><li><span class="dot fill"></span>${Pshort}${p1}</li><li>Coloured: BMW Group, Mercedes-Benz, Porsche</li>`;
    const host = document.querySelector('[data-chart="race"]');
    host.dataset.label = `Dot chart: each car group's share of all battery-electric registrations in Germany, ${P} ${p0} and ${p1}`;
    redraws.push(dotChart(host, { rows: groupRows(), aLabel: `${Pshort}${p0}`, bLabel: `${Pshort}${p1}`, fmt: val => fmtPct(val), label: bothYears }));
    // Self-registration test next to the chart: does the result hold if cars the makers and dealers
    // registered themselves are taken out?
    const R = COMP.robust;
    if (R) {
      const d = (mode, u) => R.modes[mode][1][u] - R.modes[mode][0][u];
      const top3 = mode => units.filter(u => R.modes[mode][1][u] !== undefined && d(mode, u) > 0).sort((a, b) => d(mode, b) - d(mode, a)).slice(0, 3);
      const sameSet = (a, b) => a.length === b.length && a.every(u => b.includes(u));
      const holds = mode => sameSet(top3(mode), top3('raw')) && units.filter(u => R.modes[mode][1][u] !== undefined).reduce((a, u) => (d(mode, u) < d(mode, a) ? u : a)) === 'VW GROUP' &&
        d(mode, 'MERCEDES-BENZ') > 0 && d(mode, 'BMW GROUP') < 0 && d(mode, 'PORSCHE') < 0;
      const mName = monthName(`2000-${R.months}`);
      // One visible sentence with the numbers (review item P-171); the method is behind the fold.
      set('robust0', `<div class="test"><strong>${holds('proportional') ? 'Self-registrations do not change the result.' : 'Self-registrations change the result.'}</strong> Car makers and dealers register some cars themselves. Removing them in proportion ${holds('proportional') ? 'leaves the finding unchanged' : 'changes the finding'} (VW Group ${fmtPct(R.modes.proportional[0]['VW GROUP'])} → ${fmtPct(R.modes.proportional[1]['VW GROUP'])}). ` +
        `Counting every self-registered car as electric would reverse BMW Group's direction, but would take out ${fmtInt(R.selfAllBrands)} cars, ${(R.selfAllBrands / R.selfBev).toFixed(1)} times the ${fmtInt(R.selfBev)} electric self-registrations KBA actually counts${R.selfAllBrands > R.selfBev ? ', so it cannot happen' : ''}.` +
        `<details class="more"><summary>How this was tested</summary>KBA table FZ8 gives each brand's registrations by keeper (all drive types, January–${mName} of both years); each brand's electric cars are reduced by its maker-and-dealer rate, and the market by the sum. ` +
        (holds('proportional') ? 'The same three groups gain most, VW Group loses most, Mercedes-Benz still gains and BMW Group and Porsche still lose. ' : `The groups that gain most become ${listAnd(top3('proportional').map(nice))}. `) +
        `The worst-case bound counts every self-registered car of a brand as electric; KBA's FZ28 table gives the electric self-registrations of the whole market, which that bound exceeds.</details></div>`);
    }
    // Is each named change larger than month-to-month noise (review item P-045)? Same-month pairs remove
    // seasonality: for each month of this year, the share minus the same month's share a year earlier; the
    // paired t-statistic is their mean over its standard error. With 9 months (8 degrees of freedom) the 5%
    // two-sided threshold is 2.31.
    const paired = k => {
      const d = [];
      for (const r of COMP.monthly.filter(r => r.month.startsWith(p1))) {
        const q = COMP.monthly.find(x => x.month === `${p0}${r.month.slice(4)}`);
        if (q && r[k] && q[k]) d.push(100 * r[k].bev / r.MARKET.bev - 100 * q[k].bev / q.MARKET.bev);
      }
      const n = d.length, mean = d.reduce((s, x) => s + x, 0) / n, sd = Math.sqrt(d.reduce((s, x) => s + (x - mean) ** 2, 0) / (n - 1));
      return { n, same: d.filter(x => Math.sign(x) === Math.sign(mean)).length, t: mean / (sd / Math.sqrt(n)) };
    };
    // Two-sided 5% critical values of Student's t by degrees of freedom.
    const TCRIT = { 1: 12.71, 2: 4.30, 3: 3.18, 4: 2.78, 5: 2.57, 6: 2.45, 7: 2.36, 8: 2.31, 9: 2.26, 10: 2.23, 11: 2.20 };
    const named = ['VW GROUP', 'TESLA', 'CHINESE BRANDS', 'STELLANTIS', 'MERCEDES-BENZ', 'BMW GROUP', 'PORSCHE'].map(k => ({ k, ...paired(k) }));
    const crit = TCRIT[named[0].n - 1];
    const weak = named.filter(r => !(Math.abs(r.t) > crit));
    document.getElementById('robust0').insertAdjacentHTML('beforeend', `<div class="test"><strong>${weak.length ? `Not every change is larger than monthly noise: ${listAnd(weak.map(r => nice(r.k)))} ${weak.length > 1 ? 'are' : 'is'} within it.` : 'Each named change is larger than month-to-month noise.'}</strong> <details class="more"><summary>How this was tested</summary>` +
      `Each month of ${p1} against the same month of ${p0} (paired, so seasonality cancels): ${named.map(r => `${nice(r.k)} moved the same way in ${r.same} of ${r.n} months (t = ${r.t.toFixed(1)})`).join('; ')}. With ${named[0].n} months the 5% threshold is ${crit.toFixed(2)}. The test treats each month as independent; sales in neighbouring months are related, so the true uncertainty is somewhat larger than the test shows. Every named change is at least |t| = ${Math.min(...named.map(r => Math.abs(r.t))).toFixed(1)}, so the conclusions do not rest on that assumption.</details></div>`);
    // Headline under other definitions (run 4, same rows as scripts/competitors.js sensitivity()): each claim
    // with the brand instead of the group, Porsche inside VW Group, Leapmotor moved, self-registrations removed.
    {
      const Rp = R && R.modes.proportional, prop = `self-registrations removed (Jan–${R ? monthName(`2000-${R.months}`, 'short') : ''})`;
      const S = [
        ['VW Group lost share', 'VW Group (VW, Audi, Skoda, Seat, Bentley, Lamborghini)', cs('VW GROUP', 0), cs('VW GROUP', 1), -1],
        ['VW Group lost share', 'VW Group including Porsche', cs('VW GROUP INCL. PORSCHE', 0), cs('VW GROUP INCL. PORSCHE', 1), -1],
        ['VW Group lost share', 'VW brand only', cs('VW', 0), cs('VW', 1), -1],
        ...(Rp ? [['VW Group lost share', 'VW Group, ' + prop, Rp[0]['VW GROUP'], Rp[1]['VW GROUP'], -1]] : []),
        ['Mercedes-Benz gained share', 'Mercedes-Benz', cs('MERCEDES-BENZ', 0), cs('MERCEDES-BENZ', 1), 1],
        ...(Rp ? [['Mercedes-Benz gained share', 'Mercedes-Benz, ' + prop, Rp[0]['MERCEDES-BENZ'], Rp[1]['MERCEDES-BENZ'], 1]] : []),
        ['BMW Group lost share', 'BMW Group (BMW, MINI)', cs('BMW GROUP', 0), cs('BMW GROUP', 1), -1],
        ['BMW Group lost share', 'BMW brand only', cs('BMW', 0), cs('BMW', 1), -1],
        ['BMW Group lost share', 'MINI only', cs('MINI', 0), cs('MINI', 1), -1],
        ...(Rp ? [['BMW Group lost share', 'BMW Group, ' + prop, Rp[0]['BMW GROUP'], Rp[1]['BMW GROUP'], -1]] : []),
        ['Chinese brands gained share', 'Chinese brands including Leapmotor', cs('CHINESE BRANDS', 0), cs('CHINESE BRANDS', 1), 1],
        ['Chinese brands gained share', 'Chinese brands without Leapmotor', cs('CHINESE BRANDS EXCL. LEAPMOTOR', 0), cs('CHINESE BRANDS EXCL. LEAPMOTOR', 1), 1],
        ['Stellantis gained share', 'Stellantis without Leapmotor', cs('STELLANTIS', 0), cs('STELLANTIS', 1), 1],
        ['Stellantis gained share', 'Stellantis including Leapmotor', cs('STELLANTIS INCL. LEAPMOTOR', 0), cs('STELLANTIS INCL. LEAPMOTOR', 1), 1],
      ].map(([claim, def, a, b, dir]) => ({ claim, def, a, b, holds: Math.sign(b - a) === dir }));
      const fails = S.filter(r => !r.holds);
      document.getElementById('robust0').insertAdjacentHTML('beforeend', `<div class="test"><strong>${fails.length ? `${fails.length} of ${S.length} alternative definitions change a claim.` : `Every claim holds under all ${S.length} definitions tested.`}</strong> <details class="more"><summary>Definitions tested</summary><div class="tablewrap" data-table="sens"></div></details></div>`);
      table('sens', ['Unit as defined', p0, p1, 'Points', 'Claim', 'Holds'], S.map(r => [r.def, fmtPct(r.a), fmtPct(r.b), pts(r.b - r.a), r.claim.split(' ').at(-2), r.holds ? 'yes' : '<strong>no</strong>']));
    }
    // Every brand, drawn when the reader opens it.
    const keyCss ={ BMW: '--bmw', MINI: '--bmw', MERCEDES: '--mb', PORSCHE: '--por' };
    const brandItems = COMP.brands.filter(b => cs(b.brand, 0) >= 1 || cs(b.brand, 1) >= 1)
      .sort((a, b) => cs(b.brand, 1) - cs(a.brand, 1))
      .map(b => ({ name: nice(b.brand), a: cs(b.brand, 0), b: cs(b.brand, 1), css: keyCss[b.brand] }));
    const bHost = document.querySelector('[data-chart="brands"]');
    if (bHost) {
      bHost.dataset.label = `Dot chart: each brand's share of all battery-electric registrations in Germany, ${P} ${p0} and ${p1}, brands with at least 1%`;
      redraws.push(dotChart(bHost, { rows: brandItems, aLabel: `${Pshort}${p0}`, bLabel: `${Pshort}${p1}`, fmt: val => fmtPct(val) }));
    }
    const tableUnits = [...Object.keys(COMP.groups), ...COMP.brands.filter(b => cs(b.brand, 0) >= 0.5 || cs(b.brand, 1) >= 0.5).sort((a, b) => cs(b.brand, 1) - cs(a.brand, 1)).map(b => b.brand)];
    table('race', ['Brand or group', `Electric cars ${p0}`, `Electric cars ${p1}`, `Share ${p0}`, `Share ${p1}`, 'Change (points)', `Plug-in hybrid share ${p0}`, `${p1}`],
      tableUnits.map(k => [nice(k) + (COMP.groups[k] ? ` (${COMP.groups[k].members.map(nice).join(', ')})` : ''), fmtInt(unit(k).bev[0]), fmtInt(unit(k).bev[1]), fmtPct(cs(k, 0)), fmtPct(cs(k, 1)), pts(chg(k)), fmtPct(cs(k, 0, 'phev')), fmtPct(cs(k, 1, 'phev'))]));
  }

  // ---------- share-change decomposition (review item P-156) ----------
  // own growth = (cars this year − cars last year) / market this year; market growth = cars last year /
  // market this year − cars last year / market last year. The two parts add up to the change exactly.
  if (COMP) {
    const keyCss = { 'BMW GROUP': '--bmw', 'MERCEDES-BENZ': '--mb', PORSCHE: '--por' };
    const dec = k => {
      const u = unit(k), [m0, m1] = COMP.market.bev, [b0, b1] = u.bev;
      return { key: k, name: nice(k), own: 100 * (b1 - b0) / m1, market: 100 * (b0 / m1 - b0 / m0), total: 100 * (b1 / m1 - b0 / m0), b0, b1, css: keyCss[k] };
    };
    const items = ['VW GROUP', 'TESLA', 'CHINESE BRANDS', 'STELLANTIS', 'BMW GROUP', 'MERCEDES-BENZ', 'PORSCHE'].map(dec);
    const bad = items.filter(r => Math.abs(r.own + r.market - r.total) > 1e-9 || Math.abs(r.total - chg(r.key)) > 1e-9);
    const host = document.querySelector('[data-chart="decomp"]');
    host.dataset.label = 'Bar chart: each group\'s change in share of battery-electric registrations split into its own growth and the market\'s growth';
    host.dataset.check = bad.length ? 'parts do not add up: ' + bad.map(r => r.name).join(', ') : 'parts add up';
    redraws.push(decompChart(host, items));
    const vw = items[0], mktG = 100 * (COMP.market.bev[1] / COMP.market.bev[0] - 1);
    document.getElementById('legend5').innerHTML = '<li><span class="swatch" style="background:var(--ink-2)"></span>Own growth</li><li><span class="swatch" style="background:var(--ink-2);opacity:.35"></span>Market growth (pulls the share down)</li><li><span class="line" style="border-color:var(--ink)"></span>Net change</li>';
    // Folded section titles stay at or below 10 words (review run 4); check-browser.js counts them.
    set('h5', `${vw.name} +${Math.round(100 * (vw.b1 / vw.b0 - 1))}%, market +${Math.round(mktG)}%: its share fell ${Math.abs(vw.total).toFixed(1)} points`);
    // The per-group numbers repeat the chart and its table, so they sit behind a link (desktop page budget, run 4).
    set('t5', `<p>A group's share falls when its electric registrations grow more slowly than the market's.</p><details class="more"><summary>The chart in words</summary><p>${items.map(r => `${r.name}: ${fmtSigned(r.own)} from its own growth, ${fmtSigned(r.market)} from the market's, ${fmtSigned(r.total)} net`).join('; ')} (points of share, ${P} ${COMP.years[0]} to ${COMP.years[1]}).</p></details>`);
    // EU anchor (review item P-022): VW Group's own count of its Western European BEV market share against
    // KBA's German share over the same half-years, with Porsche counted in as VW counts it.
    const X = window.CTX || {};
    if (X.vw_we_bev_share_h1_2026 && X.vw_we_bev_share_h1_2025) {
      const h1 = (y) => { const rs = COMP.monthly.filter(r => r.month.startsWith(y) && r.month.slice(5) <= '06'); return 100 * rs.reduce((s, r) => s + r['VW GROUP INCL. PORSCHE'].bev, 0) / rs.reduce((s, r) => s + r.MARKET.bev, 0); };
      const [y0, y1] = COMP.years, de0 = h1(y0), de1 = h1(y1), we0 = +X.vw_we_bev_share_h1_2025.value, we1 = +X.vw_we_bev_share_h1_2026.value;
      const ratio = (de0 - de1) / (we0 - we1);
      document.getElementById('t5').insertAdjacentHTML('beforeend', `<p><strong>Beyond Germany the loss is smaller.</strong> By Volkswagen's own count, its share of Western Europe's electric-car market fell from ${fmtPct(we0)} to ${fmtPct(we1)} in January–June ${y1}; in Germany (KBA, same months, Porsche included as Volkswagen counts it) it fell from ${fmtPct(de0)} to ${fmtPct(de1)}, ${ratio > 1.75 && ratio < 2.25 ? 'about twice the regional loss' : `${ratio.toFixed(1)} times the regional loss`}. ` +
        (X.acea_de_bev_growth_janaug_2026 ? `Germany's electric market also grew faster than the EU's: ${fmtSigned(+X.acea_de_bev_growth_janaug_2026.value)}% against ${fmtSigned(+X.acea_eu_bev_growth_janaug_2026.value)}% in January–August (ACEA). ` : '') +
        `Volkswagen's figure is its own estimate; Western Europe includes Germany.</p>`);
    }
    // Lowest German list prices of an electric model per group (dated; each checked against the saved page).
    const PR = [['VW Group', 'price_vw_id_polo'], ['BMW Group', 'price_mini_cooper_e'], ['Mercedes-Benz', 'price_mb_gla_electric'], ['Porsche', 'price_porsche_macan'], ['BYD (Chinese brands)', 'price_byd_dolphin_surf'], ['Stellantis', 'price_citroen_e_c3'], ['Leapmotor (51% Stellantis)', 'price_leapmotor_t03'], ['Renault Group', 'price_dacia_spring']].filter(([, k]) => X[k]);
    if (PR.length) {
      document.getElementById('t5').insertAdjacentHTML('beforeend', `<details class="more"><summary>Lowest electric list prices per group</summary><p>Lowest German list price of an electric model found on each maker's own website or price list, before the federal bonus and dealer discounts. Tesla's German site refused automated access, so Tesla is missing.</p><div class="tablewrap" data-table="prices"></div></details>`);
      table('prices', ['Group', 'Model', 'Price (€)', 'As shown', 'Date'], PR.map(([g, k]) => [g, X[k].label.replace(/, from$|, offer price in the page data$/, '').replace(/ \((Stellantis|Renault Group|Leapmotor International, 51% Stellantis)\)$/, ''), (Number.isInteger(+X[k].value) ? fmtInt(+X[k].value) : (+X[k].value).toLocaleString('en-GB', { minimumFractionDigits: 2 })), X[k].unit.replace('EUR ', '').replace('EUR, ', ''), X[k].period]));
    }
    // Seasonality check for the October–December test (review item P-193): is a group's share in the last
    // months of a year routinely different from its share in January to the latest month?
    if (COMP.season) {
      const nx = monthName(`2000-${String(+lastMM + 1).padStart(2, '0')}`), rest = `${nx}–December`, first = `January–${monthName(`2000-${lastMM}`)}`;
      const dv = COMP.season.map(s => s['VW GROUP'][1] - s['VW GROUP'][0]);
      const mixed = dv.some(x => x > 0) && dv.some(x => x < 0);
      const last = COMP.season.at(-1);
      document.getElementById('t5').insertAdjacentHTML('beforeend', `<details class="more"><summary>Is ${rest} different from ${first}?</summary><p>VW Group's ${rest} share differed from its ${first} share by ${listAnd(COMP.season.map((s, i) => `${fmtSigned(dv[i])} points in ${s.year}`))}${mixed ? '; the gap changes sign from year to year' : `; it was ${dv[0] > 0 ? 'higher' : 'lower'} every year`}. ` +
        `So ${/^[AEIO]/.test(rest) ? 'an' : 'a'} ${rest} share is compared with the same months a year earlier (VW Group ${last.year}: ${fmtPct(last['VW GROUP'][1])}), not with ${first}. December ${COMP.season[0].year} is a special case: the purchase bonus closed to new applications after 17 December 2023.</p><div class="tablewrap" data-table="season"></div></details>`);
      const SU = ['VW GROUP', 'BMW GROUP', 'MERCEDES-BENZ', 'PORSCHE', 'TESLA', 'CHINESE BRANDS', 'STELLANTIS'];
      table('season', ['Group', ...COMP.season.flatMap(s => [`${s.year} ${first.replace('January', 'Jan').replace(/–(\w{3})\w*/, '–$1')}`, `${s.year} ${rest.replace(/(\w{3})\w*–December/, '$1–Dec')}`])], SU.map(u => [nice(u), ...COMP.season.flatMap(s => [fmtPct(s[u][0]), fmtPct(s[u][1])])]));
    }
    set('cap5', `Unit: points of share of all battery-electric registrations in Germany, ${P}. Own growth plus market growth equals the change in share (formulas: docs/method.md). Source: KBA FZ10, data/brands.csv.`);
    table('decomp', ['Group', `Electric cars ${COMP.years[0]}`, `${COMP.years[1]}`, 'Own growth (points)', 'Market growth (points)', 'Change in share (points)'], items.map(r => [r.name, fmtInt(r.b0), fmtInt(r.b1), fmtSigned(r.own, 2), fmtSigned(r.market, 2), fmtSigned(r.total, 2)]));
  }

  // ---------- chart 1: electric share of each brand's registrations ----------
  if (KBA.length) {
    const series = [...BRANDS, MARKET].map(b => ({ ...b, values: years.map(y => share(b.key, y)) }));
    legend('share', series);
    const host = document.querySelector('[data-chart="share"]');
    host.dataset.label = `Line chart: battery-electric share of new registrations in Germany, ${basis}, for BMW, Mercedes-Benz, Porsche and the whole market`;
    redraws.push(lineChart(host, {
      series, xLabels: years, yMax: Math.ceil(Math.max(...series.flatMap(s => s.values)) / 10) * 10,
      yFmt: val => val.toFixed(0) + '%', endFmt: val => fmtPct(val), markers: yearMarkers,
      tipTitle: i => yl(years[i]), tipFmt: val => fmtPct(val),
    }));
    table('share', ['Period', ...series.map(s => s.name), 'BMW brand only'],
      years.map((y, i) => [yl(y), ...series.map(s => fmtPct(s.values[i])), fmtPct(share('BMW', y))]));
  }

  // ---------- chart 2: each brand's slice of all electric registrations ----------
  if (KBA.length) {
    const series = BRANDS.map(b => ({ ...b, values: years.map(y => segB(b.key, y)) }));
    legend('volume', series);
    const host = document.querySelector('[data-chart="volume"]');
    host.dataset.label = `Line chart: each brand's share of all battery-electric registrations in Germany, ${basis}`;
    redraws.push(lineChart(host, {
      series, xLabels: years, yMax: Math.ceil(Math.max(...series.flatMap(s => s.values)) / 4) * 4,
      yFmt: val => val.toFixed(0) + '%', endFmt: val => fmtPct(val), markers: yearMarkers,
      tipTitle: i => `${yl(years[i])}: ${fmtInt(bev('MARKET', years[i]))} electric cars in total`,
      tipFmt: val => fmtPct(val),
    }));
    table('volume', ['Period', 'All electric registrations', ...BRANDS.map(b => `${b.name}: cars (slice)`), 'Three together'],
      years.map(y => [yl(y), fmtInt(bev('MARKET', y)), ...BRANDS.map(b => `${fmtInt(bev(b.key, y))} (${fmtPct(segB(b.key, y))})`), fmtPct(seg(y))]));
  }

  // ---------- chart 4: shares of all plug-in hybrid registrations, month by month ----------
  const PHEV_SERIES = [
    { key: 'BMW GROUP', name: 'BMW Group', css: '--bmw' },
    { key: 'MERCEDES-BENZ', name: 'Mercedes-Benz', css: '--mb' },
    { key: 'PORSCHE', name: 'Porsche', css: '--por' },
    { key: 'CHINESE BRANDS', name: 'Chinese brands', css: '--cn' },
  ];
  if (COMP && COMP.monthly.length) {
    const ms = COMP.monthly.map(r => r.month);
    const mShare = (k, r) => 100 * r[k].phev / r.MARKET.phev;
    const series = PHEV_SERIES.map(s => ({ ...s, values: COMP.monthly.map(r => mShare(s.key, r)) }));
    legend('phev', series);
    const host = document.querySelector('[data-chart="phev"]');
    host.dataset.label = 'Line chart: share of all plug-in hybrid registrations in Germany by month for BMW Group, Mercedes-Benz, Porsche and Chinese brands';
    const iJan = ms.indexOf('2026-01'), iMay = ms.indexOf('2026-05');
    redraws.push(lineChart(host, {
      series, xLabels: ms, yMax: Math.ceil(Math.max(...series.flatMap(s => s.values)) / 4) * 4,
      yFmt: val => val.toFixed(0) + '%', endFmt: val => fmtPct(val),
      xFmt: (m, w) => `${monthName(m, 'short')} '${m.slice(2, 4)}`, xEvery: w => (w ? 3 : 6),
      markers: [...(iJan >= 0 ? [{ at: iJan, label: 'Bonus covers cars from 1 Jan', short: '1 Jan' }] : []),
        ...(iMay >= 0 ? [{ at: iMay + 18 / 31, label: 'Applications open 19 May', short: '19 May' }] : [])],
      tipTitle: i => `${monthName(ms[i])} ${ms[i].slice(0, 4)}: ${fmtInt(COMP.monthly[i].MARKET.phev)} plug-in hybrids`, tipFmt: val => fmtPct(val),
    }));
    table('phev', ['Month', 'All plug-in hybrids', ...series.map(s => s.name)], COMP.monthly.map((r, i) => [`${monthName(r.month, 'short')} ${r.month.slice(0, 4)}`, fmtInt(r.MARKET.phev), ...series.map(s => fmtPct(s.values[i]))]));
  }

  // ---------- chart 3: margins from company reports ----------
  const marg = IR.filter(r => r.metric === 'auto_margin');
  const periods = [...new Set(marg.map(r => r.period))].sort();
  {
    const series = BRANDS.map(b => ({
      ...b, name: b.company,
      values: periods.map(p => margin(b.ir || b.key, p) ?? null),
      label: gi => (marg.find(x => x.company === (b.ir || b.key) && x.period === periods[gi]) || {}).label || 'Margin',
    }));
    const host = document.querySelector('[data-chart="margin"]');
    if (periods.length) {
      // One panel per company on one shared scale: read each company's trend, not the levels side by side.
      const all = series.flatMap(s => s.values).filter(val => val != null);
      const domain = [Math.min(0, ...all), Math.max(0, ...all)];
      host.classList.add('multiples');
      for (const s of series) {
        const panel = el('div', { class: 'panel' });
        panel.innerHTML = `<h3><span class="swatch" style="background:${v(s.css)}"></span>${s.name}</h3>`;
        const box = el('div', { class: 'plot' });
        box.dataset.label = `Bar chart: ${s.name} reported margin by year`;
        panel.append(box);
        host.append(panel);
        redraws.push(barChart(box, {
          groups: periods.map(p => ({ short: p.replace(/^H1-20/, "H1 '").replace(/^20/, "'"), long: p.replace('H1-', 'January–June '), partial: p.startsWith('H1-') })),
          series: [s], domain, tipFmt: val => fmtPct(val),
        }));
      }
      table('margin', ['Period', ...series.map(s => s.name)], periods.map((p, i) => [p.replace('H1-', 'H1 '), ...series.map(s => (s.values[i] == null ? 'n/a' : fmtPct(s.values[i])))]));
    } else {
      host.innerHTML = '<p class="note">No company margin data loaded.</p>';
    }
  }

  // ---------- text ----------
  if (KBA.length) {
    const by = f => BRANDS.reduce((a, b) => (f(b.key) > f(a.key) ? b : a));
    const most = by(b => bev(b, Y)), mix = by(b => share(b, Y));
    const segNow = seg(Y), segPrev = seg(prev), mkt = growth('MARKET', Y);
    const threeGrowthNow = 100 * (BRANDS.reduce((s, b) => s + bev(b.key, Y), 0) / BRANDS.reduce((s, b) => s + bev(b.key, prev), 0) - 1);
    const pd = lastMM === '12' ? Y : `${P} ${Y}`;
    const charges = has(irv('PORSCHE', '2025', 'ev_platform_charge'), irv('PORSCHE', '2025', 'battery_expense'), irv('MERCEDES', '2024', 'ev_impairment'));
    const drop = c => (has(margin(c, '2023'), margin(c, '2025')) ? margin(c, '2023') - margin(c, '2025') : undefined);

    set('kicker', `Germany, new passenger cars, ${monthName(firstMonth)} ${firstMonth.slice(0, 4)} to ${monthName(lastMonth)} ${Y}`);
    const dl = window.META && window.META.downloaded ? new Date(window.META.downloaded + 'T00:00Z').toLocaleString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }) : 'unknown date';
    // A missing month would make one year shorter than the others; say so instead of comparing silently.
    const gaps = years.flatMap(y => Array.from({ length: +lastMM }, (_, i) => `${y}-${String(i + 1).padStart(2, '0')}`)).filter(m => !months.includes(m));
    // "Data as of", from the data itself (review item P-088): latest registration month, latest keeper month,
    // latest company period.
    const kpLast = COMP && COMP.keepers.length ? COMP.keepers.map(r => r.month).sort().at(-1) : '';
    const irLast = IR.map(r => r.period).sort((a, b) => (a.replace('H1-', '') + (a.startsWith('H1') ? '.5' : '')).localeCompare(b.replace('H1-', '') + (b.startsWith('H1') ? '.5' : ''))).at(-1) || '';
    set('meta', `<strong>Data as of:</strong> registrations to ${monthName(lastMonth)} ${Y}${kpLast ? `, keeper groups to ${monthName(kpLast)} ${kpLast.slice(0, 4)}` : ''}${irLast ? `, company figures to ${irLast.startsWith('H1-') ? 'June ' + irLast.slice(3) : irLast}` : ''}; downloaded ${dl}. Sources: Kraftfahrt-Bundesamt (KBA), ${months.length} monthly files; company reports.` +
      (gaps.length ? ` <strong>Warning: missing months ${gaps.join(', ')}; the comparison for those years is incomplete.</strong>` : ''));

    // Headline phrases are chosen from the data, so they stay true if the data changes.
    const allFell = BRANDS.every(b => has(drop(b.ir || b.key)) && drop(b.ir || b.key) > 0);
    const porPts = has(irv('PORSCHE', '2025', 'auto_revenue')) ? 100 * 1000 * (irv('PORSCHE', '2025', 'ev_platform_charge') + irv('PORSCHE', '2025', 'battery_expense')) / irv('PORSCHE', '2025', 'auto_revenue') : undefined;
    const PREM = [['BMW GROUP', 'BMW Group'], ['MERCEDES-BENZ', 'Mercedes-Benz'], ['PORSCHE', 'Porsche']];
    const dir = (k, nm) => `${nm} (${fmtPct(cs(k, 0))} to ${fmtPct(cs(k, 1))})`;
    if (COMP) {
      const gainers = units.filter(u => chg(u) > 0).sort((a, b) => chg(b) - chg(a)).slice(0, 3);
      const loser = units.reduce((a, u) => (chg(u) < chg(a) ? u : a));
      const mktG = 100 * (COMP.market.bev[1] / COMP.market.bev[0] - 1);
      const up = PREM.filter(([k]) => chg(k) > 0), down = PREM.filter(([k]) => chg(k) < 0);
      set('answer',
        `<strong>Germany's electric-car market ${mktG >= 0 ? 'grew' : 'shrank'} ${Math.abs(Math.round(mktG))}% in ${P} ${Y}, but ${nice(loser)}'s share fell from ${fmtPct(cs(loser, 0))} to ${fmtPct(cs(loser, 1))} as ${listAnd(gainers.map(nice))} took share.</strong> ` +
        `Of the German premium makers, ${up.length ? listAnd(up.map(([k, nm]) => dir(k, nm))) + ' gained' : 'none gained'}${down.length ? `; ${listAnd(down.map(([k, nm]) => dir(k, nm)))} lost` : ''}.` +
        (charges && allFell ? ` What the shift costs the three, as far as they disclose it, is in the last section.` : ''));

      // Hero title, at the same level as the chart (owner groups): who lost most, who gained most.
      const premUp = PREM.filter(([k]) => chg(k) > 0).map(([, nm]) => nm);
      set('h0', `${nice(loser)} lost ${Math.abs(chg(loser)).toFixed(1)} points; ${listAnd(gainers.map(nice))} gained most; ${premUp.length === 1 ? `of the premium makers only ${premUp[0]} gained` : premUp.length ? `${listAnd(premUp)} gained` : 'the premium makers all lost'}`);
      set('cap0', `Unit: % of all battery-electric registrations in Germany, ${P}; label: ${COMP.years[0]} → ${COMP.years[1]}. Car groups by owner (<a href="#c0-groups">members</a>); groups and brands with at least 1%. "Chinese brands" are the ${COMP.groups['CHINESE BRANDS'].members.length} brands of carmakers headquartered in China. ` +
        `Source: KBA FZ10, data/brands.csv.`);
      // The Leapmotor classification as a finding next to the chart (review item P-192), with both groupings.
      if (unit('STELLANTIS INCL. LEAPMOTOR')) {
        const stTop = chg('STELLANTIS INCL. LEAPMOTOR') > Math.max(...units.filter(u => u !== 'STELLANTIS' && u !== 'CHINESE BRANDS').map(u => chg(u)));
        set('leap0', `<strong>Who gained most depends on one classification.</strong> Leapmotor is a Chinese brand, but its cars are sold in Germany by Leapmotor International, a 51% Stellantis joint venture. Counted as Chinese, the Chinese brands gain ${pts(chg('CHINESE BRANDS'))} points; counted under Stellantis, Stellantis gains ${pts(chg('STELLANTIS INCL. LEAPMOTOR'))}${stTop ? ' and becomes the largest gainer' : ''}, and the Chinese brands ${pts(chg('CHINESE BRANDS EXCL. LEAPMOTOR'))}.`);
      }
    }

    // Keeper groups (KBA FZ8): how many of a brand's cars (all drives) the maker or its dealers registered themselves.
    const kp = COMP ? COMP.keepers : [];
    const kMonth = kp.length ? kp.map(r => r.month).sort().at(-1) : '';
    const kFor = brands => { const rs = kp.filter(r => r.month === kMonth && brands.includes(r.brand)); const t = rs.reduce((s, r) => s + r.total, 0); return t ? ['manufacturer', 'dealer', 'private'].map(k => 100 * rs.reduce((s, r) => s + r[k], 0) / t) : null; };
    const kpLabel = kMonth ? `January–${monthName(kMonth)} ${kMonth.slice(0, 4)}` : '';
    set('stats', BRANDS.map(b => {
      const gk = { BMWG: 'BMW GROUP', MERCEDES: 'MERCEDES-BENZ', PORSCHE: 'PORSCHE' }[b.key];
      const kr = kFor(partsOf(b.key));
      return `<div class="stat"><div class="who"><span class="swatch" style="background:${v(b.css)}"></span>${b.name}</div>` +
        `<div class="num">${fmtPct(segB(b.key, Y))}</div>` +
        `<div class="sub">of German electric registrations, ${pd}; ${fmtPct(segB(b.key, prev))} a year earlier` +
        `<br>${fmtInt(bev(b.key, Y))} electric cars, ${fmtChg(growth(b.key, Y))} (market ${fmtChg(growth('MARKET', Y))})` +
        `</div></div>`;
    }).join(''));
    // Self-registrations next to the shares (chart 2's text): a share can be lifted by the maker or its dealers registering cars.
    const kpText = kMonth ? `<details class="more"><summary>Who registers the cars</summary><p>Who registers the cars (KBA FZ8, all drive types, ${kpLabel}): the maker itself or its dealers registered ${BRANDS.map(b => { const kr = kFor(partsOf(b.key)); return kr ? `${fmtPct(kr[0] + kr[1])} of ${b.name}'s new cars (maker ${fmtPct(kr[0])}, dealers ${fmtPct(kr[1])})` : ''; }).filter(Boolean).join(', ')}, against ${fmtPct(kFor(['MARKET'])[0] + kFor(['MARKET'])[1])} for the whole market; Tesla ${kFor(['TESLA']) ? fmtPct(kFor(['TESLA'])[0] + kFor(['TESLA'])[1]) : 'n/a'}. KBA publishes no split by keeper and drive type, so these rates cover all of a brand's cars, not only electric ones.</p></details>` : '';

    const moved = (a, b) => (+b.toFixed(1) > +a.toFixed(1) ? 'rose from' : +b.toFixed(1) < +a.toFixed(1) ? 'fell from' : 'stayed at');
    const fyBev = (b, y) => rows(b).filter(r => r.month.startsWith(y)).reduce((s, r) => s + r.bev, 0);
    const bmwDel = irv('BMW', '2025', 'global_bev_deliveries'), mbDel = irv('MERCEDES', '2025', 'global_bev_deliveries');
    // Chart 1: electric share of each maker's own registrations.
    const byShare = [...BRANDS].sort((a, b) => share(b.key, Y) - share(a.key, Y));
    set('h1', `${byShare[0].name} is the most electric: ${fmtPct(share(byShare[0].key, Y))}, against the market's ${fmtPct(share('MARKET', Y))}`);
    set('t1', `<p>${BRANDS.map(b => `${b.name} ${moved(share(b.key, prev), share(b.key, Y))} ${fmtPct(share(b.key, prev))}${moved(share(b.key, prev), share(b.key, Y)) === 'stayed at' ? '' : ` to ${fmtPct(share(b.key, Y))}`}`).join('; ')} (${P} ${prev} to ${Y}).</p>` +
      `<details class="more"><summary>More on this chart</summary>` +
      (share('PORSCHE', Y) > share('MARKET', Y) ? `<p>Porsche's high share partly reflects its model line-up: it offers the combustion Macan mainly outside the EU and reports European supply shortages of combustion models because of cyber-security rules (2025 annual report, p. 51).</p>` : '') +
      (has(bmwDel, mbDel) && years.includes('2025') ? `<p>Germany is one market: in 2025 it took about ${Math.round(100 * fyBev('BMWG', '2025') / bmwDel)}% of the BMW Group's worldwide electric deliveries (BMW, MINI and Rolls-Royce) and ${Math.round(100 * fyBev('MERCEDES', '2025') / mbDel)}% of Mercedes-Benz Cars'.</p>` : '') +
      `</details>`);

    // Chart 2: the three makers' slices of the electric market, with the model series behind the change.
    const peak = years.reduce((a, y) => (seg(y) > seg(a) ? y : a));
    const three = y => BRANDS.reduce((s, b) => s + bev(b.key, y), 0);
    const rangeSum = (y, from, to, f = 'bev') => rows('MARKET').filter(r => r.month.startsWith(y) && r.month.slice(5) >= from && r.month.slice(5) <= to).reduce((s, r) => s + r[f], 0);
    const rangeGrowth = (from, to, f = 'bev') => 100 * (rangeSum(Y, from, to, f) / rangeSum(prev, from, to, f) - 1);
    const seg12 = endMonth => {
      const ms = months.filter(m => m <= endMonth).slice(-12);
      const s = b => rows(b).filter(r => ms.includes(r.month)).reduce((t, r) => t + r.bev, 0);
      return 100 * BRANDS.reduce((t, b) => t + s(b.key), 0) / s('MARKET');
    };
    // Model series behind each maker's change (KBA groups by series; a series can mix generations and drives).
    const modelText = () => {
      if (!COMP || !COMP.models) return '';
      const ser = b => COMP.models.filter(r => partsOf(b).includes(r.brand)).map(r => ({ ...r, d: r.bev[1] - r.bev[0] })).sort((a, c) => c.d - a.d);
      // KBA series names: "4ER" = 4 Series, "CLA-KLASSE" = CLA, "GLK, GLC" = GLC; "SONSTIGE" = other models.
      const nm = mo => mo === 'SONSTIGE' ? 'other models' : mo.replace(/-KLASSE$/, '').replace(/^GLK, GLC$/, 'GLC').replace(/^(\d)ER$/, '$1 Series').replace(/^E$/, 'E-Class')
        .replace(/^(MACAN|CAYENNE|TAYCAN|MINI|SPRINTER)$/, s => s[0] + s.slice(1).toLowerCase());
      const out = [];
      for (const b of BRANDS) {
        const s = ser(b.key), total = bev(b.key, Y) - bev(b.key, prev), top = s.filter(r => r.d > 0).slice(0, 2), falls = s.filter(r => r.d < 0).reverse();
        if (!top.length) continue;
        const sum = top.reduce((t, r) => t + r.d, 0);
        out.push(`${b.name}: ${top.map(r => `${nm(r.model)} ${fmtInt(r.bev[0])} to ${fmtInt(r.bev[1])}`).join(', ')}` +
          (sum > total && total > 0 ? `, ${top.length > 1 ? 'together ' : ''}more than its whole increase of ${fmtInt(total)}` : '') +
          (falls.length ? `; ${falls.slice(0, 2).map(r => nm(r.model)).join(' and ')} fell` : ''));
      }
      return out.length ? `Largest changes by model series (electric cars, ${P} ${prev} to ${Y}): ${out.join('. ')}. KBA groups models by series, so the X3 row includes the new iX3 and older models; data/models.csv. ` : '';
    };
    const upB = BRANDS.filter(b => segB(b.key, Y) > segB(b.key, prev)), downB = BRANDS.filter(b => segB(b.key, Y) < segB(b.key, prev));
    set('h2', `${upB.length ? listAnd(upB.map(b => b.name)) + ' gained share' : 'None of the three gained share'}${downB.length ? `; ${listAnd(downB.map(b => b.name))} lost it` : ''}`);
    set('t2', `<p>${BRANDS.map(b => `${b.name} ${fmtPct(segB(b.key, prev))} to ${fmtPct(segB(b.key, Y))}`).join(', ')} (${P} ${prev} to ${Y}). ` +
      modelText() + `</p>` + kpText +
      `<details class="more"><summary>More on this chart</summary><p>The three together: ${years.map(y => `${fmtPct(seg(y))} in ${y}`).join(', ')} (${basis}). Their slice peaked in ${peak}` +
      (peak === '2024' && years.includes('2023') && growth('MARKET', '2024') < 0 ? ` because the whole electric market shrank by ${fmtPct(-growth('MARKET', '2024'), 0)} while their own electric registrations ${Math.abs(three('2024') / three('2023') - 1) < 0.05 ? 'stayed level' : `changed by ${fmtChg(100 * (three('2024') / three('2023') - 1))}`} (${fmtInt(three('2023'))}, then ${fmtInt(three('2024'))}). The federal purchase bonus had closed to new applications after 17 December 2023 (<a href="https://www.bundesregierung.de/breg-de/aktuelles/faq-umweltbonus-1993830">Federal Government</a>)` : '') + '. ' +
      `Over the latest twelve months their slice was ${fmtPct(seg12(lastMonth))}, against ${fmtPct(seg12(`${prev}-${lastMM}`))} in the twelve months before.</p></details>`);

    // Chart 4: plug-in hybrids before and after the bonus opened, with diesel as the comparison.
    if (COMP && Y === '2026' && +lastMM >= 6) {
      const ph = (k, a, b) => { const rs = COMP.monthly.filter(r => r.month.startsWith(Y) && r.month.slice(5) >= a && r.month.slice(5) <= b); return 100 * rs.reduce((s, r) => s + r[k].phev, 0) / rs.reduce((s, r) => s + r.MARKET.phev, 0); };
      const before = k => ph(k, '01', '05'), after = k => ph(k, '06', lastMM);
      const cnUp = after('CHINESE BRANDS') > before('CHINESE BRANDS');
      // One message, at most 15 words (review item P-146); the other groups' numbers are in the text below.
      set('h4', `Bonus months: Chinese brands' plug-in hybrid share ${cnUp ? 'rose' : 'fell'} to ${fmtPct(after('CHINESE BRANDS'))}`);
      const g = (a, b, f) => rangeGrowth(a, b, f);
      const did = (f) => (g('06', lastMM, f) - g('01', '05', f)) - (g('06', lastMM, 'diesel') - g('01', '05', 'diesel'));
      // Difference-in-differences in words (review item P-157), with its definition.
      set('t4', `<p>Shares of all plug-in hybrid registrations, January–May against June–${monthName(lastMonth)} ${Y}: Chinese brands ${fmtPct(before('CHINESE BRANDS'))} to ${fmtPct(after('CHINESE BRANDS'))}; ${PHEV_SERIES.slice(0, 3).map(s => `${s.name} ${moved(before(s.key), after(s.key))} ${fmtPct(before(s.key))}${moved(before(s.key), after(s.key)) === 'stayed at' ? '' : ` to ${fmtPct(after(s.key))}`}`).join(', ')}.</p>` +
        (unit('BYD') ? `<p>BYD alone went from ${fmtPct(cs('BYD', 0, 'phev'))} to ${fmtPct(cs('BYD', 1, 'phev'))} of all plug-in hybrid registrations (${P} ${COMP.years[0]} to ${COMP.years[1]}). The EU's countervailing duties on cars imported from China cover battery-electric cars only (BYD: 17.0%); plug-in hybrids are outside their scope (Implementing Regulation (EU) 2024/2754, quoted in SOURCES.md).</p>` : '') +
        `<p><strong>The lift after the bonus opened was a fully electric one.</strong> Growth against the same months of ${prev}, January–May, then June–${monthName(lastMonth)}: battery-electric ${fmtChg(g('01', '05', 'bev'))}, then ${fmtChg(g('06', lastMM, 'bev'))}; plug-in hybrids, which the bonus also covers, ${fmtChg(g('01', '05', 'phev'))}, then ${fmtChg(g('06', lastMM, 'phev'))}; diesel, which it does not cover, ${fmtChg(g('01', '05', 'diesel'))}, then ${fmtChg(g('06', lastMM, 'diesel'))}. ` +
        `The change in growth rate minus diesel's change (a difference-in-differences) is ${fmtSigned(did('bev'), 0)} points for battery-electric cars and ${fmtSigned(did('phev'), 1)} for plug-in hybrids. The timing fits the bonus; it does not prove it.</p>` +
        `<details class="more"><summary>What this can and cannot show</summary><p>The comparison shows timing, not cause: new models (Mercedes-Benz CLA, BMW iX3, Skoda Elroq) and the EU CO2 targets moved in the same months, and the bonus covers cars first registered from 1 January 2026, so some buyers who registered earlier also qualify (<a href="https://www.bafa.de/SharedDocs/Kurzmeldungen/DE/Energie/E-Auto-Foerderung/20260519_E-Auto-Foerderung.html">BAFA</a>). Plug-in hybrids, which the bonus also covers, did not speed up.</p></details>`);
      set('cap4', `Unit: the brand's or group's plug-in hybrid (PHEV) registrations as % of all PHEV registrations in Germany, by month. BMW Group = BMW and MINI; Chinese brands = ${COMP.groups['CHINESE BRANDS'].members.map(nice).join(', ')}. Source: KBA FZ10, data/brands.csv.`);
    }

    if (has(drop('BMW'), drop('MERCEDES'), drop('PORSCHE'))) {
      const change = c => `${drop(c) >= 0 ? 'fell' : 'rose'} ${Math.abs(drop(c)).toFixed(1)} points`;
      const rev = irv('PORSCHE', '2025', 'auto_revenue'), grpRev = irv('PORSCHE', '2025', 'group_revenue'), mbRev = irv('MERCEDES', '2024', 'cars_revenue_ref');
      const pc = irv('PORSCHE', '2025', 'ev_platform_charge'), pb = irv('PORSCHE', '2025', 'battery_expense'), pt = irv('PORSCHE', '2025', 'us_tariff_effect');
      const mbImp = irv('MERCEDES', '2024', 'ev_impairment');
      const pts = bn => (100 * 1000 * bn / rev).toFixed(1);
      const fallers = ['BMW', 'MERCEDES', 'PORSCHE'].filter(c => drop(c) > 0);
      // What the companies say the shift costs (review items P-139, P-140, P-142, P-047, P-149): charges on the
      // conservative base (group revenue) with the automotive base next to it; every base named; company claims
      // labelled as claims. Guidance figures and claims are quoted in SOURCES.md and checked there by validate.js.
      const grpPts = has(grpRev) ? 100 * 1000 * (pc + pb) / grpRev : undefined;
      set('h3', `${fallers.length === 3 ? 'All three margins fell' : `Margins fell at ${fallers.length} of the three`}${has(porPts, mbRev) && porPts > 0.25 * drop('PORSCHE') && 100 * mbImp / mbRev < 0.1 * drop('MERCEDES') ? '; only Porsche ties much to EVs' : ''}`);
      set('t3', `<p>From 2023 to 2025 the reported car-business margin ${change('BMW')} at BMW (Automotive segment), ${change('MERCEDES')} at Mercedes-Benz Cars and ${change('PORSCHE')} at Porsche (Automotive). These are worldwide margins; the chart does not isolate the cost of electric cars.</p>` +
        (charges && has(rev, grpPts) ? `<p><strong>What the companies say the shift costs.</strong> Porsche ties €${(pc + pb).toFixed(1)} billion of 2025 charges to its electric programme: €${pc} billion for postponing its new electric-car platform (its ad hoc release of 19 September 2025 had said "up to €1.8 billion"; the annual report gives the final effect on operating profit) and €${pb} billion of battery expenses (the September 2025 presentation put battery-related special expenses at €1.3 billion, a wider measure). That is ${grpPts.toFixed(1)} points of Porsche's group revenue, or ${porPts.toFixed(1)} of its ${drop('PORSCHE').toFixed(1)}-point automotive margin fall measured on automotive revenue. ` +
          `Mercedes-Benz booked €${mbImp} million of impairment losses on vehicles with electric drives in 2024${has(mbRev) ? ` (${(100 * mbImp / mbRev).toFixed(2)} points of Mercedes-Benz Cars revenue, an upper bound because it is booked "mainly" there)` : ''}. BMW names no such amount in its 2025 report.</p>` +
          `<p><strong>What they claim for the next models (company claims, not measurements).</strong> BMW's finance chief told Reuters the new iX3 could reach "margin parity" with combustion models in 2026 (reported by Reuters, September 2025; secondary source). Mercedes-Benz says closing the margin gap between electric and combustion cars by the end of the decade is "feasible" (investor presentation, first quarter 2026).</p>` +
          `<p><strong>2026 so far: the three diverge.</strong> First half of 2026: BMW Automotive ${fmtPct(margin('BMW', 'H1-2026'))}, with full-year guidance cut to 1–3% on 16 June 2026; Mercedes-Benz Cars ${fmtPct(margin('MERCEDES', 'H1-2026'))} reported (${fmtPct(irv('MERCEDES', 'H1-2026', 'auto_margin_adj'))} adjusted; guidance 3–5% adjusted); Porsche Automotive ${fmtPct(margin('PORSCHE', 'H1-2026'))}, while its <em>group</em> guidance is 5.5–7.5% return on sales (last confirmed 29 July 2026; Porsche reports again on 27 October 2026, after Volkswagen cut its own forecast on 18 September) and its new medium-term <em>group</em> target 10–15%. Other causes they name: Porsche €${pt} billion of US tariffs in 2025 and weak demand in China; Mercedes-Benz lower volumes in China; BMW ${irv('BMW', 'H1-2026', 'tariff_margin_hit')} margin points from US tariffs in the first half of 2026.</p>` : ''));
    }
    const adj = p => irv('MERCEDES', p, 'auto_margin_adj');
    set('s3unit', 'Unit: operating profit (EBIT) as % of revenue, worldwide, as reported including one-off charges. One panel per company on the same scale; the outlined lighter bar is January–June 2026. Sources: company reports (details below).');
    set('s3', `BMW: Automotive segment EBIT margin. Mercedes-Benz Cars: return on sales; for 2025 and the first half of 2026 it is computed from the segment's EBIT and revenue, because Mercedes-Benz headlines an adjusted figure` +
      (has(adj('2025'), adj('H1-2026')) ? ` (${fmtPct(adj('2025'))} and ${fmtPct(adj('H1-2026'))}, excluding one-off items)` : '') +
      `. Porsche: Automotive segment return on sales. Definitions still differ, so compare trends. Sources: BMW Group Report 2025 (p. 9) and H1 2026 report (p. 4); Mercedes-Benz annual reports 2022 (p. 361) and 2024 (p. 450), 2025 results (pp. 2, 3) and Q2 2026 results (p. 5); Porsche AG annual reports 2023 (p. 219) and 2025 (pp. 51, 52, 243), H1 2026 report (p. 3). data/ir_figures.csv and SOURCES.md.`);
    // Fleet CO2 against EU targets (review item P-144): 2024 as confirmed by the Commission, 2025 as the companies report it.
    {
      const X = window.CTX || {}, g = k => X[k] ? (+X[k].value).toFixed(1) : null;
      if (g('co2_2024_bmw_pool')) document.getElementById('t3').insertAdjacentHTML('beforeend', `<details class="more"><summary>Fleet CO2 against the EU targets</summary><p>` +
        `In 2024, the latest year the European Commission has confirmed (Implementing Decision (EU) 2026/1907), all three stayed below their targets, in g CO2/km (WLTP): BMW pool ${g('co2_2024_bmw_pool')} against ${g('co2_2024_bmw_pool_target')}, Mercedes-Benz pool ${g('co2_2024_mb_pool')} against ${g('co2_2024_mb_pool_target')}, Volkswagen pool, which includes Porsche, ${g('co2_2024_vw_pool')} against ${g('co2_2024_vw_pool_target')}; Porsche on its own ${g('co2_2024_porsche')} against ${g('co2_2024_porsche_target')}. ` +
        `From 2025 the targets are lower and compliance is judged on the 2025–2027 average (Regulation (EU) 2025/1214). For 2025 BMW reports ${g('co2_2025_bmw')} against a limit it states as ${g('co2_2025_bmw_limit')} (its own preliminary calculation); Mercedes-Benz reports ${(+X.co2_2025_mb.value).toFixed(0)} for its European passenger-car fleet (an internal value) and states no target. The Commission has not yet published 2025 targets per manufacturer.</p></details>`);
    }
    set('cap1', `Unit: battery-electric (BEV) registrations as % of all the brand's new registrations in Germany, ${basis}. Brand level: BMW excludes MINI (the table adds BMW and MINI together), Mercedes-Benz excludes smart. Source: KBA FZ10, data/clean.csv.`);
    set('cap2', `Unit: the brand's BEV registrations as % of all BEV registrations in Germany, ${basis}. Car counts are in the table. Source: KBA FZ10, data/clean.csv.`);
    set('footer', `<details><summary><strong>Limits of this analysis</strong></summary><p>Registrations show where a car is registered, not who bought it or at what price. Private keepers registered only 40.3% of new cars in September 2026 (KBA press release 41/2026); the rest are companies, fleets, dealers and rental firms, so the data mixes private demand with company-car tax rules and dealer self-registrations (rates per brand above, from KBA FZ8). BMW Group here means the BMW and MINI brands (Rolls-Royce, ${unit('ROLLS ROYCE') ? fmtInt(unit('ROLLS ROYCE').bev[1]) + ' electric cars in ' + P + ' ' + Y : 'a few cars'}, is left out); Mercedes-Benz excludes smart. Porsche AG is controlled by Volkswagen AG but is compared on its own; VW Group with Porsche is in the first table. Margins are worldwide and company-defined; they cannot be split into German or electric business. Porsche publishes model figures and its electric share of deliveries, but no total number of electric cars delivered.</p></details>` +
      `<p>Sources: <a href="https://www.kba.de/DE/Statistik/Produktkatalog/produkte/Fahrzeuge/fz10/fz10_gentab.html">KBA FZ10</a> (© Kraftfahrt-Bundesamt, Flensburg; <a href="https://www.govdata.de/dl-de/by-2-0">dl-de/by-2-0</a>; processed by the author) (${months.length} monthly files, downloaded ${dl}), KBA press releases 01/2026 and 41/2026, the company reports above and the policy pages linked in the text; full list, data and code in the repository (SOURCES.md).</p>` +
      // Three reader notes (review run 4, D9): what the data shows for a reader's own work, facts only, no advice.
      (() => {
        if (!COMP) return '';
        const X = window.CTX || {};
        const p0 = COMP.years[0], p1 = COMP.years[1], gvw = 100 * (unit('VW GROUP').bev[1] / unit('VW GROUP').bev[0] - 1), gm = 100 * (COMP.market.bev[1] / COMP.market.bev[0] - 1);
        const cheap = ['price_dacia_spring', 'price_leapmotor_t03', 'price_citroen_e_c3', 'price_byd_dolphin_surf'].filter(k => X[k]).map(k => +X[k].value);
        const price = k => X[k] ? fmtInt(+X[k].value) : null;
        return `<details><summary><strong>If you work at a carmaker, a bank or a tech company</strong></summary>` +
          `<p><strong>Carmaker strategy.</strong> VW Group's electric registrations grew ${fmtPct(gvw, 0)} while the market grew ${fmtPct(gm, 0)}, so it lost share by growing slowly, not by shrinking; Mercedes-Benz gained on two new models. ` +
          (cheap.length && price('price_vw_id_polo') ? `The lowest list prices found for electric models of Renault Group, Leapmotor, Stellantis and BYD run from €${fmtInt(Math.min(...cheap))} to €${fmtInt(Math.max(...cheap))}, against €${price('price_vw_id_polo')} for Volkswagen's ID. Polo and €${price('price_mini_cooper_e')} for the MINI Cooper Electric (makers' sites, 9 October 2026). ` : '') +
          `The page does not show why buyers chose one car over another; registrations carry no price or buyer data.</p>` +
          `<p><strong>Bank analyst.</strong> KBA registrations are public every month, while the companies report deliveries by quarter; this page rebuilds from them with one command. They count German registrations, including makers' and dealers' own (rates above), not worldwide sales, and the margins shown are worldwide and company-defined. Not investment advice.</p>` +
          `<p><strong>Tech product.</strong> Every number in the memo and the README is recomputed from the data by a script on every change, the data files are described column by column in a data dictionary that the checks enforce, and a headless browser checks this page on phone and desktop in light and dark mode on every change. The method and its limits are in docs/method.md.</p></details>`;
      })() +
      `<p>By Joshua Musick, first-year Bachelor in Management, ESCP Business School. Educational project, not investment advice.</p>`);
  }

  // The memo's chart: the same dot chart at owner-group level, rendered by scripts/check-browser.js.
  window.EVCharts = {
    groupChart: host => {
      if (!COMP) return;
      host.dataset.label = 'Dot chart: share of battery-electric registrations in Germany by owner group';
      dotChart(host, { rows: groupRows(), aLabel: COMP.years[0], bLabel: COMP.years[1], fmt: val => fmtPct(val), label: bothYears });
    },
  };

  let t;
  addEventListener('resize', () => { clearTimeout(t); t = setTimeout(() => redraws.forEach(f => f()), 120); });
  // On a phone the sections below the hero chart fold to their finding (the h2); opening one redraws
  // the charts at their real width. Desktop keeps every section open.
  const narrow = matchMedia('(max-width: 620px)').matches;
  document.querySelectorAll('details.sec, #brands0').forEach(d => {
    // Desktop keeps the decomposition and the premium-makers section open and folds the rest (page-length
    // budget, review item P-151); a phone folds every section.
    if ((narrow && d.classList.contains('sec')) || d.classList.contains('fold-desktop')) d.open = false;
    d.addEventListener('toggle', () => { if (d.open) redraws.forEach(f => f()); });
  });
  document.documentElement.classList.remove('js'); // everything is drawn: show the page (see index.html)
})();
