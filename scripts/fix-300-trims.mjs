import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { sql } from 'drizzle-orm';

const pool = new pg.Pool({ connectionString: process.env.POSTGRES_URL });
const db = drizzle(pool);

// Fix 300S: 20" only
console.log('Fixing chrysler-300-300s-57432462 (300S → 20" only)...');
await db.execute(sql`
  UPDATE vehicle_fitments 
  SET 
    oem_tire_sizes = '["245/45R20"]',
    oem_wheel_sizes = '[{"diameter":20,"width":8,"offset":null,"tireSize":"245/45R20","axle":"both","isStock":true}]'
  WHERE modification_id = 'chrysler-300-300s-57432462'
`);
console.log('✓ 300S fixed: 20" only');

// Fix Limited: 17" only  
console.log('Fixing chrysler-300-limited-a5e41491 (Limited → 17" only)...');
await db.execute(sql`
  UPDATE vehicle_fitments 
  SET 
    oem_tire_sizes = '["215/65R17"]',
    oem_wheel_sizes = '[{"diameter":17,"width":7,"offset":null,"tireSize":"215/65R17","axle":"both","isStock":true}]'
  WHERE modification_id = 'chrysler-300-limited-a5e41491'
`);
console.log('✓ Limited fixed: 17" only');

// Verify both
const verify = await db.execute(sql`
  SELECT modification_id, raw_trim, oem_tire_sizes 
  FROM vehicle_fitments 
  WHERE modification_id IN ('chrysler-300-300s-57432462', 'chrysler-300-limited-a5e41491')
`);
console.log('\nVerified:');
for (const row of verify.rows) {
  console.log(`  ${row.raw_trim}: ${row.oem_tire_sizes}`);
}

await pool.end();
console.log('\nDone!');
