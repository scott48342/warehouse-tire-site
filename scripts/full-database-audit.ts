/**
 * FULL DATABASE INTEGRITY AUDIT
 * 
 * Validates EVERY record in vehicle_fitments for data completeness and usability.
 * 
 * Run: npx tsx scripts/full-database-audit.ts
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { db } from "../src/lib/fitment-db/db";
import { sql } from "drizzle-orm";
import * as fs from "fs";

// ============================================================================
// Types
// ============================================================================

type Classification = "A" | "B" | "C" | "D";

interface AuditResult {
  id: string;
  year: number;
  make: string;
  model: string;
  displayTrim: string;
  classification: Classification;
  issues: string[];
  missingFields: string[];
}

interface AuditSummary {
  timestamp: string;
  totalRecords: number;
  byClassification: Record<Classification, number>;
  issueBreakdown: Record<string, number>;
  missingFieldBreakdown: Record<string, number>;
  incompleteRecords: AuditResult[];
  invalidRecords: AuditResult[];
  sampleProblematic: AuditResult[];
  recommendations: string[];
}

// ============================================================================
// Validation Functions
// ============================================================================

function isValidString(val: any): boolean {
  return typeof val === "string" && val.trim().length > 0;
}

function isValidNumber(val: any): boolean {
  return typeof val === "number" && !isNaN(val) && val > 0;
}

function isValidArray(val: any): boolean {
  return Array.isArray(val) && val.length > 0;
}

function isValidWheelSizes(sizes: any): { valid: boolean; reason?: string } {
  if (!sizes || !Array.isArray(sizes) || sizes.length === 0) {
    return { valid: false, reason: "empty_or_null" };
  }
  
  const first = sizes[0];
  
  // Check for corrupted [object Object] strings
  if (typeof first === "string" && first.includes("[object")) {
    return { valid: false, reason: "corrupted_object_string" };
  }
  
  // Check for proper object format
  if (typeof first === "object" && first !== null && first.diameter) {
    return { valid: true };
  }
  
  // Check for string format like "18x8" or "7.5Jx17"
  if (typeof first === "string" && /\d+[xX]\d+/.test(first)) {
    return { valid: true };
  }
  
  if (typeof first === "string" && /\d+J?[xX]\d+/.test(first)) {
    return { valid: true };
  }
  
  return { valid: false, reason: "unrecognized_format" };
}

function isValidTireSizes(sizes: any): { valid: boolean; reason?: string } {
  if (!sizes || !Array.isArray(sizes) || sizes.length === 0) {
    return { valid: false, reason: "empty_or_null" };
  }
  
  const first = sizes[0];
  
  // Check for tire size format like "225/45R17" or "P265/70R17"
  if (typeof first === "string") {
    if (/\d+\/\d+[RrZz]\d+/.test(first)) {
      return { valid: true };
    }
    if (first.includes("[object")) {
      return { valid: false, reason: "corrupted_object_string" };
    }
  }
  
  return { valid: false, reason: "unrecognized_format" };
}

function isJunkTrim(trim: string): boolean {
  if (!trim) return true;
  const lower = trim.toLowerCase();
  
  // Known junk patterns
  const junkPatterns = [
    /^\d+$/,                    // Just numbers
    /^[a-z]$/i,                 // Single letter
    /^\s*$/,                    // Whitespace only
    /^\[object/,                // Object toString
    /^undefined$/,
    /^null$/,
  ];
  
  return junkPatterns.some(p => p.test(lower));
}

function isValidBoltPattern(pattern: string): boolean {
  if (!pattern) return false;
  // Valid formats: "5x114.3", "6x139.7", "8x165.1"
  return /^\d+x\d+(\.\d+)?$/.test(pattern);
}

function isValidCenterBore(cb: string): boolean {
  if (!cb) return false;
  const num = parseFloat(cb);
  // Reasonable range: 50mm to 180mm
  return !isNaN(num) && num >= 50 && num <= 180;
}

function isValidThreadSize(thread: string): boolean {
  if (!thread) return false;
  // Valid formats: "M12x1.5", "M14x1.5", "M14 x 1.5"
  return /M\d+/i.test(thread);
}

// ============================================================================
// Main Audit Function
// ============================================================================

async function auditRecord(row: any): Promise<AuditResult> {
  const issues: string[] = [];
  const missingFields: string[] = [];
  
  // 1. IDENTITY VALIDATION
  if (!isValidNumber(row.year) || row.year < 1900 || row.year > 2030) {
    issues.push("invalid_year");
    missingFields.push("year");
  }
  
  if (!isValidString(row.make)) {
    issues.push("missing_make");
    missingFields.push("make");
  }
  
  if (!isValidString(row.model)) {
    issues.push("missing_model");
    missingFields.push("model");
  }
  
  if (!isValidString(row.display_trim) || isJunkTrim(row.display_trim)) {
    issues.push("invalid_trim");
    missingFields.push("display_trim");
  }
  
  // 2. CORE FITMENT VALIDATION (REQUIRED)
  if (!isValidBoltPattern(row.bolt_pattern)) {
    issues.push("invalid_bolt_pattern");
    missingFields.push("bolt_pattern");
  }
  
  if (!isValidCenterBore(row.center_bore_mm)) {
    issues.push("invalid_center_bore");
    missingFields.push("center_bore_mm");
  }
  
  if (!isValidThreadSize(row.thread_size)) {
    issues.push("missing_thread_size");
    missingFields.push("thread_size");
  }
  
  // 3. WHEEL DATA VALIDATION (REQUIRED)
  const wheelCheck = isValidWheelSizes(row.oem_wheel_sizes);
  if (!wheelCheck.valid) {
    issues.push(`invalid_wheel_sizes:${wheelCheck.reason}`);
    missingFields.push("oem_wheel_sizes");
  }
  
  const tireCheck = isValidTireSizes(row.oem_tire_sizes);
  if (!tireCheck.valid) {
    issues.push(`invalid_tire_sizes:${tireCheck.reason}`);
    missingFields.push("oem_tire_sizes");
  }
  
  // 4. OFFSET DATA (non-critical but important)
  if (!row.offset_min_mm && !row.offset_max_mm) {
    issues.push("missing_offset_data");
  }
  
  // Classification logic
  let classification: Classification;
  
  const criticalMissing = missingFields.filter(f => 
    ["bolt_pattern", "center_bore_mm", "year", "make", "model"].includes(f)
  );
  
  const hasCorruptedData = issues.some(i => 
    i.includes("corrupted") || i.includes("invalid_year")
  );
  
  if (hasCorruptedData || criticalMissing.length >= 3) {
    classification = "D"; // INVALID
  } else if (criticalMissing.length > 0) {
    classification = "C"; // INCOMPLETE
  } else if (issues.length > 0) {
    classification = "B"; // PARTIAL
  } else {
    classification = "A"; // COMPLETE
  }
  
  return {
    id: row.id,
    year: row.year,
    make: row.make,
    model: row.model,
    displayTrim: row.display_trim,
    classification,
    issues,
    missingFields,
  };
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  FULL DATABASE INTEGRITY AUDIT");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log(`  Started: ${new Date().toISOString()}`);
  console.log();

  // Fetch ALL records
  console.log("Loading all records...");
  const allRecords = await db.execute(sql`
    SELECT 
      id, year, make, model, modification_id, display_trim, submodel,
      bolt_pattern, center_bore_mm, thread_size,
      oem_wheel_sizes, oem_tire_sizes,
      offset_min_mm, offset_max_mm,
      source, created_at
    FROM vehicle_fitments
    ORDER BY make, model, year
  `);
  
  const records = allRecords.rows as any[];
  console.log(`Loaded ${records.length} records\n`);
  
  // Audit each record
  console.log("Auditing records...");
  const results: AuditResult[] = [];
  const byClassification: Record<Classification, number> = { A: 0, B: 0, C: 0, D: 0 };
  const issueBreakdown: Record<string, number> = {};
  const missingFieldBreakdown: Record<string, number> = {};
  
  let processed = 0;
  for (const row of records) {
    const result = await auditRecord(row);
    results.push(result);
    
    byClassification[result.classification]++;
    
    for (const issue of result.issues) {
      issueBreakdown[issue] = (issueBreakdown[issue] || 0) + 1;
    }
    
    for (const field of result.missingFields) {
      missingFieldBreakdown[field] = (missingFieldBreakdown[field] || 0) + 1;
    }
    
    processed++;
    if (processed % 1000 === 0) {
      console.log(`  Processed ${processed}/${records.length}`);
    }
  }
  
  console.log(`  Processed ${processed}/${records.length}`);
  console.log();
  
  // Collect problematic records
  const incompleteRecords = results.filter(r => r.classification === "C");
  const invalidRecords = results.filter(r => r.classification === "D");
  
  // Sample problematic records for review
  const sampleProblematic = [
    ...incompleteRecords.slice(0, 25),
    ...invalidRecords.slice(0, 25),
  ];
  
  // Generate recommendations
  const recommendations: string[] = [];
  
  if (missingFieldBreakdown["thread_size"] > 100) {
    recommendations.push(`PRIORITY: ${missingFieldBreakdown["thread_size"]} records missing thread_size - needs bulk backfill`);
  }
  if (missingFieldBreakdown["oem_wheel_sizes"] > 100) {
    recommendations.push(`PRIORITY: ${missingFieldBreakdown["oem_wheel_sizes"]} records missing wheel sizes - needs derivation from tire sizes`);
  }
  if (missingFieldBreakdown["oem_tire_sizes"] > 100) {
    recommendations.push(`PRIORITY: ${missingFieldBreakdown["oem_tire_sizes"]} records missing tire sizes - needs external data source`);
  }
  if (invalidRecords.length > 0) {
    recommendations.push(`CRITICAL: ${invalidRecords.length} invalid records should be deleted or completely rebuilt`);
  }
  if (issueBreakdown["invalid_trim"] > 100) {
    recommendations.push(`CLEANUP: ${issueBreakdown["invalid_trim"]} records have junk trim names - normalize to "Base"`);
  }
  
  // Build summary
  const summary: AuditSummary = {
    timestamp: new Date().toISOString(),
    totalRecords: records.length,
    byClassification,
    issueBreakdown,
    missingFieldBreakdown,
    incompleteRecords: incompleteRecords.slice(0, 100), // Limit for file size
    invalidRecords: invalidRecords.slice(0, 100),
    sampleProblematic,
    recommendations,
  };
  
  // Output results
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  AUDIT RESULTS");
  console.log("═══════════════════════════════════════════════════════════════\n");
  
  console.log("CLASSIFICATION SUMMARY:");
  console.log(`  A (Complete):   ${byClassification.A} (${(byClassification.A / records.length * 100).toFixed(1)}%)`);
  console.log(`  B (Partial):    ${byClassification.B} (${(byClassification.B / records.length * 100).toFixed(1)}%)`);
  console.log(`  C (Incomplete): ${byClassification.C} (${(byClassification.C / records.length * 100).toFixed(1)}%)`);
  console.log(`  D (Invalid):    ${byClassification.D} (${(byClassification.D / records.length * 100).toFixed(1)}%)`);
  console.log();
  
  console.log("TOP MISSING FIELDS:");
  const sortedFields = Object.entries(missingFieldBreakdown)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  for (const [field, count] of sortedFields) {
    console.log(`  ${field}: ${count} records`);
  }
  console.log();
  
  console.log("TOP ISSUES:");
  const sortedIssues = Object.entries(issueBreakdown)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15);
  for (const [issue, count] of sortedIssues) {
    console.log(`  ${issue}: ${count}`);
  }
  console.log();
  
  console.log("SAMPLE INCOMPLETE RECORDS:");
  for (const r of incompleteRecords.slice(0, 10)) {
    console.log(`  ${r.year} ${r.make} ${r.model} (${r.displayTrim}): ${r.missingFields.join(", ")}`);
  }
  console.log();
  
  if (invalidRecords.length > 0) {
    console.log("SAMPLE INVALID RECORDS:");
    for (const r of invalidRecords.slice(0, 10)) {
      console.log(`  ${r.year} ${r.make} ${r.model} (${r.displayTrim}): ${r.issues.join(", ")}`);
    }
    console.log();
  }
  
  console.log("RECOMMENDATIONS:");
  for (const rec of recommendations) {
    console.log(`  • ${rec}`);
  }
  console.log();
  
  // Save full report
  const reportPath = "scripts/full-audit-report.json";
  fs.writeFileSync(reportPath, JSON.stringify(summary, null, 2));
  console.log(`Full report saved to: ${reportPath}`);
  
  // Save list of all C/D records for review
  const problemRecordsPath = "scripts/problem-records.json";
  fs.writeFileSync(problemRecordsPath, JSON.stringify({
    incomplete: incompleteRecords,
    invalid: invalidRecords,
  }, null, 2));
  console.log(`Problem records saved to: ${problemRecordsPath}`);
  
  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log("  AUDIT COMPLETE");
  console.log("═══════════════════════════════════════════════════════════════");
  
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
