// Runs every check in this repository and exits 1 if any fails. Run: node scripts/check-all.js
//   --online        also request every link in README, SOURCES and the dashboard (slow; needs the internet)
//   --skip-browser  leave out the browser check (it needs Playwright, see scripts/check-browser.js); the
//                   summary then says SKIPPED, so a skipped run is never reported as a full pass
// Needs the company reports fetched and extracted first (node scripts/fetch-sources.js, then the
// extract step in README "How to rerun"); without them validate.js fails and says which file is missing.
const { spawnSync } = require('child_process');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const arg = a => process.argv.includes(a);
const steps = [
  ['rebuild from data/raw', ['scripts/build.js']],
  ['rebuilt files equal the committed ones', null, () => spawnSync('git', ['diff', '--exit-code', '--stat', '--', 'data', 'docs/data.js'], { cwd: ROOT, encoding: 'utf8' })],
  ['validate data, dictionary and memo PDF', ['scripts/validate.js']],
  ['every number in memo, German memo and README', ['scripts/check-memo-numbers.js']],
  ['link checker self-test', ['scripts/check-links.js', '--self-test']],
  ['publish scan of the current tree', ['scripts/check-publish.js', '--tree-only']],
];
if (!arg('--skip-browser')) steps.push(['browser views, budgets, labels, contrast, memo PDF', ['scripts/check-browser.js', '--no-write', '--pdf']]);
if (arg('--online')) steps.push(['every link answers', ['scripts/check-links.js']]);

const results = [];
for (const [name, args, fn] of steps) {
  const t = Date.now();
  const r = fn ? fn() : spawnSync(process.execPath, args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 28 });
  const out = (r.stdout || '') + (r.stderr || '');
  const ok = r.status === 0;
  results.push([ok ? 'PASS' : 'FAIL', name, ((Date.now() - t) / 1000).toFixed(1) + ' s']);
  // A failing step prints its own FAIL lines (or its last lines when it has none) so the cause is visible here.
  if (!ok) {
    const lines = out.split('\n').filter(l => /FAIL|Error|error|missing|not found/.test(l));
    console.log(`--- ${name} (exit ${r.status}) ---\n` + (lines.length ? lines : out.trim().split('\n').slice(-15)).slice(0, 40).join('\n'));
  }
}
if (arg('--skip-browser')) results.push(['SKIPPED', 'browser views, budgets, labels, contrast, memo PDF', '']);
if (!arg('--online')) results.push(['NOT RUN', 'every link answers (add --online)', '']);
console.log(results.map(r => `${r[0].padEnd(8)} ${r[1]}${r[2] ? '  (' + r[2] + ')' : ''}`).join('\n'));
const failed = results.filter(r => r[0] === 'FAIL').length;
console.log(failed ? `${failed} check(s) failed` : `all ${results.filter(r => r[0] === 'PASS').length} checks run passed`);
process.exit(failed ? 1 : 0);
