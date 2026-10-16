// Pre-publish scan. Prints every hit and exits 1 if the files that would be published (the current
// tree) or any commit in the history contain secrets, personal paths, private notes or files whose
// publishers do not allow redistribution. Run: node scripts/check-publish.js [--tree-only]
const { execFileSync } = require('child_process');
const git = (...a) => execFileSync('git', a, { encoding: 'utf8', maxBuffer: 1 << 30 });
// The owner's private e-mail address is matched by its SHA-256, so this file does not publish it.
const PRIVATE_EMAIL_SHA256 = '04f699724037f3424b23957b23804f95977b89b35eb1f237689ea747e5b5467e';
const sha256 = t => require('crypto').createHash('sha256').update(t).digest('hex');
const privateEmail = { [Symbol.match](s) {
  for (const m of s.matchAll(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g)) if (sha256(m[0].toLowerCase()) === PRIVATE_EMAIL_SHA256) return ['(private address, matched by hash)'];
  return null;
} };

// Content patterns: credentials, personal paths and addresses, and process wording that belongs in private notes.
const CONTENT = [
  ['API key or token', /\b(sk-[A-Za-z0-9]{20,}|ghp_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|AKIA[0-9A-Z]{16}|xox[bp]-[A-Za-z0-9-]{20,})/],
  ['private key', /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ['personal Windows path', /[A-Za-z]:\\+Users\\+[A-Za-z]/],
  ['personal e-mail address', privateEmail],
  ['reviewer-score wording', /\b(persona|90 gate|score[sd]? \d{2}\/100|bar-raiser)\b/i],
];
// Path patterns: report PDFs, extracted report text, government pages fetched into the cache, tool logs.
const PATHS = [
  ['company report or report text', /(^|\/)(data\/raw\/ir|data\/ir_text|data\/cache)\//],
  ['Federal Government page or BAFA page', /bundesregierung|richtlinie|bafa/i],
  ['tool log', /^\.playwright-mcp\/|^\.claude\//],
  // KBA press releases name a press officer with phone, fax and e-mail; they are fetched, never committed.
  ['KBA press release (third-party contact details)', /^data\/raw\/press\/|(^|\/)kba_pm\d+/i],
  ['PDF other than memo.pdf and memo.de.pdf', /\.pdf$/i, p => !['memo.pdf', 'memo.de.pdf'].includes(p)],
];
const textLike = p => /\.(md|js|json|csv|tsv|html|css|txt|yml|yaml|py|gitignore|gitattributes)$/i.test(p) || !/\./.test(p.split('/').pop());

const hits = [];
const scanTree = (ref, label) => {
  for (const p of git('ls-tree', '-r', '--name-only', ref).split('\n').filter(Boolean)) {
    for (const [what, re, extra] of PATHS) if (re.test(p) && (!extra || extra(p))) hits.push(`${label}: ${what}: ${p}`);
    if (!textLike(p) || p === 'scripts/check-publish.js') continue; // this file holds the patterns themselves
    const text = git('show', `${ref}:${p}`);
    for (const [what, re] of CONTENT) {
      const m = text.match(re);
      if (m) hits.push(`${label}: ${what} in ${p}: "${m[0].slice(0, 40)}"`);
    }
  }
};

scanTree('HEAD', 'current tree');
const treeHits = hits.length;
if (!process.argv.includes('--tree-only')) {
  // Every path that ever existed in any commit, and every commit's author e-mail.
  const seen = new Set();
  for (const line of git('rev-list', '--all', '--objects').split('\n')) {
    const p = line.slice(41);
    if (!p || seen.has(p)) continue;
    seen.add(p);
    for (const [what, re, extra] of PATHS) if (re.test(p) && (!extra || extra(p))) hits.push(`history: ${what}: ${p}`);
  }
  for (const e of new Set(git('log', '--all', '--format=%ae').split('\n').filter(Boolean))) {
    if (!/noreply\.github\.com$/.test(e)) hits.push(`history: commit author e-mail is not a noreply address: ${e.replace(/^(.).*@/, '$1…@')}`);
  }
  // --deep: also scan the text content of every file in every commit (for a curated history before publishing).
  if (process.argv.includes('--deep')) {
    for (const c of git('rev-list', '--all').split('\n').filter(Boolean)) {
      const before = hits.length;
      scanTree(c, `commit ${c.slice(0, 7)}`);
      // Path hits of older commits are already reported above; keep only their content hits.
      hits.splice(before, hits.length - before, ...hits.slice(before).filter(h => / in [^:]+: "/.test(h)));
    }
  }
  for (const s of git('log', '--all', '--format=%s').split('\n')) if (CONTENT[4][1].test(s) || /\bround[s]? \d|independent rounds/i.test(s)) hits.push(`history: commit subject with review-process wording: ${s}`);
}
for (const h of hits) console.log('HIT  ' + h);
console.log(`\n${treeHits} hit(s) in the current tree, ${hits.length - treeHits} in the history${process.argv.includes('--tree-only') ? ' (not scanned)' : ''}`);
process.exit(hits.length ? 1 : 0);
