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
  // Update the Redis cache with the correct models list including Envoy
  const correctModels = [
    "Acadia",
    "Canyon", 
    "Envoy",
    "Sierra 1500",
    "Sierra 2500 HD",
    "Sierra 3500 HD",
    "Yukon"
  ];
  
  const key = 'wt:ymm:models:2006:gmc';
  
  // Set with 1 hour TTL (matches the API config)
  await redis.set(key, correctModels, { ex: 3600 });
  
  console.log(`✓ Updated Redis cache: ${key}`);
  console.log(`  Models: ${correctModels.join(', ')}`);
  console.log('\nEdge cache will clear within ~1 hour (browser max-age)');
}

main().catch(console.error);
