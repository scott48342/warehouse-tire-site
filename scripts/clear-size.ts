import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

import { Redis } from "@upstash/redis";

const size = process.argv[2];
if (!size) {
  console.log("Usage: npx tsx scripts/clear-size.ts 255/45R19");
  process.exit(1);
}

const simpleSize = size.replace(/[^0-9]/g, "");
const key = `tiresearch:size:${simpleSize}`;

const redis = new Redis({ 
  url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || "",
  token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || ""
});

redis.del(key).then(() => {
  console.log(`✅ Cleared cache for ${size} (key: ${key})`);
  process.exit(0);
}).catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
