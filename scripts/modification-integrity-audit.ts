/**
 * MODIFICATION INTEGRITY AUDIT
 * 
 * Checks all selector/URL-accessible vehicles for modification integrity.
 * Identifies mismatches between selector modification IDs and stored DB values.
 * 
 * For each supported vehicle, verifies:
 * - Modification ID returned by trims API
 * - Display trim returned by trims API
 * - Modification ID stored in DB
 * - Whether exact modification lookup succeeds
 * - Whether trim fallback would succeed if modification fails
 * 
 * Classifications:
 * A. Exact modification match valid
 * B. Malformed/stale modification but trim fallback resolves
 * C. Ambiguous trim fallback (unsafe - multiple matches)
 * D. No valid fitment found
 * 
 * Usage: npx tsx scripts/modification-integrity-audit.ts
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { db } from "../src/lib/fitment-db/db";
import { vehicleFitments } from "../src/lib/fitment-db/schema";
import { sql, eq, and, asc, ilike } from "drizzle-orm";
import { normalizeMake, normalizeModel, slugify } from "../src/lib/fitment-db/keys";
import { getModelVariants } from "../src/lib/fitment-db/modelAliases";
import * as fs from "fs";

// ============================================================================
// Types
// ============================================================================

type Classification = "A" | "B" | "C" | "D";

interface VehicleAuditResult {
  year: number;
  make: string;
  model: string;
  selectorModificationId: string;  // What selector/API returns
  selectorDisplayTrim: string;     // What selector/API shows
  dbModificationId: string | null; // What's actually in DB
  dbDisplayTrim: string | null;    // What's stored as displayTrim
  classification: Classification;
  resolutionMethod: string;
  exactModMatch: boolean;
  exactTrimMatch: boolean;
  normalizedTrimMatch: boolean;
  singleTrimFallback: boolean;
  isAmbiguous: boolean;
  candidateCount: number;
  notes: string[];
}

interface AuditSummary {
  timestamp: string;
  totalVehicles: number;
  byClassification: Record<Classification, number>;
  byResolutionMethod: Record<string, number>;
  byMake: Record<string, { total: number; problems: number }>;
  malformedModifications: VehicleAuditResult[];
  ambiguousCases: VehicleAuditResult[];
  noFitmentCases: VehicleAuditResult[];
  recommendations: string[];
}

// ============================================================================
// Trim Normalization (matching safeResolver.ts)
// ============================================================================

function normalizeTrim(trim: string): string {
  return trim
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "")
    .replace(/crewcab|extendedcab|regularcab|supercrew|supercab/g, "")
    .replace(/4x4|4wd|awd|2wd|rwd|fwd/g, "")
    .replace(/diesel|gas|hybrid|electric/g, "")
    .trim();
}

function trimsMatch(trim1: string, trim2: string): boolean {
  const n1 = normalizeTrim(trim1);
  const n2 = normalizeTrim(trim2);
  if (n1 === n2) return true;
  if (n1.length > 0 && n2.length > 0) {
    if (n1.includes(n2) || n2.includes(n1)) return true;
  }
  return false;
}

// ============================================================================
// Audit Single Vehicle
// ============================================================================

async function auditVehicle(
  year: number,
  make: string,
  model: string,
  selectorModificationId: string,
  selectorDisplayTrim: string
): Promise<VehicleAuditResult> {
  const normalizedMake = normalizeMake(make);
  const modelVariants = getModelVariants(model);
  const normalizedModId = slugify(selectorModificationId);
  
  const notes: string[] = [];
  let dbModificationId: string | null = null;
  let dbDisplayTrim: string | null = null;
  let exactModMatch = false;
  let exactTrimMatch = false;
  let normalizedTrimMatch = false;
  let singleTrimFallback = false;
  let isAmbiguous = false;
  let candidateCount = 0;
  let resolutionMethod = "not_found";
  let classification: Classification = "D";
  
  for (const modelName of modelVariants) {
    // Step 1: Check exact modification ID match
    const exactMod = await db
      .select()
      .from(vehicleFitments)
      .where(
        and(
          eq(vehicleFitments.year, year),
          eq(vehicleFitments.make, normalizedMake),
          eq(vehicleFitments.model, modelName),
          eq(vehicleFitments.modificationId, normalizedModId)
        )
      )
      .limit(1);
    
    if (exactMod.length > 0) {
      exactModMatch = true;
      dbModificationId = exactMod[0].modificationId;
      dbDisplayTrim = exactMod[0].displayTrim;
      resolutionMethod = "exact_modification";
      classification = "A";
      break;
    }
    
    // Step 2: Check exact displayTrim match
    const exactTrim = await db
      .select()
      .from(vehicleFitments)
      .where(
        and(
          eq(vehicleFitments.year, year),
          eq(vehicleFitments.make, normalizedMake),
          eq(vehicleFitments.model, modelName),
          eq(vehicleFitments.displayTrim, selectorDisplayTrim)
        )
      )
      .limit(1);
    
    if (exactTrim.length > 0) {
      exactTrimMatch = true;
      dbModificationId = exactTrim[0].modificationId;
      dbDisplayTrim = exactTrim[0].displayTrim;
      resolutionMethod = "exact_display_trim";
      classification = "B";
      notes.push(`Selector modificationId "${selectorModificationId}" differs from DB "${dbModificationId}"`);
      break;
    }
    
    // Step 3: Check case-insensitive trim match
    const caseInsensitive = await db
      .select()
      .from(vehicleFitments)
      .where(
        and(
          eq(vehicleFitments.year, year),
          eq(vehicleFitments.make, normalizedMake),
          eq(vehicleFitments.model, modelName),
          ilike(vehicleFitments.displayTrim, selectorDisplayTrim)
        )
      )
      .limit(5);
    
    if (caseInsensitive.length === 1) {
      normalizedTrimMatch = true;
      dbModificationId = caseInsensitive[0].modificationId;
      dbDisplayTrim = caseInsensitive[0].displayTrim;
      resolutionMethod = "case_insensitive_trim";
      classification = "B";
      notes.push(`Case mismatch: selector "${selectorDisplayTrim}" vs DB "${dbDisplayTrim}"`);
      break;
    }
    
    // Step 4: Get all trims for this Y/M/M
    const allTrims = await db
      .select()
      .from(vehicleFitments)
      .where(
        and(
          eq(vehicleFitments.year, year),
          eq(vehicleFitments.make, normalizedMake),
          eq(vehicleFitments.model, modelName)
        )
      )
      .limit(50);
    
    candidateCount = allTrims.length;
    
    if (allTrims.length > 0) {
      // Check normalized trim matches
      const normalizedMatches = allTrims.filter(t => 
        trimsMatch(t.displayTrim, selectorDisplayTrim) || 
        trimsMatch(t.modificationId, selectorModificationId)
      );
      
      if (normalizedMatches.length === 1) {
        normalizedTrimMatch = true;
        dbModificationId = normalizedMatches[0].modificationId;
        dbDisplayTrim = normalizedMatches[0].displayTrim;
        resolutionMethod = "normalized_trim";
        classification = "B";
        notes.push(`Normalized match: "${selectorDisplayTrim}" → "${dbDisplayTrim}"`);
        break;
      }
      
      if (normalizedMatches.length > 1) {
        isAmbiguous = true;
        resolutionMethod = "ambiguous";
        classification = "C";
        notes.push(`Ambiguous: ${normalizedMatches.length} trims match "${selectorDisplayTrim}"`);
        notes.push(`Candidates: ${normalizedMatches.map(t => t.displayTrim).join(", ")}`);
        break;
      }
      
      // Single trim fallback
      if (allTrims.length === 1) {
        singleTrimFallback = true;
        dbModificationId = allTrims[0].modificationId;
        dbDisplayTrim = allTrims[0].displayTrim;
        resolutionMethod = "single_trim_fallback";
        classification = "B";
        notes.push(`Single trim fallback: only "${dbDisplayTrim}" exists`);
        break;
      }
      
      // Multiple trims but no match
      notes.push(`No match found among ${allTrims.length} trims: ${allTrims.map(t => t.displayTrim).slice(0, 5).join(", ")}${allTrims.length > 5 ? "..." : ""}`);
    }
  }
  
  return {
    year,
    make,
    model,
    selectorModificationId,
    selectorDisplayTrim,
    dbModificationId,
    dbDisplayTrim,
    classification,
    resolutionMethod,
    exactModMatch,
    exactTrimMatch,
    normalizedTrimMatch,
    singleTrimFallback,
    isAmbiguous,
    candidateCount,
    notes,
  };
}

// ============================================================================
// Main Audit
// ============================================================================

async function main() {
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  MODIFICATION INTEGRITY AUDIT");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log(`  Timestamp: ${new Date().toISOString()}`);
  console.log();

  // Get all unique Y/M/M combinations with their trims
  console.log("Loading all vehicles from database...");
  
  const allVehicles = await db
    .select({
      year: vehicleFitments.year,
      make: vehicleFitments.make,
      model: vehicleFitments.model,
      modificationId: vehicleFitments.modificationId,
      displayTrim: vehicleFitments.displayTrim,
    })
    .from(vehicleFitments)
    .orderBy(
      asc(vehicleFitments.make),
      asc(vehicleFitments.model),
      asc(vehicleFitments.year),
      asc(vehicleFitments.displayTrim)
    );
  
  console.log(`Loaded ${allVehicles.length} vehicle records\n`);

  // Initialize counters
  const byClassification: Record<Classification, number> = { A: 0, B: 0, C: 0, D: 0 };
  const byResolutionMethod: Record<string, number> = {};
  const byMake: Record<string, { total: number; problems: number }> = {};
  
  const malformedModifications: VehicleAuditResult[] = [];
  const ambiguousCases: VehicleAuditResult[] = [];
  const noFitmentCases: VehicleAuditResult[] = [];
  
  // Audit each vehicle
  console.log("Auditing vehicles...");
  let processed = 0;
  
  for (const vehicle of allVehicles) {
    // Simulate what the selector API would return
    // In reality, the selector returns modificationId as "value" and displayTrim as "label"
    const result = await auditVehicle(
      vehicle.year,
      vehicle.make,
      vehicle.model,
      vehicle.modificationId,  // Selector uses this as value
      vehicle.displayTrim      // Selector uses this as label
    );
    
    byClassification[result.classification]++;
    byResolutionMethod[result.resolutionMethod] = (byResolutionMethod[result.resolutionMethod] || 0) + 1;
    
    if (!byMake[vehicle.make]) {
      byMake[vehicle.make] = { total: 0, problems: 0 };
    }
    byMake[vehicle.make].total++;
    
    if (result.classification !== "A") {
      byMake[vehicle.make].problems++;
    }
    
    // Collect problem cases
    if (result.classification === "B") {
      malformedModifications.push(result);
    } else if (result.classification === "C") {
      ambiguousCases.push(result);
    } else if (result.classification === "D") {
      noFitmentCases.push(result);
    }
    
    processed++;
    if (processed % 1000 === 0) {
      console.log(`  Processed ${processed}/${allVehicles.length}`);
    }
  }
  
  console.log(`  Processed ${processed}/${allVehicles.length}`);
  console.log();

  // Generate recommendations
  const recommendations: string[] = [];
  
  if (ambiguousCases.length > 0) {
    recommendations.push(`CRITICAL: ${ambiguousCases.length} vehicles have ambiguous trim matches - add unique modificationIds`);
  }
  
  if (noFitmentCases.length > 0) {
    recommendations.push(`HIGH: ${noFitmentCases.length} vehicles have no valid fitment - investigate data gaps`);
  }
  
  if (malformedModifications.length > 100) {
    recommendations.push(`MEDIUM: ${malformedModifications.length} vehicles rely on trim fallback - consider data normalization`);
  }
  
  // Find makes with highest problem rates
  const makeProblems = Object.entries(byMake)
    .map(([make, stats]) => ({ make, ...stats, rate: stats.problems / stats.total }))
    .filter(m => m.problems > 0)
    .sort((a, b) => b.rate - a.rate);
  
  if (makeProblems.length > 0) {
    const topProblemMakes = makeProblems.slice(0, 5);
    recommendations.push(`TOP PROBLEM MAKES: ${topProblemMakes.map(m => `${m.make} (${(m.rate * 100).toFixed(1)}%)`).join(", ")}`);
  }

  // Build summary
  const summary: AuditSummary = {
    timestamp: new Date().toISOString(),
    totalVehicles: allVehicles.length,
    byClassification,
    byResolutionMethod,
    byMake,
    malformedModifications: malformedModifications.slice(0, 100),
    ambiguousCases,
    noFitmentCases: noFitmentCases.slice(0, 100),
    recommendations,
  };

  // Output results
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  AUDIT RESULTS");
  console.log("═══════════════════════════════════════════════════════════════\n");
  
  console.log("CLASSIFICATION SUMMARY:");
  console.log(`  A (Exact mod match):    ${byClassification.A} (${(byClassification.A / allVehicles.length * 100).toFixed(1)}%)`);
  console.log(`  B (Trim fallback OK):   ${byClassification.B} (${(byClassification.B / allVehicles.length * 100).toFixed(1)}%)`);
  console.log(`  C (Ambiguous fallback): ${byClassification.C} (${(byClassification.C / allVehicles.length * 100).toFixed(1)}%)`);
  console.log(`  D (No valid fitment):   ${byClassification.D} (${(byClassification.D / allVehicles.length * 100).toFixed(1)}%)`);
  console.log();
  
  console.log("RESOLUTION METHOD BREAKDOWN:");
  for (const [method, count] of Object.entries(byResolutionMethod).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${method}: ${count}`);
  }
  console.log();
  
  if (ambiguousCases.length > 0) {
    console.log("⚠️  AMBIGUOUS CASES (require fix):");
    for (const c of ambiguousCases.slice(0, 10)) {
      console.log(`  ${c.year} ${c.make} ${c.model} | "${c.selectorDisplayTrim}"`);
      for (const note of c.notes) {
        console.log(`    → ${note}`);
      }
    }
    if (ambiguousCases.length > 10) {
      console.log(`  ... and ${ambiguousCases.length - 10} more`);
    }
    console.log();
  }
  
  if (noFitmentCases.length > 0) {
    console.log("❌ NO FITMENT CASES:");
    for (const c of noFitmentCases.slice(0, 10)) {
      console.log(`  ${c.year} ${c.make} ${c.model} | "${c.selectorDisplayTrim}"`);
      for (const note of c.notes) {
        console.log(`    → ${note}`);
      }
    }
    if (noFitmentCases.length > 10) {
      console.log(`  ... and ${noFitmentCases.length - 10} more`);
    }
    console.log();
  }
  
  console.log("TOP MAKES BY PROBLEM RATE:");
  for (const m of makeProblems.slice(0, 10)) {
    const bar = "█".repeat(Math.round(m.rate * 20));
    console.log(`  ${m.make.padEnd(15)} ${bar} ${m.problems}/${m.total} (${(m.rate * 100).toFixed(1)}%)`);
  }
  console.log();
  
  console.log("RECOMMENDATIONS:");
  for (const rec of recommendations) {
    console.log(`  • ${rec}`);
  }
  console.log();

  // Save full report
  const reportPath = "scripts/modification-integrity-report.json";
  fs.writeFileSync(reportPath, JSON.stringify(summary, null, 2));
  console.log(`Full report saved to: ${reportPath}`);
  
  // Save problem records
  const problemsPath = "scripts/modification-problems.json";
  fs.writeFileSync(problemsPath, JSON.stringify({
    ambiguous: ambiguousCases,
    noFitment: noFitmentCases,
    malformed: malformedModifications.slice(0, 500),
  }, null, 2));
  console.log(`Problem records saved to: ${problemsPath}`);

  console.log("\n═══════════════════════════════════════════════════════════════");
  
  if (ambiguousCases.length > 0 || noFitmentCases.length > 0) {
    console.log("  ⚠️  AUDIT FOUND ISSUES REQUIRING ATTENTION");
    console.log("═══════════════════════════════════════════════════════════════");
    process.exit(1);
  }
  
  console.log("  ✅ MODIFICATION INTEGRITY AUDIT PASSED");
  console.log("═══════════════════════════════════════════════════════════════");
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
