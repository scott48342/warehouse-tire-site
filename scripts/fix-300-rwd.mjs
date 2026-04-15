import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { sql } from 'drizzle-orm';

const pool = new pg.Pool({ connectionString: process.env.POSTGRES_URL });
const db = drizzle(pool);

// Fix 300C RWD: Should be 18" or 20" (no 19")
console.log('Fixing chrysler-300c-rwd-1a19b06d...');
await db.execute(sql`
  UPDATE vehicle_fitments 
  SET 
    oem_tire_sizes = '["225/60R18","245/45R20"]',
    oem_wheel_sizes = '[{"diameter":18,"width":7.5,"offset":null,"tireSize":"225/60R18","axle":"both","isStock":true},{"diameter":20,"width":8,"offset":null,"tireSize":"245/45R20","axle":"both","isStock":true}]'
  WHERE modification_id = 'chrysler-300c-rwd-1a19b06d'
`);
console.log('✓ 300C RWD fixed: 18" or 20"');

// Verify
const verify = await db.execute(sql`
  SELECT modification_id, oem_tire_sizes 
  FROM vehicle_fitments 
  WHERE modification_id = 'chrysler-300c-rwd-1a19b06d'
`);
console.log('\nVerified:', verify.rows[0]);

await pool.end();
console.log('\nDone!');
