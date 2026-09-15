// summarize a cached tiresize year index: option -> sizes
import fs from 'node:fs';
for (const f of process.argv.slice(2)) {
  let h = fs.readFileSync(f,'utf8').replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ');
  let t = h.replace(/<[^>]+>/g,'\n').replace(/[ \t]+/g,' ').replace(/\n\s*\n+/g,'\n');
  const a = t.indexOf('Select Your Vehicle'), b = t.indexOf('Tires By Vehicle', a);
  const body = t.slice(a+20, b).split('\n').map(s=>s.trim()).filter(s=>s && !/^\d+\.$/.test(s));
  console.log('## ' + f.replace(/.*tiresize_tires_/,'').replace(/_\.html$/,'').replace(/_/g,' '));
  let cur=null; const out={};
  for (const line of body) { if (/^\d{4} /.test(line)) { cur=line; out[cur]=[]; } else if (cur && /\d{3}\/\d{2}R\d{2}|R\d{2}/.test(line)) out[cur].push(line); }
  for (const k in out) console.log('  ' + k + ' => ' + out[k].join(', '));
}
