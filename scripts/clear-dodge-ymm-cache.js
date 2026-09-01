/** Clear stale YMM Redis cache for Dodge after Intrepid 2000-2004 insert */
const fs = require("fs");
const path = require("path");
const env = fs.readFileSync(path.join(__dirname, "..", ".env.local"), "utf8");
const grab = (k) => { const m = env.match(new RegExp(k + '="?([^\\r\\n"]+)')); return m ? m[1] : null; };
const url = grab("UPSTASH_REDIS_REST_URL") || grab("KV_REST_API_URL");
const token = grab("UPSTASH_REDIS_REST_TOKEN") || grab("KV_REST_API_TOKEN");
if (!url || !token) { console.error("No Upstash creds found in .env.local"); process.exit(1); }

const keys = ["wt:ymm:models:all:dodge", "wt:ymm:years:dodge:intrepid"];
for (let y = 1993; y <= 2004; y++) keys.push(`wt:ymm:models:${y}:dodge`);

(async () => {
  for (const key of keys) {
    const res = await fetch(`${url}/del/${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const j = await res.json();
    console.log(`DEL ${key} -> ${JSON.stringify(j)}`);
  }
})();
