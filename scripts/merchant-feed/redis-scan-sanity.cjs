/** READ-ONLY: single SCAN to see if wt:inv:* keys exist in the local-cred Redis. */
let Redis;
try { ({ Redis } = require("@upstash/redis")); }
catch { ({ Redis } = require("F:/clawd/warehouse-tire-site/node_modules/@upstash/redis")); }
(async () => {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) { console.log("NO REDIS CREDS"); process.exit(2); }
  const redis = new Redis({ url, token });
  const [cursor, keys] = await redis.scan(0, { match: "wt:inv:*", count: 1000 });
  console.log("scan wt:inv:* -> cursor:", cursor, "keys found in first page:", keys.length, "sample:", keys.slice(0, 3));
  const [c2, k2] = await redis.scan(0, { count: 20 });
  console.log("scan any -> first keys (names only):", k2.slice(0, 10));
  const size = await redis.dbsize();
  console.log("dbsize:", size);
})().catch(e => { console.error("FATAL:", e.message); process.exit(1); });
