const postgres = require("postgres");

async function main() {
  const client = postgres("postgresql://neondb_owner:npg_c0FpKTmNB3qR@ep-aged-dust-an7vnet1-pooler.c-6.us-east-1.aws.neon.tech/neondb?sslmode=require");
  
  // Check column names in vehicle_fitments
  const cols = await client`
    SELECT column_name FROM information_schema.columns 
    WHERE table_name = 'vehicle_fitments'
    ORDER BY column_name
  `;
  
  console.log("Columns:", cols.map(c => c.column_name).join(", "));
  
  await client.end();
}

main().catch(console.error);