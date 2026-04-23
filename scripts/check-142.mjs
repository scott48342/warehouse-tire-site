import postgres from 'postgres';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const sql = postgres(process.env.POSTGRES_URL);

const missing = await sql`
  SELECT make, model, COUNT(*) as cnt
  FROM vehicle_fitments 
  WHERE oem_wheel_sizes IS NULL OR oem_wheel_sizes::text = '[]'
  GROUP BY make, model
  ORDER BY cnt DESC
  LIMIT 20
`;

console.log('Models missing wheel sizes:\n');
missing.forEach(m => console.log(`  ${m.make} ${m.model}: ${m.cnt}`));

// Check if they have tire sizes
const sample = await sql`
  SELECT year, make, model, oem_tire_sizes 
  FROM vehicle_fitments 
  WHERE oem_wheel_sizes IS NULL OR oem_wheel_sizes::text = '[]'
  LIMIT 5
`;
console.log('\nSample (do they have tires?):');
sample.forEach(s => console.log(`  ${s.year} ${s.make} ${s.model}: tires=${JSON.stringify(s.oem_tire_sizes)}`));

await sql.end();
