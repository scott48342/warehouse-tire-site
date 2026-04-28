import { Redis } from '@upstash/redis';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '.env.local') });

const redis = new Redis({
  url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN
});

const years = [2002, 2003, 2004, 2005, 2006, 2007, 2008, 2009];

async function main() {
  for (const year of years) {
    const key = `wt:ymm:models:${year}:gmc`;
    const result = await redis.del(key);
    console.log(`Deleted ${key}: ${result}`);
  }
  console.log('\n✓ All Envoy year caches busted');
}

main().catch(console.error);
