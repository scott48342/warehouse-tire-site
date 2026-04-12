/**
 * FULL TIRE-SPEC INTEGRITY AUDIT
 * 
 * Comprehensive audit of all vehicle fitment records (2000-2026)
 * Checks for data integrity issues and classifies each record
 * 
 * Usage: npx tsx scripts/fitment-audit/full-tire-spec-audit.ts
 */

import * as dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import pg from "pg";
import * as fs from "fs/promises";

const { Pool } = pg;

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

type IssueType = 
  | "exact_safe"           // No issues detected
  | "missing_specs"        // No tire sizes
  | "legacy_contamination" // Legacy tire sizes on modern vehicle
  | "cross_gen_contamination" // Wrong-era sizes from inheritance
  | "sibling_aggregation"  // Multiple trims grouped together
  | "broad_diameter_spread" // >4" spread in wheel diameters
  | "implausible_diameter" // Diameters don't match vehicle class
  | "plausible_multi";     // Multiple diameters but reasonable

interface AuditRecord {
  year: number;
  make: string;
  model: string;
  displayTrim: string;
  modificationId: string;
  tireSizes: string[];
  wheelDiameters: number[];
  diameterSpread: number;
  source: string;
  issueType: IssueType;
  issueDetails: string;
  isTruckSuv: boolean;
  isSportsCar: boolean;
  isLuxury: boolean;
}

interface AuditSummary {
  timestamp: string;
  totalRecords: number;
  byIssueType: Record<IssueType, number>;
  byYear: Record<number, { total: number; issues: number }>;
  byMake: Record<string, { total: number; issues: number }>;
  byModel: Record<string, { total: number; issues: number }>;
  bySource: Record<string, { total: number; issues: number }>;
  examples: Record<IssueType, AuditRecord[]>;
}

// ═══════════════════════════════════════════════════════════════════════════
// VEHICLE CLASSIFICATION
// ═══════════════════════════════════════════════════════════════════════════

const TRUCKS_SUVS = [
  'silverado', 'sierra', 'f-150', 'f-250', 'f-350', 'ram', '1500', '2500', '3500',
  'tundra', 'tacoma', 'titan', 'frontier', 'colorado', 'canyon', 'ranger', 'maverick',
  'tahoe', 'yukon', 'suburban', 'expedition', 'navigator', 'escalade', 'escalade-esv',
  'durango', 'grand-cherokee', '4runner', 'sequoia', 'land-cruiser', 'gx', 'lx',
  'highlander', 'pilot', 'passport', 'telluride', 'palisade', 'atlas', 'traverse',
  'blazer', 'trailblazer', 'equinox', 'terrain', 'acadia', 'explorer', 'bronco',
  'wrangler', 'gladiator', 'defender', 'range-rover', 'discovery'
];

const SPORTS_CARS = [
  'corvette', 'camaro', 'mustang', 'challenger', 'charger', '370z', '350z', 'supra',
  'gt-r', 'wrx', 'sti', 'brz', '86', 'miata', 'mx-5', 'cayman', 'boxster', '911',
  'amg-gt', 'm2', 'm3', 'm4', 'm5', 'm8', 'rs3', 'rs5', 'rs6', 'rs7', 'r8',
  'viper', 'c8', 'z06', 'zr1', 'gt500', 'type-r', 'nsx'
];

const LUXURY_BRANDS = [
  'mercedes-benz', 'bmw', 'audi', 'lexus', 'infiniti', 'acura', 'cadillac', 
  'lincoln', 'genesis', 'porsche', 'jaguar', 'land-rover', 'maserati', 
  'bentley', 'rolls-royce', 'aston-martin', 'ferrari', 'lamborghini', 'mclaren'
];

function isTruckSuv(model: string): boolean {
  return TRUCKS_SUVS.some(t => model.toLowerCase().includes(t));
}

function isSportsCar(model: string): boolean {
  return SPORTS_CARS.some(s => model.toLowerCase().includes(s));
}

function isLuxuryBrand(make: string): boolean {
  return LUXURY_BRANDS.some(l => make.toLowerCase().includes(l));
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

function extractRimDiameter(tireSize: string): number | null {
  if (!tireSize) return null;
  const match = String(tireSize).toUpperCase().match(/R(\d{2}(?:\.\d)?)/);
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

function getMinExpectedDiameter(year: number, model: string, make: string): number {
  const modelLower = model.toLowerCase();
  
  // Model-specific overrides (verified OEM data)
  // MX-5 Miata: ND gen (2016+) is 17" minimum
  if (modelLower.includes('mx-5') || modelLower.includes('miata')) {
    return year >= 2016 ? 17 : 15;
  }
  
  // Corvette: C6 (2005-2013) is 18", C7 (2014-2019) is 18", C8 (2020+) is 19"
  if (modelLower.includes('corvette')) {
    if (year >= 2020) return 19;
    if (year >= 2005) return 18;
    return 16;
  }
  
  // BMW 3-Series: G20 (2019+) is 17" minimum
  if (modelLower.includes('3-series') && make.toLowerCase() === 'bmw') {
    return year >= 2019 ? 17 : 16;
  }
  
  // Sports cars - 17" is the realistic minimum for base trims (2020+)
  // Many sports cars (WRX, BRZ, GR86, Mustang EcoBoost, Challenger SXT) have 17" base
  if (isSportsCar(model)) {
    if (year >= 2020) return 17;  // Changed from 18 - many base trims have 17"
    if (year >= 2015) return 17;
    if (year >= 2010) return 16;
    return 15;
  }
  
  // Modern trucks/SUVs - 16" still available on some work trims
  if (isTruckSuv(model)) {
    if (year >= 2020) return 16;  // Changed from 17 - work trucks still have 16"
    if (year >= 2015) return 16;
    if (year >= 2010) return 15;
    return 14;
  }
  
  // Luxury brands
  if (isLuxuryBrand(make)) {
    if (year >= 2020) return 17;
    if (year >= 2015) return 16;
    return 15;
  }
  
  // Default for economy cars
  if (year >= 2020) return 15;
  if (year >= 2015) return 14;
  return 14;
}

// ═══════════════════════════════════════════════════════════════════════════
// ISSUE CLASSIFICATION
// ═══════════════════════════════════════════════════════════════════════════

function classifyRecord(row: any): AuditRecord {
  const tireSizes = (row.oem_tire_sizes || []) as string[];
  const diameters = getWheelDiameters(tireSizes);
  const spread = diameters.length > 1 ? diameters[diameters.length - 1] - diameters[0] : 0;
  const source = row.source || "unknown";
  const displayTrim = row.display_trim || "Base";
  
  const truck = isTruckSuv(row.model);
  const sports = isSportsCar(row.model);
  const luxury = isLuxuryBrand(row.make);
  
  const record: AuditRecord = {
    year: row.year,
    make: row.make,
    model: row.model,
    displayTrim,
    modificationId: row.modification_id,
    tireSizes,
    wheelDiameters: diameters,
    diameterSpread: spread,
    source,
    issueType: "exact_safe",
    issueDetails: "",
    isTruckSuv: truck,
    isSportsCar: sports,
    isLuxury: luxury,
  };

  // Check for missing specs
  if (tireSizes.length === 0) {
    record.issueType = "missing_specs";
    record.issueDetails = "No tire sizes defined";
    return record;
  }

  // Check for sibling aggregation (multiple trims grouped)
  if (displayTrim.includes(',') || displayTrim.includes('/')) {
    record.issueType = "sibling_aggregation";
    record.issueDetails = `Multiple trims grouped: ${displayTrim}`;
    return record;
  }

  // Check for legacy contamination
  const minExpected = getMinExpectedDiameter(row.year, row.model, row.make);
  const minActual = Math.min(...diameters);
  if (minActual < minExpected && row.year >= 2015) {
    record.issueType = "legacy_contamination";
    record.issueDetails = `Min diameter ${minActual}" < expected ${minExpected}" for ${row.year} ${row.model}`;
    return record;
  }

  // Check for cross-generation contamination
  if (source.includes('inherit') && minActual < minExpected) {
    record.issueType = "cross_gen_contamination";
    record.issueDetails = `Inherited ${minActual}" diameter seems wrong for ${row.year}`;
    return record;
  }

  // Check for implausibly broad diameter spread
  if (spread > 4 && !displayTrim.includes(',')) {
    // Allow broad spread for luxury SUVs (they often have 4-5 wheel options)
    if (luxury && truck && spread <= 6) {
      record.issueType = "plausible_multi";
      record.issueDetails = `Luxury SUV with ${spread}" spread across ${diameters.length} options`;
      return record;
    }
    
    record.issueType = "broad_diameter_spread";
    record.issueDetails = `${spread}" spread (${diameters.join('", ')}") for single trim`;
    return record;
  }

  // Check for plausible multi-diameter
  if (diameters.length > 1) {
    record.issueType = "plausible_multi";
    record.issueDetails = `${diameters.length} wheel options: ${diameters.map(d => d + '"').join(', ')}`;
    return record;
  }

  // No issues - exact and safe
  record.issueType = "exact_safe";
  record.issueDetails = "Single diameter, appropriate for vehicle";
  return record;
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN AUDIT
// ═══════════════════════════════════════════════════════════════════════════

async function runAudit() {
  const pool = new Pool({ connectionString: process.env.POSTGRES_URL, ssl: false });
  
  const summary: AuditSummary = {
    timestamp: new Date().toISOString(),
    totalRecords: 0,
    byIssueType: {
      exact_safe: 0,
      missing_specs: 0,
      legacy_contamination: 0,
      cross_gen_contamination: 0,
      sibling_aggregation: 0,
      broad_diameter_spread: 0,
      implausible_diameter: 0,
      plausible_multi: 0,
    },
    byYear: {},
    byMake: {},
    byModel: {},
    bySource: {},
    examples: {
      exact_safe: [],
      missing_specs: [],
      legacy_contamination: [],
      cross_gen_contamination: [],
      sibling_aggregation: [],
      broad_diameter_spread: [],
      implausible_diameter: [],
      plausible_multi: [],
    },
  };

  const allRecords: AuditRecord[] = [];

  try {
    console.log("═══════════════════════════════════════════════════════════════");
    console.log("           FULL TIRE-SPEC INTEGRITY AUDIT (2000-2026)          ");
    console.log("═══════════════════════════════════════════════════════════════\n");

    const { rows } = await pool.query(`
      SELECT year, make, model, display_trim, modification_id, oem_tire_sizes, source
      FROM vehicle_fitments
      WHERE year >= 2000 AND year <= 2026
      ORDER BY year DESC, make, model, display_trim
    `);

    summary.totalRecords = rows.length;
    console.log(`Auditing ${rows.length} records...\n`);

    for (const row of rows) {
      const record = classifyRecord(row);
      allRecords.push(record);
      
      // Count by issue type
      summary.byIssueType[record.issueType]++;
      
      // Count by year
      if (!summary.byYear[record.year]) {
        summary.byYear[record.year] = { total: 0, issues: 0 };
      }
      summary.byYear[record.year].total++;
      if (record.issueType !== "exact_safe" && record.issueType !== "plausible_multi") {
        summary.byYear[record.year].issues++;
      }
      
      // Count by make
      if (!summary.byMake[record.make]) {
        summary.byMake[record.make] = { total: 0, issues: 0 };
      }
      summary.byMake[record.make].total++;
      if (record.issueType !== "exact_safe" && record.issueType !== "plausible_multi") {
        summary.byMake[record.make].issues++;
      }
      
      // Count by model
      const modelKey = `${record.make}/${record.model}`;
      if (!summary.byModel[modelKey]) {
        summary.byModel[modelKey] = { total: 0, issues: 0 };
      }
      summary.byModel[modelKey].total++;
      if (record.issueType !== "exact_safe" && record.issueType !== "plausible_multi") {
        summary.byModel[modelKey].issues++;
      }
      
      // Count by source
      if (!summary.bySource[record.source]) {
        summary.bySource[record.source] = { total: 0, issues: 0 };
      }
      summary.bySource[record.source].total++;
      if (record.issueType !== "exact_safe" && record.issueType !== "plausible_multi") {
        summary.bySource[record.source].issues++;
      }
      
      // Collect examples (max 5 per type)
      if (summary.examples[record.issueType].length < 5) {
        summary.examples[record.issueType].push(record);
      }
    }

    // Print summary
    console.log("═══════════════════════════════════════════════════════════════");
    console.log("                         SUMMARY                                ");
    console.log("═══════════════════════════════════════════════════════════════\n");

    console.log(`Total Records: ${summary.totalRecords}\n`);

    console.log("BY ISSUE TYPE:");
    for (const [type, count] of Object.entries(summary.byIssueType).sort((a, b) => b[1] - a[1])) {
      const pct = (count / summary.totalRecords * 100).toFixed(1);
      const icon = type === "exact_safe" || type === "plausible_multi" ? "✅" : "⚠️";
      console.log(`  ${icon} ${type}: ${count} (${pct}%)`);
    }
    console.log("");

    // Calculate issue records (excluding safe and plausible_multi)
    const issueCount = summary.totalRecords - summary.byIssueType.exact_safe - summary.byIssueType.plausible_multi;
    console.log(`FLAGGED RECORDS: ${issueCount} (${(issueCount / summary.totalRecords * 100).toFixed(1)}%)\n`);

    console.log("TOP 10 AFFECTED MAKES:");
    const sortedMakes = Object.entries(summary.byMake)
      .sort((a, b) => b[1].issues - a[1].issues)
      .slice(0, 10);
    for (const [make, data] of sortedMakes) {
      if (data.issues > 0) {
        console.log(`  ${make}: ${data.issues}/${data.total} issues`);
      }
    }
    console.log("");

    console.log("TOP 10 AFFECTED MODELS:");
    const sortedModels = Object.entries(summary.byModel)
      .sort((a, b) => b[1].issues - a[1].issues)
      .slice(0, 10);
    for (const [model, data] of sortedModels) {
      if (data.issues > 0) {
        console.log(`  ${model}: ${data.issues}/${data.total} issues`);
      }
    }
    console.log("");

    // Print examples
    console.log("═══════════════════════════════════════════════════════════════");
    console.log("                    EXAMPLES BY ISSUE TYPE                      ");
    console.log("═══════════════════════════════════════════════════════════════\n");

    for (const [type, examples] of Object.entries(summary.examples)) {
      if (examples.length > 0 && type !== "exact_safe" && type !== "plausible_multi") {
        console.log(`--- ${type.toUpperCase()} ---`);
        for (const ex of examples.slice(0, 3)) {
          console.log(`${ex.year} ${ex.make} ${ex.model} "${ex.displayTrim}"`);
          console.log(`  Diameters: ${ex.wheelDiameters.map(d => d + '"').join(', ')}`);
          console.log(`  Issue: ${ex.issueDetails}`);
          console.log("");
        }
      }
    }

    // Save JSON results
    await fs.writeFile(
      "./scripts/fitment-audit/full-audit-results.json",
      JSON.stringify({ summary, records: allRecords }, null, 2)
    );
    console.log("📄 JSON saved to: scripts/fitment-audit/full-audit-results.json");

    // Generate CSV
    const csvHeader = "year,make,model,trim,modificationId,tireSizes,wheelDiameters,diameterSpread,source,issueType,issueDetails,isTruckSuv,isSportsCar,isLuxury";
    const csvRows = allRecords.map(r => [
      r.year,
      `"${r.make}"`,
      `"${r.model}"`,
      `"${r.displayTrim.replace(/"/g, '""')}"`,
      `"${r.modificationId}"`,
      `"${r.tireSizes.join('; ')}"`,
      `"${r.wheelDiameters.join('; ')}"`,
      r.diameterSpread,
      `"${r.source}"`,
      r.issueType,
      `"${r.issueDetails.replace(/"/g, '""')}"`,
      r.isTruckSuv,
      r.isSportsCar,
      r.isLuxury,
    ].join(','));
    
    await fs.writeFile(
      "./scripts/fitment-audit/full-audit-results.csv",
      [csvHeader, ...csvRows].join('\n')
    );
    console.log("📄 CSV saved to: scripts/fitment-audit/full-audit-results.csv");

  } finally {
    await pool.end();
  }
}

runAudit().catch(console.error);
