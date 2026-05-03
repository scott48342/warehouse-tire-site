/**
 * QA Script: Audit Tire Size Gate Prompts
 * 
 * This script identifies vehicles where the "multiple tire sizes" prompt
 * appears due to fallback to model-level data rather than legitimate
 * multiple OEM options for the selected trim.
 * 
 * Run: npx tsx scripts/qa-tire-size-gate.ts
 * 
 * 2026-05-03: Created as part of the tire-size-gate fix
 */

import { db } from "../src/lib/fitment-db/db";
import { vehicleFitments, vehicleFitmentConfigurations } from "../src/lib/fitment-db/schema";
import { eq, and, sql } from "drizzle-orm";

interface VehicleWithIssue {
  year: number;
  make: string;
  model: string;
  trimCount: number;
  diametersInModel: number[];
  issue: string;
}

async function auditTireSizeGate() {
  console.log("🔍 Auditing tire size gate prompts...\n");
  
  const issues: VehicleWithIssue[] = [];
  
  // Get all unique year/make/model combinations
  const vehicles = await db.execute(sql`
    SELECT DISTINCT year, make, model, COUNT(*) as trim_count
    FROM vehicle_fitments
    WHERE year >= 2020 AND certification_status = 'certified'
    GROUP BY year, make, model
    HAVING COUNT(*) > 1
    ORDER BY year DESC, make, model
    LIMIT 500
  `) as { rows: Array<{ year: number; make: string; model: string; trim_count: string }> };
  
  console.log(`Found ${vehicles.rows.length} vehicles with multiple trims to audit.\n`);
  
  let audited = 0;
  let issuesFound = 0;
  
  for (const vehicle of vehicles.rows) {
    audited++;
    
    // Get all fitments for this Y/M/M
    const fitments = await db
      .select({
        modificationId: vehicleFitments.modificationId,
        displayTrim: vehicleFitments.displayTrim,
        oemTireSizes: vehicleFitments.oemTireSizes,
      })
      .from(vehicleFitments)
      .where(
        and(
          eq(vehicleFitments.year, vehicle.year),
          eq(vehicleFitments.make, vehicle.make),
          eq(vehicleFitments.model, vehicle.model),
          eq(vehicleFitments.certificationStatus, "certified")
        )
      );
    
    // Extract all unique diameters across all trims
    const allDiameters = new Set<number>();
    const trimDiameters = new Map<string, Set<number>>();
    
    for (const fitment of fitments) {
      const tireSizes = (fitment.oemTireSizes as string[]) || [];
      const trimDias = new Set<number>();
      
      for (const size of tireSizes) {
        const match = size.match(/R(\d{2})/);
        if (match) {
          const dia = parseInt(match[1], 10);
          allDiameters.add(dia);
          trimDias.add(dia);
        }
      }
      
      trimDiameters.set(fitment.displayTrim, trimDias);
    }
    
    // Check for issues
    const modelDiameterCount = allDiameters.size;
    
    // Issue 1: All trims have single diameter, but diameters differ across trims
    // This means selecting a trim should show ONE size, but if we fall back to model-level, we show multiple
    const trimsWithSingleSize = [...trimDiameters.entries()].filter(([_, dias]) => dias.size === 1);
    const trimsSharingData = fitments.filter(f => {
      const sizes = (f.oemTireSizes as string[]) || [];
      return sizes.length === 0;
    });
    
    if (modelDiameterCount > 1 && trimsWithSingleSize.length === fitments.length) {
      // Every trim has exactly one diameter, but they're different
      // If we fall back to model-level, we'd incorrectly show all diameters
      issues.push({
        year: vehicle.year,
        make: vehicle.make,
        model: vehicle.model,
        trimCount: fitments.length,
        diametersInModel: [...allDiameters].sort((a, b) => a - b),
        issue: `All ${fitments.length} trims have single diameter, but model shows ${modelDiameterCount} diameters. Fallback would be wrong.`,
      });
      issuesFound++;
    }
    
    // Issue 2: Some trims share the same oemTireSizes (data duplication)
    const sizeSignatures = new Map<string, string[]>();
    for (const fitment of fitments) {
      const sizes = (fitment.oemTireSizes as string[]) || [];
      const sig = sizes.sort().join(",");
      if (!sizeSignatures.has(sig)) {
        sizeSignatures.set(sig, []);
      }
      sizeSignatures.get(sig)!.push(fitment.displayTrim);
    }
    
    const sharedData = [...sizeSignatures.entries()].filter(([_, trims]) => trims.length > 1);
    if (sharedData.length > 0 && modelDiameterCount > 1) {
      // Multiple trims share the same tire data - likely model-level import
      const sharedTrims = sharedData.map(([sizes, trims]) => `[${trims.join(", ")}]`).join("; ");
      issues.push({
        year: vehicle.year,
        make: vehicle.make,
        model: vehicle.model,
        trimCount: fitments.length,
        diametersInModel: [...allDiameters].sort((a, b) => a - b),
        issue: `Trims sharing identical tire data: ${sharedTrims}. Likely model-level import.`,
      });
      issuesFound++;
    }
    
    if (audited % 50 === 0) {
      console.log(`  Progress: ${audited}/${vehicles.rows.length} vehicles audited, ${issuesFound} issues found...`);
    }
  }
  
  console.log(`\n✅ Audit complete: ${audited} vehicles checked, ${issuesFound} potential issues found.\n`);
  
  // Group and display issues
  if (issues.length > 0) {
    console.log("═══════════════════════════════════════════════════════════════");
    console.log("POTENTIAL ISSUES (vehicles where fallback may cause false prompts)");
    console.log("═══════════════════════════════════════════════════════════════\n");
    
    // Group by issue type
    const byIssue = new Map<string, VehicleWithIssue[]>();
    for (const issue of issues) {
      const key = issue.issue.split(".")[0]; // First sentence
      if (!byIssue.has(key)) byIssue.set(key, []);
      byIssue.get(key)!.push(issue);
    }
    
    for (const [issueType, vehicles] of byIssue) {
      console.log(`📌 ${issueType}\n`);
      for (const v of vehicles.slice(0, 10)) {
        console.log(`   ${v.year} ${v.make} ${v.model} (${v.trimCount} trims, diameters: ${v.diametersInModel.join('"/')}"`);
      }
      if (vehicles.length > 10) {
        console.log(`   ... and ${vehicles.length - 10} more vehicles\n`);
      }
      console.log();
    }
  }
  
  // Summary statistics
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("SUMMARY");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log(`Total vehicles audited: ${audited}`);
  console.log(`Issues found: ${issuesFound}`);
  console.log(`Issue rate: ${((issuesFound / audited) * 100).toFixed(1)}%`);
  
  process.exit(0);
}

auditTireSizeGate().catch(err => {
  console.error("Audit failed:", err);
  process.exit(1);
});
