// Minimal .xlsx reader: enough to read one worksheet into a 2-D array of strings.
// Written by hand so the project needs no npm dependencies.
// ponytail: ignores styles, dates and formulas (cached values only); fine for KBA tables.
const fs = require('fs');
const zlib = require('zlib');

function unzip(buf) {
  // Find the End Of Central Directory record (signature 0x06054b50) from the end.
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('not a zip file');
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const files = {};
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('bad central directory');
    const method = buf.readUInt16LE(p + 10);
    const csize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen);
    const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const data = buf.subarray(start, start + csize);
    files[name] = method === 0 ? data : zlib.inflateRawSync(data);
    p += 46 + nameLen + extraLen + commentLen;
  }
  return files;
}

const decode = s => s
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&amp;/g, '&');

// Concatenate all <t> runs inside one <si> or <is> element.
const textOf = xml => [...xml.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(m => decode(m[1])).join('');

function colIndex(ref) {
  const letters = ref.match(/^[A-Z]+/)[0];
  let n = 0;
  for (const ch of letters) n = n * 26 + ch.charCodeAt(0) - 64;
  return n - 1;
}

// Returns { sheetNames, rows } where rows is an array of arrays (strings, '' for empty).
function readSheet(file, wantedName) {
  const z = unzip(fs.readFileSync(file));
  const str = k => (z[k] ? z[k].toString('utf8') : '');
  const shared = [...str('xl/sharedStrings.xml').matchAll(/<si>([\s\S]*?)<\/si>/g)].map(m => textOf(m[1]));
  const wb = str('xl/workbook.xml');
  // Attributes can come in any order (KBA's exporter and other tools differ), so read each one by name.
  const attr = (tag, name) => (tag.match(new RegExp(`\\b${name}="([^"]*)"`)) || [])[1];
  const sheets = [...wb.matchAll(/<sheet\b[^>]*>/g)].map(m => ({ name: decode(attr(m[0], 'name') || ''), rid: attr(m[0], 'r:id') }));
  const rels = Object.fromEntries([...str('xl/_rels/workbook.xml.rels').matchAll(/<Relationship\b[^>]*>/g)]
    .map(m => [attr(m[0], 'Id'), attr(m[0], 'Target')]));
  const sheet = typeof wantedName === 'function' ? sheets.find(s => wantedName(s.name)) : sheets.find(s => s.name === wantedName);
  if (!sheet) throw new Error(`${file}: sheet not found; have ${sheets.map(s => s.name).join(', ')}`);
  if (!rels[sheet.rid]) throw new Error(`${file}: sheet "${sheet.name}" has no file in workbook.xml.rels`);
  const target = rels[sheet.rid].replace(/^\/?(xl\/)?/, 'xl/');
  const rows = [];
  for (const rm of str(target).matchAll(/<row [^>]*?r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g)) {
    const row = [];
    for (const cm of rm[2].matchAll(/<c ([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = cm[1];
      const ref = attrs.match(/r="([A-Z]+\d+)"/)[1];
      const type = (attrs.match(/t="([^"]+)"/) || [])[1];
      const inner = cm[2] || '';
      let v = (inner.match(/<v>([\s\S]*?)<\/v>/) || [])[1];
      if (type === 's') v = shared[+v];
      else if (type === 'inlineStr') v = textOf(inner);
      else if (v !== undefined) v = decode(v);
      row[colIndex(ref)] = v === undefined ? '' : String(v);
    }
    rows[+rm[1] - 1] = Array.from(row, x => x ?? '');
  }
  return { sheetNames: sheets.map(s => s.name), rows: Array.from(rows, r => r || []) };
}

module.exports = { readSheet };
