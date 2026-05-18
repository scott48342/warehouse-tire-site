import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { sql } from 'drizzle-orm';

const connectionString = "postgresql://neondb_owner:npg_c0FpKTmNB3qR@ep-aged-dust-an7vnet1-pooler.c-6.us-east-1.aws.neon.tech/neondb?sslmode=require";
const client = postgres(connectionString);
const db = drizzle(client);

// First, show column names
const cols = await db.execute(sql`
  SELECT column_name FROM information_schema.columns 
  WHERE table_name = 'vehicle_fitments'
`);
console.log("Columns:", cols.map(c => c.column_name).join(", "));
console.log("");

// Now query the actual data
const results = await db.execute(sql`
  SELECT *
  FROM vehicle_fitments
  WHERE year = '2007'
    AND make ILIKE '%BMW%'
    AND model ILIKE '%3 Series%'
  LIMIT 10
`);

console.log(`Found ${results.length} fitments:\n`);

for (const r of results) {
  console.log(JSON.stringify(r, null, 2));
  console.log('---');
}

await client.end();
