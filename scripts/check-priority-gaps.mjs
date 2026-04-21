import pg from 'pg';
import fs from 'fs';

const env = fs.readFileSync('.env.local', 'utf-8');
const url = env.match(/POSTGRES_URL="?([^"\s]+)/)[1];
const pool = new pg.Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });

// High priority vehicles from the alert
const priority = [
  { year: 2015, make: 'dodge', model: 'journey' },
  { year: 2013, make: 'mazda', model: 'mazda6' },
  { year: 2022, make: 'subaru', model: 'ascent' },
  { year: 2017, make: 'mazda', model: 'mazda6' },
  { year: 2018, make: 'toyota', model: 'camry' },
  { year: 2024, make: 'ford', model: 'bronco' },
  { year: 2023, make: 'dodge', model: 'durango' },
  { year: 2013, make: 'volkswagen', model: 'jetta' },
  { year: 2012, make: 'honda', model: 'civic' },
  { year: 2011, make: 'acura', model: 'mdx' },
  { year: 2016, make: 'mazda', model: 'cx-9' },
  { year: 2021, make: 'mini', model: 'clubman' },
  { year: 2022, make: 'mini', model: 'countryman' },
  { year: 2026, make: 'infiniti', model: 'q50' },
];

console.log('=== CHECKING HIGH PRIORITY GAPS ===\n');

for (const v of priority) {
  const result = await pool.query(`
    SELECT year, make, model, display_trim, 
           oem_tire_sizes, oem_wheel_sizes,
           bolt_pattern, center_bore_mm
    FROM vehicle_fitments
    WHERE year = $1 AND LOWER(make) = LOWER($2) AND LOWER(model) = LOWER($3)
    LIMIT 3
  `, [v.year, v.make, v.model]);
  
  if (result.rows.length === 0) {
    console.log(`❌ ${v.year} ${v.make} ${v.model}: NO RECORDS FOUND`);
  } else {
    const r = result.rows[0];
    const tires = r.oem_tire_sizes || [];
    const wheels = r.oem_wheel_sizes || [];
    const hasTires = Array.isArray(tires) && tires.length > 0;
    const hasWheels = Array.isArray(wheels) && wheels.length > 0;
    
    if (!hasTires && !hasWheels) {
      console.log(`⚠️ ${v.year} ${v.make} ${v.model}: EMPTY (has bolt: ${r.bolt_pattern}, hub: ${r.center_bore_mm})`);
    } else if (!hasTires) {
      console.log(`🟡 ${v.year} ${v.make} ${v.model}: Missing TIRES (has ${wheels.length} wheel specs)`);
    } else if (!hasWheels) {
      console.log(`🟡 ${v.year} ${v.make} ${v.model}: Missing WHEELS (has ${tires.length} tires: ${tires.slice(0,3).join(', ')})`);
    } else {
      console.log(`✅ ${v.year} ${v.make} ${v.model}: HAS DATA (${tires.length} tires, ${wheels.length} wheels)`);
    }
  }
}

pool.end();
