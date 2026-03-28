/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * FITMENT RESEARCH WORKFLOW DEMO
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Demonstrates the fitment research ingestion workflow with:
 * - 2020 Ram 1500 (5th Gen DT) → 6x139.7
 * - 2020 Ram 1500 Classic → 5x139.7
 * 
 * Run with: npx tsx scripts/demo-fitment-research.ts
 * 
 * @created 2026-03-28
 */

import {
  type FitmentResearchInput,
  type RawFitmentFinding,
  type ResearchSource,
  executeResearchWorkflow,
  canApproveForProduction,
  exportCandidateForProduction,
} from "../src/lib/fitment-db/research";

// ═══════════════════════════════════════════════════════════════════════════════
// SIMULATED RESEARCH DATA
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Simulated findings from web research for 2020 Ram 1500 (5th Gen)
 */
const ram1500_2020_sources: ResearchSource[] = [
  {
    url: "https://www.ramtrucks.com/specs/2020-ram-1500.html",
    name: "RAM Trucks Official",
    authority: "manufacturer",
    retrievedAt: new Date(),
    isPrimary: true,
  },
  {
    url: "https://www.tirerack.com/wheels/fitment/Ram/1500/2020",
    name: "Tire Rack",
    authority: "reference",
    retrievedAt: new Date(),
    isPrimary: false,
  },
  {
    url: "https://www.wheelpros.com/fitment/ram/1500",
    name: "Wheel Pros",
    authority: "supplier",
    retrievedAt: new Date(),
    isPrimary: false,
  },
];

const ram1500_2020_findings: RawFitmentFinding[] = [
  // Bolt pattern - all sources agree
  {
    field: "boltPattern",
    value: "6x139.7",
    source: ram1500_2020_sources[0],
    confidence: 1.0,
    notes: "Manufacturer spec sheet",
  },
  {
    field: "boltPattern",
    value: "6x5.5",
    source: ram1500_2020_sources[1],
    confidence: 0.9,
    notes: "Imperial format",
  },
  {
    field: "boltPattern",
    value: "6x139.7",
    source: ram1500_2020_sources[2],
    confidence: 0.9,
  },
  
  // Center bore - manufacturer source
  {
    field: "centerBore",
    value: "77.8mm",
    source: ram1500_2020_sources[0],
    confidence: 1.0,
    notes: "Hub-centric fit",
  },
  {
    field: "centerBore",
    value: "77.8",
    source: ram1500_2020_sources[2],
    confidence: 0.9,
  },
  
  // Thread size
  {
    field: "threadSize",
    value: "14x1.5",
    source: ram1500_2020_sources[0],
    confidence: 1.0,
  },
  {
    field: "threadSize",
    value: "M14x1.5",
    source: ram1500_2020_sources[1],
    confidence: 0.9,
  },
  
  // Offset range
  {
    field: "offsetMin",
    value: "+18",
    source: ram1500_2020_sources[1],
    confidence: 0.8,
  },
  {
    field: "offsetMax",
    value: "+22",
    source: ram1500_2020_sources[1],
    confidence: 0.8,
  },
  {
    field: "offsetTypical",
    value: "+20",
    source: ram1500_2020_sources[2],
    confidence: 0.85,
  },
  
  // OEM wheel sizes
  {
    field: "oemWheelSize",
    value: "18x8 ET20",
    source: ram1500_2020_sources[0],
    confidence: 1.0,
  },
  {
    field: "oemWheelSize",
    value: "20x9 ET19",
    source: ram1500_2020_sources[0],
    confidence: 1.0,
  },
  {
    field: "oemWheelSize",
    value: "22x9 ET19",
    source: ram1500_2020_sources[0],
    confidence: 1.0,
  },
  
  // OEM tire sizes
  {
    field: "oemTireSize",
    value: "275/65R18",
    source: ram1500_2020_sources[0],
    confidence: 1.0,
  },
  {
    field: "oemTireSize",
    value: "275/55R20",
    source: ram1500_2020_sources[0],
    confidence: 1.0,
  },
  {
    field: "oemTireSize",
    value: "285/45R22",
    source: ram1500_2020_sources[0],
    confidence: 1.0,
  },
  
  // Generation info
  {
    field: "generation",
    value: "5th Gen (DT Platform)",
    source: ram1500_2020_sources[0],
    confidence: 1.0,
  },
  {
    field: "yearRange",
    value: "2019-2026",
    source: ram1500_2020_sources[0],
    confidence: 0.9,
  },
  
  // Exception for Classic
  {
    field: "exception",
    value: "RAM 1500 Classic (2019-2024) uses 5x139.7 bolt pattern - different platform",
    source: ram1500_2020_sources[1],
    confidence: 1.0,
    notes: "Critical variant exception",
  },
];

/**
 * Simulated findings for 2020 Ram 1500 Classic
 */
const ram1500Classic_2020_sources: ResearchSource[] = [
  {
    url: "https://www.ramtrucks.com/specs/2020-ram-1500-classic.html",
    name: "RAM Trucks Official",
    authority: "manufacturer",
    retrievedAt: new Date(),
    isPrimary: true,
  },
  {
    url: "https://www.tirerack.com/wheels/fitment/Ram/1500+Classic/2020",
    name: "Tire Rack",
    authority: "reference",
    retrievedAt: new Date(),
    isPrimary: false,
  },
];

const ram1500Classic_2020_findings: RawFitmentFinding[] = [
  // Bolt pattern - 5-lug
  {
    field: "boltPattern",
    value: "5x139.7",
    source: ram1500Classic_2020_sources[0],
    confidence: 1.0,
    notes: "4th gen carryover - 5-lug pattern",
  },
  {
    field: "boltPattern",
    value: "5x5.5",
    source: ram1500Classic_2020_sources[1],
    confidence: 0.9,
  },
  
  // Center bore
  {
    field: "centerBore",
    value: "77.8mm",
    source: ram1500Classic_2020_sources[0],
    confidence: 1.0,
  },
  
  // Thread size
  {
    field: "threadSize",
    value: "14x1.5",
    source: ram1500Classic_2020_sources[0],
    confidence: 1.0,
  },
  
  // Offset range (wider on Classic due to different suspension)
  {
    field: "offsetMin",
    value: "+18",
    source: ram1500Classic_2020_sources[1],
    confidence: 0.85,
  },
  {
    field: "offsetMax",
    value: "+35",
    source: ram1500Classic_2020_sources[1],
    confidence: 0.85,
  },
  
  // OEM wheel sizes
  {
    field: "oemWheelSize",
    value: "17x7",
    source: ram1500Classic_2020_sources[0],
    confidence: 1.0,
  },
  {
    field: "oemWheelSize",
    value: "20x8 ET19",
    source: ram1500Classic_2020_sources[0],
    confidence: 1.0,
  },
  
  // OEM tire sizes
  {
    field: "oemTireSize",
    value: "265/70R17",
    source: ram1500Classic_2020_sources[0],
    confidence: 1.0,
  },
  {
    field: "oemTireSize",
    value: "275/60R20",
    source: ram1500Classic_2020_sources[0],
    confidence: 1.0,
  },
  
  // Generation info
  {
    field: "generation",
    value: "4th Gen DS (Classic carryover)",
    source: ram1500Classic_2020_sources[0],
    confidence: 1.0,
  },
  {
    field: "yearRange",
    value: "2019-2024",
    source: ram1500Classic_2020_sources[0],
    confidence: 1.0,
    notes: "Classic discontinued after 2024",
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// DEMO EXECUTION
// ═══════════════════════════════════════════════════════════════════════════════

async function runDemo() {
  console.log("═══════════════════════════════════════════════════════════════════════════════");
  console.log("FITMENT RESEARCH WORKFLOW DEMO");
  console.log("═══════════════════════════════════════════════════════════════════════════════\n");
  
  // ─────────────────────────────────────────────────────────────────────────────
  // Example 1: 2020 Ram 1500 (5th Gen)
  // ─────────────────────────────────────────────────────────────────────────────
  
  console.log("┌─────────────────────────────────────────────────────────────────────────────┐");
  console.log("│ EXAMPLE 1: 2020 RAM 1500 (5th Gen DT)                                       │");
  console.log("└─────────────────────────────────────────────────────────────────────────────┘\n");
  
  const input1: FitmentResearchInput = {
    make: "Ram",
    model: "1500",
    year: 2020,
    trim: "Big Horn",
  };
  
  const result1 = await executeResearchWorkflow(
    input1,
    ram1500_2020_findings,
    ram1500_2020_sources,
    { initiatedBy: "demo-script" }
  );
  
  printResult(result1, "2020 Ram 1500");
  
  // ─────────────────────────────────────────────────────────────────────────────
  // Example 2: 2020 Ram 1500 Classic
  // ─────────────────────────────────────────────────────────────────────────────
  
  console.log("\n\n┌─────────────────────────────────────────────────────────────────────────────┐");
  console.log("│ EXAMPLE 2: 2020 RAM 1500 Classic                                            │");
  console.log("└─────────────────────────────────────────────────────────────────────────────┘\n");
  
  const input2: FitmentResearchInput = {
    make: "Ram",
    model: "1500",
    year: 2020,
    trim: "Classic Warlock",
    rawModel: "1500 Classic",
  };
  
  const result2 = await executeResearchWorkflow(
    input2,
    ram1500Classic_2020_findings,
    ram1500Classic_2020_sources,
    { initiatedBy: "demo-script" }
  );
  
  printResult(result2, "2020 Ram 1500 Classic");
  
  // ─────────────────────────────────────────────────────────────────────────────
  // Comparison
  // ─────────────────────────────────────────────────────────────────────────────
  
  console.log("\n\n┌─────────────────────────────────────────────────────────────────────────────┐");
  console.log("│ COMPARISON: 5th Gen vs Classic                                              │");
  console.log("└─────────────────────────────────────────────────────────────────────────────┘\n");
  
  console.log("┌───────────────────────┬─────────────────────────┬─────────────────────────┐");
  console.log("│ Field                 │ 2020 Ram 1500 (5th Gen) │ 2020 Ram 1500 Classic   │");
  console.log("├───────────────────────┼─────────────────────────┼─────────────────────────┤");
  
  const c1 = result1.record.candidate;
  const c2 = result2.record.candidate;
  
  const rows = [
    ["Bolt Pattern", c1?.boltPattern || "-", c2?.boltPattern || "-"],
    ["Center Bore", c1?.centerBoreMm ? `${c1.centerBoreMm}mm` : "-", c2?.centerBoreMm ? `${c2.centerBoreMm}mm` : "-"],
    ["Thread Size", c1?.threadSize || "-", c2?.threadSize || "-"],
    ["Offset Range", c1?.offsetMinMm !== undefined ? `${c1.offsetMinMm} to ${c1.offsetMaxMm}mm` : "-", 
                     c2?.offsetMinMm !== undefined ? `${c2.offsetMinMm} to ${c2.offsetMaxMm}mm` : "-"],
    ["Generation", c1?.generation || "-", c2?.generation || "-"],
    ["Is Variant", c1?.isVariant ? "No" : "No", c2?.isVariant ? "Yes (Classic)" : "No"],
    ["OEM Tire Sizes", (c1?.oemTireSizes || []).slice(0, 2).join(", "), (c2?.oemTireSizes || []).slice(0, 2).join(", ")],
  ];
  
  for (const [field, v1, v2] of rows) {
    console.log(`│ ${field.padEnd(21)} │ ${v1.padEnd(23)} │ ${v2.padEnd(23)} │`);
  }
  
  console.log("└───────────────────────┴─────────────────────────┴─────────────────────────┘");
  
  // ─────────────────────────────────────────────────────────────────────────────
  // Key Difference Highlight
  // ─────────────────────────────────────────────────────────────────────────────
  
  console.log("\n⚠️  KEY DIFFERENCE:");
  console.log("   • 2020 Ram 1500 (5th Gen DT): 6x139.7 (6-lug)");
  console.log("   • 2020 Ram 1500 Classic:      5x139.7 (5-lug)");
  console.log("\n   These vehicles CANNOT share wheels. The Classic is a carryover 4th gen platform.");
  
  console.log("\n═══════════════════════════════════════════════════════════════════════════════\n");
}

function printResult(result: any, label: string) {
  console.log(`Summary: ${result.summary}\n`);
  
  const record = result.record;
  const candidate = record.candidate;
  
  // Confidence
  console.log("CONFIDENCE SCORE:");
  console.log(`  Level: ${record.overallConfidence.level.toUpperCase()}`);
  console.log(`  Score: ${record.overallConfidence.score}/100`);
  console.log(`  Factors:`);
  console.log(`    • Source Authority: ${record.overallConfidence.factors.sourceAuthority}/40`);
  console.log(`    • Source Agreement: ${record.overallConfidence.factors.sourceAgreement}/40`);
  console.log(`    • Completeness:     ${record.overallConfidence.factors.completeness}/20`);
  console.log(`  Reasoning:`);
  for (const r of record.overallConfidence.reasoning) {
    console.log(`    • ${r}`);
  }
  
  // Validation
  console.log(`\nVALIDATION:`);
  console.log(`  Reviewable: ${record.isReviewable ? "✅ Yes" : "❌ No"}`);
  if (record.validationErrors.length > 0) {
    console.log(`  Errors:`);
    for (const e of record.validationErrors) {
      console.log(`    ❌ ${e}`);
    }
  }
  if (record.validationWarnings.length > 0) {
    console.log(`  Warnings:`);
    for (const w of record.validationWarnings) {
      console.log(`    ⚠️  ${w}`);
    }
  }
  
  // Candidate preview
  if (candidate) {
    console.log(`\nNORMALIZED CANDIDATE:`);
    console.log(`  Vehicle: ${candidate.vehicleLabel}`);
    console.log(`  Generation: ${candidate.generation || "Unknown"}`);
    console.log(`  Is Variant: ${candidate.isVariant} ${candidate.variantQualifier ? `(${candidate.variantQualifier})` : ""}`);
    console.log(`  Bolt Pattern: ${candidate.boltPattern} ${candidate.boltPatternImperial ? `(${candidate.boltPatternImperial})` : ""}`);
    console.log(`  Center Bore: ${candidate.centerBoreMm}mm`);
    console.log(`  Thread Size: ${candidate.threadSize || "Unknown"}`);
    console.log(`  Offset Range: ${candidate.offsetMinMm ?? "?"} to ${candidate.offsetMaxMm ?? "?"}mm`);
    console.log(`  OEM Wheel Sizes: ${candidate.oemWheelSizes.map(w => `${w.diameter}x${w.width}`).join(", ")}`);
    console.log(`  OEM Tire Sizes: ${candidate.oemTireSizes.join(", ")}`);
    
    if (candidate.exceptions.length > 0) {
      console.log(`  Exceptions:`);
      for (const ex of candidate.exceptions) {
        console.log(`    • [${ex.type}] ${ex.description}`);
      }
    }
  }
  
  // Production approval check
  const approval = canApproveForProduction(record);
  console.log(`\nPRODUCTION APPROVAL:`);
  console.log(`  Can Approve: ${approval.canApprove ? "✅ Yes" : "❌ No"}`);
  if (approval.blockers.length > 0) {
    console.log(`  Blockers:`);
    for (const b of approval.blockers) {
      console.log(`    ⛔ ${b}`);
    }
  }
  
  // Production-ready export preview
  if (candidate) {
    console.log(`\nPRODUCTION EXPORT PREVIEW (requires manual approval):`);
    const exported = exportCandidateForProduction(candidate);
    console.log(JSON.stringify(exported, null, 2).split("\n").map(l => `  ${l}`).join("\n"));
  }
}

// Run the demo
runDemo().catch(console.error);
