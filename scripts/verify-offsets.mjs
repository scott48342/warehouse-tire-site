import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

// Check remaining nulls for our makes
const remaining = await pool.query(`
  SELECT make, model, MIN(year) year_from, MAX(year) year_to, COUNT(*) cnt
  FROM vehicle_fitments
  WHERE (offset_min_mm IS NULL OR offset_max_mm IS NULL)
    AND LOWER(make) IN ('ford','lincoln','mercury','jeep','ram','dodge','chrysler','plymouth')
  GROUP BY make, model
  ORDER BY make, model
`);

console.log('\n=== REMAINING NULL OFFSETS ===');
console.log(`Total remaining groups: ${remaining.rows.length}`);
if (remaining.rows.length > 0) {
  for (const r of remaining.rows) {
    console.log(`  ${r.make} ${r.model} (${r.year_from}-${r.year_to}): ${r.cnt} rows`);
  }
}

// Check total updated
const stats = await pool.query(`
  SELECT make, COUNT(*) total,
    SUM(CASE WHEN offset_min_mm IS NOT NULL AND offset_max_mm IS NOT NULL THEN 1 ELSE 0 END) has_offset,
    SUM(CASE WHEN offset_min_mm IS NULL OR offset_max_mm IS NULL THEN 1 ELSE 0 END) null_offset
  FROM vehicle_fitments
  WHERE LOWER(make) IN ('ford','lincoln','mercury','jeep','ram','dodge','chrysler','plymouth')
  GROUP BY make
  ORDER BY make
`);

console.log('\n=== COVERAGE BY MAKE ===');
let totalRows = 0, totalFixed = 0, totalNull = 0;
for (const r of stats.rows) {
  const pct = ((r.has_offset / r.total) * 100).toFixed(1);
  console.log(`  ${r.make}: ${r.has_offset}/${r.total} rows have offsets (${pct}%), ${r.null_offset} still null`);
  totalRows += parseInt(r.total);
  totalFixed += parseInt(r.has_offset);
  totalNull += parseInt(r.null_offset);
}
console.log(`\n  TOTAL: ${totalFixed}/${totalRows} (${((totalFixed/totalRows)*100).toFixed(1)}%), ${totalNull} still null`);

await pool.end();
