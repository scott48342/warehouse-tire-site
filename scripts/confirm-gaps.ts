import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { db } from "../src/lib/fitment-db/db";
import { sql } from "drizzle-orm";

async function main() {
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  STEP 1: CONFIRM GAPS");
  console.log("═══════════════════════════════════════════════════════════════\n");

  // Check Chrysler 300
  console.log("CHRYSLER 300:");
  const chrysler = await db.execute(sql`
    SELECT year, model, display_trim, bolt_pattern, center_bore_mm
    FROM vehicle_fitments
    WHERE make = 'chrysler' AND model LIKE '%300%'
    ORDER BY year
  `);
  console.log("  Found records:", chrysler.rows.length);
  if (chrysler.rows.length > 0) {
    const years = [...new Set((chrysler.rows as any[]).map(r => r.year))].sort((a, b) => a - b);
    console.log("  Years covered:", years.join(", "));
    console.log("  Sample:", chrysler.rows[0]);
  }
  
  // Check 2008 specifically
  const chr2008 = await db.execute(sql`
    SELECT * FROM vehicle_fitments
    WHERE make = 'chrysler' AND model LIKE '%300%' AND year = 2008
  `);
  console.log("  2008 Chrysler 300:", chr2008.rows.length > 0 ? "EXISTS" : "MISSING ❌");

  console.log("\nFORD F-350:");
  // Check Ford F-350 naming variants
  const f350 = await db.execute(sql`
    SELECT DISTINCT model, COUNT(*) as count
    FROM vehicle_fitments
    WHERE make = 'ford' AND (model LIKE '%f-350%' OR model LIKE '%f350%')
    GROUP BY model
  `);
  console.log("  Model variants:", f350.rows);
  
  // Check years for F-350
  const f350years = await db.execute(sql`
    SELECT year, model, display_trim, bolt_pattern, center_bore_mm
    FROM vehicle_fitments
    WHERE make = 'ford' AND model LIKE '%f-350%'
    ORDER BY year
  `);
  if (f350years.rows.length > 0) {
    const years = [...new Set((f350years.rows as any[]).map(r => r.year))].sort((a, b) => a - b);
    console.log("  Years covered:", years.join(", "));
    console.log("  Sample:", f350years.rows[0]);
  }
  
  // Check 2015 specifically
  const f3502015 = await db.execute(sql`
    SELECT * FROM vehicle_fitments
    WHERE make = 'ford' AND model LIKE '%f-350%' AND year = 2015
  `);
  console.log("  2015 Ford F-350:", f3502015.rows.length > 0 ? "EXISTS" : "MISSING ❌");

  // Also check F-250
  console.log("\nFORD F-250:");
  const f250years = await db.execute(sql`
    SELECT year, model, display_trim, bolt_pattern
    FROM vehicle_fitments
    WHERE make = 'ford' AND model LIKE '%f-250%'
    ORDER BY year
  `);
  if (f250years.rows.length > 0) {
    const years = [...new Set((f250years.rows as any[]).map(r => r.year))].sort((a, b) => a - b);
    console.log("  Years covered:", years.join(", "));
    console.log("  Sample:", f250years.rows[0]);
  }
  
  // Check 2015 specifically
  const f2502015 = await db.execute(sql`
    SELECT * FROM vehicle_fitments
    WHERE make = 'ford' AND model LIKE '%f-250%' AND year = 2015
  `);
  console.log("  2015 Ford F-250:", f2502015.rows.length > 0 ? "EXISTS" : "MISSING ❌");

  // Check for all missing years
  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log("  GAP ANALYSIS");
  console.log("═══════════════════════════════════════════════════════════════\n");
  
  // Chrysler 300 gaps (model years: 2005-present, 2nd gen 2011+)
  const chrYears = new Set((chrysler.rows as any[]).map(r => r.year));
  const chrGaps: number[] = [];
  for (let y = 2005; y <= 2026; y++) {
    if (!chrYears.has(y)) chrGaps.push(y);
  }
  console.log("Chrysler 300 gaps:", chrGaps.join(", ") || "None");
  
  // F-350 gaps (Super Duty: 1999-present)
  const f350Yrs = new Set((f350years.rows as any[]).map(r => r.year));
  const f350Gaps: number[] = [];
  for (let y = 1999; y <= 2026; y++) {
    if (!f350Yrs.has(y)) f350Gaps.push(y);
  }
  console.log("Ford F-350 gaps:", f350Gaps.join(", ") || "None");
  
  // F-250 gaps
  const f250Yrs = new Set((f250years.rows as any[]).map(r => r.year));
  const f250Gaps: number[] = [];
  for (let y = 1999; y <= 2026; y++) {
    if (!f250Yrs.has(y)) f250Gaps.push(y);
  }
  console.log("Ford F-250 gaps:", f250Gaps.join(", ") || "None");
  
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
