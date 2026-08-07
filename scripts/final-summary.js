require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });

async function main() {
  const client = await pool.connect();
  try {
    // Total count
    const total = await client.query(`
      SELECT COUNT(*) as cnt FROM vehicle_fitments WHERE year >= 1980 AND year <= 1990
    `);
    
    // By make
    const byMake = await client.query(`
      SELECT make, COUNT(*) as cnt, COUNT(DISTINCT model) as models
      FROM vehicle_fitments WHERE year >= 1980 AND year <= 1990
      GROUP BY make ORDER BY cnt DESC
    `);
    
    // Data quality
    const quality = await client.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE bolt_pattern IS NOT NULL AND bolt_pattern != '') as has_bolt,
        COUNT(*) FILTER (WHERE center_bore_mm IS NOT NULL) as has_hub,
        COUNT(*) FILTER (WHERE offset_min_mm IS NOT NULL) as has_offset,
        COUNT(*) FILTER (WHERE oem_tire_sizes IS NOT NULL AND oem_tire_sizes::text != '[]') as has_tires
      FROM vehicle_fitments WHERE year >= 1980 AND year <= 1990
    `);
    
    console.log('=== FINAL CLASSIC VEHICLE SUMMARY (1980-1990) ===\n');
    console.log(`TOTAL RECORDS: ${total.rows[0].cnt}\n`);
    
    console.log('BY MAKE:');
    console.log('Make                    | Records | Models');
    console.log('------------------------|---------|-------');
    byMake.rows.forEach(r => {
      console.log(`${r.make.padEnd(23)} | ${String(r.cnt).padStart(7)} | ${String(r.models).padStart(5)}`);
    });
    
    const q = quality.rows[0];
    console.log('\n\nDATA QUALITY:');
    console.log(`  bolt_pattern:    ${q.has_bolt}/${q.total} (${(q.has_bolt/q.total*100).toFixed(1)}%)`);
    console.log(`  center_bore_mm:  ${q.has_hub}/${q.total} (${(q.has_hub/q.total*100).toFixed(1)}%)`);
    console.log(`  offset range:    ${q.has_offset}/${q.total} (${(q.has_offset/q.total*100).toFixed(1)}%)`);
    console.log(`  oem_tire_sizes:  ${q.has_tires}/${q.total} (${(q.has_tires/q.total*100).toFixed(1)}%)`);
    
  } finally {
    client.release();
    await pool.end();
  }
}
main();
