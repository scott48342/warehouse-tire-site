import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const pool = new pg.Pool({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });

const result = await pool.query(`
  SELECT 
    COUNT(*) as total,
    COUNT(CASE WHEN oem_tire_sizes IS NOT NULL AND jsonb_array_length(oem_tire_sizes) > 0 THEN 1 END) as has_tires,
    COUNT(CASE WHEN oem_wheel_sizes IS NOT NULL AND jsonb_array_length(oem_wheel_sizes) > 0 THEN 1 END) as has_wheels,
    COUNT(CASE WHEN 
      oem_tire_sizes IS NOT NULL AND jsonb_array_length(oem_tire_sizes) > 0 AND
      oem_wheel_sizes IS NOT NULL AND jsonb_array_length(oem_wheel_sizes) > 0
    THEN 1 END) as complete
  FROM vehicle_fitments WHERE year >= 2000
`);

const s = result.rows[0];
console.log('');
console.log('='.repeat(50));
console.log('FINAL DATABASE STATE (2000-2026)');
console.log('='.repeat(50));
console.log(`Total Records:    ${s.total.toLocaleString()}`);
console.log(`With Tire Sizes:  ${s.has_tires.toLocaleString()} (${(s.has_tires/s.total*100).toFixed(1)}%)`);
console.log(`With Wheel Specs: ${s.has_wheels.toLocaleString()} (${(s.has_wheels/s.total*100).toFixed(1)}%)`);
console.log(`COMPLETE:         ${s.complete.toLocaleString()} (${(s.complete/s.total*100).toFixed(1)}%)`);
console.log('='.repeat(50));

await pool.end();
