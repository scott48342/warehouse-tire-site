import fs from 'node:fs';
let h=fs.readFileSync('cache/tiresize_bolt-pattern-finder_.html','utf8');
const links=[...h.matchAll(/href="(\/bolt-pattern[^"]*)"/g)].map(m=>m[1]).filter((v,i,a)=>a.indexOf(v)===i);
console.log(links.slice(0,40).join('\n'));
const t=h.replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<[^>]+>/g,'\n').replace(/[ \t]+/g,' ').replace(/\n\s*\n+/g,'\n');
const i=t.indexOf('Bolt Pattern Finder'); console.log(t.slice(i,i+1200));
