import postgres from 'postgres';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const sql = postgres(process.env.POSTGRES_URL);

const result = await sql`
  SELECT display_trim, modification_id, oem_tire_sizes, oem_wheel_sizes
  FROM vehicle_fitments 
  WHERE year = 2018 
    AND make ILIKE 'Chevrolet' 
    AND model ILIKE 'Camaro'
    AND display_trim ILIKE '%SS%'
  LIMIT 10
`;

console.log("=== 2018 Chevrolet Camaro SS Records ===\n");
for (const row of result) {
  console.log(`Trim: ${row.display_trim}`);
  console.log(`  oem_tire_sizes type: ${typeof row.oem_tire_sizes}`);
  console.log(`  oem_tire_sizes: ${JSON.stringify(row.oem_tire_sizes)}`);
  console.log("");
}

await sql.end();
