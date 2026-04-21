import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const pool = new pg.Pool({ 
  connectionString: process.env.POSTGRES_URL, 
  ssl: { rejectUnauthorized: false } 
});

// Top priority gaps from API
const PRIORITY_VEHICLES = [
  { year: 2013, make: 'mazda', model: 'mazda6' },
  { year: 2022, make: 'subaru', model: 'ascent' },
  { year: 2017, make: 'mazda', model: 'mazda6' },
  { year: 2018, make: 'toyota', model: 'camry' },
  { year: 2024, make: 'ford', model: 'bronco' },
  { year: 2023, make: 'dodge', model: 'durango' },
  { year: 2018, make: 'dodge', model: 'durango' },
  { year: 2013, make: 'volkswagen', model: 'jetta' },
  { year: 2012, make: 'honda', model: 'civic' },
  { year: 2013, make: 'toyota', model: 'camry' },
  { year: 2011, make: 'acura', model: 'mdx' },
  { year: 2014, make: 'toyota', model: 'camry' },
  { year: 2014, make: 'toyota', model: 'highlander' },
  { year: 2010, make: 'honda', model: 'cr-v' },
  { year: 2023, make: 'volkswagen', model: 'jetta' },
  { year: 2021, make: 'toyota', model: 'camry' },
  { year: 2012, make: 'mazda', model: 'mazda6' },
  { year: 2014, make: 'volkswagen', model: 'passat' },
  { year: 2014, make: 'volkswagen', model: 'tiguan' },
  { year: 2016, make: 'mazda', model: 'mazda6' },
  { year: 2016, make: 'mazda', model: 'cx-9' },
  { year: 2015, make: 'hyundai', model: 'sonata' },
  { year: 2018, make: 'mazda', model: 'mazda6' },
  { year: 2010, make: 'chevrolet', model: 'colorado' },
  { year: 2025, make: 'acura', model: 'integra' },
  { year: 2020, make: 'volkswagen', model: 'jetta' },
  { year: 2014, make: 'hyundai', model: 'tucson' },
  { year: 2014, make: 'honda', model: 'cr-v' },
  { year: 2016, make: 'hyundai', model: 'sonata' },
  { year: 2026, make: 'infiniti', model: 'q50' },
  { year: 2017, make: 'acura', model: 'rdx' },
  { year: 2015, make: 'ford', model: 'f-150' },
  { year: 2011, make: 'ford', model: 'ranger' },
  { year: 2013, make: 'toyota', model: 'corolla' },
  { year: 2010, make: 'nissan', model: 'rogue' },
  { year: 2022, make: 'jeep', model: 'wrangler' },
  { year: 2025, make: 'mazda', model: 'mazda3' },
  { year: 2021, make: 'mini', model: 'clubman' },
  { year: 2021, make: 'volkswagen', model: 'tiguan' },
  { year: 2023, make: 'hyundai', model: 'tucson' },
  { year: 2015, make: 'dodge', model: 'durango' },
  { year: 2022, make: 'mini', model: 'countryman' },
  { year: 2024, make: 'toyota', model: 'tacoma' },
  { year: 2016, make: 'honda', model: 'pilot' },
  { year: 2013, make: 'dodge', model: 'durango' },
  { year: 2019, make: 'honda', model: 'accord' },
  { year: 2013, make: 'honda', model: 'accord' },
  { year: 2011, make: 'toyota', model: 'highlander' },
];

async function check() {
  const client = await pool.connect();
  
  console.log('Checking priority vehicles in database...\n');
  console.log('Status | Year | Make | Model | DB Records | Has Tires | Has Wheels');
  console.log('-'.repeat(80));
  
  const missing = [];
  const noTires = [];
  const noWheels = [];
  
  for (const v of PRIORITY_VEHICLES) {
    const result = await client.query(`
      SELECT 
        COUNT(*) as count,
        COUNT(CASE WHEN oem_tire_sizes IS NOT NULL AND jsonb_array_length(oem_tire_sizes) > 0 THEN 1 END) as has_tires,
        COUNT(CASE WHEN oem_wheel_sizes IS NOT NULL AND jsonb_array_length(oem_wheel_sizes) > 0 THEN 1 END) as has_wheels
      FROM vehicle_fitments
      WHERE year = $1 AND make ILIKE $2 AND model ILIKE $3
    `, [v.year, v.make, `%${v.model}%`]);
    
    const row = result.rows[0];
    const count = parseInt(row.count);
    const tires = parseInt(row.has_tires);
    const wheels = parseInt(row.has_wheels);
    
    let status = '✅';
    if (count === 0) {
      status = '❌ MISSING';
      missing.push(v);
    } else if (tires === 0) {
      status = '⚠️ NO TIRES';
      noTires.push(v);
    } else if (wheels === 0) {
      status = '⚠️ NO WHEELS';
      noWheels.push(v);
    }
    
    console.log(`${status.padEnd(12)} | ${v.year} | ${v.make.padEnd(10)} | ${v.model.padEnd(12)} | ${count.toString().padStart(3)} | ${tires.toString().padStart(3)} | ${wheels.toString().padStart(3)}`);
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('SUMMARY');
  console.log('='.repeat(80));
  console.log(`Total checked: ${PRIORITY_VEHICLES.length}`);
  console.log(`Missing from DB: ${missing.length}`);
  console.log(`No tire data: ${noTires.length}`);
  console.log(`No wheel data: ${noWheels.length}`);
  
  if (missing.length > 0) {
    console.log('\n❌ MISSING VEHICLES:');
    missing.forEach(v => console.log(`  ${v.year} ${v.make} ${v.model}`));
  }
  
  if (noTires.length > 0) {
    console.log('\n⚠️ NO TIRE DATA:');
    noTires.forEach(v => console.log(`  ${v.year} ${v.make} ${v.model}`));
  }

  await client.release();
  await pool.end();
}

check().catch(console.error);
