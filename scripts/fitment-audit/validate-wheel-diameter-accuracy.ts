/**
 * VALIDATION AUDIT: Wheel Diameter Accuracy
 * 
 * Checks whether wheel diameter options are truly trim-specific,
 * or if they're accidentally inherited from grouped sibling trims.
 * 
 * NON-DESTRUCTIVE: Read-only audit, no changes to Phase 1 code.
 * 
 * Usage: npx tsx scripts/fitment-audit/validate-wheel-diameter-accuracy.ts
 */

import * as dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import pg from "pg";
const { Pool } = pg;

interface SampleVehicle {
  year: number;
  make: string;
  model: string;
  displayTrim: string;
  modificationId: string;
  oemTireSizes: string[];
  wheelDiameters: number[];
  expectedSingleDiameter: boolean; // Based on trim name heuristics
  verdict: "CORRECT" | "FALSE_MULTI" | "SUSPICIOUS" | "NEEDS_REVIEW";
  notes: string;
}

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

// Heuristics to identify trims that should likely have a SINGLE wheel diameter
function expectsSingleDiameter(displayTrim: string, make: string): boolean {
  const trim = (displayTrim || "").toLowerCase();
  
  // Base/entry trims typically have ONE wheel size
  if (/^(base|s|ls|lt|se|le|lx|ex|sport|xle|xse|sr|sv|sxt|gt|limited)$/i.test(trim)) {
    return true;
  }
  
  // Specific package names that indicate a single wheel config
  if (/trail boss|at4|trailboss|z71|off-road|trd pro|raptor|tremor|power wagon/i.test(trim)) {
    return true;
  }
  
  // Performance trims typically have specific wheel sizes
  if (/shelby|gt350|gt500|zl1|hellcat|demon|type r|nismo|amg|m sport/i.test(trim)) {
    return true;
  }
  
  return false;
}

// Sample configuration: 50 vehicles across segments
const SAMPLE_QUERIES = [
  // GM Trucks (8 samples)
  { year: 2024, make: "chevrolet", model: "silverado-1500", limit: 4 },
  { year: 2024, make: "gmc", model: "sierra-1500", limit: 2 },
  { year: 2023, make: "chevrolet", model: "colorado", limit: 2 },
  
  // GM SUVs (6 samples)
  { year: 2024, make: "chevrolet", model: "tahoe", limit: 2 },
  { year: 2024, make: "cadillac", model: "escalade", limit: 2 },
  { year: 2024, make: "gmc", model: "yukon", limit: 2 },
  
  // Ford Trucks (6 samples)
  { year: 2024, make: "ford", model: "f-150", limit: 3 },
  { year: 2024, make: "ford", model: "ranger", limit: 2 },
  { year: 2024, make: "ford", model: "maverick", limit: 1 },
  
  // Ford SUVs (4 samples)
  { year: 2024, make: "ford", model: "bronco", limit: 2 },
  { year: 2024, make: "ford", model: "expedition", limit: 2 },
  
  // Ram (4 samples)
  { year: 2024, make: "ram", model: "1500", limit: 3 },
  { year: 2024, make: "ram", model: "2500", limit: 1 },
  
  // Toyota (6 samples)
  { year: 2024, make: "toyota", model: "tundra", limit: 2 },
  { year: 2024, make: "toyota", model: "tacoma", limit: 2 },
  { year: 2024, make: "toyota", model: "4runner", limit: 2 },
  
  // Nissan (4 samples)
  { year: 2024, make: "nissan", model: "titan", limit: 2 },
  { year: 2024, make: "nissan", model: "frontier", limit: 2 },
  
  // Luxury/Performance (8 samples)
  { year: 2024, make: "bmw", model: "x5", limit: 2 },
  { year: 2024, make: "mercedes-benz", model: "gle-class", limit: 2 },
  { year: 2024, make: "porsche", model: "cayenne", limit: 2 },
  { year: 2024, make: "tesla", model: "model-y", limit: 2 },
  
  // Sedans/Cars (4 samples)
  { year: 2024, make: "honda", model: "accord", limit: 2 },
  { year: 2024, make: "toyota", model: "camry", limit: 2 },
];

async function runValidation() {
  const pool = new Pool({
    connectionString: process.env.POSTGRES_URL,
    ssl: false,
  });

  try {
    console.log("═══════════════════════════════════════════════════════════════");
    console.log("     VALIDATION AUDIT: Wheel Diameter Accuracy by Trim         ");
    console.log("═══════════════════════════════════════════════════════════════\n");

    const samples: SampleVehicle[] = [];

    for (const query of SAMPLE_QUERIES) {
      const { rows } = await pool.query(`
        SELECT 
          year,
          make,
          model,
          display_trim,
          modification_id,
          oem_tire_sizes
        FROM vehicle_fitments
        WHERE year = $1 AND make = $2 AND model = $3
          AND oem_tire_sizes IS NOT NULL
        ORDER BY display_trim
        LIMIT $4
      `, [query.year, query.make, query.model, query.limit]);

      for (const row of rows) {
        const tireSizes = (row.oem_tire_sizes || []) as string[];
        const wheelDiameters = getWheelDiameters(tireSizes);
        const expectedSingle = expectsSingleDiameter(row.display_trim, row.make);
        
        let verdict: SampleVehicle["verdict"] = "CORRECT";
        let notes = "";

        if (wheelDiameters.length === 1) {
          verdict = "CORRECT";
          notes = "Single diameter - clean";
        } else if (wheelDiameters.length > 1 && expectedSingle) {
          verdict = "FALSE_MULTI";
          notes = `Expected single diameter for "${row.display_trim}" trim, got ${wheelDiameters.length}`;
        } else if (wheelDiameters.length > 1) {
          // Multiple diameters - check if reasonable
          const spread = wheelDiameters[wheelDiameters.length - 1] - wheelDiameters[0];
          if (spread > 4) {
            verdict = "SUSPICIOUS";
            notes = `Large spread (${spread}") between diameters - may be aggregated`;
          } else {
            verdict = "CORRECT";
            notes = `Multiple options within ${spread}" spread - typical for this segment`;
          }
        }

        samples.push({
          year: row.year,
          make: row.make,
          model: row.model,
          displayTrim: row.display_trim || "Base",
          modificationId: row.modification_id,
          oemTireSizes: tireSizes,
          wheelDiameters,
          expectedSingleDiameter: expectedSingle,
          verdict,
          notes,
        });
      }
    }

    // Print detailed results
    console.log(`📊 SAMPLED ${samples.length} VEHICLES\n`);

    // Group by verdict
    const correct = samples.filter(s => s.verdict === "CORRECT");
    const falseMulti = samples.filter(s => s.verdict === "FALSE_MULTI");
    const suspicious = samples.filter(s => s.verdict === "SUSPICIOUS");
    const needsReview = samples.filter(s => s.verdict === "NEEDS_REVIEW");

    console.log("SUMMARY:");
    console.log(`   ✅ CORRECT: ${correct.length} (${(correct.length / samples.length * 100).toFixed(1)}%)`);
    console.log(`   ⚠️  FALSE MULTI-DIAMETER: ${falseMulti.length}`);
    console.log(`   🔶 SUSPICIOUS: ${suspicious.length}`);
    console.log(`   ❓ NEEDS REVIEW: ${needsReview.length}\n`);

    // Print issues
    if (falseMulti.length > 0) {
      console.log("═══════════════════════════════════════════════════════════════");
      console.log("⚠️  FALSE MULTI-DIAMETER CASES (expected single, got multiple)");
      console.log("═══════════════════════════════════════════════════════════════\n");
      
      for (const s of falseMulti) {
        console.log(`${s.year} ${s.make} ${s.model} - "${s.displayTrim}"`);
        console.log(`   Sizes: ${s.oemTireSizes.join(", ")}`);
        console.log(`   Diameters: ${s.wheelDiameters.map(d => d + '"').join(", ")}`);
        console.log(`   ModID: ${s.modificationId}`);
        console.log(`   Issue: ${s.notes}`);
        console.log("");
      }
    }

    if (suspicious.length > 0) {
      console.log("═══════════════════════════════════════════════════════════════");
      console.log("🔶 SUSPICIOUS CASES (large diameter spread)");
      console.log("═══════════════════════════════════════════════════════════════\n");
      
      for (const s of suspicious) {
        console.log(`${s.year} ${s.make} ${s.model} - "${s.displayTrim}"`);
        console.log(`   Sizes: ${s.oemTireSizes.join(", ")}`);
        console.log(`   Diameters: ${s.wheelDiameters.map(d => d + '"').join(", ")}`);
        console.log(`   Issue: ${s.notes}`);
        console.log("");
      }
    }

    // Print all samples grouped by make
    console.log("═══════════════════════════════════════════════════════════════");
    console.log("📋 ALL SAMPLED VEHICLES");
    console.log("═══════════════════════════════════════════════════════════════\n");

    const byMake = new Map<string, SampleVehicle[]>();
    for (const s of samples) {
      const key = s.make;
      if (!byMake.has(key)) byMake.set(key, []);
      byMake.get(key)!.push(s);
    }

    for (const [make, vehicles] of byMake) {
      console.log(`\n--- ${make.toUpperCase()} ---`);
      for (const v of vehicles) {
        const icon = v.verdict === "CORRECT" ? "✅" : v.verdict === "FALSE_MULTI" ? "⚠️" : "🔶";
        const diaStr = v.wheelDiameters.length === 1 
          ? `${v.wheelDiameters[0]}"`
          : v.wheelDiameters.map(d => d + '"').join("/");
        console.log(`${icon} ${v.year} ${v.model} "${v.displayTrim}" → ${diaStr}`);
        if (v.verdict !== "CORRECT") {
          console.log(`      ${v.notes}`);
        }
      }
    }

    // Cross-check: look for trim aggregation issues
    console.log("\n═══════════════════════════════════════════════════════════════");
    console.log("🔍 TRIM AGGREGATION CHECK");
    console.log("═══════════════════════════════════════════════════════════════\n");

    // Check if multiple display_trims share same modification_id with different tire sizes
    const { rows: aggCheck } = await pool.query(`
      SELECT 
        modification_id,
        array_agg(DISTINCT display_trim) as trims,
        array_agg(DISTINCT oem_tire_sizes::text) as tire_configs,
        count(*) as count
      FROM vehicle_fitments
      WHERE year >= 2020
      GROUP BY modification_id
      HAVING count(*) > 1
      ORDER BY count DESC
      LIMIT 20
    `);

    console.log(`Found ${aggCheck.length} modification_ids with multiple trims:`);
    for (const row of aggCheck.slice(0, 10)) {
      const trims = row.trims as string[];
      const configs = row.tire_configs as string[];
      console.log(`\n   ModID: ${row.modification_id}`);
      console.log(`   Trims (${trims.length}): ${trims.slice(0, 5).join(", ")}${trims.length > 5 ? "..." : ""}`);
      console.log(`   Unique tire configs: ${configs.length}`);
    }

    // Final recommendation
    console.log("\n═══════════════════════════════════════════════════════════════");
    console.log("🏗️ VALIDATION FINDINGS & RECOMMENDATION");
    console.log("═══════════════════════════════════════════════════════════════\n");

    const issueRate = (falseMulti.length + suspicious.length) / samples.length * 100;
    
    if (issueRate < 10) {
      console.log("✅ ARCHITECTURE IS SAFE");
      console.log("");
      console.log(`Issue rate: ${issueRate.toFixed(1)}% (${falseMulti.length + suspicious.length}/${samples.length})`);
      console.log("The 92% multi-diameter figure is EXPECTED - most vehicles offer");
      console.log("multiple wheel size options from the factory.");
      console.log("");
      console.log("RECOMMENDATION: Phase 1 wheel diameter selector is correct.");
      console.log("No additional trim-aware filtering needed.");
    } else if (issueRate < 25) {
      console.log("⚠️ MINOR ISSUES DETECTED");
      console.log("");
      console.log(`Issue rate: ${issueRate.toFixed(1)}%`);
      console.log("Some trims may have aggregated tire sizes from sibling trims.");
      console.log("");
      console.log("RECOMMENDATION: Monitor, but Phase 1 selector still protects users.");
    } else {
      console.log("🔴 SIGNIFICANT AGGREGATION ISSUES");
      console.log("");
      console.log(`Issue rate: ${issueRate.toFixed(1)}%`);
      console.log("Trim-level tire sizes are being aggregated too broadly.");
      console.log("");
      console.log("RECOMMENDATION: Review data import process for trim-level accuracy.");
    }

    // Save results
    const fs = await import("fs/promises");
    await fs.writeFile(
      "./scripts/fitment-audit/wheel-diameter-validation.json",
      JSON.stringify({
        timestamp: new Date().toISOString(),
        summary: {
          totalSampled: samples.length,
          correct: correct.length,
          falseMulti: falseMulti.length,
          suspicious: suspicious.length,
          issueRate: issueRate.toFixed(2) + "%",
        },
        falseMultiCases: falseMulti,
        suspiciousCases: suspicious,
        allSamples: samples,
      }, null, 2)
    );
    console.log("\n📄 Full results saved to: ./scripts/fitment-audit/wheel-diameter-validation.json");

  } finally {
    await pool.end();
  }
}

runValidation().catch(console.error);
