import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import pg from 'pg';
const { Pool } = pg;

async function main() {
  const pool = new Pool({
    connectionString: process.env.POSTGRES_URL,
    max: 3,
    ssl: { rejectUnauthorized: false },
  });
  
  console.log('=== TireWeb Connections ===');
  const { rows } = await pool.query(`
    SELECT provider, connection_id, enabled, created_at 
    FROM tireweb_connections 
    ORDER BY provider
  `);
  
  console.log('Connections:', rows.length);
  rows.forEach(r => console.log(`  ${r.provider}: conn_id=${r.connection_id}, enabled=${r.enabled}`));
  
  console.log('\n=== Env Vars ===');
  console.log('TIREWEB_ACCESS_KEY:', process.env.TIREWEB_ACCESS_KEY ? '✓ set' : '✗ missing');
  console.log('TIREWEB_GROUP_TOKEN:', process.env.TIREWEB_GROUP_TOKEN ? '✓ set' : '✗ missing');
  console.log('TIREWIRE_ACCESS_KEY:', process.env.TIREWIRE_ACCESS_KEY ? '✓ set' : '✗ missing');
  console.log('TIREWIRE_GROUP_TOKEN:', process.env.TIREWIRE_GROUP_TOKEN ? '✓ set' : '✗ missing');
  
  await pool.end();
}

main().catch(console.error);
