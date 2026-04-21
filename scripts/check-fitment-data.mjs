import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '../.env.local') });

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

try {
  // Get recent additions
  const recent = await pool.query(`
    SELECT year, make, model, display_trim, bolt_pattern, center_bore_mm, 
           offset_min_mm, offset_max_mm, oem_wheel_sizes, oem_tire_sizes, source,
           created_at
    FROM vehicle_fitments 
    ORDER BY created_at DESC 
    LIMIT 20
  `);
  console.log('=== RECENT VEHICLE FITMENTS ===');
  recent.rows.forEach(r => {
    const wheels = r.oem_wheel_sizes || [];
    const tires = r.oem_tire_sizes || [];
    console.log(`${r.year} ${r.make} ${r.model} - ${r.display_trim}`);
    console.log(`  Bolt: ${r.bolt_pattern}, Hub: ${r.center_bore_mm}mm, Offset: ${r.offset_min_mm}-${r.offset_max_mm}mm`);
    console.log(`  Wheels: ${JSON.stringify(wheels).substring(0,120)}`);
    console.log(`  Tires: ${JSON.stringify(tires).substring(0,100)}`);
    console.log(`  Source: ${r.source}, Added: ${r.created_at}`);
    console.log('');
  });
  
  // Count records with missing data
  const missing = await pool.query(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN bolt_pattern IS NULL OR bolt_pattern = '' THEN 1 ELSE 0 END) as missing_bolt,
      SUM(CASE WHEN center_bore_mm IS NULL THEN 1 ELSE 0 END) as missing_hub,
      SUM(CASE WHEN offset_min_mm IS NULL THEN 1 ELSE 0 END) as missing_offset,
      SUM(CASE WHEN oem_wheel_sizes = '[]'::jsonb OR oem_wheel_sizes IS NULL THEN 1 ELSE 0 END) as empty_wheels,
      SUM(CASE WHEN oem_tire_sizes = '[]'::jsonb OR oem_tire_sizes IS NULL THEN 1 ELSE 0 END) as empty_tires
    FROM vehicle_fitments
  `);
  console.log('=== DATA COMPLETENESS ===');
  console.log(missing.rows[0]);
  
  // Get unique sources
  const sources = await pool.query(`
    SELECT source, COUNT(*) as count 
    FROM vehicle_fitments 
    GROUP BY source 
    ORDER BY count DESC
  `);
  console.log('\n=== SOURCES ===');
  sources.rows.forEach(s => console.log(`  ${s.source}: ${s.count}`));
  
} finally {
  pool.end();
}
