// Simulate exactly what profileService does
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, and, ilike, sql } from "drizzle-orm";
import { pgTable, varchar, integer, text, jsonb, timestamp } from "drizzle-orm/pg-core";
import pg from "pg";
import fs from "fs";

const envContent = fs.readFileSync(".env.local", "utf-8");
const dbMatch = envContent.match(/POSTGRES_URL="?([^"\s]+)/);
const dbUrl = dbMatch ? dbMatch[1].trim() : null;

const { Pool } = pg;
const pool = new Pool({ connectionString: dbUrl });
const db = drizzle(pool, { logger: true });

// Schema
const vehicleFitments = pgTable('vehicle_fitments', {
  id: varchar('id', { length: 255 }),
  year: integer('year'),
  make: varchar('make', { length: 100 }),
  model: varchar('model', { length: 100 }),
  modificationId: varchar('modification_id', { length: 255 }),
  displayTrim: varchar('display_trim', { length: 255 }),
  boltPattern: varchar('bolt_pattern', { length: 20 }),
  oemTireSizes: jsonb('oem_tire_sizes'),
  oemWheelSizes: jsonb('oem_wheel_sizes'),
});

// Exactly what profileService does
const year = 2022;
const make = "Buick";
const model = "Encore GX";  // From URL
const modificationId = "buick-encore-gx-preferred-ff350f80";

// Step 1: normalizeMake
const normalizedMake = make.toLowerCase();

// Step 2: getModelVariants
const slugified = model.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const modelVariants = [slugified];  // ["encore-gx"]

// Step 3: modelNormalizedMatch pattern
const patterns = modelVariants.map(v => {
  const words = v.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(/\s+/);
  return `%${words.join('%')}%`;
});
const pattern = patterns[0];  // %encore%gx%

// Step 4: normalizedModId
const normalizedModId = modificationId.toLowerCase().trim();

console.log("Parameters:");
console.log("  year:", year);
console.log("  normalizedMake:", normalizedMake);
console.log("  modelVariants:", modelVariants);
console.log("  ilike pattern:", pattern);
console.log("  normalizedModId:", normalizedModId);
console.log("");

// Query exactly like profileService
const [fitment] = await db
  .select()
  .from(vehicleFitments)
  .where(
    and(
      eq(vehicleFitments.year, year),
      sql`lower(${vehicleFitments.make}) = ${normalizedMake}`,
      ilike(vehicleFitments.model, pattern),
      eq(vehicleFitments.modificationId, normalizedModId)
    )
  )
  .limit(1);

if (fitment) {
  console.log("FOUND:", fitment.displayTrim);
  console.log("  boltPattern:", fitment.boltPattern);
  console.log("  oemTireSizes:", JSON.stringify(fitment.oemTireSizes));
} else {
  console.log("NOT FOUND");
}

await pool.end();
