/**
 * Fitment Quality Audit
 * 
 * Evaluates every fitment record for:
 * A) Submodel/trim quality
 * B) Core fitment completeness
 * C) Package/search readiness
 * 
 * Run: npx tsx scripts/fitment-quality-audit.ts
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { db } from "../src/lib/fitment-db/db";
import { vehicleFitments } from "../src/lib/fitment-db/schema";
import { sql } from "drizzle-orm";
import * as fs from "fs";

// ============================================================================
// TYPES
// ============================================================================

interface RecordAudit {
  id: string;
  year: number;
  make: string;
  model: string;
  modificationId: string;
  displayTrim: string;
  source: string;
  
  // Quality scores
  trimQuality: "good" | "acceptable" | "placeholder" | "junk";
  fitmentCompleteness: "complete" | "usable" | "partial" | "missing";
  searchReadiness: "launch_ready" | "searchable" | "needs_cleanup" | "block";
  
  // Issue flags
  issues: string[];
  
  // Field presence
  hasBoltPattern: boolean;
  hasCenterBore: boolean;
  hasThreadSize: boolean;
  hasOffsetRange: boolean;
  hasOemWheelSizes: boolean;
  hasOemTireSizes: boolean;
  hasStaggeredData: boolean;
}

interface AuditSummary {
  timestamp: string;
  totalRecords: number;
  
  // Quality buckets
  bySearchReadiness: {
    launch_ready: number;
    searchable: number;
    needs_cleanup: number;
    block: number;
  };
  
  byTrimQuality: {
    good: number;
    acceptable: number;
    placeholder: number;
    junk: number;
  };
  
  byFitmentCompleteness: {
    complete: number;
    usable: number;
    partial: number;
    missing: number;
  };
  
  // Field coverage
  fieldCoverage: {
    boltPattern: { present: number; missing: number; percent: number };
    centerBore: { present: number; missing: number; percent: number };
    threadSize: { present: number; missing: number; percent: number };
    offsetRange: { present: number; missing: number; percent: number };
    oemWheelSizes: { present: number; missing: number; percent: number };
    oemTireSizes: { present: number; missing: number; percent: number };
  };
  
  // Problem areas
  trimIssuesByMakeModel: Array<{
    make: string;
    model: string;
    issueCount: number;
    examples: string[];
  }>;
  
  fitmentIssuesByMakeModel: Array<{
    make: string;
    model: string;
    missingFields: string[];
    recordCount: number;
  }>;
  
  // Duplicate detection
  duplicateTrims: Array<{
    year: number;
    make: string;
    model: string;
    trims: string[];
    count: number;
  }>;
  
  // Bad record examples
  badRecordExamples: RecordAudit[];
  
  // Repair recommendations
  recommendations: Array<{
    priority: "critical" | "high" | "medium" | "low";
    issue: string;
    affectedRecords: number;
    repair: string;
  }>;
}

// ============================================================================
// QUALITY CHECKS
// ============================================================================

// Known junk/placeholder trim patterns
const JUNK_TRIM_PATTERNS = [
  /^s_[a-f0-9]{8}$/i,          // Generated hash IDs
  /^supp_/i,                    // Supplement placeholders
  /^\d{4}-.*-[a-f0-9]{8}$/i,   // Year-prefixed hash IDs
  /^[a-f0-9]{8,}$/i,           // Raw hashes
  /^modification_/i,            // Generic modification prefix
  /^trim_/i,                    // Generic trim prefix
  /^unknown$/i,
  /^n\/a$/i,
  /^none$/i,
  /^default$/i,
  /^\s*$/,                      // Empty/whitespace
];

// Acceptable generic trims (these are valid)
const ACCEPTABLE_GENERIC_TRIMS = [
  "base",
  "standard",
  "s",
  "se",
  "le",
  "xle",
  "xl",
  "xlt",
  "lx",
  "ex",
  "sport",
  "limited",
  "touring",
  "premium",
  "luxury",
];

function assessTrimQuality(displayTrim: string, modificationId: string): "good" | "acceptable" | "placeholder" | "junk" {
  const trimLower = (displayTrim || "").toLowerCase().trim();
  const modIdLower = (modificationId || "").toLowerCase();
  
  // Check for junk patterns
  for (const pattern of JUNK_TRIM_PATTERNS) {
    if (pattern.test(displayTrim) || pattern.test(modificationId)) {
      return "junk";
    }
  }
  
  // Empty or very short is junk
  if (!trimLower || trimLower.length < 1) {
    return "junk";
  }
  
  // "Base" with a generated mod ID is a placeholder
  if (trimLower === "base" && /[a-f0-9]{8}/.test(modIdLower)) {
    return "placeholder";
  }
  
  // Known acceptable generic trims
  if (ACCEPTABLE_GENERIC_TRIMS.includes(trimLower)) {
    return "acceptable";
  }
  
  // Real trim names (has letters, reasonable length)
  if (/^[a-z0-9\s\-\.\/]+$/i.test(displayTrim) && displayTrim.length >= 2 && displayTrim.length <= 50) {
    return "good";
  }
  
  return "acceptable";
}

function assessFitmentCompleteness(record: any): {
  completeness: "complete" | "usable" | "partial" | "missing";
  issues: string[];
  fields: {
    hasBoltPattern: boolean;
    hasCenterBore: boolean;
    hasThreadSize: boolean;
    hasOffsetRange: boolean;
    hasOemWheelSizes: boolean;
    hasOemTireSizes: boolean;
    hasStaggeredData: boolean;
  };
} {
  const issues: string[] = [];
  
  // Check each field
  const hasBoltPattern = !!record.bolt_pattern && record.bolt_pattern.length > 0;
  const hasCenterBore = record.center_bore_mm != null && parseFloat(record.center_bore_mm) > 0;
  const hasThreadSize = !!record.thread_size && record.thread_size.length > 0;
  const hasOffsetRange = record.offset_min_mm != null || record.offset_max_mm != null;
  
  // OEM wheel sizes - check if array has valid content
  let hasOemWheelSizes = false;
  if (record.oem_wheel_sizes) {
    if (Array.isArray(record.oem_wheel_sizes) && record.oem_wheel_sizes.length > 0) {
      // Check if it's actually useful data, not "[object Object]"
      const first = record.oem_wheel_sizes[0];
      if (typeof first === "object" && first !== null && first.diameter) {
        hasOemWheelSizes = true;
      } else if (typeof first === "string" && !first.includes("[object")) {
        hasOemWheelSizes = true;
      }
    }
  }
  
  // OEM tire sizes
  let hasOemTireSizes = false;
  if (record.oem_tire_sizes) {
    if (Array.isArray(record.oem_tire_sizes) && record.oem_tire_sizes.length > 0) {
      const first = record.oem_tire_sizes[0];
      if (typeof first === "string" && /\d+\/\d+R?\d+/.test(first)) {
        hasOemTireSizes = true;
      }
    }
  }
  
  // Check for staggered data
  let hasStaggeredData = false;
  if (hasOemWheelSizes && Array.isArray(record.oem_wheel_sizes)) {
    const axles = new Set(record.oem_wheel_sizes.map((w: any) => w?.axle).filter(Boolean));
    hasStaggeredData = axles.has("front") && axles.has("rear");
  }
  
  // Build issues list
  if (!hasBoltPattern) issues.push("missing_bolt_pattern");
  if (!hasCenterBore) issues.push("missing_center_bore");
  if (!hasThreadSize) issues.push("missing_thread_size");
  if (!hasOffsetRange) issues.push("missing_offset_range");
  if (!hasOemWheelSizes) issues.push("missing_oem_wheel_sizes");
  if (!hasOemTireSizes) issues.push("missing_oem_tire_sizes");
  
  // Validate bolt pattern format
  if (hasBoltPattern && !/^\d+x\d+(\.\d+)?$/.test(record.bolt_pattern)) {
    issues.push("invalid_bolt_pattern_format");
  }
  
  // Validate center bore is reasonable (40-180mm typical range)
  if (hasCenterBore) {
    const cb = parseFloat(record.center_bore_mm);
    if (cb < 40 || cb > 180) {
      issues.push("suspicious_center_bore");
    }
  }
  
  // Determine completeness level
  let completeness: "complete" | "usable" | "partial" | "missing";
  const criticalFields = [hasBoltPattern, hasCenterBore];
  const importantFields = [hasThreadSize, hasOffsetRange];
  const niceToHave = [hasOemWheelSizes, hasOemTireSizes];
  
  const criticalCount = criticalFields.filter(Boolean).length;
  const importantCount = importantFields.filter(Boolean).length;
  const niceCount = niceToHave.filter(Boolean).length;
  
  if (criticalCount === 2 && importantCount >= 1 && niceCount >= 1) {
    completeness = "complete";
  } else if (criticalCount === 2 && importantCount >= 1) {
    completeness = "usable";
  } else if (criticalCount >= 1) {
    completeness = "partial";
  } else {
    completeness = "missing";
  }
  
  return {
    completeness,
    issues,
    fields: {
      hasBoltPattern,
      hasCenterBore,
      hasThreadSize,
      hasOffsetRange,
      hasOemWheelSizes,
      hasOemTireSizes,
      hasStaggeredData,
    },
  };
}

function determineSearchReadiness(
  trimQuality: "good" | "acceptable" | "placeholder" | "junk",
  fitmentCompleteness: "complete" | "usable" | "partial" | "missing"
): "launch_ready" | "searchable" | "needs_cleanup" | "block" {
  // Block if fitment is missing critical data
  if (fitmentCompleteness === "missing") {
    return "block";
  }
  
  // Block if trim is junk
  if (trimQuality === "junk") {
    return "block";
  }
  
  // Needs cleanup if partial fitment or placeholder trim
  if (fitmentCompleteness === "partial" || trimQuality === "placeholder") {
    return "needs_cleanup";
  }
  
  // Searchable if usable fitment
  if (fitmentCompleteness === "usable") {
    return "searchable";
  }
  
  // Launch ready if complete and good/acceptable trim
  if (fitmentCompleteness === "complete" && (trimQuality === "good" || trimQuality === "acceptable")) {
    return "launch_ready";
  }
  
  return "searchable";
}

// ============================================================================
// MAIN AUDIT
// ============================================================================

async function runAudit(): Promise<AuditSummary> {
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  FITMENT QUALITY AUDIT");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log();
  
  // Fetch all records
  console.log("Loading all fitment records...");
  const records = await db.execute(sql`
    SELECT id, year, make, model, modification_id, display_trim, raw_trim, submodel,
           bolt_pattern, center_bore_mm, thread_size, seat_type,
           offset_min_mm, offset_max_mm, oem_wheel_sizes, oem_tire_sizes,
           source
    FROM vehicle_fitments
    ORDER BY make, model, year
  `);
  
  console.log(`Loaded ${records.rows.length} records. Auditing...`);
  
  const audits: RecordAudit[] = [];
  const issuesByMakeModel = new Map<string, { issues: string[]; count: number }>();
  const missingFieldsByMakeModel = new Map<string, { fields: Set<string>; count: number }>();
  
  // Counters
  const searchReadinessCounts = { launch_ready: 0, searchable: 0, needs_cleanup: 0, block: 0 };
  const trimQualityCounts = { good: 0, acceptable: 0, placeholder: 0, junk: 0 };
  const fitmentCompletenessCounts = { complete: 0, usable: 0, partial: 0, missing: 0 };
  const fieldCoverage = {
    boltPattern: { present: 0, missing: 0 },
    centerBore: { present: 0, missing: 0 },
    threadSize: { present: 0, missing: 0 },
    offsetRange: { present: 0, missing: 0 },
    oemWheelSizes: { present: 0, missing: 0 },
    oemTireSizes: { present: 0, missing: 0 },
  };
  
  // Audit each record
  for (const row of records.rows as any[]) {
    const trimQuality = assessTrimQuality(row.display_trim, row.modification_id);
    const fitmentResult = assessFitmentCompleteness(row);
    const searchReadiness = determineSearchReadiness(trimQuality, fitmentResult.completeness);
    
    const audit: RecordAudit = {
      id: row.id,
      year: row.year,
      make: row.make,
      model: row.model,
      modificationId: row.modification_id,
      displayTrim: row.display_trim,
      source: row.source,
      trimQuality,
      fitmentCompleteness: fitmentResult.completeness,
      searchReadiness,
      issues: fitmentResult.issues,
      ...fitmentResult.fields,
    };
    
    // Add trim quality issues
    if (trimQuality === "junk") {
      audit.issues.push("junk_trim");
    } else if (trimQuality === "placeholder") {
      audit.issues.push("placeholder_trim");
    }
    
    audits.push(audit);
    
    // Update counters
    searchReadinessCounts[searchReadiness]++;
    trimQualityCounts[trimQuality]++;
    fitmentCompletenessCounts[fitmentResult.completeness]++;
    
    // Field coverage
    if (fitmentResult.fields.hasBoltPattern) fieldCoverage.boltPattern.present++;
    else fieldCoverage.boltPattern.missing++;
    if (fitmentResult.fields.hasCenterBore) fieldCoverage.centerBore.present++;
    else fieldCoverage.centerBore.missing++;
    if (fitmentResult.fields.hasThreadSize) fieldCoverage.threadSize.present++;
    else fieldCoverage.threadSize.missing++;
    if (fitmentResult.fields.hasOffsetRange) fieldCoverage.offsetRange.present++;
    else fieldCoverage.offsetRange.missing++;
    if (fitmentResult.fields.hasOemWheelSizes) fieldCoverage.oemWheelSizes.present++;
    else fieldCoverage.oemWheelSizes.missing++;
    if (fitmentResult.fields.hasOemTireSizes) fieldCoverage.oemTireSizes.present++;
    else fieldCoverage.oemTireSizes.missing++;
    
    // Track issues by make/model
    if (audit.issues.length > 0) {
      const key = `${row.make}|${row.model}`;
      if (!issuesByMakeModel.has(key)) {
        issuesByMakeModel.set(key, { issues: [], count: 0 });
      }
      const entry = issuesByMakeModel.get(key)!;
      entry.count++;
      for (const issue of audit.issues) {
        if (!entry.issues.includes(issue)) {
          entry.issues.push(issue);
        }
      }
      
      // Track missing fields
      const missingFields = audit.issues.filter(i => i.startsWith("missing_"));
      if (missingFields.length > 0) {
        if (!missingFieldsByMakeModel.has(key)) {
          missingFieldsByMakeModel.set(key, { fields: new Set(), count: 0 });
        }
        const fieldEntry = missingFieldsByMakeModel.get(key)!;
        fieldEntry.count++;
        for (const f of missingFields) {
          fieldEntry.fields.add(f.replace("missing_", ""));
        }
      }
    }
  }
  
  // Check for duplicate trims
  console.log("Checking for duplicate trims...");
  const duplicates = await db.execute(sql`
    SELECT year, make, model, array_agg(display_trim) as trims, COUNT(*) as count
    FROM vehicle_fitments
    GROUP BY year, make, model
    HAVING COUNT(*) > 1 AND COUNT(DISTINCT display_trim) < COUNT(*)
  `);
  
  const duplicateTrims = (duplicates.rows as any[]).map(row => ({
    year: row.year,
    make: row.make,
    model: row.model,
    trims: row.trims,
    count: row.count,
  }));
  
  // Sort issue lists
  const trimIssuesByMakeModel = Array.from(issuesByMakeModel.entries())
    .filter(([_, v]) => v.issues.some(i => i.includes("trim")))
    .map(([key, v]) => {
      const [make, model] = key.split("|");
      return {
        make,
        model,
        issueCount: v.count,
        examples: v.issues.filter(i => i.includes("trim")),
      };
    })
    .sort((a, b) => b.issueCount - a.issueCount)
    .slice(0, 20);
  
  const fitmentIssuesByMakeModel = Array.from(missingFieldsByMakeModel.entries())
    .map(([key, v]) => {
      const [make, model] = key.split("|");
      return {
        make,
        model,
        missingFields: Array.from(v.fields),
        recordCount: v.count,
      };
    })
    .sort((a, b) => b.recordCount - a.recordCount)
    .slice(0, 20);
  
  // Get bad record examples
  const badRecordExamples = audits
    .filter(a => a.searchReadiness === "block" || a.searchReadiness === "needs_cleanup")
    .slice(0, 30);
  
  // Generate recommendations
  const recommendations: AuditSummary["recommendations"] = [];
  
  if (searchReadinessCounts.block > 0) {
    recommendations.push({
      priority: "critical",
      issue: `${searchReadinessCounts.block} records blocked from search (missing critical data or junk trims)`,
      affectedRecords: searchReadinessCounts.block,
      repair: "Either fix the data or remove these records to prevent dead-end searches",
    });
  }
  
  if (fieldCoverage.oemWheelSizes.missing > 1000) {
    recommendations.push({
      priority: "high",
      issue: `${fieldCoverage.oemWheelSizes.missing} records missing OEM wheel sizes`,
      affectedRecords: fieldCoverage.oemWheelSizes.missing,
      repair: "Import OEM wheel size data from manufacturer specs or inherit from platform siblings",
    });
  }
  
  if (fieldCoverage.threadSize.missing > 500) {
    recommendations.push({
      priority: "high",
      issue: `${fieldCoverage.threadSize.missing} records missing thread size (lug spec)`,
      affectedRecords: fieldCoverage.threadSize.missing,
      repair: "Thread size is needed for accessory matching. Backfill from known platform specs.",
    });
  }
  
  if (trimQualityCounts.placeholder > 100) {
    recommendations.push({
      priority: "medium",
      issue: `${trimQualityCounts.placeholder} records have placeholder trims (generic 'Base' with generated IDs)`,
      affectedRecords: trimQualityCounts.placeholder,
      repair: "Replace with real trim names from manufacturer data or mark as intentional 'Base' trim",
    });
  }
  
  if (duplicateTrims.length > 0) {
    const totalDupes = duplicateTrims.reduce((sum, d) => sum + d.count, 0);
    recommendations.push({
      priority: "medium",
      issue: `${duplicateTrims.length} Y/M/M combinations have duplicate trims (${totalDupes} records)`,
      affectedRecords: totalDupes,
      repair: "Deduplicate by keeping the most complete record or merging data",
    });
  }
  
  // Build summary
  const total = records.rows.length;
  const summary: AuditSummary = {
    timestamp: new Date().toISOString(),
    totalRecords: total,
    bySearchReadiness: searchReadinessCounts,
    byTrimQuality: trimQualityCounts,
    byFitmentCompleteness: fitmentCompletenessCounts,
    fieldCoverage: {
      boltPattern: { ...fieldCoverage.boltPattern, percent: Math.round((fieldCoverage.boltPattern.present / total) * 100) },
      centerBore: { ...fieldCoverage.centerBore, percent: Math.round((fieldCoverage.centerBore.present / total) * 100) },
      threadSize: { ...fieldCoverage.threadSize, percent: Math.round((fieldCoverage.threadSize.present / total) * 100) },
      offsetRange: { ...fieldCoverage.offsetRange, percent: Math.round((fieldCoverage.offsetRange.present / total) * 100) },
      oemWheelSizes: { ...fieldCoverage.oemWheelSizes, percent: Math.round((fieldCoverage.oemWheelSizes.present / total) * 100) },
      oemTireSizes: { ...fieldCoverage.oemTireSizes, percent: Math.round((fieldCoverage.oemTireSizes.present / total) * 100) },
    },
    trimIssuesByMakeModel,
    fitmentIssuesByMakeModel,
    duplicateTrims,
    badRecordExamples,
    recommendations,
  };
  
  return summary;
}

async function main() {
  const summary = await runAudit();
  
  // Print summary
  console.log();
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  AUDIT RESULTS");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log();
  console.log(`Total records audited: ${summary.totalRecords.toLocaleString()}`);
  console.log();
  
  console.log("SEARCH READINESS:");
  console.log(`  ✅ Launch-ready:    ${summary.bySearchReadiness.launch_ready.toLocaleString()} (${Math.round(summary.bySearchReadiness.launch_ready / summary.totalRecords * 100)}%)`);
  console.log(`  🟡 Searchable:      ${summary.bySearchReadiness.searchable.toLocaleString()} (${Math.round(summary.bySearchReadiness.searchable / summary.totalRecords * 100)}%)`);
  console.log(`  🟠 Needs cleanup:   ${summary.bySearchReadiness.needs_cleanup.toLocaleString()} (${Math.round(summary.bySearchReadiness.needs_cleanup / summary.totalRecords * 100)}%)`);
  console.log(`  🔴 Block/repair:    ${summary.bySearchReadiness.block.toLocaleString()} (${Math.round(summary.bySearchReadiness.block / summary.totalRecords * 100)}%)`);
  console.log();
  
  console.log("TRIM QUALITY:");
  console.log(`  Good:        ${summary.byTrimQuality.good.toLocaleString()}`);
  console.log(`  Acceptable:  ${summary.byTrimQuality.acceptable.toLocaleString()}`);
  console.log(`  Placeholder: ${summary.byTrimQuality.placeholder.toLocaleString()}`);
  console.log(`  Junk:        ${summary.byTrimQuality.junk.toLocaleString()}`);
  console.log();
  
  console.log("FITMENT COMPLETENESS:");
  console.log(`  Complete: ${summary.byFitmentCompleteness.complete.toLocaleString()}`);
  console.log(`  Usable:   ${summary.byFitmentCompleteness.usable.toLocaleString()}`);
  console.log(`  Partial:  ${summary.byFitmentCompleteness.partial.toLocaleString()}`);
  console.log(`  Missing:  ${summary.byFitmentCompleteness.missing.toLocaleString()}`);
  console.log();
  
  console.log("FIELD COVERAGE:");
  console.log(`  Bolt pattern:    ${summary.fieldCoverage.boltPattern.percent}% (${summary.fieldCoverage.boltPattern.present}/${summary.totalRecords})`);
  console.log(`  Center bore:     ${summary.fieldCoverage.centerBore.percent}% (${summary.fieldCoverage.centerBore.present}/${summary.totalRecords})`);
  console.log(`  Thread size:     ${summary.fieldCoverage.threadSize.percent}% (${summary.fieldCoverage.threadSize.present}/${summary.totalRecords})`);
  console.log(`  Offset range:    ${summary.fieldCoverage.offsetRange.percent}% (${summary.fieldCoverage.offsetRange.present}/${summary.totalRecords})`);
  console.log(`  OEM wheel sizes: ${summary.fieldCoverage.oemWheelSizes.percent}% (${summary.fieldCoverage.oemWheelSizes.present}/${summary.totalRecords})`);
  console.log(`  OEM tire sizes:  ${summary.fieldCoverage.oemTireSizes.percent}% (${summary.fieldCoverage.oemTireSizes.present}/${summary.totalRecords})`);
  console.log();
  
  if (summary.trimIssuesByMakeModel.length > 0) {
    console.log("TOP TRIM ISSUES BY MAKE/MODEL:");
    for (const item of summary.trimIssuesByMakeModel.slice(0, 10)) {
      console.log(`  ${item.make} ${item.model}: ${item.issueCount} records (${item.examples.join(", ")})`);
    }
    console.log();
  }
  
  if (summary.fitmentIssuesByMakeModel.length > 0) {
    console.log("TOP MISSING FIELDS BY MAKE/MODEL:");
    for (const item of summary.fitmentIssuesByMakeModel.slice(0, 10)) {
      console.log(`  ${item.make} ${item.model}: ${item.recordCount} records missing [${item.missingFields.join(", ")}]`);
    }
    console.log();
  }
  
  if (summary.duplicateTrims.length > 0) {
    console.log(`DUPLICATE TRIMS: ${summary.duplicateTrims.length} Y/M/M with duplicates`);
    for (const d of summary.duplicateTrims.slice(0, 5)) {
      console.log(`  ${d.year} ${d.make} ${d.model}: ${d.count} records`);
    }
    console.log();
  }
  
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  RECOMMENDATIONS");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log();
  for (const rec of summary.recommendations) {
    const icon = rec.priority === "critical" ? "🔴" : rec.priority === "high" ? "🟠" : rec.priority === "medium" ? "🟡" : "🟢";
    console.log(`${icon} [${rec.priority.toUpperCase()}] ${rec.issue}`);
    console.log(`   Repair: ${rec.repair}`);
    console.log();
  }
  
  // Save full report
  const reportPath = "scripts/fitment-quality-audit-report.json";
  fs.writeFileSync(reportPath, JSON.stringify(summary, null, 2));
  console.log(`Full report saved to: ${reportPath}`);
  
  process.exit(0);
}

main().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
