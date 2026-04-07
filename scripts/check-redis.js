/**
 * Check Redis/Upstash connection status
 */
require('dotenv').config({ path: '.env.local' });

async function main() {
  console.log('=== Redis Connection Check ===\n');
  
  // Check env vars
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  
  console.log('1. Environment:');
  console.log(`   KV_REST_API_URL: ${url ? url.substring(0, 30) + '...' : 'NOT SET'}`);
  console.log(`   KV_REST_API_TOKEN: ${token ? '***' + token.slice(-8) : 'NOT SET'}`);
  
  if (!url || !token) {
    console.log('\n❌ Redis credentials missing!');
    return;
  }
  
  // Try @upstash/redis
  console.log('\n2. Testing @upstash/redis connection...');
  try {
    const { Redis } = require('@upstash/redis');
    const redis = new Redis({ url, token });
    
    // Test write
    const testKey = 'test:connection:' + Date.now();
    await redis.set(testKey, 'hello', { ex: 60 });
    console.log('   ✅ Write succeeded');
    
    // Test read
    const val = await redis.get(testKey);
    console.log(`   ✅ Read succeeded: ${val}`);
    
    // Test delete
    await redis.del(testKey);
    console.log('   ✅ Delete succeeded');
    
    // Check some existing keys
    console.log('\n3. Checking existing cache keys...');
    const keys = await redis.keys('wt:*');
    console.log(`   Found ${keys.length} keys with prefix 'wt:'`);
    
    const tireKeys = await redis.keys('tires:*');
    console.log(`   Found ${tireKeys.length} keys with prefix 'tires:'`);
    
    // Check TireWeb protection keys
    const twKeys = await redis.keys('tireweb:*');
    console.log(`   Found ${twKeys.length} keys with prefix 'tireweb:'`);
    
    console.log('\n✅ Redis is working!');
    
  } catch (err) {
    console.log(`   ❌ Error: ${err.message}`);
    console.log('\n❌ Redis connection failed!');
    console.log('   Full error:', err);
  }
}

main().catch(console.error);
