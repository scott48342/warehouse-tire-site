// Test what SQL Drizzle generates for ilike
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, and, ilike, sql } from "drizzle-orm";
import { pgTable, varchar, integer, text } from "drizzle-orm/pg-core";
import pg from "pg";
import fs from "fs";

const envContent = fs.readFileSync(".env.local", "utf-8");
const dbMatch = envContent.match(/POSTGRES_URL="?([^"\s]+)/);
const dbUrl = dbMatch ? dbMatch[1].trim() : null;

const { Pool } = pg;
const pool = new Pool({ connectionString: dbUrl });
const db = drizzle(pool, { logger: true });  // Enable logging!

// Define table schema matching our vehicleFitments
const vehicleFitments = pgTable('vehicle_fitments', {
  id: varchar('id', { length: 255 }),
  year: integer('year'),
  make: varchar('make', { length: 100 }),
  model: varchar('model', { length: 100 }),
  modificationId: varchar('modification_id', { length: 255 }),
  displayTrim: varchar('display_trim', { length: 255 }),
});

// Test query
const modelVariants = ["encore-gx"];
const patterns = modelVariants.map(v => {
  const words = v.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(/\s+/);
  return `%${words.join('%')}%`;
});
console.log("Pattern:", patterns[0]);

try {
  const result = await db
    .select({ displayTrim: vehicleFitments.displayTrim, model: vehicleFitments.model })
    .from(vehicleFitments)
    .where(
      and(
        eq(vehicleFitments.year, 2022),
        sql`lower(${vehicleFitments.make}) = ${"buick"}`,
        ilike(vehicleFitments.model, patterns[0]),
        eq(vehicleFitments.modificationId, "buick-encore-gx-preferred-ff350f80")
      )
    )
    .limit(5);
  
  console.log("Results:", result);
} catch (e) {
  console.error("Error:", e.message);
}

await pool.end();
