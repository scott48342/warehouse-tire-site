require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });

// Spot check popular classics
const vehicles = [
  { year: 1984, make: 'Buick', model: 'Regal' },
  { year: 1985, make: 'Chevrolet', model: 'Camaro' },
  { year: 1987, make: 'Buick', model: 'Grand National' },
  { year: 1985, make: 'Chevrolet', model: 'C10' },
  { year: 1985, make: 'Ford', model: 'Mustang' },
  { year: 1986, make: 'Pontiac', model: 'Firebird' },
  { year: 1985, make: 'Chevrolet', model: 'Corvette' },
  { year: 1988, make: 'Ford', model: 'F-150' },
  { year: 1985, make: 'Jeep', model: 'CJ-7' },
  { year: 1990, make: 'Ford', model: 'Bronco' },
];

async function main() {
  const client = await pool.connect();
  try {
    console.log('=== CLASSIC VEHICLE FITMENT SPOT CHECK ===\n');
    console.log('Vehicle                          | Bolt      | Hub   | Lugs      | Offset      | Wheels        | Quality');
    console.log('---------------------------------|-----------|-------|-----------|-------------|---------------|--------');
    
    for (const v of vehicles) {
      const result = await client.query(`
        SELECT 
          year, make, model, display_trim,
          bolt_pattern, center_bore_mm, thread_size, seat_type,
          offset_min_mm, offset_max_mm,
          oem_wheel_sizes, oem_tire_sizes,
          quality_tier, confidence_tag
        FROM vehicle_fitments
        WHERE year = $1 AND make ILIKE $2 AND model ILIKE $3
        LIMIT 1
      `, [v.year, v.make, v.model]);
      
      if (result.rows.length === 0) {
        console.log(`${v.year} ${v.make} ${v.model}`.padEnd(32) + ' | NOT FOUND');
        continue;
      }
      
      const r = result.rows[0];
      const name = `${r.year} ${r.make} ${r.model}`.substring(0, 32).padEnd(32);
      const bolt = (r.bolt_pattern || 'N/A').padEnd(9);
      const hub = (r.center_bore_mm ? r.center_bore_mm + 'mm' : 'N/A').padEnd(5);
      const lugs = (r.thread_size || 'N/A').padEnd(9);
      const offset = r.offset_min_mm !== null ? `${r.offset_min_mm}-${r.offset_max_mm}`.padEnd(11) : 'N/A'.padEnd(11);
      
      // Extract wheel diameters
      let wheels = 'N/A';
      if (r.oem_wheel_sizes) {
        const sizes = Array.isArray(r.oem_wheel_sizes) ? r.oem_wheel_sizes : [];
        const diams = [...new Set(sizes.map(s => s.diameter || (typeof s === 'string' ? parseInt(s) : null)).filter(Boolean))];
        wheels = diams.length > 0 ? diams.join(', ') + '"' : 'N/A';
      }
      wheels = wheels.padEnd(13);
      
      const quality = `${r.quality_tier || '?'}/${r.confidence_tag || '?'}`;
      
      console.log(`${name} | ${bolt} | ${hub} | ${lugs} | ${offset} | ${wheels} | ${quality}`);
    }
    
    // Check for missing critical fields
    console.log('\n\n=== MISSING CRITICAL FIELDS (1980-1990) ===\n');
    
    const missing = await client.query(`
      SELECT 
        COUNT(*) FILTER (WHERE bolt_pattern IS NULL OR bolt_pattern = '') as missing_bolt,
        COUNT(*) FILTER (WHERE center_bore_mm IS NULL) as missing_hub,
        COUNT(*) FILTER (WHERE thread_size IS NULL OR thread_size = '') as missing_thread,
        COUNT(*) FILTER (WHERE seat_type IS NULL OR seat_type = '') as missing_seat,
        COUNT(*) FILTER (WHERE offset_min_mm IS NULL) as missing_offset,
        COUNT(*) FILTER (WHERE oem_wheel_sizes IS NULL OR oem_wheel_sizes::text = '[]' OR oem_wheel_sizes::text = 'null') as missing_wheels,
        COUNT(*) FILTER (WHERE oem_tire_sizes IS NULL OR oem_tire_sizes::text = '[]' OR oem_tire_sizes::text = 'null') as missing_tires,
        COUNT(*) as total
      FROM vehicle_fitments
      WHERE year >= 1980 AND year <= 1990
    `);
    
    const m = missing.rows[0];
    console.log(`Total records: ${m.total}`);
    console.log(`Missing bolt_pattern: ${m.missing_bolt} (${(m.missing_bolt/m.total*100).toFixed(1)}%)`);
    console.log(`Missing center_bore_mm: ${m.missing_hub} (${(m.missing_hub/m.total*100).toFixed(1)}%)`);
    console.log(`Missing thread_size: ${m.missing_thread} (${(m.missing_thread/m.total*100).toFixed(1)}%)`);
    console.log(`Missing seat_type: ${m.missing_seat} (${(m.missing_seat/m.total*100).toFixed(1)}%)`);
    console.log(`Missing offset range: ${m.missing_offset} (${(m.missing_offset/m.total*100).toFixed(1)}%)`);
    console.log(`Missing oem_wheel_sizes: ${m.missing_wheels} (${(m.missing_wheels/m.total*100).toFixed(1)}%)`);
    console.log(`Missing oem_tire_sizes: ${m.missing_tires} (${(m.missing_tires/m.total*100).toFixed(1)}%)`);
    
  } finally {
    client.release();
    await pool.end();
  }
}
main();
