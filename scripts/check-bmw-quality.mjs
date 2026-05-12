import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { sql } from 'drizzle-orm';

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

const db = drizzle(pool);

async function check() {
  const results = await db.execute(sql`
    SELECT display_trim, modification_id, quality_tier, certification_status, certification_errors, source
    FROM vehicle_fitments 
    WHERE make ILIKE 'bmw' AND model ILIKE '3 series' AND year = 2007
  `);
  
  console.log('2007 BMW 3 Series quality/certification:');
  console.log(JSON.stringify(results.rows, null, 2));
  
  await pool.end();
  process.exit(0);
}

check().catch(e => {
  console.error(e);
  process.exit(1);
});
