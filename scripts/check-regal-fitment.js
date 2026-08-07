require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });

async function main() {
  const client = await pool.connect();
  try {
    // Get Buick Regal fitment data
    const result = await client.query(`
      SELECT 
        year, make, model, display_trim, modification_id,
        bolt_pattern, center_bore_mm, thread_size, seat_type,
        offset_min_mm, offset_max_mm,
        oem_wheel_sizes, oem_tire_sizes,
        quality_tier, confidence_tag
      FROM vehicle_fitments
      WHERE make ILIKE 'Buick' AND model ILIKE '%Regal%'
        AND year >= 1980 AND year <= 1990
      ORDER BY year
    `);
    
    console.log('=== Buick Regal Fitment Data (1980-1990) ===\n');
    result.rows.forEach(r => {
      console.log(`${r.year} ${r.make} ${r.model} ${r.display_trim || 'Base'}`);
      console.log(`  modification_id: ${r.modification_id}`);
      console.log(`  bolt_pattern: ${r.bolt_pattern}`);
      console.log(`  center_bore_mm: ${r.center_bore_mm}`);
      console.log(`  thread_size: ${r.thread_size}`);
      console.log(`  seat_type: ${r.seat_type}`);
      console.log(`  offset_range: ${r.offset_min_mm} to ${r.offset_max_mm}mm`);
      console.log(`  oem_wheel_sizes: ${JSON.stringify(r.oem_wheel_sizes)}`);
      console.log(`  oem_tire_sizes: ${JSON.stringify(r.oem_tire_sizes)}`);
      console.log(`  quality: ${r.quality_tier} / ${r.confidence_tag}`);
      console.log('');
    });
  } finally {
    client.release();
    await pool.end();
  }
}
main();
