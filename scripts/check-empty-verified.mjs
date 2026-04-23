import pg from 'pg';
import { config } from 'dotenv';
config({ path: '.env.local' });
const { Pool } = pg;

const url = process.env.POSTGRES_URL;
const pool = new Pool({
  connectionString: url,
  ssl: url?.includes('neon') || url?.includes('prisma') ? { rejectUnauthorized: false } : undefined
});

async function main() {
  // Check empty records with verified sources
  console.log('=== EMPTY RECORDS FROM "VERIFIED" SOURCES ===\n');
  
  const empty = await pool.query(`
    SELECT year, make, model, raw_trim, source, quality_tier, created_at
    FROM vehicle_fitments 
    WHERE (oem_tire_sizes IS NULL OR oem_tire_sizes = '[]'::jsonb OR oem_tire_sizes = 'null'::jsonb)
      AND (oem_wheel_sizes IS NULL OR oem_wheel_sizes = '[]'::jsonb OR oem_wheel_sizes = 'null'::jsonb)
      AND source ILIKE '%verified%'
    ORDER BY year DESC, make, model
    LIMIT 30
  `);
  
  console.log(`Found ${empty.rows.length} empty "verified" records:\n`);
  for (const r of empty.rows) {
    console.log(`${r.year} ${r.make} ${r.model} ${r.raw_trim || ''} | src=${r.source} | tier=${r.quality_tier} | ${r.created_at?.toISOString().slice(0,10)}`);
  }
  
  // Count by source
  console.log('\n=== EMPTY RECORDS BY SOURCE ===');
  const bySrc = await pool.query(`
    SELECT source, COUNT(*) as cnt
    FROM vehicle_fitments 
    WHERE (oem_tire_sizes IS NULL OR oem_tire_sizes = '[]'::jsonb OR oem_tire_sizes = 'null'::jsonb)
      AND (oem_wheel_sizes IS NULL OR oem_wheel_sizes = '[]'::jsonb OR oem_wheel_sizes = 'null'::jsonb)
    GROUP BY source
    ORDER BY cnt DESC
    LIMIT 20
  `);
  for (const r of bySrc.rows) {
    console.log(`${r.source}: ${r.cnt}`);
  }

  // Check if these have OTHER data (bolt pattern, center bore, etc)
  console.log('\n=== DO EMPTY RECORDS HAVE OTHER DATA? ===');
  const hasOther = await pool.query(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN bolt_pattern IS NOT NULL AND bolt_pattern != '' THEN 1 ELSE 0 END) as has_bolt,
      SUM(CASE WHEN center_bore_mm IS NOT NULL THEN 1 ELSE 0 END) as has_bore,
      SUM(CASE WHEN thread_size IS NOT NULL AND thread_size != '' THEN 1 ELSE 0 END) as has_thread
    FROM vehicle_fitments 
    WHERE (oem_tire_sizes IS NULL OR oem_tire_sizes = '[]'::jsonb OR oem_tire_sizes = 'null'::jsonb)
      AND (oem_wheel_sizes IS NULL OR oem_wheel_sizes = '[]'::jsonb OR oem_wheel_sizes = 'null'::jsonb)
  `);
  const r = hasOther.rows[0];
  console.log(`Total empty: ${r.total}`);
  console.log(`Has bolt pattern: ${r.has_bolt}`);
  console.log(`Has center bore: ${r.has_bore}`);
  console.log(`Has thread size: ${r.has_thread}`);

  // Sample one with full data
  console.log('\n=== SAMPLE EMPTY RECORD (full data) ===');
  const sample = await pool.query(`
    SELECT *
    FROM vehicle_fitments 
    WHERE (oem_tire_sizes IS NULL OR oem_tire_sizes = '[]'::jsonb OR oem_tire_sizes = 'null'::jsonb)
      AND (oem_wheel_sizes IS NULL OR oem_wheel_sizes = '[]'::jsonb OR oem_wheel_sizes = 'null'::jsonb)
      AND bolt_pattern IS NOT NULL
    LIMIT 1
  `);
  if (sample.rows.length > 0) {
    console.log(JSON.stringify(sample.rows[0], null, 2));
  }

  await pool.end();
}

main().catch(console.error);
