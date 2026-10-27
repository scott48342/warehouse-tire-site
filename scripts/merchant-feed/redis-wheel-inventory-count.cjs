/**
 * READ-ONLY Redis count: how many WheelPros wheel SKUs have live qty >= 4.
 * Uses MGET only (no writes). Run with the MAIN checkout env (has Upstash creds):
 *   node --env-file=F:/clawd/warehouse-tire-site/.env.local scripts/merchant-feed/redis-wheel-inventory-count.cjs
 */
const fs = require("fs");
const zlib = require("zlib");

let Redis;
try { ({ Redis } = require("@upstash/redis")); }
catch { ({ Redis } = require("F:/clawd/warehouse-tire-site/node_modules/@upstash/redis")); }

(async () => {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) { console.log("NO REDIS CREDS IN ENV"); process.exit(2); }
  const redis = new Redis({ url, token });

  const data = JSON.parse(zlib.gunzipSync(fs.readFileSync("F:/clawd/wt-merchant-feed/src/techfeed/wheels_by_sku.json.gz")).toString("utf8"));
  const bySku = data.bySku || {};
  const skus = Object.keys(bySku);
  console.log("techfeed skus:", skus.length);

  let found = 0, ge4 = 0, ge1 = 0, eligible = 0, cachedAtMax = 0;
  const B = 500;
  for (let i = 0; i < skus.length; i += B) {
    const batch = skus.slice(i, i + B);
    const keys = batch.map(s => `wt:inv:${s}`);
    const values = await redis.mget(...keys);
    for (let j = 0; j < batch.length; j++) {
      const v = values[j];
      if (!v) continue;
      let d;
      try { d = typeof v === "string" ? JSON.parse(v) : v; } catch { continue; }
      found++;
      const q = d.q || 0;
      if (d.u && d.u > cachedAtMax) cachedAtMax = d.u;
      if (q >= 1) ge1++;
      if (q >= 4) {
        ge4++;
        const w = bySku[batch[j]];
        const img = (w.images || [])[0];
        const msrp = Number(w.msrp) || 0, map = Number(w.map_price) || 0;
        const m = d.m || 0, p = d.p || 0;
        if (img && (msrp > 0 || map > 0 || m > 0 || p > 0)) eligible++;
      }
    }
  }
  console.log(`redis: keysFound=${found} qty>=1:${ge1} qty>=4:${ge4} feedEligible(img+price):${eligible}`);
  console.log("redis: newest cachedAt =", cachedAtMax ? new Date(cachedAtMax).toISOString() : "n/a");
})().catch(e => { console.error("FATAL:", e.message); process.exit(1); });
