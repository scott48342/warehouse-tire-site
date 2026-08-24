import pg from 'pg';
import { config } from 'dotenv';
config({ path: '.env.local' });

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  const result = await pool.query(`
    SELECT id, user_id, name, saved_at, 
           snapshot_json->'items' as items,
           snapshot_json->'vehicle' as vehicle,
           snapshot_json->'pricing' as pricing
    FROM saved_quotes 
    WHERE user_id = 'dbfb5182-485b-4a4f-a29b-5759da2519a9'
    ORDER BY saved_at DESC
  `);
  
  console.log('Saved quotes for test user:');
  result.rows.forEach(row => {
    console.log('ID:', row.id);
    console.log('Saved at:', row.saved_at);
    console.log('Vehicle:', JSON.stringify(row.vehicle, null, 2));
    console.log('Items count:', row.items?.length);
    console.log('Pricing total:', row.pricing?.total);
    console.log('---');
  });
  
  await pool.end();
}

main().catch(console.error);
