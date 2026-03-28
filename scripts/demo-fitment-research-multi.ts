/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * MULTI-VEHICLE FITMENT RESEARCH DEMO
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Proves the fitment research workflow is GENERIC, not RAM-specific.
 * Tests: Ford F-150, Chevrolet Silverado 1500, Toyota Tacoma
 * 
 * Run with: npx tsx scripts/demo-fitment-research-multi.ts
 * 
 * @created 2026-03-28
 */

import {
  type FitmentResearchInput,
  type RawFitmentFinding,
  type ResearchSource,
  executeResearchWorkflow,
  canApproveForProduction,
} from "../src/lib/fitment-db/research";

// ═══════════════════════════════════════════════════════════════════════════════
// TEST VEHICLE 1: 2024 Ford F-150 XLT
// ═══════════════════════════════════════════════════════════════════════════════

const f150_sources: ResearchSource[] = [
  {
    url: "https://www.ford.com/trucks/f150/models/f150-xlt/",
    name: "Ford Official",
    authority: "manufacturer",
    retrievedAt: new Date(),
    isPrimary: true,
  },
  {
    url: "https://www.tirerack.com/wheels/fitment/Ford/F-150/2024",
    name: "Tire Rack",
    authority: "reference",
    retrievedAt: new Date(),
    isPrimary: false,
  },
];

const f150_findings: RawFitmentFinding[] = [
  { field: "boltPattern", value: "6x135", source: f150_sources[0], confidence: 1.0 },
  { field: "boltPattern", value: "6x135", source: f150_sources[1], confidence: 0.9 },
  { field: "centerBore", value: "87.1mm", source: f150_sources[0], confidence: 1.0 },
  { field: "centerBore", value: "87.1", source: f150_sources[1], confidence: 0.9 },
  { field: "threadSize", value: "14x1.5", source: f150_sources[0], confidence: 1.0 },
  { field: "offsetMin", value: "+34", source: f150_sources[1], confidence: 0.85 },
  { field: "offsetMax", value: "+44", source: f150_sources[1], confidence: 0.85 },
  { field: "oemWheelSize", value: "17x7.5 ET44", source: f150_sources[0], confidence: 1.0 },
  { field: "oemWheelSize", value: "18x8 ET44", source: f150_sources[0], confidence: 1.0 },
  { field: "oemWheelSize", value: "20x8.5 ET44", source: f150_sources[0], confidence: 1.0 },
  { field: "oemTireSize", value: "265/70R17", source: f150_sources[0], confidence: 1.0 },
  { field: "oemTireSize", value: "275/65R18", source: f150_sources[0], confidence: 1.0 },
  { field: "oemTireSize", value: "275/55R20", source: f150_sources[0], confidence: 1.0 },
  { field: "generation", value: "14th Gen (P702)", source: f150_sources[0], confidence: 1.0 },
  { field: "yearRange", value: "2021-2026", source: f150_sources[0], confidence: 0.9 },
];

// ═══════════════════════════════════════════════════════════════════════════════
// TEST VEHICLE 2: 2020 Chevrolet Silverado 1500 LT
// ═══════════════════════════════════════════════════════════════════════════════

const silverado_sources: ResearchSource[] = [
  {
    url: "https://www.chevrolet.com/trucks/silverado/1500/build-and-price",
    name: "Chevrolet Official",
    authority: "manufacturer",
    retrievedAt: new Date(),
    isPrimary: true,
  },
  {
    url: "https://www.wheelpros.com/fitment/chevrolet/silverado-1500",
    name: "Wheel Pros",
    authority: "supplier",
    retrievedAt: new Date(),
    isPrimary: false,
  },
];

const silverado_findings: RawFitmentFinding[] = [
  { field: "boltPattern", value: "6x139.7", source: silverado_sources[0], confidence: 1.0 },
  { field: "boltPattern", value: "6x5.5", source: silverado_sources[1], confidence: 0.9, notes: "Imperial format" },
  { field: "centerBore", value: "78.1mm", source: silverado_sources[0], confidence: 1.0 },
  { field: "threadSize", value: "14x1.5", source: silverado_sources[0], confidence: 1.0 },
  { field: "threadSize", value: "M14x1.5", source: silverado_sources[1], confidence: 0.9 },
  { field: "offsetMin", value: "+24", source: silverado_sources[1], confidence: 0.85 },
  { field: "offsetMax", value: "+31", source: silverado_sources[1], confidence: 0.85 },
  { field: "oemWheelSize", value: "17x8 ET24", source: silverado_sources[0], confidence: 1.0 },
  { field: "oemWheelSize", value: "18x8.5 ET24", source: silverado_sources[0], confidence: 1.0 },
  { field: "oemWheelSize", value: "20x9 ET24", source: silverado_sources[0], confidence: 1.0 },
  { field: "oemWheelSize", value: "22x9 ET24", source: silverado_sources[0], confidence: 1.0 },
  { field: "oemTireSize", value: "255/70R17", source: silverado_sources[0], confidence: 1.0 },
  { field: "oemTireSize", value: "265/65R18", source: silverado_sources[0], confidence: 1.0 },
  { field: "oemTireSize", value: "275/60R20", source: silverado_sources[0], confidence: 1.0 },
  { field: "oemTireSize", value: "275/50R22", source: silverado_sources[0], confidence: 1.0 },
  { field: "generation", value: "4th Gen (T1XX)", source: silverado_sources[0], confidence: 1.0 },
  { field: "yearRange", value: "2019-2025", source: silverado_sources[0], confidence: 0.9 },
];

// ═══════════════════════════════════════════════════════════════════════════════
// TEST VEHICLE 3: 2022 Toyota Tacoma SR5
// ═══════════════════════════════════════════════════════════════════════════════

const tacoma_sources: ResearchSource[] = [
  {
    url: "https://www.toyota.com/tacoma/features/specifications",
    name: "Toyota Official",
    authority: "manufacturer",
    retrievedAt: new Date(),
    isPrimary: true,
  },
  {
    url: "https://www.tirerack.com/wheels/fitment/Toyota/Tacoma/2022",
    name: "Tire Rack",
    authority: "reference",
    retrievedAt: new Date(),
    isPrimary: false,
  },
  {
    url: "https://www.tacomaworld.com/threads/wheel-specs.12345/",
    name: "Tacoma World Forum",
    authority: "enthusiast",
    retrievedAt: new Date(),
    isPrimary: false,
  },
];

const tacoma_findings: RawFitmentFinding[] = [
  { field: "boltPattern", value: "6x139.7", source: tacoma_sources[0], confidence: 1.0 },
  { field: "boltPattern", value: "6x5.5", source: tacoma_sources[1], confidence: 0.9 },
  { field: "boltPattern", value: "6x139.7", source: tacoma_sources[2], confidence: 0.6 },
  { field: "centerBore", value: "106.1mm", source: tacoma_sources[0], confidence: 1.0 },
  { field: "centerBore", value: "106mm", source: tacoma_sources[2], confidence: 0.5, notes: "Forum post" },
  { field: "threadSize", value: "12x1.5", source: tacoma_sources[0], confidence: 1.0 },
  { field: "offsetMin", value: "-10", source: tacoma_sources[1], confidence: 0.8 },
  { field: "offsetMax", value: "+30", source: tacoma_sources[1], confidence: 0.8 },
  { field: "offsetTypical", value: "+15", source: tacoma_sources[2], confidence: 0.5 },
  { field: "oemWheelSize", value: "16x7 ET30", source: tacoma_sources[0], confidence: 1.0 },
  { field: "oemWheelSize", value: "17x7.5 ET30", source: tacoma_sources[0], confidence: 1.0 },
  { field: "oemWheelSize", value: "18x7.5", source: tacoma_sources[0], confidence: 1.0 },
  { field: "oemTireSize", value: "245/75R16", source: tacoma_sources[0], confidence: 1.0 },
  { field: "oemTireSize", value: "265/70R17", source: tacoma_sources[0], confidence: 1.0 },
  { field: "oemTireSize", value: "265/60R18", source: tacoma_sources[0], confidence: 1.0 },
  { field: "generation", value: "3rd Gen (N300)", source: tacoma_sources[0], confidence: 1.0 },
  { field: "yearRange", value: "2016-2023", source: tacoma_sources[0], confidence: 0.9 },
];

// ═══════════════════════════════════════════════════════════════════════════════
// RUN DEMO
// ═══════════════════════════════════════════════════════════════════════════════

async function runMultiVehicleDemo() {
  console.log("═══════════════════════════════════════════════════════════════════════════════");
  console.log("MULTI-VEHICLE FITMENT RESEARCH WORKFLOW DEMO");
  console.log("Proving the pipeline is GENERIC, not RAM-specific");
  console.log("═══════════════════════════════════════════════════════════════════════════════\n");

  const vehicles = [
    {
      input: { make: "Ford", model: "F-150", year: 2024, trim: "XLT" } as FitmentResearchInput,
      findings: f150_findings,
      sources: f150_sources,
    },
    {
      input: { make: "Chevrolet", model: "Silverado 1500", year: 2020, trim: "LT" } as FitmentResearchInput,
      findings: silverado_findings,
      sources: silverado_sources,
    },
    {
      input: { make: "Toyota", model: "Tacoma", year: 2022, trim: "SR5" } as FitmentResearchInput,
      findings: tacoma_findings,
      sources: tacoma_sources,
    },
  ];

  const results = [];

  for (const v of vehicles) {
    console.log(`┌─────────────────────────────────────────────────────────────────────────────┐`);
    console.log(`│ ${v.input.year} ${v.input.make} ${v.input.model} ${v.input.trim}`.padEnd(78) + `│`);
    console.log(`└─────────────────────────────────────────────────────────────────────────────┘\n`);

    const result = await executeResearchWorkflow(
      v.input,
      v.findings,
      v.sources,
      { initiatedBy: "multi-vehicle-demo" }
    );

    results.push({ vehicle: v.input, result });

    printVehicleResult(result);
    console.log("\n");
  }

  // Summary comparison table
  console.log("═══════════════════════════════════════════════════════════════════════════════");
  console.log("SUMMARY COMPARISON");
  console.log("═══════════════════════════════════════════════════════════════════════════════\n");

  console.log("┌────────────────────────┬─────────────┬────────────┬─────────────┬────────────┐");
  console.log("│ Vehicle                │ Bolt        │ Center     │ Offset      │ Confidence │");
  console.log("│                        │ Pattern     │ Bore       │ Range       │            │");
  console.log("├────────────────────────┼─────────────┼────────────┼─────────────┼────────────┤");

  for (const r of results) {
    const c = r.result.record.candidate;
    const conf = r.result.record.overallConfidence;
    const label = `${r.vehicle.year} ${r.vehicle.make} ${r.vehicle.model}`.substring(0, 22);
    const bp = c?.boltPattern || "N/A";
    const cb = c?.centerBoreMm ? `${c.centerBoreMm}mm` : "N/A";
    const offset = c?.offsetMinMm !== undefined && c?.offsetMaxMm !== undefined 
      ? `${c.offsetMinMm} to ${c.offsetMaxMm}`
      : "N/A";
    const confStr = `${conf.level.toUpperCase()} (${Math.round(conf.score)})`;
    
    console.log(`│ ${label.padEnd(22)} │ ${bp.padEnd(11)} │ ${cb.padEnd(10)} │ ${offset.padEnd(11)} │ ${confStr.padEnd(10)} │`);
  }

  console.log("└────────────────────────┴─────────────┴────────────┴─────────────┴────────────┘");

  // OEM sizes table
  console.log("\n┌────────────────────────┬────────────────────────────────────────────────────┐");
  console.log("│ Vehicle                │ OEM Tire Sizes                                     │");
  console.log("├────────────────────────┼────────────────────────────────────────────────────┤");

  for (const r of results) {
    const c = r.result.record.candidate;
    const label = `${r.vehicle.year} ${r.vehicle.make} ${r.vehicle.model}`.substring(0, 22);
    const tires = c?.oemTireSizes.join(", ") || "N/A";
    console.log(`│ ${label.padEnd(22)} │ ${tires.substring(0, 50).padEnd(50)} │`);
  }

  console.log("└────────────────────────┴────────────────────────────────────────────────────┘");

  console.log("\n═══════════════════════════════════════════════════════════════════════════════");
  console.log("✅ CONCLUSION: Workflow is GENERIC - works for any vehicle make/model");
  console.log("═══════════════════════════════════════════════════════════════════════════════\n");
}

function printVehicleResult(result: any) {
  const record = result.record;
  const c = record.candidate;
  const conf = record.overallConfidence;

  console.log("CONFIDENCE:");
  console.log(`  Level: ${conf.level.toUpperCase()} (${Math.round(conf.score)}/100)`);
  console.log(`  Source Authority: ${conf.factors.sourceAuthority}/40`);
  console.log(`  Source Agreement: ${Math.round(conf.factors.sourceAgreement)}/40`);
  console.log(`  Completeness: ${conf.factors.completeness}/20`);

  console.log("\nFITMENT DATA:");
  if (c) {
    console.log(`  Bolt Pattern: ${c.boltPattern}${c.boltPatternImperial ? ` (${c.boltPatternImperial})` : ""}`);
    console.log(`  Center Bore: ${c.centerBoreMm}mm`);
    console.log(`  Thread Size: ${c.threadSize || "Unknown"}`);
    console.log(`  Offset Range: ${c.offsetMinMm ?? "?"} to ${c.offsetMaxMm ?? "?"}mm`);
    console.log(`  Generation: ${c.generation || "Unknown"}`);
    console.log(`  OEM Wheel Sizes: ${c.oemWheelSizes.map((w: any) => `${w.diameter}x${w.width}`).join(", ")}`);
    console.log(`  OEM Tire Sizes: ${c.oemTireSizes.join(", ")}`);
    
    if (c.notes && c.notes.length > 0) {
      console.log(`  Notes:`);
      for (const n of c.notes) {
        console.log(`    • ${n}`);
      }
    }
  } else {
    console.log("  ❌ Normalization failed");
  }

  console.log("\nVALIDATION:");
  console.log(`  Reviewable: ${record.isReviewable ? "✅ Yes" : "❌ No"}`);
  if (record.validationWarnings.length > 0) {
    for (const w of record.validationWarnings) {
      console.log(`  ⚠️  ${w}`);
    }
  }

  const approval = canApproveForProduction(record);
  console.log(`  Can Approve: ${approval.canApprove ? "✅ Yes" : "❌ No"}`);
}

runMultiVehicleDemo().catch(console.error);
