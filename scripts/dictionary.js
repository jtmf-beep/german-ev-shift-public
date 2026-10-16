// Prints the data dictionary (docs/data-dictionary.md) from data/datapackage.json, and checks every
// tracked data file against it. Run: node scripts/dictionary.js   (rewrites docs/data-dictionary.md)
// validate.js calls render() and checkPackage(), so a column added to a file without a description fails there.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { readTable } = require('./table');

const ROOT = path.join(__dirname, '..');
const PKG = path.join(ROOT, 'data', 'datapackage.json');
const OUT = path.join(ROOT, 'docs', 'data-dictionary.md');

function render(pkg = JSON.parse(fs.readFileSync(PKG, 'utf8'))) {
  const cell = s => String(s).replace(/\|/g, '\\|');
  const rule = f => { const c = f.constraints || {}; return [c.required ? 'required' : 'may be empty', c.minimum !== undefined ? `≥ ${c.minimum}` : '', c.enum ? 'one of: ' + c.enum.join(', ') : '', c.pattern ? `pattern \`${c.pattern}\`` : ''].filter(Boolean).join('; '); };
  return [
    `# Data dictionary`, '',
    `Printed from \`data/datapackage.json\` by \`node scripts/dictionary.js\`; edit the JSON, not this file. \`node scripts/validate.js\` checks that every tracked data file has exactly these columns, that every value meets its type and rule, and that this file matches the JSON.`, '',
    pkg.description, '',
    `Licence of the KBA data: ${pkg.licenses[0].title}.`, '',
    ...pkg.resources.flatMap(r => [
      `## ${r.path}`, '', r.description, '',
      ...(r.schema.primaryKey ? [`One row per: ${r.schema.primaryKey.join(' + ')}.${r.dialect.header === false ? ' No header row.' : ''}`, ''] : r.dialect.header === false ? ['No header row.', ''] : []),
      '| Column | Type | Rule | Meaning |', '|---|---|---|---|',
      ...r.schema.fields.map(f => `| \`${f.name}\` | ${f.type} | ${cell(rule(f))} | ${cell(f.description)} |`), '',
    ]),
  ].join('\n');
}

// Returns a list of problems (empty when every tracked data file matches its description).
function checkPackage() {
  const pkg = JSON.parse(fs.readFileSync(PKG, 'utf8'));
  const problems = [];
  const tracked = execFileSync('git', ['ls-files', 'data'], { cwd: ROOT, encoding: 'utf8' }).split('\n').filter(f => /\.(csv|tsv)$/.test(f));
  const described = new Set(pkg.resources.map(r => r.path));
  for (const f of tracked) if (!described.has(f)) problems.push(`${f} is tracked but not described in datapackage.json`);
  let values = 0;
  for (const r of pkg.resources) {
    const file = path.join(ROOT, r.path);
    if (!fs.existsSync(file)) { problems.push(`${r.path} described but missing`); continue; }
    const names = r.schema.fields.map(f => f.name);
    for (const f of r.schema.fields) if (!f.description || f.description.length < 10) problems.push(`${r.path}: column ${f.name} has no description`);
    let rows;
    if (r.dialect.header === false) {
      rows = fs.readFileSync(file, 'utf8').trim().split(/\r?\n/).map((l, i) => {
        const c = l.split(r.dialect.delimiter);
        if (c.length !== names.length) problems.push(`${r.path}:${i + 1}: ${c.length} cells, dictionary has ${names.length}`);
        return Object.fromEntries(names.map((n, k) => [n, c[k] ?? '']));
      });
    } else {
      const head = fs.readFileSync(file, 'utf8').split(/\r?\n/)[0].split(r.dialect.delimiter);
      if (head.join('|') !== names.join('|')) { problems.push(`${r.path}: header ${head.join(',')} ≠ dictionary ${names.join(',')}`); continue; }
      rows = readTable(file, r.dialect.delimiter);
    }
    const seen = new Set();
    rows.forEach((row, i) => {
      const where = `${r.path}:${i + (r.dialect.header === false ? 1 : 2)}`;
      for (const f of r.schema.fields) {
        const v = row[f.name], c = f.constraints || {};
        values++;
        if (v === '') { if (c.required) problems.push(`${where}: ${f.name} is empty`); continue; }
        if (f.type === 'integer' && !/^-?\d+$/.test(v)) problems.push(`${where}: ${f.name} "${v}" is not an integer`);
        if (f.type === 'number' && !/^-?\d+(\.\d+)?$/.test(v)) problems.push(`${where}: ${f.name} "${v}" is not a number`);
        if (c.minimum !== undefined && +v < c.minimum) problems.push(`${where}: ${f.name} ${v} < ${c.minimum}`);
        if (c.enum && !c.enum.includes(v)) problems.push(`${where}: ${f.name} "${v}" not in ${c.enum.join('/')}`);
        if (c.pattern && !new RegExp(c.pattern).test(v)) problems.push(`${where}: ${f.name} "${v}" does not match ${c.pattern}`);
      }
      if (r.schema.primaryKey) {
        const k = r.schema.primaryKey.map(n => row[n]).join('|');
        if (seen.has(k)) problems.push(`${where}: duplicate key ${k}`);
        seen.add(k);
      }
    });
  }
  const md = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8').replace(/\r\n/g, '\n') : '';
  if (md !== render(pkg) + '\n') problems.push('docs/data-dictionary.md is not what datapackage.json prints — run: node scripts/dictionary.js');
  return { problems, resources: pkg.resources.length, tracked: tracked.length, values };
}

module.exports = { render, checkPackage };
if (require.main === module) {
  fs.writeFileSync(OUT, render() + '\n');
  const r = checkPackage();
  console.log(`wrote docs/data-dictionary.md (${r.resources} files); ${r.values} values checked; ${r.problems.length} problems`);
  r.problems.slice(0, 20).forEach(p => console.log('  ' + p));
  process.exit(r.problems.length ? 1 : 0);
}
