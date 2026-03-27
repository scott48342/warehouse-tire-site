#!/usr/bin/env npx tsx
/**
 * Check what data sources we have in the fitment DB
 */

const fs = require("fs");
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
        if ((value.startsWith('"') && value.endsWith('"')) || 
            (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        if (!process.env[key]) process.env[key] = value;
      }
    }
  }
}

const { db } = require("../src/lib/fitment-db/db");
const { sql } = require("drizzle-orm");

async function main() {
  console.log("\n📊 FITMENT DATABASE ANALYSIS\n");
  
  // Check data sources
  const sources = await db.execute(sql`SELECT DISTINCT source FROM vehicle_fitments`);
  console.log("Data sources in DB:", sources.rows.map((r: any) => r.source));
  
  // Count by source
  const countBySource = await db.execute(sql`
    SELECT source, COUNT(*) as cnt 
    FROM vehicle_fitments 
    GROUP BY source
  `);
  console.log("\nRecords by source:");
  for (const r of countBySource.rows as any[]) {
    console.log(`  ${r.source}: ${r.cnt}`);
  }
  
  // Sample records
  const sampleData = await db.execute(sql`
    SELECT year, make, model, modification_id, display_trim, bolt_pattern, center_bore_mm, source 
    FROM vehicle_fitments 
    ORDER BY year DESC, make, model
    LIMIT 10
  `);
  console.log("\nSample records:");
  for (const r of sampleData.rows as any[]) {
    console.log(`  ${r.year} ${r.make} ${r.model} | ${r.bolt_pattern} | ${r.center_bore_mm}mm | ${r.source}`);
  }
  
  // Check fitment_source_records
  const sourceRecords = await db.execute(sql`
    SELECT source, COUNT(*) as cnt 
    FROM fitment_source_records 
    GROUP BY source
  `);
  console.log("\nSource records (raw API data):");
  for (const r of sourceRecords.rows as any[]) {
    console.log(`  ${r.source}: ${r.cnt}`);
  }
  
  // Check fitment_overrides
  const overrides = await db.execute(sql`SELECT COUNT(*) as cnt FROM fitment_overrides`);
  console.log("\nManual overrides:", (overrides.rows[0] as any)?.cnt || 0);
  
  process.exit(0);
}

main().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
