import postgres from 'postgres';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const sql = postgres(process.env.POSTGRES_URL);

const missing = await sql`
  SELECT year, make, model, oem_wheel_sizes 
  FROM vehicle_fitments 
  WHERE oem_tire_sizes IS NULL OR oem_tire_sizes::text = '[]'
  ORDER BY make, model, year
`;

console.log('9 records still missing tires:\n');
missing.forEach(m => console.log(`  ${m.year} ${m.make} ${m.model}: wheels=${JSON.stringify(m.oem_wheel_sizes)}`));

await sql.end();
