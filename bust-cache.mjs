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

async function main() {
  // Keys are normalized to lowercase
  const keysToDelete = [
    'wt:ymm:models:2006:gmc',
    'wt:ymm:trims:2006:gmc:envoy'
  ];
  
  for (const key of keysToDelete) {
    const result = await redis.del(key);
    console.log(`Deleted ${key}: ${result}`);
  }
  
  console.log('\n✓ Cache busted');
}

main().catch(console.error);
