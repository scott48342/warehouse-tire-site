// tiresize.com throttled fetcher. usage: node ts-fetch.mjs <path e.g. /tires/Ford/F150/1997/>
import fs from 'node:fs'; import path from 'node:path';
const LOG = 'cache/tiresize-log.json'; const log = fs.existsSync(LOG) ? JSON.parse(fs.readFileSync(LOG,'utf8')) : [];
const now = Date.now(); const hr = log.filter(x => now - new Date(x.t).getTime() < 3600e3).length; const day = log.filter(x => now - new Date(x.t).getTime() < 86400e3).length;
const p = process.argv[2]; const url = 'https://tiresize.com' + p; const file = 'cache/tiresize' + p.replace(/\//g,'_') + '.html';
if (fs.existsSync(file)) { console.log('CACHED', file); process.exit(0); }
if (hr >= 15 || day >= 75) { console.error(`THROTTLE hr=${hr} day=${day}`); process.exit(2); }
const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; WarehouseTireFitmentAudit/1.0)' } });
log.push({ t: new Date().toISOString(), url, status: res.status }); fs.writeFileSync(LOG, JSON.stringify(log, null, 1));
if (!res.ok) { console.error('HTTP', res.status, url); process.exit(1); }
fs.writeFileSync(file, await res.text()); console.log('FETCHED', file, `(hr=${hr+1} day=${day+1})`);
