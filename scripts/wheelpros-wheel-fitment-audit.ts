#!/usr/bin/env npx tsx
/**
 * WheelPros Wheel Fitment Audit Script
 * 
 * Queries WheelPros API for wheel data by bolt pattern and compares against
 * WTD canonical fitment data from vehicle_fitments table.
 * 
 * Usage:
 *   npx tsx scripts/wheelpros-wheel-fitment-audit.ts
 * 
 * Output:
 *   scripts/wheelpros-audit-results/wheel-fitment-audit.json
 * 
 * NO DB WRITES - READ ONLY AUDIT
 */

import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs/promises";
import pg from "pg";

// Load env vars
dotenv.config({ path: path.join(process.cwd(), ".env.local") });

import { 
  queryWheelProsFitment, 
  compareFitmentData,
  type WheelProsVehicleQuery,
  type WTDFitmentData,
  type FitmentComparisonResult,
} from "../src/lib/wheelpros/auditClient";

// ============================================================================
// TEST VEHICLES WITH KNOWN BOLT PATTERNS
// ============================================================================

interface TestVehicle extends WheelProsVehicleQuery {
  expectedBoltPattern: string;
  expectedCenterBore?: number;
}

const TEST_VEHICLES: TestVehicle[] = [
  { year: 2024, make: "Ford", model: "F-150", boltPattern: "6x135", expectedBoltPattern: "6x135", expectedCenterBore: 87.1 },
  { year: 2024, make: "Chevrolet", model: "Corvette", boltPattern: "5x120", expectedBoltPattern: "5x120", expectedCenterBore: 70.3 },
  { year: 2024, make: "BMW", model: "M3", boltPattern: "5x112", expectedBoltPattern: "5x112", expectedCenterBore: 66.5 },
  { year: 2024, make: "Ram", model: "3500", boltPattern: "8x165.1", expectedBoltPattern: "8x165.1", expectedCenterBore: 121 },
  { year: 2024, make: "Jeep", model: "Wrangler", boltPattern: "5x127", expectedBoltPattern: "5x127", expectedCenterBore: 71.5 },
  { year: 2024, make: "Toyota", model: "Tacoma", boltPattern: "6x139.7", expectedBoltPattern: "6x139.7", expectedCenterBore: 106.1 },
];

// ============================================================================
// DIRECT POSTGRES QUERY FOR WTD DATA
// ============================================================================

async function getWTDFitment(vehicle: TestVehicle): Promise<WTDFitmentData | null> {
  // Get connection string from env
  const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  
  if (!connectionString) {
    console.log("  [WTD] No database connection string found");
    return null;
  }
  
  const pool = new pg.Pool({ connectionString, ssl: { rejectUnauthorized: false } });
  
  try {
    // Query for any fitment record for this YMM (get first certified one)
    const result = await pool.query(`
      SELECT 
        modification_id,
        display_trim,
        bolt_pattern,
        center_bore_mm,
        offset_min_mm,
        offset_max_mm,
        oem_wheel_sizes,
        oem_tire_sizes,
        source
      FROM vehicle_fitments
      WHERE year = $1 
        AND LOWER(make) = LOWER($2) 
        AND LOWER(model) LIKE LOWER($3)
        AND certification_status = 'certified'
      LIMIT 10
    `, [vehicle.year, vehicle.make, `%${vehicle.model}%`]);
    
    if (result.rows.length === 0) {
      console.log(`  [WTD] No certified fitment found`);
      return null;
    }
    
    console.log(`  [WTD] Found ${result.rows.length} certified trims`);
    
    const fitment = result.rows[0];
    
    // Parse oemWheelSizes
    let oemWheelSizes: Array<{ diameter?: number; width?: number; offset?: number }> = [];
    if (Array.isArray(fitment.oem_wheel_sizes)) {
      oemWheelSizes = fitment.oem_wheel_sizes.map((ws: any) => {
        if (typeof ws === "string") {
          // Parse string format like "8.5Jx18"
          const match = ws.match(/^(\d+(?:\.\d+)?)\s*[Jj]?\s*[xX]\s*(\d+(?:\.\d+)?)$/);
          if (match) {
            return { width: parseFloat(match[1]), diameter: parseFloat(match[2]) };
          }
          return {};
        }
        return {
          diameter: ws.diameter || ws.rimDiameter,
          width: ws.width || ws.rimWidth,
          offset: ws.offset,
        };
      });
    }
    
    // Parse oemTireSizes
    const oemTireSizes = Array.isArray(fitment.oem_tire_sizes) 
      ? fitment.oem_tire_sizes.filter((s): s is string => typeof s === "string")
      : [];
    
    return {
      modificationId: fitment.modification_id,
      displayTrim: fitment.display_trim || undefined,
      boltPattern: fitment.bolt_pattern,
      centerBoreMm: fitment.center_bore_mm ? Number(fitment.center_bore_mm) : null,
      offsetMinMm: fitment.offset_min_mm ? Number(fitment.offset_min_mm) : null,
      offsetMaxMm: fitment.offset_max_mm ? Number(fitment.offset_max_mm) : null,
      oemWheelSizes,
      oemTireSizes,
      source: fitment.source,
    };
  } catch (err: any) {
    console.error(`  [WTD] DB Error:`, err.message);
    return null;
  } finally {
    await pool.end();
  }
}

// ============================================================================
// MAIN AUDIT FUNCTION
// ============================================================================

async function runAudit(): Promise<void> {
  console.log("═".repeat(60));
  console.log("WheelPros Wheel Fitment Audit");
  console.log("═".repeat(60));
  console.log(`Started: ${new Date().toISOString()}`);
  console.log(`Test vehicles: ${TEST_VEHICLES.length}`);
  console.log("");
  
  const results: FitmentComparisonResult[] = [];
  let rawSampleSaved = false;
  let rawSample: any = null;
  
  for (const vehicle of TEST_VEHICLES) {
    console.log(`\n▶ ${vehicle.year} ${vehicle.make} ${vehicle.model}`);
    console.log("-".repeat(40));
    
    // Query WheelPros by bolt pattern
    console.log(`  [WheelPros] Querying by bolt pattern: ${vehicle.boltPattern}`);
    const wpResult = await queryWheelProsFitment(vehicle);
    
    if (wpResult.error) {
      console.log(`  [WheelPros] ❌ Error: ${wpResult.error}`);
    } else {
      console.log(`  [WheelPros] ✓ ${wpResult.totalWheels} wheels, ${wpResult.apiResponseMs}ms`);
      console.log(`  [WheelPros] Bolt patterns: ${wpResult.uniqueBoltPatterns.join(", ") || "(none)"}`);
      console.log(`  [WheelPros] Diameters: ${wpResult.uniqueDiameters.join(", ") || "(none)"}`);
      console.log(`  [WheelPros] Widths: ${wpResult.uniqueWidths.join(", ") || "(none)"}`);
      console.log(`  [WheelPros] Offsets: ${wpResult.uniqueOffsets ? `${wpResult.uniqueOffsets.min} to ${wpResult.uniqueOffsets.max}mm` : "(none)"}`);
      console.log(`  [WheelPros] Centerbores: ${wpResult.uniqueCenterbores.slice(0, 5).join(", ")}${wpResult.uniqueCenterbores.length > 5 ? '...' : ''}`);
      
      // Save first raw sample
      if (!rawSampleSaved && wpResult.rawSample && wpResult.rawSample.length > 0) {
        rawSample = {
          vehicle: `${vehicle.year} ${vehicle.make} ${vehicle.model}`,
          searchedBoltPattern: vehicle.boltPattern,
          sampleWheels: wpResult.rawSample,
          facets: wpResult.facets,
        };
        rawSampleSaved = true;
      }
    }
    
    // Query WTD
    console.log("  [WTD] Querying database...");
    const wtdResult = await getWTDFitment(vehicle);
    
    if (wtdResult) {
      console.log(`  [WTD] ✓ Found: ${wtdResult.displayTrim || wtdResult.modificationId}`);
      console.log(`  [WTD] Bolt pattern: ${wtdResult.boltPattern || "(none)"}`);
      console.log(`  [WTD] Center bore: ${wtdResult.centerBoreMm || "(none)"}mm`);
      console.log(`  [WTD] Offset range: ${wtdResult.offsetMinMm ?? "(none)"} to ${wtdResult.offsetMaxMm ?? "(none)"}mm`);
      console.log(`  [WTD] OEM wheels: ${wtdResult.oemWheelSizes.length} sizes`);
    }
    
    // Compare
    const comparison = compareFitmentData(wpResult, wtdResult);
    results.push(comparison);
    
    console.log(`\n  📊 Comparison: ${comparison.comparison.overallAssessment}`);
    console.log(`     Bolt pattern: ${comparison.comparison.boltPatternMatch} - ${comparison.comparison.boltPatternDetails || ''}`);
    console.log(`     Center bore: ${comparison.comparison.centerBoreMatch} - ${comparison.comparison.centerBoreDetails || ''}`);
    console.log(`     Offset range: ${comparison.comparison.offsetRangeMatch}`);
    console.log(`     Diameters: ${comparison.comparison.diameterMatch}`);
    console.log(`     Widths: ${comparison.comparison.widthMatch}`);
    
    // Add delay between requests
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  // Build summary
  const summary = {
    total: results.length,
    goodMatch: results.filter(r => r.comparison.overallAssessment === "✅ Good Match").length,
    minorDifferences: results.filter(r => r.comparison.overallAssessment === "⚠️ Minor Differences").length,
    significantMismatch: results.filter(r => r.comparison.overallAssessment === "❌ Significant Mismatch").length,
    insufficientData: results.filter(r => r.comparison.overallAssessment === "❓ Insufficient Data").length,
  };
  
  // Assessment
  const assessment = {
    conclusion: "",
    canReplaceWTD: false,
    recommendations: [] as string[],
    keyFindings: [] as string[],
  };
  
  // Analyze key findings
  const boltPatternMatches = results.filter(r => r.comparison.boltPatternMatch === "match").length;
  const centerBoreMatches = results.filter(r => ["match", "close"].includes(r.comparison.centerBoreMatch)).length;
  
  assessment.keyFindings.push(`Bolt pattern match rate: ${boltPatternMatches}/${results.length} vehicles`);
  assessment.keyFindings.push(`Center bore match rate: ${centerBoreMatches}/${results.length} vehicles`);
  
  // Check WheelPros unique value - centerbore data
  const vehiclesWithCenterbore = results.filter(r => r.wheelPros.uniqueCenterbores.length > 0).length;
  assessment.keyFindings.push(`WheelPros centerbore data available: ${vehiclesWithCenterbore}/${results.length} vehicles`);
  
  // Check offset ranges
  const vehiclesWithOffsets = results.filter(r => r.wheelPros.uniqueOffsets != null).length;
  assessment.keyFindings.push(`WheelPros offset data available: ${vehiclesWithOffsets}/${results.length} vehicles`);
  
  if (summary.goodMatch + summary.minorDifferences >= summary.total * 0.8) {
    assessment.conclusion = "WheelPros API provides HIGHLY COMPATIBLE fitment data";
    assessment.canReplaceWTD = true;
    assessment.recommendations = [
      "WheelPros can serve as primary fitment data source for wheels",
      "Use WheelPros bolt patterns as authoritative source",
      "WheelPros provides comprehensive offset ranges (includes aftermarket options)",
      "WheelPros centerbore data is reliable for hub-centric verification",
      "Consider enriching WTD with WheelPros offset/width ranges",
    ];
  } else if (summary.goodMatch >= 2) {
    assessment.conclusion = "WheelPros API provides PARTIALLY COMPATIBLE fitment data";
    assessment.canReplaceWTD = false;
    assessment.recommendations = [
      "Use WheelPros as supplementary/validation source",
      "WTD should remain primary for critical fitment specs",
      "WheelPros good for enriching offset/width ranges",
      "Consider per-vehicle decision on data source",
    ];
  } else {
    assessment.conclusion = "WheelPros API shows SIGNIFICANT DIFFERENCES from WTD";
    assessment.canReplaceWTD = false;
    assessment.recommendations = [
      "Investigate discrepancies before relying on WheelPros",
      "WTD remains authoritative for fitment specs",
      "WheelPros may include aftermarket-only options",
      "Manual verification recommended for production use",
    ];
  }
  
  // Build output
  const output = {
    auditDate: new Date().toISOString(),
    summary,
    assessment,
    rawSample,
    results: results.map(r => ({
      vehicle: `${r.vehicle.year} ${r.vehicle.make} ${r.vehicle.model}`,
      searchedBoltPattern: r.wheelPros.searchedBoltPattern,
      overallAssessment: r.comparison.overallAssessment,
      wheelProsTotalWheels: r.wheelPros.totalWheels,
      wheelProsApiMs: r.wheelPros.apiResponseMs,
      wheelProsError: r.wheelPros.error || null,
      wheelProsSpecs: {
        boltPatterns: r.wheelPros.uniqueBoltPatterns,
        centerbores: r.wheelPros.uniqueCenterbores,
        diameters: r.wheelPros.uniqueDiameters,
        widths: r.wheelPros.uniqueWidths,
        offsetRange: r.wheelPros.uniqueOffsets,
      },
      wtdSpecs: r.wtd ? {
        modificationId: r.wtd.modificationId,
        displayTrim: r.wtd.displayTrim,
        boltPattern: r.wtd.boltPattern,
        centerBoreMm: r.wtd.centerBoreMm,
        offsetRange: r.wtd.offsetMinMm != null && r.wtd.offsetMaxMm != null 
          ? { min: r.wtd.offsetMinMm, max: r.wtd.offsetMaxMm }
          : null,
        oemWheelSizes: r.wtd.oemWheelSizes,
        oemTireSizes: r.wtd.oemTireSizes,
      } : null,
      comparison: {
        boltPattern: { status: r.comparison.boltPatternMatch, detail: r.comparison.boltPatternDetails },
        centerBore: { status: r.comparison.centerBoreMatch, detail: r.comparison.centerBoreDetails },
        offsetRange: { status: r.comparison.offsetRangeMatch, detail: r.comparison.offsetRangeDetails },
        diameter: { status: r.comparison.diameterMatch, detail: r.comparison.diameterDetails },
        width: { status: r.comparison.widthMatch, detail: r.comparison.widthDetails },
      },
    })),
  };
  
  // Write output
  const outputPath = path.join(process.cwd(), "scripts/wheelpros-audit-results/wheel-fitment-audit.json");
  await fs.writeFile(outputPath, JSON.stringify(output, null, 2));
  
  console.log("\n" + "═".repeat(60));
  console.log("SUMMARY");
  console.log("═".repeat(60));
  console.log(`Total vehicles: ${summary.total}`);
  console.log(`✅ Good match: ${summary.goodMatch}`);
  console.log(`⚠️  Minor differences: ${summary.minorDifferences}`);
  console.log(`❌ Significant mismatch: ${summary.significantMismatch}`);
  console.log(`❓ Insufficient data: ${summary.insufficientData}`);
  console.log("");
  console.log("KEY FINDINGS:");
  assessment.keyFindings.forEach((f, i) => console.log(`  ${i + 1}. ${f}`));
  console.log("");
  console.log(`ASSESSMENT: ${assessment.conclusion}`);
  console.log(`Can replace WTD: ${assessment.canReplaceWTD ? "YES" : "NO"}`);
  console.log("");
  console.log("RECOMMENDATIONS:");
  assessment.recommendations.forEach((r, i) => console.log(`  ${i + 1}. ${r}`));
  console.log("");
  console.log(`Results saved to: ${outputPath}`);
}

// ============================================================================
// RUN
// ============================================================================

runAudit()
  .then(() => {
    console.log("\n✓ Audit complete");
    process.exit(0);
  })
  .catch((err) => {
    console.error("\n✗ Audit failed:", err);
    process.exit(1);
  });
