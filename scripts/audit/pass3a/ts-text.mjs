// strip html to text for a cached tiresize page
import fs from 'node:fs';
let h = fs.readFileSync(process.argv[2],'utf8');
h = h.replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ');
const links = [...h.matchAll(/href="(\/tires\/[^"]+)"/g)].map(m=>m[1]).filter((v,i,a)=>a.indexOf(v)===i);
let t = h.replace(/<[^>]+>/g,'\n').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/[ \t]+/g,' ').replace(/\n\s*\n+/g,'\n');
const i = t.search(/Select Option|Trim|Option/i); console.log(t.slice(0, 6000)); console.log('\nLINKS:', links.filter(l=>l.includes(process.argv[3]||'/')).join('\n'));
