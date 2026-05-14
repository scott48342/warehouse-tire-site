import postgres from 'postgres';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const sql = postgres(process.env.POSTGRES_URL);

const result = await sql`
  SELECT display_trim, certification_status, modification_id
  FROM vehicle_fitments 
  WHERE year = 2014 
    AND make ILIKE 'Ford' 
    AND model ILIKE 'Fusion'
`;

console.log("=== 2014 Ford Fusion Records ===\n");
for (const row of result) {
  console.log(`Trim: ${row.display_trim}`);
  console.log(`  certificationStatus: ${row.certification_status}`);
  console.log("");
}

await sql.end();
