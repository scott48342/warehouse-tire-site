/**
 * P0 deploy — purge YMM + fitment Redis caches (Upstash REST)
 * Scans wt:ymm:* and wt:fit:* and deletes in batches.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const env = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf-8');
const get = k => { const m = env.match(new RegExp(`${k}="?([^"\\r\\n]+)"?`)); return m && m[1]; };
const URL_ = get('UPSTASH_REDIS_REST_URL') || get('KV_REST_API_URL');
const TOKEN = get('UPSTASH_REDIS_REST_TOKEN') || get('KV_REST_API_TOKEN');
if (!URL_ || !TOKEN) { console.error('Missing Upstash env'); process.exit(1); }

async function redis(cmd) {
  const res = await fetch(URL_, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmd),
  });
  const j = await res.json();
  if (j.error) throw new Error(j.error);
  return j.result;
}

async function purgePattern(pattern) {
  let cursor = '0', total = 0;
  do {
    const [next, keys] = await redis(['SCAN', cursor, 'MATCH', pattern, 'COUNT', '500']);
    cursor = next;
    if (keys.length) {
      // batch delete in chunks of 100
      for (let i = 0; i < keys.length; i += 100) {
        const chunk = keys.slice(i, i + 100);
        total += await redis(['DEL', ...chunk]);
      }
    }
  } while (cursor !== '0');
  return total;
}

const patterns = ['wt:ymm:*', 'wt:fit:*'];
for (const p of patterns) {
  const n = await purgePattern(p);
  console.log(`${p} → deleted ${n} keys`);
}
console.log('Done.');
