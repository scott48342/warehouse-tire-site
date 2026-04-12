/**
 * Phase 2: Tire Size Mismatch Audit
 * 
 * Finds vehicles where:
 * 1. Multiple trims share the same modificationId
 * 2. BUT have different OEM tire sizes or wheel diameters
 * 
 * This identifies data quality issues where trims were incorrectly grouped.
 * 
 * Usage: npx tsx scripts/fitment-audit/audit-tire-size-mismatch.ts
 */

import * as dotenv from "dotenv";
import path from "path";

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import pg from "pg";

const { Pool } = pg;

interface TrimInfo {
  displayTrim: string;
  tireSizes: string[];
  wheelDiameters: number[];
}

interface MismatchedVehicle {
  year: number;
  make: string;
  model: string;
  modificationId: string;
  trimCount: number;
  trims: TrimInfo[];
  uniqueTireSizeConfigs: number;
  uniqueWheelDiameters: number[];
  severity: "critical" | "warning" | "info";
  issue: string;
}

function extractRimDiameter(tireSize: string): number | null {
  if (!tireSize) return null;
  const match = tireSize.toUpperCase().match(/R(\d{2}(?:\.\d)?)/);
  if (match) return Math.floor(parseFloat(match[1]));
  return null;
}

function getWheelDiameters(tireSizes: string[]): number[] {
  const diameters = new Set<number>();
  for (const size of tireSizes) {
    const d = extractRimDiameter(size);
    if (d !== null) diameters.add(d);
  }
  return Array.from(diameters).sort((a, b) => a - b);
}

async function runAudit() {
  // Use POSTGRES_URL directly - Prisma handles SSL
  const connectionString = process.env.POSTGRES_URL;
  if (!connectionString) {
    throw new Error("POSTGRES_URL environment variable is required");
  }
  
  // Parse and adjust for direct pg connection
  const pool = new Pool({
    connectionString,
    ssl: connectionString.includes("sslmode=require") 
      ? { rejectUnauthorized: false }
      : false,
  });

  try {
    console.log("🔍 Phase 2: Tire Size Mismatch Audit\n");
    console.log("Finding vehicles where grouped trims have different tire sizes...\n");

    // Query all fitment records with their tire sizes
    const { rows } = await pool.query(`
      SELECT 
        year,
        make,
        model,
        modification_id,
        display_trim,
        oem_tire_sizes
      FROM vehicle_fitments
      WHERE year >= 2015
      ORDER BY year DESC, make, model, modification_id, display_trim
    `);

    console.log(`📊 Analyzing ${rows.length} fitment records...\n`);

    // Group by year/make/model/modificationId
    const groups = new Map<string, {
      year: number;
      make: string;
      model: string;
      modificationId: string;
      trims: Map<string, TrimInfo>;
    }>();

    for (const row of rows) {
      const key = `${row.year}:${row.make}:${row.model}:${row.modification_id}`;
      
      if (!groups.has(key)) {
        groups.set(key, {
          year: row.year,
          make: row.make,
          model: row.model,
          modificationId: row.modification_id,
          trims: new Map(),
        });
      }

      const group = groups.get(key)!;
      const tireSizes = (row.oem_tire_sizes || []) as string[];
      const wheelDiameters = getWheelDiameters(tireSizes);
      
      // Use display_trim as key (might be same trim with different data)
      const trimKey = row.display_trim || "Base";
      if (!group.trims.has(trimKey)) {
        group.trims.set(trimKey, {
          displayTrim: trimKey,
          tireSizes,
          wheelDiameters,
        });
      }
    }

    // Find mismatches
    const mismatches: MismatchedVehicle[] = [];

    for (const [key, group] of groups) {
      if (group.trims.size <= 1) continue; // Only interested in multi-trim groups

      // Collect all unique tire size configurations
      const allTireSizeConfigs = new Set<string>();
      const allWheelDiameters = new Set<number>();
      
      for (const trim of group.trims.values()) {
        allTireSizeConfigs.add(JSON.stringify(trim.tireSizes.sort()));
        trim.wheelDiameters.forEach(d => allWheelDiameters.add(d));
      }

      // Check for mismatches
      const hasTireSizeMismatch = allTireSizeConfigs.size > 1;
      const hasMultipleDiameters = allWheelDiameters.size > 1;

      if (hasTireSizeMismatch || hasMultipleDiameters) {
        // Determine severity
        let severity: "critical" | "warning" | "info" = "info";
        let issue = "";

        if (hasMultipleDiameters) {
          severity = "critical";
          issue = `DIFFERENT WHEEL DIAMETERS: ${Array.from(allWheelDiameters).join(", ")}"`;
        } else if (hasTireSizeMismatch) {
          severity = "warning";
          issue = `Different tire size configs across trims`;
        }

        mismatches.push({
          year: group.year,
          make: group.make,
          model: group.model,
          modificationId: group.modificationId,
          trimCount: group.trims.size,
          trims: Array.from(group.trims.values()),
          uniqueTireSizeConfigs: allTireSizeConfigs.size,
          uniqueWheelDiameters: Array.from(allWheelDiameters).sort((a, b) => a - b),
          severity,
          issue,
        });
      }
    }

    // Sort by severity and then by year
    mismatches.sort((a, b) => {
      const severityOrder = { critical: 0, warning: 1, info: 2 };
      if (severityOrder[a.severity] !== severityOrder[b.severity]) {
        return severityOrder[a.severity] - severityOrder[b.severity];
      }
      return b.year - a.year;
    });

    // Print summary
    console.log("═══════════════════════════════════════════════════════════════");
    console.log("                    TIRE SIZE MISMATCH AUDIT                    ");
    console.log("═══════════════════════════════════════════════════════════════\n");

    const critical = mismatches.filter(m => m.severity === "critical");
    const warning = mismatches.filter(m => m.severity === "warning");
    const info = mismatches.filter(m => m.severity === "info");

    console.log(`📊 SUMMARY`);
    console.log(`   Total grouped modifications analyzed: ${groups.size}`);
    console.log(`   Multi-trim groups: ${Array.from(groups.values()).filter(g => g.trims.size > 1).length}`);
    console.log(`   🔴 CRITICAL (different wheel diameters): ${critical.length}`);
    console.log(`   ⚠️  WARNING (different tire configs): ${warning.length}`);
    console.log(`   ℹ️  INFO: ${info.length}`);
    console.log(`   Total affected: ${mismatches.length}\n`);

    // Print critical issues (different wheel diameters)
    if (critical.length > 0) {
      console.log("═══════════════════════════════════════════════════════════════");
      console.log("🔴 CRITICAL: Different Wheel Diameters (WRONG TIRES POSSIBLE)");
      console.log("═══════════════════════════════════════════════════════════════\n");

      for (const m of critical.slice(0, 20)) {
        console.log(`${m.year} ${m.make} ${m.model}`);
        console.log(`   Trims (${m.trimCount}): ${m.trims.map(t => t.displayTrim).join(", ")}`);
        console.log(`   Wheel Diameters: ${m.uniqueWheelDiameters.map(d => d + '"').join(", ")}`);
        console.log(`   ModID: ${m.modificationId}`);
        console.log("");
      }

      if (critical.length > 20) {
        console.log(`   ... and ${critical.length - 20} more\n`);
      }
    }

    // Group by make for summary
    const byMake = new Map<string, number>();
    for (const m of mismatches) {
      byMake.set(m.make, (byMake.get(m.make) || 0) + 1);
    }

    console.log("═══════════════════════════════════════════════════════════════");
    console.log("📈 AFFECTED VEHICLES BY MAKE");
    console.log("═══════════════════════════════════════════════════════════════\n");

    const sortedMakes = Array.from(byMake.entries()).sort((a, b) => b[1] - a[1]);
    for (const [make, count] of sortedMakes) {
      const criticalForMake = mismatches.filter(m => m.make === make && m.severity === "critical").length;
      console.log(`   ${make.padEnd(15)} ${count} affected ${criticalForMake > 0 ? `(${criticalForMake} critical)` : ""}`);
    }

    // Save full results
    const fs = await import("fs/promises");
    const outputPath = "./scripts/fitment-audit/tire-mismatch-results.json";
    await fs.writeFile(outputPath, JSON.stringify({
      timestamp: new Date().toISOString(),
      summary: {
        totalGroups: groups.size,
        multiTrimGroups: Array.from(groups.values()).filter(g => g.trims.size > 1).length,
        criticalCount: critical.length,
        warningCount: warning.length,
        infoCount: info.length,
      },
      criticalIssues: critical,
      warnings: warning,
    }, null, 2));
    
    console.log(`\n📄 Full results saved to: ${outputPath}`);

    // Architecture recommendation
    console.log("\n═══════════════════════════════════════════════════════════════");
    console.log("🏗️ ARCHITECTURE RECOMMENDATION");
    console.log("═══════════════════════════════════════════════════════════════\n");

    if (critical.length === 0) {
      console.log("✅ NO CRITICAL ISSUES FOUND");
      console.log("");
      console.log("Current architecture is safe. The wheel diameter selector (Phase 1)");
      console.log("will handle any edge cases where trims have multiple wheel sizes.");
      console.log("");
      console.log("Recommendation: KEEP current grouped modifications with Phase 1 filter.");
    } else if (critical.length < 50) {
      console.log("⚠️ LIMITED CRITICAL ISSUES");
      console.log("");
      console.log(`Found ${critical.length} vehicles with different wheel diameters grouped together.`);
      console.log("The Phase 1 wheel diameter selector will protect users from wrong tire sizes.");
      console.log("");
      console.log("Recommendation: Monitor with Phase 1 filter. Consider splitting these");
      console.log("specific modificationIds if issues persist.");
    } else {
      console.log("🔴 SIGNIFICANT DATA QUALITY ISSUE");
      console.log("");
      console.log(`Found ${critical.length} vehicles with mismatched wheel diameters.`);
      console.log("Consider splitting modificationIds by wheel diameter for data integrity.");
      console.log("");
      console.log("Recommendation: Option A (split by wheel diameter) for long-term fix.");
    }

  } finally {
    await pool.end();
  }
}

runAudit().catch(console.error);
