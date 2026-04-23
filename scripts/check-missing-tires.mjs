import postgres from 'postgres';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const sql = postgres(process.env.POSTGRES_URL);

// Check what's missing tires
const missing = await sql`
  SELECT make, model, COUNT(*) as cnt
  FROM vehicle_fitments 
  WHERE oem_tire_sizes IS NULL OR oem_tire_sizes = '[]' OR oem_tire_sizes::text = '[]'
  GROUP BY make, model
  ORDER BY cnt DESC
  LIMIT 30
`;

console.log('Top models missing tire sizes:\n');
console.log('Make | Model | Count');
console.log('-'.repeat(50));
missing.forEach(m => console.log(`${m.make} | ${m.model} | ${m.cnt}`));

// Check a sample record to see data format
const sample = await sql`
  SELECT year, make, model, oem_wheel_sizes, oem_tire_sizes 
  FROM vehicle_fitments 
  WHERE (oem_tire_sizes IS NULL OR oem_tire_sizes = '[]')
  LIMIT 5
`;
console.log('\nSample records missing tires:');
sample.forEach(s => console.log(`  ${s.year} ${s.make} ${s.model}: wheels=${JSON.stringify(s.oem_wheel_sizes)}, tires=${JSON.stringify(s.oem_tire_sizes)}`));

await sql.end();
