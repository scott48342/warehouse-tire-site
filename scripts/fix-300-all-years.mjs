import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { sql } from 'drizzle-orm';

const pool = new pg.Pool({ connectionString: process.env.POSTGRES_URL });
const db = drizzle(pool);

// First, let's see all Chrysler 300 models/trims
console.log('=== Current 300/300c structure ===\n');
const all = await db.execute(sql`
  SELECT DISTINCT year, model, raw_trim, modification_id
  FROM vehicle_fitments 
  WHERE make ILIKE 'chrysler' AND model ILIKE '%300%'
  ORDER BY year DESC, model, raw_trim
`);

const byYear = {};
for (const row of all.rows) {
  const key = row.year;
  if (!byYear[key]) byYear[key] = [];
  byYear[key].push({ model: row.model, trim: row.raw_trim, mod: row.modification_id });
}

for (const [year, items] of Object.entries(byYear).slice(0, 5)) {
  console.log(`${year}:`);
  for (const item of items) {
    console.log(`  ${item.model} | ${item.trim || '(base)'} | ${item.mod}`);
  }
  console.log('');
}

// Now fix all 300S trims across years (20" only)
console.log('\n=== Fixing 300S trims (20" only) ===');
const s_result = await db.execute(sql`
  UPDATE vehicle_fitments 
  SET 
    oem_tire_sizes = '["245/45R20"]',
    oem_wheel_sizes = '[{"diameter":20,"width":8,"offset":null,"tireSize":"245/45R20","axle":"both","isStock":true}]'
  WHERE make ILIKE 'chrysler' 
    AND model ILIKE '%300%' 
    AND raw_trim = '300S'
  RETURNING year, modification_id
`);
console.log(`Fixed ${s_result.rows.length} 300S records`);

// Fix all Limited trims across years (17" only)
console.log('\n=== Fixing Limited trims (17" only) ===');
const ltd_result = await db.execute(sql`
  UPDATE vehicle_fitments 
  SET 
    oem_tire_sizes = '["215/65R17"]',
    oem_wheel_sizes = '[{"diameter":17,"width":7,"offset":null,"tireSize":"215/65R17","axle":"both","isStock":true}]'
  WHERE make ILIKE 'chrysler' 
    AND model ILIKE '%300%' 
    AND raw_trim = 'Limited'
  RETURNING year, modification_id
`);
console.log(`Fixed ${ltd_result.rows.length} Limited records`);

// Fix all 300C RWD trims (18" or 20", no 19")
console.log('\n=== Fixing 300C RWD trims (18" or 20") ===');
const rwd_result = await db.execute(sql`
  UPDATE vehicle_fitments 
  SET 
    oem_tire_sizes = '["225/60R18","245/45R20"]',
    oem_wheel_sizes = '[{"diameter":18,"width":7.5,"offset":null,"tireSize":"225/60R18","axle":"both","isStock":true},{"diameter":20,"width":8,"offset":null,"tireSize":"245/45R20","axle":"both","isStock":true}]'
  WHERE make ILIKE 'chrysler' 
    AND model ILIKE '%300%' 
    AND raw_trim = 'RWD'
  RETURNING year, modification_id
`);
console.log(`Fixed ${rwd_result.rows.length} RWD records`);

// Fix all AWD trims (19" only)
console.log('\n=== Fixing AWD trims (19" only) ===');
const awd_result = await db.execute(sql`
  UPDATE vehicle_fitments 
  SET 
    oem_tire_sizes = '["235/55R19"]',
    oem_wheel_sizes = '[{"diameter":19,"width":7.5,"offset":null,"tireSize":"235/55R19","axle":"both","isStock":true}]'
  WHERE make ILIKE 'chrysler' 
    AND model ILIKE '%300%' 
    AND raw_trim = 'AWD'
  RETURNING year, modification_id
`);
console.log(`Fixed ${awd_result.rows.length} AWD records`);

await pool.end();
console.log('\n✅ All years fixed!');
