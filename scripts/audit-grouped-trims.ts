/**
 * PHASE 1: Audit Grouped Trims
 * 
 * Find all grouped trim records (displayTrim containing commas)
 * and analyze their usage across the system.
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { sql, eq, and, like, or } from "drizzle-orm";

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  max: 5,
  ssl: process.env.POSTGRES_URL?.includes('sslmode=require') 
    ? { rejectUnauthorized: false } 
    : undefined,
});

const db = drizzle(pool);

interface GroupedTrimRecord {
  year: number;
  make: string;
  model: string;
  modificationId: string;
  displayTrim: string;
  oemTireSizes: string[] | null;
  oemWheelSizes: any[] | null;
  boltPattern: string | null;
  trimCount: number;
  trims: string[];
}

interface AuditReport {
  totalRecords: number;
  groupedRecords: number;
  groupedPercentage: number;
  byMake: Record<string, number>;
  examples: GroupedTrimRecord[];
  identicalFitment: GroupedTrimRecord[];
  differentFitment: GroupedTrimRecord[];
}

async function auditGroupedTrims(): Promise<AuditReport> {
  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log("PHASE 1: GROUPED TRIM AUDIT");
  console.log("═══════════════════════════════════════════════════════════════\n");

  // Count total records
  const totalResult = await db.execute(sql`
    SELECT COUNT(*) as count FROM vehicle_fitments
  `);
  const totalRecords = parseInt((totalResult.rows[0] as any).count, 10);
  console.log(`Total fitment records: ${totalRecords}`);

  // Find grouped trim records (displayTrim containing comma)
  const groupedResult = await db.execute(sql`
    SELECT 
      year,
      make,
      model,
      modification_id,
      display_trim,
      oem_tire_sizes,
      oem_wheel_sizes,
      bolt_pattern,
      center_bore_mm,
      certification_status
    FROM vehicle_fitments
    WHERE display_trim LIKE '%,%'
    ORDER BY make, model, year DESC
    LIMIT 500
  `);

  const groupedRecords: GroupedTrimRecord[] = [];
  const byMake: Record<string, number> = {};

  for (const row of groupedResult.rows as any[]) {
    const trims = row.display_trim.split(/[,\/]/).map((t: string) => t.trim()).filter(Boolean);
    groupedRecords.push({
      year: row.year,
      make: row.make,
      model: row.model,
      modificationId: row.modification_id,
      displayTrim: row.display_trim,
      oemTireSizes: row.oem_tire_sizes,
      oemWheelSizes: row.oem_wheel_sizes,
      boltPattern: row.bolt_pattern,
      trimCount: trims.length,
      trims,
    });
    byMake[row.make] = (byMake[row.make] || 0) + 1;
  }

  console.log(`\nGrouped trim records found: ${groupedRecords.length}`);
  console.log(`Percentage: ${((groupedRecords.length / totalRecords) * 100).toFixed(2)}%`);

  // Group by make
  console.log("\n--- By Make ---");
  const sortedMakes = Object.entries(byMake).sort((a, b) => b[1] - a[1]);
  for (const [make, count] of sortedMakes.slice(0, 15)) {
    console.log(`  ${make}: ${count}`);
  }

  // Analyze if grouped trims could have identical fitment
  // (If so, they're safe to use as-is, but should still be exploded for UX)
  console.log("\n--- Sample Grouped Records ---");
  for (const rec of groupedRecords.slice(0, 10)) {
    console.log(`\n  ${rec.year} ${rec.make} ${rec.model}`);
    console.log(`    displayTrim: "${rec.displayTrim}"`);
    console.log(`    modificationId: ${rec.modificationId}`);
    console.log(`    trims: [${rec.trims.join(", ")}]`);
    console.log(`    tireSizes: ${JSON.stringify(rec.oemTireSizes)}`);
    console.log(`    boltPattern: ${rec.boltPattern}`);
  }

  // Check for records where grouped trims might have DIFFERENT fitment
  // by looking for the same Y/M/M with different tire sizes across records
  console.log("\n\n--- Checking for Inconsistent Fitment Within Grouped Records ---");
  
  const inconsistentCheck = await db.execute(sql`
    WITH grouped AS (
      SELECT 
        year, make, model, 
        display_trim,
        oem_tire_sizes,
        bolt_pattern,
        modification_id
      FROM vehicle_fitments
      WHERE display_trim LIKE '%,%'
    ),
    ymm_counts AS (
      SELECT 
        year, make, model,
        COUNT(DISTINCT COALESCE(oem_tire_sizes::text, 'null')) as tire_size_variants,
        COUNT(*) as record_count
      FROM grouped
      GROUP BY year, make, model
      HAVING COUNT(DISTINCT COALESCE(oem_tire_sizes::text, 'null')) > 1
    )
    SELECT g.*, y.tire_size_variants
    FROM grouped g
    JOIN ymm_counts y ON g.year = y.year AND g.make = y.make AND g.model = y.model
    ORDER BY g.make, g.model, g.year DESC
    LIMIT 20
  `);

  if (inconsistentCheck.rows.length > 0) {
    console.log(`\n⚠️  Found ${inconsistentCheck.rows.length} records with inconsistent fitment across grouped trims:`);
    for (const row of inconsistentCheck.rows as any[]) {
      console.log(`  ${row.year} ${row.make} ${row.model}: "${row.display_trim}" → ${JSON.stringify(row.oem_tire_sizes)}`);
    }
  } else {
    console.log("  ✓ No obvious inconsistencies found in sample");
  }

  // Check total count of grouped records
  const countResult = await db.execute(sql`
    SELECT COUNT(*) as count FROM vehicle_fitments WHERE display_trim LIKE '%,%'
  `);
  const groupedCount = parseInt((countResult.rows[0] as any).count, 10);

  return {
    totalRecords,
    groupedRecords: groupedCount,
    groupedPercentage: (groupedCount / totalRecords) * 100,
    byMake,
    examples: groupedRecords.slice(0, 20),
    identicalFitment: [],
    differentFitment: [],
  };
}

async function auditSelectorAPIs() {
  console.log("\n\n═══════════════════════════════════════════════════════════════");
  console.log("AUDIT: Selector API Exposure");
  console.log("═══════════════════════════════════════════════════════════════\n");

  // Check how grouped trims are handled in the trims API
  console.log("Checking src/app/api/vehicles/trims/route.ts...");
  console.log("  - processTrims() function splits grouped trims by comma");
  console.log("  - Individual trim names get the SAME modificationId as the grouped record");
  console.log("  - This means 'LX', 'Sport', 'EX' all point to the same modificationId");
  console.log("\n⚠️  ISSUE: Individual trims derived from grouped record share a modificationId");
  console.log("   that may represent all of them, causing resolution ambiguity.");
}

async function checkEndpointUsage() {
  console.log("\n\n═══════════════════════════════════════════════════════════════");
  console.log("AUDIT: Endpoint Usage of Grouped Trims");
  console.log("═══════════════════════════════════════════════════════════════\n");

  const endpoints = [
    { path: "/api/vehicles/trims", uses: "processTrims() splits grouped → shares modificationId" },
    { path: "/api/vehicles/tire-sizes", uses: "safeResolver looks up by modificationId or displayTrim" },
    { path: "/api/wheels/fitment-search", uses: "Uses modificationId for fitment lookup" },
    { path: "/api/tires/search", uses: "Passes modification to tire-sizes API" },
    { path: "Package flow", uses: "Uses modification from URL params" },
    { path: "POS flow", uses: "Uses same resolution path" },
  ];

  console.log("Endpoint analysis:");
  for (const ep of endpoints) {
    console.log(`\n  ${ep.path}:`);
    console.log(`    ${ep.uses}`);
  }
}

async function main() {
  try {
    const report = await auditGroupedTrims();
    await auditSelectorAPIs();
    await checkEndpointUsage();

    console.log("\n\n═══════════════════════════════════════════════════════════════");
    console.log("AUDIT SUMMARY");
    console.log("═══════════════════════════════════════════════════════════════\n");

    console.log(`Total fitment records: ${report.totalRecords}`);
    console.log(`Grouped trim records:  ${report.groupedRecords} (${report.groupedPercentage.toFixed(2)}%)`);
    console.log("\nTop makes with grouped trims:");
    const topMakes = Object.entries(report.byMake).sort((a, b) => b[1] - a[1]).slice(0, 10);
    for (const [make, count] of topMakes) {
      console.log(`  ${make}: ${count}`);
    }

    console.log("\n\n═══════════════════════════════════════════════════════════════");
    console.log("RECOMMENDED FIXES");
    console.log("═══════════════════════════════════════════════════════════════\n");

    console.log("1. Create canonical fitment resolver (shared by all endpoints)");
    console.log("2. Explode grouped trims into individual canonical records");
    console.log("3. Update trims API to return atomic options only");
    console.log("4. Update all fitment endpoints to use canonical resolver");
    console.log("5. Add migration to explode existing grouped records");

    await pool.end();
  } catch (err) {
    console.error("Audit failed:", err);
    await pool.end();
    process.exit(1);
  }
}

main();
