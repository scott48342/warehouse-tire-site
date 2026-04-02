/**
 * PRE-DEPLOY DATABASE INTEGRITY CHECK
 * 
 * Run before deployment to block releases if data integrity degrades.
 * Exits with code 1 if any record becomes incomplete or invalid.
 * 
 * Usage: npx tsx scripts/integrity-check.ts
 * Add to CI: npm run integrity-check
 * 
 * Thresholds (fail if exceeded):
 * - Class C (Incomplete): 0 allowed
 * - Class D (Invalid): 0 allowed
 * - Missing wheel sizes: <1% of records
 * - Missing tire sizes: <1% of records
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { db } from "../src/lib/fitment-db/db";
import { sql } from "drizzle-orm";

// ============================================================================
// Thresholds
// ============================================================================

const THRESHOLDS = {
  maxIncompleteRecords: 0,    // Class C
  maxInvalidRecords: 0,       // Class D
  minWheelSizeCoverage: 0.99, // 99%
  minTireSizeCoverage: 0.99,  // 99%
  minBoltPatternCoverage: 1.0, // 100%
  minCenterBoreCoverage: 1.0,  // 100%
};

// ============================================================================
// Validation Functions (same as full-database-audit.ts)
// ============================================================================

function isValidBoltPattern(pattern: string): boolean {
  if (!pattern) return false;
  return /^\d+x\d+(\.\d+)?$/.test(pattern);
}

function isValidCenterBore(cb: string): boolean {
  if (!cb) return false;
  const num = parseFloat(cb);
  return !isNaN(num) && num >= 50 && num <= 180;
}

function isValidThreadSize(thread: string): boolean {
  if (!thread) return false;
  return /M\d+/i.test(thread);
}

function isValidWheelSizes(sizes: any): boolean {
  if (!sizes || !Array.isArray(sizes) || sizes.length === 0) return false;
  const first = sizes[0];
  if (typeof first === "string" && first.includes("[object")) return false;
  if (typeof first === "object" && first !== null && first.diameter) return true;
  if (typeof first === "string" && /\d+[xXjJ]?\d*/.test(first)) return true;
  return false;
}

function isValidTireSizes(sizes: any): boolean {
  if (!sizes || !Array.isArray(sizes) || sizes.length === 0) return false;
  const first = sizes[0];
  if (typeof first === "string" && /\d+\/\d+[RrZz]?\d+/.test(first)) return true;
  if (typeof first === "string" && first.includes("[object")) return false;
  return false;
}

// ============================================================================
// Main Check
// ============================================================================

async function main() {
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  PRE-DEPLOY INTEGRITY CHECK");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log(`  Timestamp: ${new Date().toISOString()}\n`);

  const allRecords = await db.execute(sql`
    SELECT 
      id, year, make, model, display_trim,
      bolt_pattern, center_bore_mm, thread_size,
      oem_wheel_sizes, oem_tire_sizes
    FROM vehicle_fitments
  `);
  
  const records = allRecords.rows as any[];
  const total = records.length;
  
  console.log(`Total records: ${total}\n`);

  // Counters
  let classC = 0; // Incomplete
  let classD = 0; // Invalid
  let hasBoltPattern = 0;
  let hasCenterBore = 0;
  let hasWheelSizes = 0;
  let hasTireSizes = 0;
  
  const problems: string[] = [];

  for (const row of records) {
    const issues: string[] = [];
    
    // Critical fields
    const validYear = row.year >= 1900 && row.year <= 2030;
    const validBolt = isValidBoltPattern(row.bolt_pattern);
    const validCB = isValidCenterBore(row.center_bore_mm);
    const validThread = isValidThreadSize(row.thread_size);
    const validWheels = isValidWheelSizes(row.oem_wheel_sizes);
    const validTires = isValidTireSizes(row.oem_tire_sizes);
    
    if (!validYear) issues.push("invalid_year");
    if (!validBolt) issues.push("invalid_bolt_pattern");
    if (!validCB) issues.push("invalid_center_bore");
    if (!validThread) issues.push("missing_thread_size");
    
    // Count coverage
    if (validBolt) hasBoltPattern++;
    if (validCB) hasCenterBore++;
    if (validWheels) hasWheelSizes++;
    if (validTires) hasTireSizes++;
    
    // Classification
    const criticalMissing = [!validYear, !validBolt, !validCB].filter(Boolean).length;
    
    if (criticalMissing >= 3) {
      classD++;
      problems.push(`INVALID: ${row.year} ${row.make} ${row.model} - ${issues.join(", ")}`);
    } else if (criticalMissing > 0) {
      classC++;
      problems.push(`INCOMPLETE: ${row.year} ${row.make} ${row.model} - ${issues.join(", ")}`);
    }
  }

  // Calculate percentages
  const boltCoverage = hasBoltPattern / total;
  const cbCoverage = hasCenterBore / total;
  const wheelCoverage = hasWheelSizes / total;
  const tireCoverage = hasTireSizes / total;

  // Output results
  console.log("CLASSIFICATION:");
  console.log(`  Class C (Incomplete): ${classC}`);
  console.log(`  Class D (Invalid):    ${classD}`);
  console.log();
  
  console.log("COVERAGE:");
  console.log(`  Bolt pattern: ${(boltCoverage * 100).toFixed(2)}%`);
  console.log(`  Center bore:  ${(cbCoverage * 100).toFixed(2)}%`);
  console.log(`  Wheel sizes:  ${(wheelCoverage * 100).toFixed(2)}%`);
  console.log(`  Tire sizes:   ${(tireCoverage * 100).toFixed(2)}%`);
  console.log();

  // Check thresholds
  const failures: string[] = [];
  
  if (classC > THRESHOLDS.maxIncompleteRecords) {
    failures.push(`❌ Class C records (${classC}) exceeds threshold (${THRESHOLDS.maxIncompleteRecords})`);
  }
  if (classD > THRESHOLDS.maxInvalidRecords) {
    failures.push(`❌ Class D records (${classD}) exceeds threshold (${THRESHOLDS.maxInvalidRecords})`);
  }
  if (boltCoverage < THRESHOLDS.minBoltPatternCoverage) {
    failures.push(`❌ Bolt pattern coverage (${(boltCoverage*100).toFixed(1)}%) below threshold (${THRESHOLDS.minBoltPatternCoverage*100}%)`);
  }
  if (cbCoverage < THRESHOLDS.minCenterBoreCoverage) {
    failures.push(`❌ Center bore coverage (${(cbCoverage*100).toFixed(1)}%) below threshold (${THRESHOLDS.minCenterBoreCoverage*100}%)`);
  }
  if (wheelCoverage < THRESHOLDS.minWheelSizeCoverage) {
    failures.push(`❌ Wheel size coverage (${(wheelCoverage*100).toFixed(1)}%) below threshold (${THRESHOLDS.minWheelSizeCoverage*100}%)`);
  }
  if (tireCoverage < THRESHOLDS.minTireSizeCoverage) {
    failures.push(`❌ Tire size coverage (${(tireCoverage*100).toFixed(1)}%) below threshold (${THRESHOLDS.minTireSizeCoverage*100}%)`);
  }

  if (failures.length > 0) {
    console.log("═══════════════════════════════════════════════════════════════");
    console.log("  ❌ INTEGRITY CHECK FAILED");
    console.log("═══════════════════════════════════════════════════════════════\n");
    
    for (const f of failures) {
      console.log(`  ${f}`);
    }
    
    if (problems.length > 0) {
      console.log("\nPROBLEM RECORDS (first 20):");
      for (const p of problems.slice(0, 20)) {
        console.log(`  ${p}`);
      }
    }
    
    console.log("\n⛔ Deployment blocked. Fix data issues before deploying.");
    process.exit(1);
  }

  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  ✅ INTEGRITY CHECK PASSED");
  console.log("═══════════════════════════════════════════════════════════════");
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
