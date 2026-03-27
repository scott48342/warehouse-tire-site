#!/usr/bin/env npx tsx
/**
 * Check current fitment data in database
 * 
 * Uses require() to ensure env is loaded before db module
 */

// eslint-disable-next-line @typescript-eslint/no-var-requires
const fs = require("fs");

// Load .env.local with proper quote handling
const envPath = ".env.local";
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx > 0) {
        const key = trimmed.slice(0, eqIdx);
        let value = trimmed.slice(eqIdx + 1);
        // Strip surrounding quotes
        if ((value.startsWith('"') && value.endsWith('"')) || 
            (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    }
  }
}

// Now load db module (after env is set)
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { db, schema } = require("../src/lib/fitment-db/db");
// eslint-disable-next-line @typescript-eslint/no-var-requires  
const { sql, count } = require("drizzle-orm");

async function main() {
  try {
    console.log("\n📊 FITMENT DATABASE STATUS\n");
    
    // Total records
    const countResult = await db.select({ count: count() }).from(schema.vehicleFitments);
    console.log(`Total fitment records: ${countResult[0]?.count || 0}`);
    
    // Unique vehicles
    const uniqueVehicles = await db.execute(sql`
      SELECT COUNT(DISTINCT (year || '|' || LOWER(make) || '|' || LOWER(model))) as unique_vehicles
      FROM vehicle_fitments
    `);
    console.log(`Unique year/make/model combos: ${(uniqueVehicles.rows as any)?.[0]?.unique_vehicles || 0}`);
    
    // Sample by make
    const byMake = await db.execute(sql`
      SELECT make, COUNT(*) as cnt
      FROM vehicle_fitments
      GROUP BY make
      ORDER BY cnt DESC
      LIMIT 15
    `);
    
    console.log("\nRecords by make:");
    for (const row of byMake.rows as any[]) {
      console.log(`  - ${row.make}: ${row.cnt}`);
    }
    
    // Sample recent vehicles
    const recentSample = await db
      .select({
        year: schema.vehicleFitments.year,
        make: schema.vehicleFitments.make,
        model: schema.vehicleFitments.model,
      })
      .from(schema.vehicleFitments)
      .groupBy(
        schema.vehicleFitments.year,
        schema.vehicleFitments.make,
        schema.vehicleFitments.model
      )
      .orderBy(sql`year DESC, make, model`)
      .limit(20);
    
    console.log("\nSample vehicles in DB (most recent first):");
    for (const v of recentSample) {
      console.log(`  - ${v.year} ${v.make} ${v.model}`);
    }
    
  } catch (err) {
    console.error("Error:", err);
  }
  
  process.exit(0);
}

main();
