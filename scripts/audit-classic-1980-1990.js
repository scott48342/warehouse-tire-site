require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  const client = await pool.connect();
  try {
    // Get all classic fitments that cover years 1980-1990
    const result = await client.query(`
      SELECT 
        make, model, year_start, year_end, 
        common_bolt_pattern as bolt_pattern,
        common_center_bore as center_bore_mm,
        rec_wheel_diameter_min, rec_wheel_diameter_max,
        stock_wheel_diameter, stock_tire_size,
        fitment_level, confidence, platform_name
      FROM classic_fitments
      WHERE year_start <= 1990 AND year_end >= 1980
        AND is_active = true
      ORDER BY make, model, year_start
    `);
    
    const vehicles = result.rows;
    console.log('Total classic fitment records covering 1980-1990:', vehicles.length);
    
    console.log('\nBy make:');
    const byMake = {};
    vehicles.forEach(v => {
      byMake[v.make] = (byMake[v.make] || 0) + 1;
    });
    Object.entries(byMake).sort((a,b) => b[1] - a[1]).forEach(([make, count]) => {
      console.log('  ' + make + ': ' + count);
    });
    
    console.log('\n--- All Records ---');
    vehicles.forEach(v => {
      const years = v.year_start === v.year_end ? v.year_start : `${v.year_start}-${v.year_end}`;
      const diameters = v.rec_wheel_diameter_min === v.rec_wheel_diameter_max 
        ? v.rec_wheel_diameter_min + '"'
        : `${v.rec_wheel_diameter_min}-${v.rec_wheel_diameter_max}"`;
      console.log(`${years} ${v.make} ${v.model} | bolt: ${v.bolt_pattern} | hub: ${v.center_bore_mm}mm | wheels: ${diameters} | stock: ${v.stock_wheel_diameter}" | tire: ${v.stock_tire_size} | ${v.fitment_level}/${v.confidence}`);
    });
    
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(console.error);
