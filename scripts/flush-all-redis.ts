import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function flushRedis(name: string, url: string | undefined, token: string | undefined) {
  if (!url || !token) {
    console.log(`${name}: Not configured`);
    return;
  }
  
  console.log(`Flushing ${name}...`);
  try {
    const response = await fetch(`${url}/flushdb`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await response.json();
    console.log(`${name}:`, JSON.stringify(data));
  } catch (err) {
    console.error(`${name} error:`, err);
  }
}

async function main() {
  // KV (Vercel KV)
  await flushRedis(
    'KV',
    process.env.KV_REST_API_URL,
    process.env.KV_REST_API_TOKEN
  );
  
  // Upstash Redis
  await flushRedis(
    'Upstash',
    process.env.UPSTASH_REDIS_REST_URL,
    process.env.UPSTASH_REDIS_REST_TOKEN
  );
  
  console.log('\nDone! Note: Local in-memory caches on Vercel instances will clear on next cold start.');
}

main();
