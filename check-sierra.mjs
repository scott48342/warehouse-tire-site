import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { vehicleFitments } from './src/lib/db/schema.js';
import { ilike, and, eq } from 'drizzle-orm';

const connectionString = process.env.POSTGRES_URL;
const client = postgres(connectionString);
const db = drizzle(client);

const results = await db.select()
  .from(vehicleFitments)
  .where(
    and(
      ilike(vehicleFitments.make, '%GMC%'),
      ilike(vehicleFitments.model, '%Sierra 2500%')
    )
  )
  .limit(20);

console.log('Found:', results.length, 'records');
for (const r of results) {
  console.log(`${r.year} ${r.make} ${r.model} - ${r.modificationId} - bolt: ${r.boltPattern}`);
}

await client.end();
