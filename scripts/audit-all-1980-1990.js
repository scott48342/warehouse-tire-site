require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  const client = await pool.connect();
  try {
    // Check vehicle_fitments table for 1980-1990
    const vfResult = await client.query(`
      SELECT 
        year, make, model, display_trim, modification_id,
        bolt_pattern, center_bore_mm,
        oem_wheel_sizes, oem_tire_sizes,
        offset_min_mm, offset_max_mm,
        quality_tier, confidence_tag
      FROM vehicle_fitments
      WHERE year >= 1980 AND year <= 1990
      ORDER BY make, model, year, display_trim
    `);
    
    console.log('=== vehicle_fitments table (1980-1990) ===');
    console.log('Total records:', vfResult.rows.length);
    
    if (vfResult.rows.length > 0) {
      const byMake = {};
      vfResult.rows.forEach(v => {
        byMake[v.make] = (byMake[v.make] || 0) + 1;
      });
      console.log('\nBy make:');
      Object.entries(byMake).sort((a,b) => b[1] - a[1]).forEach(([make, count]) => {
        console.log('  ' + make + ': ' + count);
      });
      
      console.log('\n--- All Records ---');
      vfResult.rows.forEach(v => {
        const wheels = v.oem_wheel_sizes ? JSON.stringify(v.oem_wheel_sizes) : 'N/A';
        const tires = v.oem_tire_sizes ? (Array.isArray(v.oem_tire_sizes) ? v.oem_tire_sizes.slice(0,2).join(', ') : v.oem_tire_sizes) : 'N/A';
        console.log(`${v.year} ${v.make} ${v.model} ${v.display_trim || ''} | bolt: ${v.bolt_pattern} | hub: ${v.center_bore_mm}mm | offset: ${v.offset_min_mm}-${v.offset_max_mm} | wheels: ${wheels} | tires: ${tires} | ${v.quality_tier || ''}/${v.confidence_tag || ''}`);
      });
    }
    
    // Also check classic_fitments
    console.log('\n\n=== classic_fitments table (covering 1980-1990) ===');
    const cfResult = await client.query(`
      SELECT 
        make, model, year_start, year_end,
        common_bolt_pattern, common_center_bore,
        rec_wheel_diameter_min, rec_wheel_diameter_max,
        rec_offset_min_mm, rec_offset_max_mm,
        stock_wheel_diameter, stock_tire_size,
        fitment_level, confidence
      FROM classic_fitments
      WHERE year_start <= 1990 AND year_end >= 1980
        AND is_active = true
      ORDER BY make, model, year_start
    `);
    
    console.log('Total records:', cfResult.rows.length);
    cfResult.rows.forEach(v => {
      const years = v.year_start === v.year_end ? v.year_start : `${v.year_start}-${v.year_end}`;
      console.log(`${years} ${v.make} ${v.model} | bolt: ${v.common_bolt_pattern} | hub: ${v.common_center_bore}mm | offset: ${v.rec_offset_min_mm}-${v.rec_offset_max_mm} | wheels: ${v.rec_wheel_diameter_min}-${v.rec_wheel_diameter_max}" | stock: ${v.stock_wheel_diameter}" | tire: ${v.stock_tire_size} | ${v.fitment_level}/${v.confidence}`);
    });
    
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(console.error);
