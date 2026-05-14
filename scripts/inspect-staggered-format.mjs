// Inspect staggered data format in DB
import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '../.env.local') });

async function main() {
  const pool = new pg.Pool({
    connectionString: process.env.POSTGRES_URL,
    ssl: { rejectUnauthorized: false }
  });

  // Sample staggered records
  console.log('📊 Sample staggered records (front/rear tire format):\n');
  
  const result = await pool.query(`
    SELECT id, year, make, model, display_trim, 
           oem_tire_sizes, oem_wheel_sizes,
           offset_min_mm, offset_max_mm
    FROM vehicle_fitments
    WHERE jsonb_typeof(oem_tire_sizes) = 'object' 
      AND oem_tire_sizes ? 'front'
    LIMIT 10
  `);

  for (const r of result.rows) {
    console.log(`${r.year} ${r.make} ${r.model} ${r.display_trim}`);
    console.log(`  tire_sizes: ${JSON.stringify(r.oem_tire_sizes)}`);
    console.log(`  wheel_sizes: ${JSON.stringify(r.oem_wheel_sizes)}`);
    console.log(`  offset: ${r.offset_min_mm} - ${r.offset_max_mm}`);
    console.log();
  }

  // Check schema for rear offset columns
  console.log('\n📋 Columns containing "offset" or "rear":');
  const cols = await pool.query(`
    SELECT column_name FROM information_schema.columns 
    WHERE table_name = 'vehicle_fitments' 
      AND (column_name LIKE '%offset%' OR column_name LIKE '%rear%')
  `);
  console.log(cols.rows.map(r => r.column_name).join(', ') || '(none found)');

  // Count records by tire size format
  console.log('\n📊 Records by tire size format:');
  
  const formatCounts = await pool.query(`
    SELECT 
      CASE 
        WHEN oem_tire_sizes IS NULL THEN 'null'
        WHEN jsonb_typeof(oem_tire_sizes) = 'array' THEN 'array'
        WHEN jsonb_typeof(oem_tire_sizes) = 'object' AND oem_tire_sizes ? 'front' THEN 'object_front_rear'
        WHEN jsonb_typeof(oem_tire_sizes) = 'object' THEN 'object_other'
        WHEN jsonb_typeof(oem_tire_sizes) = 'string' THEN 'string'
        ELSE 'other'
      END as format,
      COUNT(*) as count
    FROM vehicle_fitments
    GROUP BY 1
    ORDER BY count DESC
  `);
  
  for (const r of formatCounts.rows) {
    console.log(`  ${r.format}: ${r.count}`);
  }

  // Check records with staggered tire sizes but array wheel sizes
  console.log('\n📊 Records with front/rear tires but various wheel formats:');
  
  const wheelFormatCounts = await pool.query(`
    SELECT 
      CASE 
        WHEN oem_wheel_sizes IS NULL THEN 'null'
        WHEN jsonb_typeof(oem_wheel_sizes) = 'array' THEN 'array'
        WHEN jsonb_typeof(oem_wheel_sizes) = 'object' AND oem_wheel_sizes ? 'front' THEN 'object_front_rear'
        WHEN jsonb_typeof(oem_wheel_sizes) = 'object' THEN 'object_other'
        WHEN jsonb_typeof(oem_wheel_sizes) = 'string' THEN 'string'
        ELSE 'other'
      END as wheel_format,
      COUNT(*) as count
    FROM vehicle_fitments
    WHERE jsonb_typeof(oem_tire_sizes) = 'object' 
      AND oem_tire_sizes ? 'front'
    GROUP BY 1
    ORDER BY count DESC
  `);
  
  for (const r of wheelFormatCounts.rows) {
    console.log(`  ${r.wheel_format}: ${r.count}`);
  }

  // Now check: records with staggered tires but ARRAY wheel sizes (missing rear wheel data)
  console.log('\n📊 Staggered tires with ARRAY wheel sizes (likely missing rear wheel width):');
  
  const arrayWheelSample = await pool.query(`
    SELECT year, make, model, display_trim, 
           oem_tire_sizes, oem_wheel_sizes
    FROM vehicle_fitments
    WHERE jsonb_typeof(oem_tire_sizes) = 'object' 
      AND oem_tire_sizes ? 'front'
      AND jsonb_typeof(oem_wheel_sizes) = 'array'
    LIMIT 5
  `);
  
  for (const r of arrayWheelSample.rows) {
    console.log(`  ${r.year} ${r.make} ${r.model} ${r.display_trim}`);
    console.log(`    tires: ${JSON.stringify(r.oem_tire_sizes)}`);
    console.log(`    wheels: ${JSON.stringify(r.oem_wheel_sizes)}`);
  }

  // Count how many staggered records have NO rear wheel width info
  console.log('\n📊 Staggered records analysis:');
  
  const staggeredAnalysis = await pool.query(`
    WITH staggered AS (
      SELECT 
        id, year, make, model, display_trim,
        oem_tire_sizes, oem_wheel_sizes,
        CASE 
          WHEN jsonb_typeof(oem_wheel_sizes) = 'object' 
            AND oem_wheel_sizes ? 'rear'
            AND oem_wheel_sizes->>'rear' ~ '\\d+x\\d+'
          THEN true
          ELSE false
        END as has_rear_wheel_size
      FROM vehicle_fitments
      WHERE jsonb_typeof(oem_tire_sizes) = 'object' 
        AND oem_tire_sizes ? 'front'
    )
    SELECT 
      has_rear_wheel_size,
      COUNT(*) as count
    FROM staggered
    GROUP BY 1
  `);
  
  for (const r of staggeredAnalysis.rows) {
    const label = r.has_rear_wheel_size ? 'Has rear wheel size' : 'MISSING rear wheel size';
    console.log(`  ${label}: ${r.count}`);
  }

  await pool.end();
}

main();
