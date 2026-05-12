import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { sql } from 'drizzle-orm';

const { Pool } = pg;

const connStr = process.env.POSTGRES_URL;
const pool = new Pool({
  connectionString: connStr,
  ssl: { rejectUnauthorized: false }
});

const db = drizzle(pool);

async function fixArmadaHubBore() {
  // Check current values
  const before = await db.execute(sql`
    SELECT DISTINCT year, center_bore_mm 
    FROM vehicle_fitments 
    WHERE make ILIKE 'nissan' AND model ILIKE 'armada'
    ORDER BY year
  `);
  
  console.log('Current Armada center bore values:');
  console.log(before.rows);
  
  // Update all Armada center bores to 77.8
  const result = await db.execute(sql`
    UPDATE vehicle_fitments 
    SET center_bore_mm = 77.8
    WHERE make ILIKE 'nissan' AND model ILIKE 'armada'
  `);
  
  console.log('\nUpdated Armada records to center bore 77.8mm');
  console.log('Rows affected:', result.rowCount);
  
  await pool.end();
  process.exit(0);
}

fixArmadaHubBore().catch(e => {
  console.error(e);
  process.exit(1);
});
