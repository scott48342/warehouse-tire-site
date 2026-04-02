const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

(async () => {
  const client = await pool.connect();
  
  // Check legacy tables
  const vehicles = await client.query('SELECT COUNT(*) as cnt FROM vehicles');
  console.log('vehicles table:', vehicles.rows[0].cnt, 'records');
  
  const vehicleFitment = await client.query('SELECT COUNT(*) as cnt FROM vehicle_fitment');
  console.log('vehicle_fitment table:', vehicleFitment.rows[0].cnt, 'records');
  
  const vehicleWheelSpecs = await client.query('SELECT COUNT(*) as cnt FROM vehicle_wheel_specs');
  console.log('vehicle_wheel_specs table:', vehicleWheelSpecs.rows[0].cnt, 'records');
  
  // Check new table
  const newFitments = await client.query('SELECT COUNT(*) as cnt FROM vehicle_fitments');
  console.log('vehicle_fitments (new):', newFitments.rows[0].cnt, 'records');
  
  // Check makes/models in vehicles table
  const stats = await client.query(`
    SELECT 
      COUNT(DISTINCT make) as makes, 
      COUNT(DISTINCT CONCAT(make, model)) as models, 
      COUNT(DISTINCT CONCAT(year, make, model)) as ymm 
    FROM vehicles
  `);
  console.log('\nVehicles table stats:');
  console.log('  Makes:', stats.rows[0].makes);
  console.log('  Models:', stats.rows[0].models);
  console.log('  Y/M/M combos:', stats.rows[0].ymm);
  
  // Check trims
  const trims = await client.query(`
    SELECT 
      COUNT(*) as total,
      COUNT(CASE WHEN trim = 'Base' THEN 1 END) as base_count
    FROM vehicles
  `);
  console.log('  Total trims:', trims.rows[0].total);
  console.log('  "Base" trims:', trims.rows[0].base_count);
  console.log('  Real trims:', trims.rows[0].total - trims.rows[0].base_count);
  
  // Check for high-value vehicles
  console.log('\n--- HIGH-VALUE VEHICLE CHECK ---');
  const highValue = [
    ['Ford', 'F-150'],
    ['Chevrolet', 'Silverado 1500'],
    ['Ram', '1500'],
    ['Toyota', 'RAV4'],
    ['Honda', 'CR-V'],
    ['Toyota', 'Camry'],
    ['Jeep', 'Wrangler'],
    ['Jeep', 'Grand Cherokee'],
  ];
  
  for (const [make, model] of highValue) {
    const result = await client.query(
      `SELECT COUNT(*) as cnt, COUNT(DISTINCT year) as years 
       FROM vehicles 
       WHERE LOWER(make) = LOWER($1) AND LOWER(model) = LOWER($2)`,
      [make, model]
    );
    const r = result.rows[0];
    console.log(`${make} ${model}: ${r.cnt} records, ${r.years} years`);
  }
  
  // Sample makes
  const makes = await client.query('SELECT DISTINCT make FROM vehicles ORDER BY make');
  console.log('\nAll makes in vehicles table:', makes.rows.map(r => r.make).join(', '));
  
  // Year range
  const yearRange = await client.query('SELECT MIN(year) as min_year, MAX(year) as max_year FROM vehicles');
  console.log('\nYear range:', yearRange.rows[0].min_year, '-', yearRange.rows[0].max_year);
  
  client.release();
  await pool.end();
})().catch(console.error);
