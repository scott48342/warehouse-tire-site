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
  console.log('=== FITMENT DATA AUDIT ===\n');

  // Total records
  const total = await pool.query(`SELECT COUNT(*) as cnt FROM vehicle_fitments`);
  console.log(`Total fitments: ${total.rows[0].cnt}`);

  // Check schema to understand tire/wheel columns
  console.log('\n=== Schema (tire/wheel columns) ===');
  const schema = await pool.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'vehicle_fitments'
      AND (column_name LIKE '%tire%' OR column_name LIKE '%wheel%' OR column_name LIKE '%oem%')
    ORDER BY ordinal_position
  `);
  for (const col of schema.rows) {
    console.log(`${col.column_name}: ${col.data_type}`);
  }

  // Sample record to understand structure
  console.log('\n=== Sample Record ===');
  const sample = await pool.query(`
    SELECT id, year, make, model, raw_trim, oem_wheel_sizes, oem_tire_sizes, source, quality_tier
    FROM vehicle_fitments 
    LIMIT 1
  `);
  console.log(JSON.stringify(sample.rows[0], null, 2));

  // Check oem_tire_sizes structure
  console.log('\n=== OEM Tire Sizes Sample (5 records) ===');
  const tireSamples = await pool.query(`
    SELECT year, make, model, oem_tire_sizes 
    FROM vehicle_fitments 
    WHERE oem_tire_sizes IS NOT NULL AND oem_tire_sizes != '[]'::jsonb AND oem_tire_sizes != 'null'::jsonb
    LIMIT 5
  `);
  for (const r of tireSamples.rows) {
    console.log(`${r.year} ${r.make} ${r.model}: ${JSON.stringify(r.oem_tire_sizes)}`);
  }

  // Check oem_wheel_sizes structure
  console.log('\n=== OEM Wheel Sizes Sample (5 records) ===');
  const wheelSamples = await pool.query(`
    SELECT year, make, model, oem_wheel_sizes 
    FROM vehicle_fitments 
    WHERE oem_wheel_sizes IS NOT NULL AND oem_wheel_sizes != '[]'::jsonb AND oem_wheel_sizes != 'null'::jsonb
    LIMIT 5
  `);
  for (const r of wheelSamples.rows) {
    console.log(`${r.year} ${r.make} ${r.model}: ${JSON.stringify(r.oem_wheel_sizes)}`);
  }

  // PHASE 1: Count invalid records
  console.log('\n=== PHASE 1: INVALID DATA COUNTS ===');
  
  const emptyTires = await pool.query(`
    SELECT COUNT(*) as cnt FROM vehicle_fitments 
    WHERE oem_tire_sizes IS NULL OR oem_tire_sizes = '[]'::jsonb OR oem_tire_sizes = 'null'::jsonb
  `);
  console.log(`Records with empty tire_sizes: ${emptyTires.rows[0].cnt}`);

  const emptyWheels = await pool.query(`
    SELECT COUNT(*) as cnt FROM vehicle_fitments 
    WHERE oem_wheel_sizes IS NULL OR oem_wheel_sizes = '[]'::jsonb OR oem_wheel_sizes = 'null'::jsonb
  `);
  console.log(`Records with empty wheel_sizes: ${emptyWheels.rows[0].cnt}`);

  const bothEmpty = await pool.query(`
    SELECT COUNT(*) as cnt FROM vehicle_fitments 
    WHERE (oem_tire_sizes IS NULL OR oem_tire_sizes = '[]'::jsonb OR oem_tire_sizes = 'null'::jsonb)
      AND (oem_wheel_sizes IS NULL OR oem_wheel_sizes = '[]'::jsonb OR oem_wheel_sizes = 'null'::jsonb)
  `);
  console.log(`Records with BOTH empty: ${bothEmpty.rows[0].cnt}`);

  // Check source distribution
  console.log('\n=== SOURCE DISTRIBUTION ===');
  const sources = await pool.query(`
    SELECT source, quality_tier, COUNT(*) as cnt
    FROM vehicle_fitments 
    GROUP BY source, quality_tier
    ORDER BY cnt DESC
  `);
  for (const r of sources.rows) {
    console.log(`${r.source || '(null)'} | tier=${r.quality_tier || '(null)'} | ${r.cnt}`);
  }

  // Check for malformed tire sizes
  console.log('\n=== CHECKING FOR MALFORMED TIRE SIZES ===');
  const allTires = await pool.query(`
    SELECT id, oem_tire_sizes 
    FROM vehicle_fitments 
    WHERE oem_tire_sizes IS NOT NULL AND oem_tire_sizes != '[]'::jsonb AND oem_tire_sizes != 'null'::jsonb
    LIMIT 100
  `);
  
  let malformedCount = 0;
  let smallDiameter = 0;
  let largeDiameter = 0;
  
  for (const r of allTires.rows) {
    const sizes = r.oem_tire_sizes;
    if (Array.isArray(sizes)) {
      for (const size of sizes) {
        // Try to extract diameter from tire size string (e.g., "225/65R17" -> 17)
        const sizeStr = typeof size === 'string' ? size : (size?.size || size?.tireSize || '');
        const match = sizeStr.match(/R(\d+)/i);
        if (match) {
          const diameter = parseInt(match[1]);
          if (diameter < 13) smallDiameter++;
          if (diameter > 40) largeDiameter++;
        } else if (sizeStr && !sizeStr.match(/^\d+\/\d+R\d+/i)) {
          malformedCount++;
        }
      }
    }
  }
  console.log(`Malformed tire sizes (sample of 100): ${malformedCount}`);
  console.log(`Tire diameter < 13: ${smallDiameter}`);
  console.log(`Tire diameter > 40: ${largeDiameter}`);

  await pool.end();
}

main().catch(console.error);
