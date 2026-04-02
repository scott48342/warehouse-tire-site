const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });
const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

async function main() {
  // Check all batch2v2 and batch3 records for completeness
  const batches = await pool.query(`
    SELECT 
      source,
      COUNT(*) as total,
      COUNT(CASE WHEN submodel IS NULL THEN 1 END) as null_submodel,
      COUNT(CASE WHEN display_trim IS NULL OR display_trim = '' THEN 1 END) as missing_trim,
      COUNT(CASE WHEN bolt_pattern IS NULL THEN 1 END) as missing_bolt,
      COUNT(CASE WHEN center_bore_mm IS NULL THEN 1 END) as missing_cb,
      COUNT(CASE WHEN oem_wheel_sizes IS NULL OR oem_wheel_sizes = '[]' THEN 1 END) as missing_wheels,
      COUNT(CASE WHEN oem_tire_sizes IS NULL OR oem_tire_sizes = '[]' THEN 1 END) as missing_tires,
      COUNT(CASE WHEN thread_size IS NULL THEN 1 END) as missing_thread,
      COUNT(CASE WHEN offset_min_mm IS NULL THEN 1 END) as missing_offset
    FROM vehicle_fitments
    WHERE source IN ('batch2v2-trim-groups', 'batch3-sports-cars')
    GROUP BY source
  `);
  
  console.log('═'.repeat(70));
  console.log('BATCH DATA QUALITY CHECK');
  console.log('═'.repeat(70));
  
  batches.rows.forEach(r => {
    console.log(`\n${r.source}:`);
    console.log(`  Total records: ${r.total}`);
    console.log(`  Null submodel: ${r.null_submodel} (expected - we use display_trim instead)`);
    console.log(`  Missing display_trim: ${r.missing_trim}`);
    console.log(`  Missing bolt_pattern: ${r.missing_bolt}`);
    console.log(`  Missing center_bore: ${r.missing_cb}`);
    console.log(`  Missing wheels: ${r.missing_wheels}`);
    console.log(`  Missing tires: ${r.missing_tires}`);
    console.log(`  Missing thread_size: ${r.missing_thread}`);
    console.log(`  Missing offset: ${r.missing_offset}`);
  });
  
  // Sample records to verify format
  console.log('\n' + '═'.repeat(70));
  console.log('SAMPLE RECORDS');
  console.log('═'.repeat(70));
  
  const samples = await pool.query(`
    SELECT year, make, model, display_trim, submodel, bolt_pattern, 
           center_bore_mm, offset_min_mm, offset_max_mm, thread_size,
           oem_wheel_sizes, oem_tire_sizes
    FROM vehicle_fitments
    WHERE source IN ('batch2v2-trim-groups', 'batch3-sports-cars')
    ORDER BY RANDOM()
    LIMIT 5
  `);
  
  samples.rows.forEach((r, i) => {
    console.log(`\n${i+1}. ${r.year} ${r.make} ${r.model} - ${r.display_trim}`);
    console.log(`   Submodel: ${r.submodel}`);
    console.log(`   Bolt: ${r.bolt_pattern}, CB: ${r.center_bore_mm}mm`);
    console.log(`   Offset: ${r.offset_min_mm}-${r.offset_max_mm}mm`);
    console.log(`   Thread: ${r.thread_size}`);
    console.log(`   Wheels: ${JSON.stringify(r.oem_wheel_sizes)}`);
    console.log(`   Tires: ${JSON.stringify(r.oem_tire_sizes)}`);
  });
  
  await pool.end();
}

main().catch(console.error);
