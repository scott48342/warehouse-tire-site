import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env.local
const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
const match = envContent.match(/POSTGRES_URL="([^"]+)"/);
const connectionString = match ? match[1] : process.env.POSTGRES_URL;

const { Pool } = pg;

const pool = new Pool({
  connectionString,
});

async function checkDRWWheels() {
  console.log('=== DRW WHEEL OFFSET DISTRIBUTION (8x180 bolt pattern) ===\n');
  
  // Get offset distribution
  const offsetDist = await pool.query(`
    SELECT 
      CASE 
        WHEN "offset"::numeric < -150 THEN 'DRW Outer Extreme (<-150)'
        WHEN "offset"::numeric >= -150 AND "offset"::numeric < -50 THEN 'DRW Outer (-150 to -50)'
        WHEN "offset"::numeric >= -50 AND "offset"::numeric < 0 THEN 'Negative (-50 to 0)'
        WHEN "offset"::numeric >= 0 AND "offset"::numeric < 50 THEN 'Mild (0 to 50)'
        WHEN "offset"::numeric >= 50 AND "offset"::numeric < 100 THEN 'High (50 to 100)'
        WHEN "offset"::numeric >= 100 THEN 'DRW Inner/Front (100+)'
        ELSE 'Unknown'
      END as offset_range,
      COUNT(*)::int as count,
      MIN("offset"::numeric)::int as min_offset,
      MAX("offset"::numeric)::int as max_offset
    FROM techfeed_wheels
    WHERE bolt_pattern_metric = '8x180'
    GROUP BY 1
    ORDER BY min_offset
  `);
  
  console.log('Offset Distribution:');
  offsetDist.rows.forEach(row => {
    console.log(`  ${row.offset_range}: ${row.count} wheels (${row.min_offset} to ${row.max_offset})`);
  });
  
  // Get sample DRW-specific wheels (extreme offsets)
  console.log('\n=== SAMPLE DRW WHEELS (offset < -100 or > 100) ===\n');
  
  const drwWheels = await pool.query(`
    SELECT sku, style_description, "offset"::int, diameter::int, width::numeric as width
    FROM techfeed_wheels
    WHERE bolt_pattern_metric = '8x180'
      AND ("offset"::numeric < -100 OR "offset"::numeric > 100)
    ORDER BY "offset"::numeric
    LIMIT 20
  `);
  
  drwWheels.rows.forEach(w => {
    console.log(`  ${String(w.offset).padStart(5)} | ${w.sku} | ${w.diameter}x${w.width} | ${w.style_description?.substring(0,40)}`);
  });
  
  // Check for position indicators in style names
  console.log('\n=== WHEELS WITH DRW/DUALLY IN NAME ===\n');
  
  const positionWheels = await pool.query(`
    SELECT sku, style_description, "offset"::int, bolt_pattern_metric
    FROM techfeed_wheels
    WHERE (style_description ILIKE '%DRW%' OR style_description ILIKE '%DUALLY%')
    ORDER BY "offset"::numeric
    LIMIT 30
  `);
  
  positionWheels.rows.forEach(w => {
    console.log(`  ${String(w.offset).padStart(5)} | ${w.bolt_pattern_metric} | ${w.sku} | ${w.style_description?.substring(0,45)}`);
  });
  
  await pool.end();
}

checkDRWWheels().catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});
