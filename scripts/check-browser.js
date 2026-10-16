// Opens docs/index.html in headless Chromium at 390 px and 1280 px, fails on console errors or
// horizontal overflow, and saves screenshots to docs/screenshots/. With --pdf it also prints memo.html to memo.pdf.
// With --no-write the screenshots, og-image and PDF go to data/cache/browser/ instead (ignored), so CI and
// scripts/check-all.js can run every check without touching tracked files.
// Needs the Playwright library (not a project dependency): `npm install --no-save playwright-core`
// plus a Chromium; set CHROME_PATH if Playwright's own browser download is not installed.
const path = require('path');
const fs = require('fs');

let pw;
for (const name of ['playwright', 'playwright-core']) { try { pw = require(name); break; } catch {} }
if (!pw) { console.error('Playwright not found. Run: npm install --no-save playwright-core'); process.exit(2); }

const ROOT = path.join(__dirname, '..');
const OUT = process.argv.includes('--no-write') ? path.join(ROOT, 'data', 'cache', 'browser') : ROOT;
fs.mkdirSync(path.join(OUT, 'docs', 'screenshots'), { recursive: true });
// Page budgets (review items P-150, run 4): the limits, and the room each page must keep below them.
const BUDGET = { 390: { limit: 3000, margin: 60 }, 1280: { limit: 3500, margin: 100 } };

// memo.md uses only headings, paragraphs, bold, "- " lists and one image, so a few lines convert it.
function memoHtml(md, lang = 'en', src = 'memo.md') {
  const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const inline = s => esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  const blocks = md.trim().split(/\n\s*\n/).map(b => {
    const img = b.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (img) return `<p class="fig"><img alt="${esc(img[1])}" src="data:image/png;base64,${fs.readFileSync(path.join(ROOT, img[2])).toString('base64')}"></p>`;
    if (b.startsWith('# ')) return `<h1>${inline(b.slice(2))}</h1>`;
    if (b.startsWith('## ')) return `<h2>${inline(b.slice(3))}</h2>`;
    if (b.startsWith('- ')) return `<ul>${b.split(/\n(?=- )/).map(li => `<li>${inline(li.slice(2))}</li>`).join('')}</ul>`;
    return `<p>${inline(b)}</p>`;
  });
  blocks[1] = blocks[1].replace('<p>', '<p class="byline">');
  // The PDF title carries the hash of the memo.md it was printed from; validate.js compares it.
  const hash = require('crypto').createHash('sha256').update(md.replace(/\r\n/g, '\n')).digest('hex');
  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><title>Memo: German EV shift (${src} sha256 ${hash})</title><style>
    @page { size: A4; margin: 16mm 18mm 14mm; }
    body { font: 10.4pt/1.42 Charter, Georgia, "Times New Roman", serif; color: #111; margin: 0; }
    h1 { font-size: 15.5pt; line-height: 1.2; margin: 0 0 4pt; }
    h2 { font: 700 9pt/1.3 system-ui, "Segoe UI", Arial, sans-serif; text-transform: uppercase; letter-spacing: .06em; color: #444; margin: 11pt 0 3pt; border-bottom: .6pt solid #bbb; padding-bottom: 2pt; }
    p { margin: 0 0 6pt; } ul { margin: 0; padding-left: 13pt; } li { margin-bottom: 4pt; }
    .byline { font: 8.6pt/1.3 system-ui, "Segoe UI", Arial, sans-serif; color: #555; margin-bottom: 9pt; }
    h2 + p, h1 + p + p { font-size: 10.4pt; }
    p:last-child { font-size: 8.8pt; color: #444; }
    .fig { margin: 2pt 0 6pt; } .fig img { width: 100%; max-height: 46mm; object-fit: contain; object-position: left top; display: block; }
  </style></head><body>${blocks.join('\n')}</body></html>`;
}
const url = f => 'file:///' + path.join(ROOT, f).replace(/\\/g, '/');

(async () => {
  const browser = await pw.chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
  let failed = 0;
  for (const scheme of ['light', 'dark']) {
    for (const width of [390, 1280]) {
      // 844 px is a common phone screen height; "within 1.5 screens" is measured against it.
      const screenH = width === 390 ? 844 : 900;
      const page = await browser.newPage({ viewport: { width, height: screenH }, colorScheme: scheme });
      const errors = [];
      page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`${m.type()}: ${m.text()}`); });
      page.on('pageerror', e => errors.push('pageerror: ' + e.message));
      page.on('requestfailed', r => errors.push('requestfailed: ' + r.url()));
      await page.goto(url('docs/index.html'), { waitUntil: 'load' });
      await page.waitForTimeout(300);
      const m = await page.evaluate(() => ({
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        charts: document.querySelectorAll('.plot svg').length,
        answer: (document.getElementById('answer') || {}).textContent || '',
        height: document.body.scrollHeight,
        heroBottom: document.querySelector('[data-chart="race"] svg').getBoundingClientRect().bottom + scrollY,
        titlesWithQuestion: [...document.querySelectorAll('h2')].filter(h => /\?\s*$/.test(h.textContent) || !h.textContent.trim()).length,
        folded: [...document.querySelectorAll('details.sec')].filter(d => !d.open).length,
        sections: document.querySelectorAll('details.sec').length,
        foldDesktop: document.querySelectorAll('details.sec.fold-desktop').length,
        markers: document.querySelectorAll('.plot .marker').length,
      }));
      // Link-preview tags: the four the plan asks for, and every number in the head's text must be one the
      // page computes in its answer or hero title (the head is typed by hand, the answer is computed).
      if (scheme === 'light' && width === 1280) {
        const head = await page.evaluate(() => Object.fromEntries(['og:title', 'og:description', 'og:image', 'twitter:card', 'description'].map(k => [k, (document.querySelector(`meta[property="${k}"], meta[name="${k}"]`) || {}).content || ''])));
        for (const k of ['og:title', 'og:description', 'og:image', 'twitter:card']) console.log(`      ${k}: ${head[k]}`);
        const shown = await page.evaluate(() => document.getElementById('answer').textContent + ' ' + document.getElementById('h0').textContent);
        const nums = s => (s.match(/(?<![A-Za-z\d.])\d+(?:\.\d+)?%?/g) || []).filter(n => !/^20\d\d$/.test(n));
        const stray = [head['og:title'], head['og:description'], head['description']].flatMap(nums).filter(n => !nums(shown).includes(n));
        const tagsOk = ['og:title', 'og:description', 'og:image', 'twitter:card'].every(k => head[k]) && stray.length === 0;
        console.log(`${tagsOk ? 'PASS' : 'FAIL'}  link-preview tags present; numbers in them that the page does not compute: ${stray.length ? stray.join(', ') : 'none'}`);
        if (!tagsOk) failed++;
      }
      // Dot-chart labels (review items P-145, P-163): each value label sits within 12 px of its latest
      // (filled) dot, on the right when the share rose and on the left when it fell.
      {
        await page.evaluate(() => { const d = document.getElementById('brands0'); if (d) d.open = true; });
        await page.waitForTimeout(150);
        const labels = await page.evaluate(() => [...document.querySelectorAll('.valuelabel')].map(t => {
          const b = t.getBBox(), dot = +t.dataset.dotX, side = t.dataset.side;
          return { text: t.textContent, side, gap: side === 'right' ? b.x - dot : dot - (b.x + b.width) };
        }));
        const off = labels.filter(l => l.gap < 0 || l.gap > 12);
        const labelsOk = labels.length > 20 && off.length === 0;
        console.log(`${labelsOk ? 'PASS' : 'FAIL'}  ${scheme} ${width}px dot-chart labels within 12 px of their latest dot: ${labels.length - off.length} of ${labels.length}${off.length ? ' — off: ' + off.slice(0, 4).map(l => `${l.text} (${l.gap.toFixed(1)} px)`).join('; ') : ''}`);
        if (!labelsOk) failed++;
        await page.evaluate(() => { const d = document.getElementById('brands0'); if (d) d.open = false; });
        // Review item P-172: in the first chart no two texts overlap and texts on one line keep >= 12 px apart.
        const spacing = await page.evaluate(() => {
          const t = [...document.querySelectorAll('[data-chart="race"] svg text')].map(e => ({ s: e.textContent, b: e.getBBox() }));
          let overlaps = 0, minGap = Infinity, pair = [];
          for (let i = 0; i < t.length; i++) for (let j = i + 1; j < t.length; j++) {
            const A = t[i].b, B = t[j].b;
            const dx = Math.max(B.x - (A.x + A.width), A.x - (B.x + B.width)), dy = Math.max(B.y - (A.y + A.height), A.y - (B.y + B.height));
            if (dx < 0 && dy < 0) overlaps++; else if (dy < 0 && dx < minGap) { minGap = dx; pair = [t[i].s, t[j].s]; }
          }
          return { overlaps, minGap, pair };
        });
        const spacingOk = spacing.overlaps === 0 && spacing.minGap >= 12;
        console.log(`${spacingOk ? 'PASS' : 'FAIL'}  ${scheme} ${width}px first chart: ${spacing.overlaps} overlapping texts, smallest gap ${spacing.minGap.toFixed(1)} px (${spacing.pair.join(' / ')}; limit 12)`);
        if (!spacingOk) failed++;
        if (scheme === 'light' && width === 1280) {
          const h4 = await page.locator('#h4').textContent();
          const words = h4.trim().split(/\s+/).length;
          const heroText = await page.locator('[data-chart="race"] svg').textContent();
          const answer = await page.locator('#answer strong').first().textContent();
          const named = (answer.match(/\d+\.\d%/g) || []).filter(n => !heroText.includes(n));
          const ok2 = words <= 15 && named.length === 0;
          console.log(`${ok2 ? 'PASS' : 'FAIL'}  PHEV title ${words} words (limit 15); headline shares missing from the first chart's labels: ${named.length ? named.join(', ') : 'none'}`);
          if (!ok2) failed++;
        }
      }
      if (width === 1280 && scheme === 'light') {
        // Run 4: the page's definitions and seasonality tables equal scripts/competitors.js, computed separately from data/brands.csv.
        const comp = require('./competitors');
        const cells = await page.evaluate(() => Object.fromEntries(['sens', 'season'].map(t => [t, [...document.querySelectorAll(`[data-table="${t}"] tbody tr`)].map(tr => [...tr.children].map(td => td.textContent))])));
        const f1 = v => v.toFixed(1) + '%';
        const want = {
          sens: comp.sensitivity().map(r => [f1(r.a), f1(r.b), r.holds ? 'yes' : 'no']),
          season: ['VW GROUP', 'BMW GROUP', 'MERCEDES-BENZ', 'PORSCHE', 'TESLA', 'CHINESE BRANDS', 'STELLANTIS'].map(u => [3, 2, 1].flatMap(k => { const s = comp.season(u, String(+comp.LAST.slice(0, 4) - k)); return [f1(s.first), f1(s.rest)]; })),
        };
        const got = { sens: cells.sens.map(r => [r[1], r[2], r[5]]), season: cells.season.map(r => r.slice(1)) };
        for (const t of ['sens', 'season']) {
          const diff = want[t].map((w, i) => (JSON.stringify(w) === JSON.stringify(got[t][i]) ? null : `row ${i + 1}: page ${got[t][i]} script ${w}`)).filter(Boolean);
          const ok = got[t].length === want[t].length && diff.length === 0;
          console.log(`${ok ? 'PASS' : 'FAIL'}  ${t === 'sens' ? 'definitions' : 'seasonality'} table on the page equals scripts/competitors.js (${got[t].length} rows)${diff.length ? ' — ' + diff.slice(0, 3).join('; ') : ''}`);
          if (!ok) failed++;
        }
      }
      if (width === 1280) {
        // Run 4: every section title that can fold has at most 10 words.
        const long = await page.evaluate(() => [...document.querySelectorAll('details.sec > summary h2')]
          .map(h => ({ t: h.textContent.trim(), n: h.textContent.trim().split(/\s+/).length })).filter(x => x.n > 10));
        console.log(`${long.length ? 'FAIL' : 'PASS'}  ${scheme} folded section titles at most 10 words${long.length ? ' — ' + long.map(x => `"${x.t}" (${x.n})`).join('; ') : ''}`);
        if (long.length) failed++;
        // Run 4: every text in every chart, opened, reaches 4.5:1 contrast against the page background in this scheme.
        const low = await page.evaluate(async () => {
          const was = [...document.querySelectorAll('details')].map(d => d.open);
          document.querySelectorAll('details').forEach(d => { d.open = true; });
          await new Promise(r => setTimeout(r, 250));
          const rgb = c => (c.match(/[\d.]+/g) || []).map(Number);
          const lum = ([r, g, b]) => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
          const bg = rgb(getComputedStyle(document.body).backgroundColor);
          const out = [];
          let n = 0;
          for (const t of document.querySelectorAll('.plot svg text')) {
            if (!t.textContent.trim() || !t.getBBox().width) continue;
            const cs = getComputedStyle(t);
            let op = 1; for (let e = t; e && e.tagName !== 'svg'; e = e.parentElement) op *= +getComputedStyle(e).opacity * (+(e.getAttribute('fill-opacity') || 1));
            const fg = rgb(cs.fill).slice(0, 3).map((v, i) => op * v + (1 - op) * bg[i]);
            const L1 = lum(fg), L2 = lum(bg), ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
            n++;
            if (ratio < 4.5) out.push(`${t.textContent.trim().slice(0, 24)} ${ratio.toFixed(2)}`);
          }
          document.querySelectorAll('details').forEach((d, i) => { d.open = was[i]; });
          await new Promise(r => setTimeout(r, 250));
          return { n, out };
        });
        const cOk = low.n > 100 && low.out.length === 0;
        console.log(`${cOk ? 'PASS' : 'FAIL'}  ${scheme} chart texts with contrast >= 4.5:1: ${low.n - low.out.length} of ${low.n}${low.out.length ? ' — low: ' + low.out.slice(0, 6).join('; ') : ''}`);
        if (!cOk) failed++;
      }
      // hover the hero chart (visible at every width) to prove the tooltip renders without errors
      await page.locator('[data-chart="race"] svg').scrollIntoViewIfNeeded();
      const box = await page.locator('[data-chart="race"] svg').boundingBox();
      if (box) await page.mouse.move(box.x + box.width * 0.5, box.y + 30);
      const tip = await page.locator('[data-chart="race"] .tip').isVisible();
      // On a phone every section below the hero starts folded; opening one must redraw its chart at full width.
      let reopened = true;
      if (width === 390) {
        await page.locator('#c2 > details.sec > summary').click();
        await page.waitForTimeout(100);
        const w = await page.locator('[data-chart="volume"] svg').evaluate(s => +s.getAttribute('viewBox').split(' ')[2]);
        reopened = w >= 340 && w <= 390;
        await page.locator('#c2 > details.sec > summary').click();
      }
      const phone = width === 390;
      const ok = errors.length === 0 && m.overflow <= 0 && m.charts >= 7 && m.answer.length > 40 && tip && m.titlesWithQuestion === 0 && reopened &&
        m.height <= BUDGET[width].limit - BUDGET[width].margin && (phone ? m.heroBottom <= 1.5 * screenH && m.folded === m.sections : m.folded === m.foldDesktop && m.heroBottom <= 800 && m.markers >= 6);
      if (!ok) failed++;
      console.log(`${ok ? 'PASS' : 'FAIL'}  ${scheme} ${width}px: console errors ${errors.length}, horizontal overflow ${m.overflow}px, charts ${m.charts}, answer ${m.answer.length} chars, tooltip ${tip ? 'shown' : 'missing'}, ` +
        `page height ${m.height}px (limit ${BUDGET[width].limit}, must stay ${BUDGET[width].margin} px below it: ${BUDGET[width].limit - m.height} px spare), hero chart ends at ${Math.round(m.heroBottom)}px = ${(m.heroBottom / screenH).toFixed(2)} screens${phone ? ' (limit 1.5)' : ''}, ` +
        `empty or question titles ${m.titlesWithQuestion}, folded sections ${m.folded}, date markers ${m.markers}${phone ? `, folded section redraws at full width: ${reopened ? 'yes' : 'NO'}` : ''}`);
      errors.forEach(e => console.log('      ' + e));
      await page.mouse.move(0, 0);
      if (scheme === 'light') await page.screenshot({ path: path.join(OUT, 'docs', 'screenshots', `dashboard-${width}.png`), fullPage: true });
      if (scheme === 'light' && width === 1280) {
        // Folded sections are opened for the per-chart screenshots (the full-page screenshot above shows them folded).
        await page.evaluate(() => document.querySelectorAll('details.sec').forEach(d => { d.open = true; }));
        await page.waitForTimeout(250);
        await page.locator('#c0').screenshot({ path: path.join(OUT, 'docs', 'screenshots', 'chart-race.png') });
        await page.locator('#c1').screenshot({ path: path.join(OUT, 'docs', 'screenshots', 'chart-bev-share.png') });
        await page.locator('#c2').screenshot({ path: path.join(OUT, 'docs', 'screenshots', 'chart-bev-segment.png') });
        await page.locator('#c4').screenshot({ path: path.join(OUT, 'docs', 'screenshots', 'chart-phev.png') });
        // The memo's chart: owner groups, drawn by the page's own dot-chart code into a 720 px box.
        await page.evaluate(() => {
          const box = document.createElement('div');
          box.id = 'memo-chart';
          box.style.cssText = 'width:720px;padding:6px 4px 0;background:var(--bg)';
          box.innerHTML = '<div style="font:600 13px system-ui,sans-serif;margin:0 0 2px">Share of battery-electric registrations in Germany, January–September (hollow dot 2025, filled 2026)</div><div class="plot"></div>';
          document.querySelector('main').append(box);
          window.EVCharts.groupChart(box.querySelector('.plot'));
        });
        await page.locator('#memo-chart').screenshot({ path: path.join(OUT, 'docs', 'screenshots', 'chart-groups.png') });
        await page.evaluate(() => document.getElementById('memo-chart').remove());
        // Social preview (Open Graph image): 1280 x 640, the headline's first sentence over the hero chart.
        const headline = await page.locator('#answer strong').first().textContent();
        const hero = await page.locator('[data-chart="race"] svg').screenshot();
        const og = await browser.newPage({ viewport: { width: 1280, height: 640 } });
        await og.setContent(`<!doctype html><html><body style="margin:0;width:1280px;height:640px;background:#fcfcfb;font-family:system-ui,'Segoe UI',Arial,sans-serif;color:#111;display:flex;flex-direction:column;padding:34px 48px;box-sizing:border-box">` +
          `<div style="font:700 30px/1.25 Charter,Georgia,serif;max-width:1180px">${headline.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</div>` +
          `<div style="flex:1;min-height:0;margin-top:18px;overflow:hidden"><img style="width:100%;height:100%;object-fit:cover;object-position:top left" src="data:image/png;base64,${hero.toString('base64')}"></div>` +
          `<div style="font-size:16px;color:#52514e;margin-top:10px">Share of battery-electric registrations in Germany, January–September: hollow dot 2025, filled dot 2026 · Source: KBA FZ10 · Joshua Musick</div></body></html>`);
        await og.screenshot({ path: path.join(OUT, 'docs', 'og-image.png'), clip: { x: 0, y: 0, width: 1280, height: 640 } });
        await og.close();
        const size = fs.statSync(path.join(OUT, 'docs', 'og-image.png')).size;
        console.log(`${size < 1e6 ? 'PASS' : 'FAIL'}  docs/og-image.png 1280x640, ${size} bytes (limit 1,000,000)`);
        if (size >= 1e6) failed++;
      }
      if (scheme === 'dark' && width === 390) await page.screenshot({ path: path.join(OUT, 'docs', 'screenshots', 'dashboard-390-dark.png'), fullPage: true });
      await page.close();
    }
  }
  // The English memo and its German translation (run 4), each on one A4 page.
  if (process.argv.includes('--pdf')) for (const [src, out, lang] of [['memo.md', 'memo.pdf', 'en'], ['memo.de.md', 'memo.de.pdf', 'de']]) {
    const page = await browser.newPage();
    await page.setContent(memoHtml(fs.readFileSync(path.join(ROOT, src), 'utf8'), lang, src), { waitUntil: 'load' });
    await page.pdf({ path: path.join(OUT, out), format: 'A4', printBackground: true, preferCSSPageSize: true });
    await page.close();
    const pdf = fs.readFileSync(path.join(OUT, out), 'latin1');
    const pages = (pdf.match(/\/Type\s*\/Page[^s]/g) || []).length;
    console.log(`${pages === 1 ? 'PASS' : 'FAIL'}  ${out} has ${pages} page(s)`);
    if (pages !== 1) failed++;
  }
  await browser.close();
  console.log(failed ? `${failed} view(s) failed` : 'all views passed');
  process.exit(failed ? 1 : 0);
})();
