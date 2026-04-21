import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function main() {
  const url = process.env.UPSTASH_REDIS_REST_URL!;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN!;
  
  console.log('Attempting FLUSHDB...');
  
  try {
    const response = await fetch(`${url}/flushdb`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    const data = await response.json();
    console.log('Result:', JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Error:', err);
  }
}

main();
