import fs from 'node:fs';
const t = fs.readFileSync('docs/fitment-api/audit/pass3/roadkill-disagree.csv', 'utf8').split(/\r?\n/).filter(Boolean);
const h = t[0].split(',');
console.log('columns:', h.join(' | '));
const parse = (l) => { const c = []; let cur = '', q = false; for (const ch of l) { if (ch === '"') q = !q; else if (ch === ',' && !q) { c.push(cur); cur = ''; } else cur += ch; } c.push(cur); const o = {}; h.forEach((k, i) => o[k] = c[i]); return o; };
const rows = t.slice(1).map(parse);
const boltKey = h.find(k => /^bolt$/i.test(k)) || 'bolt';
const bolt = rows.filter(r => (r[boltKey] || '') === 'disagree');
console.log('total rows', rows.length, '| bolt-disagree rows', bolt.length);
const ymm = new Set(bolt.map(r => `${r.year}|${r.make}|${r.model}`));
const mm = new Set(bolt.map(r => `${r.make}|${r.model}`));
console.log('distinct Y/M/M', ymm.size, '| distinct make/model', mm.size);
const oursK = h.find(k => /our.*bolt|bolt.*our/i.test(k));
const rkK = h.find(k => /rk.*bolt|roadkill.*bolt/i.test(k));
const by = {};
for (const r of bolt) {
  const k = `${r.make} ${r.model}`;
  by[k] ??= { rows: 0, years: new Set(), ours: new Set(), rk: new Set() };
  by[k].rows++; by[k].years.add(+r.year);
  if (oursK) by[k].ours.add(r[oursK]); if (rkK) by[k].rk.add(r[rkK]);
}
const arr = Object.entries(by).sort((a, b) => b[1].rows - a[1].rows);
for (const [k, v] of arr.slice(0, 45)) {
  const ys = [...v.years].sort();
  console.log(String(v.rows).padStart(4), k.padEnd(30), `${ys[0]}-${ys[ys.length - 1]}`.padEnd(10), 'ours', [...v.ours].join('/').padEnd(22), 'rk', [...v.rk].join('/'));
}
console.log('models with <=2 rows:', arr.filter(x => x[1].rows <= 2).length, '| models with >=10 rows:', arr.filter(x => x[1].rows >= 10).length);
