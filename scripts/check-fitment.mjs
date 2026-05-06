import pg from 'pg';
import { config } from 'dotenv';
config({ path: '.env.local' });

const pool = new pg.Pool({ connectionString: process.env.POSTGRES_URL });

async function check() {
  // Check specific known staggered vehicles
  const vehicles = [
    { make: 'Chevrolet', model: 'Camaro', searchTrim: '%1le%' },
    { make: 'Chevrolet', model: 'Corvette', searchTrim: '%' },
    { make: 'Ford', model: 'Mustang', searchTrim: '%' },
    { make: 'Dodge', model: 'Challenger', searchTrim: '%' },
    { make: 'BMW', model: 'M3', searchTrim: '%' },
    { make: 'BMW', model: 'M4', searchTrim: '%' },
  ];
  
  for (const v of vehicles) {
    const { rows } = await pool.query(`
      SELECT year, make, model, modification_id, display_trim, quality_tier, oem_wheel_sizes
      FROM vehicle_fitments 
      WHERE make ILIKE $1 AND model ILIKE $2
      AND modification_id ILIKE $3
      AND certification_status = 'certified'
      ORDER BY year DESC
      LIMIT 5
    `, [v.make, v.model, v.searchTrim]);
    
    console.log(`\n${v.make} ${v.model} (${v.searchTrim}):`);
    for (const r of rows) {
      const wheels = r.oem_wheel_sizes || [];
      const widths = [...new Set(wheels.map(w => w?.width).filter(Boolean))];
      const hasFront = wheels.some(w => w?.axle === 'front');
      const hasRear = wheels.some(w => w?.axle === 'rear');
      console.log(`  ${r.year} ${r.display_trim}: widths=${widths.join(', ')}" F=${hasFront} R=${hasRear}`);
    }
    if (rows.length === 0) console.log('  (no records)');
  }
  
  await pool.end();
}

check().catch(console.error);
