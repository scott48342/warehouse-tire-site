import fs from 'fs';
const env = fs.readFileSync('.env.local', 'utf-8');
const get = k => { const m = env.match(new RegExp(`${k}="?([^"\r\n]+)"?`)); return m && m[1]; };
const URL_ = get('UPSTASH_REDIS_REST_URL') || get('KV_REST_API_URL');
const TOKEN = get('UPSTASH_REDIS_REST_TOKEN') || get('KV_REST_API_TOKEN');
async function redis(cmd) {
  const r = await fetch(URL_, { method: 'POST', headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' }, body: JSON.stringify(cmd) });
  const j = await r.json(); if (j.error) throw new Error(j.error); return j.result;
}
console.log('DBSIZE:', await redis(['DBSIZE']));
const prefixes = new Map();
let cursor = '0', sampled = 0;
do {
  const [next, keys] = await redis(['SCAN', cursor, 'COUNT', '1000']);
  cursor = next;
  for (const k of keys) {
    const p = k.split(':').slice(0, 2).join(':');
    prefixes.set(p, (prefixes.get(p) || 0) + 1);
    sampled++;
  }
} while (cursor !== '0' && sampled < 20000);
console.log('Key prefixes (first2 segments):');
for (const [p, n] of [...prefixes.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30)) console.log(`  ${p} → ${n}`);
