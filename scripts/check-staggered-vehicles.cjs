const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '../.env.local');
fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
  const m = line.match(/^([^=]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
});

const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

// Known staggered vehicles to check
const staggeredVehicles = [
  { year: 2020, make: 'Chevrolet', model: 'Corvette' },
  { year: 2020, make: 'Chevrolet', model: 'Camaro' },
  { year: 2020, make: 'Ford', model: 'Mustang' },
  { year: 2020, make: 'BMW', model: 'M3' },
  { year: 2020, make: 'BMW', model: 'M4' },
  { year: 2020, make: 'Dodge', model: 'Challenger' },
  { year: 2020, make: 'Porsche', model: '911' },
];

(async () => {
  console.log('Checking staggered vehicle data quality:\n');
  
  for (const v of staggeredVehicles) {
    const r = await pool.query(`
      SELECT modification_id, display_trim, quality_tier, oem_wheel_sizes
      FROM vehicle_fitments 
      WHERE year = $1 AND LOWER(make) = LOWER($2) AND LOWER(model) LIKE LOWER($3)
      LIMIT 3
    `, [v.year, v.make, `%${v.model}%`]);
    
    if (r.rows.length === 0) {
      console.log(`❌ ${v.year} ${v.make} ${v.model}: NOT IN DATABASE`);
      continue;
    }
    
    for (const row of r.rows) {
      const wheelSizes = row.oem_wheel_sizes || [];
      const hasAxleField = wheelSizes.some(w => w.axle === 'front' || w.axle === 'rear');
      const hasRearFlag = wheelSizes.some(w => w.rear === true);
      const allBoth = wheelSizes.every(w => !w.axle || w.axle === 'both') && !hasRearFlag;
      
      const status = row.quality_tier === 'complete' && (hasAxleField || hasRearFlag)
        ? '✅'
        : row.quality_tier === 'complete' && allBoth
        ? '⚠️ (all "both")'
        : '❌';
      
      console.log(`${status} ${v.year} ${v.make} ${v.model} - ${row.display_trim}`);
      console.log(`   quality_tier: ${row.quality_tier}`);
      console.log(`   hasAxleField: ${hasAxleField}, hasRearFlag: ${hasRearFlag}, allBoth: ${allBoth}`);
      console.log(`   wheels: ${JSON.stringify(wheelSizes.map(w => ({
        size: `${w.diameter}x${w.width}`,
        axle: w.axle || (w.rear ? 'rear' : w.front ? 'front' : '?'),
      })))}`);
    }
    console.log('');
  }
  
  await pool.end();
})();
