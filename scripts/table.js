// Reads a small CSV/TSV file into an array of objects keyed by the header. A CSV value may be quoted
// ("A1, S1"), with "" for a quote inside it. Fails loudly if any row has a different number of cells
// than the header, so a stray comma or tab in a value stops the scripts instead of shifting columns silently.
const fs = require('fs');

const splitCsv = line => {
  const cells = []; let cur = '', q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) { if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') q = false; else cur += ch; }
    else if (ch === '"' && cur === '') q = true;
    else if (ch === ',') { cells.push(cur); cur = ''; }
    else cur += ch;
  }
  cells.push(cur);
  return cells;
};

function readTable(file, sep = ',') {
  const [head, ...lines] = fs.readFileSync(file, 'utf8').trim().split(/\r?\n/);
  const cols = head.split(sep);
  return lines.filter(l => l.trim() !== '').map((line, i) => {
    const cells = sep === ',' ? splitCsv(line) : line.split(sep);
    // A TSV row may omit an empty last cell (a claim with no formula); anything else is an error.
    if (cells.length !== cols.length && !(sep === '\t' && cells.length === cols.length - 1)) {
      throw new Error(`${file}:${i + 2}: ${cells.length} cells, header has ${cols.length} — check for a stray "${sep === '\t' ? '\\t' : sep}" in a value`);
    }
    return Object.fromEntries(cols.map((c, k) => [c, cells[k] ?? '']));
  });
}

module.exports = { readTable };
