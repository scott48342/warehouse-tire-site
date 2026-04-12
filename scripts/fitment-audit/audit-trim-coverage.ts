/**
 * Fitment Trim Coverage Audit
 * 
 * Scans all Year/Make/Model combinations in the database and identifies:
 * 1. Y/M/M combinations with zero trims
 * 2. Y/M/M combinations with unusually low trim counts
 * 3. Root cause classification
 * 
 * Usage: npx tsx scripts/fitment-audit/audit-trim-coverage.ts
 */

import pg from "pg";

const { Pool } = pg;

// Minimum expected trims per vehicle type
const MIN_EXPECTED_TRIMS: Record<string, number> = {
  default: 1,
  truck: 2, // Trucks usually have 2WD/4WD variants
  suv: 2,
  sports: 2, // Usually base + performance
};

// Known truck/SUV models that should have multiple trims
const TRUCK_MODELS = new Set([
  "silverado-1500", "silverado-2500hd", "silverado-3500hd",
  "f-150", "f-250-super-duty", "f-350-super-duty",
  "ram-1500", "ram-2500", "ram-3500",
  "tacoma", "tundra", "colorado", "canyon",
  "frontier", "titan", "titan-xd",
  "ranger", "ridgeline",
]);

const SUV_MODELS = new Set([
  "tahoe", "suburban", "yukon", "escalade",
  "expedition", "explorer", "bronco",
  "durango", "grand-cherokee", "wrangler",
  "4runner", "sequoia", "land-cruiser",
  "pathfinder", "armada", "highlander",
  "pilot", "passport",
]);

interface YMMSummary {
  year: number;
  make: string;
  model: string;
  trimCount: number;
  trims: string[];
  expectedMinTrims: number;
  category: "zero" | "low" | "ok";
  vehicleType: string;
}

interface AuditResult {
  totalYMM: number;
  zeroTrims: YMMSummary[];
  lowTrims: YMMSummary[];
  byMake: Map<string, { total: number; zero: number; low: number }>;
  byYear: Map<number, { total: number; zero: number; low: number }>;
}

function getVehicleType(model: string): string {
  const modelLower = model.toLowerCase().replace(/\s+/g, "-");
  if (TRUCK_MODELS.has(modelLower)) return "truck";
  if (SUV_MODELS.has(modelLower)) return "suv";
  return "default";
}

function getExpectedMinTrims(model: string): number {
  const vehicleType = getVehicleType(model);
  return MIN_EXPECTED_TRIMS[vehicleType] || MIN_EXPECTED_TRIMS.default;
}

async function runAudit(): Promise<AuditResult> {
  const pool = new Pool({
    connectionString: process.env.POSTGRES_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    console.log("🔍 Starting Fitment Trim Coverage Audit...\n");

    // Step 1: Get all unique Y/M/M combinations and their trim counts
    const { rows: ymmData } = await pool.query(`
      SELECT 
        year,
        make,
        model,
        COUNT(DISTINCT modification_id) as trim_count,
        ARRAY_AGG(DISTINCT display_trim ORDER BY display_trim) as trims
      FROM vehicle_fitments
      GROUP BY year, make, model
      ORDER BY make, model, year
    `);

    console.log(`📊 Found ${ymmData.length} unique Year/Make/Model combinations\n`);

    const result: AuditResult = {
      totalYMM: ymmData.length,
      zeroTrims: [],
      lowTrims: [],
      byMake: new Map(),
      byYear: new Map(),
    };

    // Process each Y/M/M
    for (const row of ymmData) {
      const summary: YMMSummary = {
        year: row.year,
        make: row.make,
        model: row.model,
        trimCount: parseInt(row.trim_count),
        trims: row.trims || [],
        expectedMinTrims: getExpectedMinTrims(row.model),
        vehicleType: getVehicleType(row.model),
        category: "ok",
      };

      // Classify
      if (summary.trimCount === 0) {
        summary.category = "zero";
        result.zeroTrims.push(summary);
      } else if (summary.trimCount < summary.expectedMinTrims) {
        summary.category = "low";
        result.lowTrims.push(summary);
      }

      // Update make stats
      const makeStats = result.byMake.get(row.make) || { total: 0, zero: 0, low: 0 };
      makeStats.total++;
      if (summary.category === "zero") makeStats.zero++;
      if (summary.category === "low") makeStats.low++;
      result.byMake.set(row.make, makeStats);

      // Update year stats
      const yearStats = result.byYear.get(row.year) || { total: 0, zero: 0, low: 0 };
      yearStats.total++;
      if (summary.category === "zero") yearStats.zero++;
      if (summary.category === "low") yearStats.low++;
      result.byYear.set(row.year, yearStats);
    }

    return result;
  } finally {
    await pool.end();
  }
}

async function main() {
  try {
    const result = await runAudit();

    // Print summary
    console.log("═══════════════════════════════════════════════════════════════");
    console.log("                    FITMENT TRIM COVERAGE AUDIT                ");
    console.log("═══════════════════════════════════════════════════════════════\n");

    console.log(`📊 SUMMARY`);
    console.log(`   Total Y/M/M combinations: ${result.totalYMM}`);
    console.log(`   ❌ Zero trims: ${result.zeroTrims.length} (${(result.zeroTrims.length / result.totalYMM * 100).toFixed(1)}%)`);
    console.log(`   ⚠️  Low trims: ${result.lowTrims.length} (${(result.lowTrims.length / result.totalYMM * 100).toFixed(1)}%)`);
    console.log(`   ✅ OK: ${result.totalYMM - result.zeroTrims.length - result.lowTrims.length}\n`);

    // Zero trims by make
    if (result.zeroTrims.length > 0) {
      console.log("═══════════════════════════════════════════════════════════════");
      console.log("❌ VEHICLES WITH ZERO TRIMS (Critical)");
      console.log("═══════════════════════════════════════════════════════════════\n");

      // Group by make/model
      const byMakeModel = new Map<string, YMMSummary[]>();
      for (const v of result.zeroTrims) {
        const key = `${v.make}|${v.model}`;
        const list = byMakeModel.get(key) || [];
        list.push(v);
        byMakeModel.set(key, list);
      }

      for (const [key, vehicles] of byMakeModel) {
        const [make, model] = key.split("|");
        const years = vehicles.map(v => v.year).sort();
        const yearRange = years.length > 1 
          ? `${years[0]}-${years[years.length - 1]}` 
          : `${years[0]}`;
        console.log(`   ${make} ${model} (${yearRange})`);
        console.log(`      Years affected: ${years.join(", ")}`);
        console.log("");
      }
    }

    // Low trims by make (trucks/SUVs only)
    if (result.lowTrims.length > 0) {
      console.log("═══════════════════════════════════════════════════════════════");
      console.log("⚠️  VEHICLES WITH LOW TRIM COUNT (Trucks/SUVs expecting 2+)");
      console.log("═══════════════════════════════════════════════════════════════\n");

      // Group by make/model
      const byMakeModel = new Map<string, YMMSummary[]>();
      for (const v of result.lowTrims) {
        const key = `${v.make}|${v.model}`;
        const list = byMakeModel.get(key) || [];
        list.push(v);
        byMakeModel.set(key, list);
      }

      for (const [key, vehicles] of byMakeModel) {
        const [make, model] = key.split("|");
        const years = vehicles.map(v => v.year).sort();
        const sampleTrims = vehicles[0].trims.slice(0, 3).join(", ");
        console.log(`   ${make} ${model}`);
        console.log(`      Years: ${years.join(", ")}`);
        console.log(`      Trims found: ${sampleTrims}`);
        console.log(`      Expected: ${vehicles[0].expectedMinTrims}+ | Found: ${vehicles[0].trimCount}`);
        console.log("");
      }
    }

    // Summary by make
    console.log("═══════════════════════════════════════════════════════════════");
    console.log("📈 COVERAGE BY MAKE");
    console.log("═══════════════════════════════════════════════════════════════\n");

    const makeEntries = Array.from(result.byMake.entries())
      .sort((a, b) => b[1].zero - a[1].zero);

    for (const [make, stats] of makeEntries) {
      if (stats.zero > 0 || stats.low > 0) {
        const zeroPercent = (stats.zero / stats.total * 100).toFixed(1);
        const lowPercent = (stats.low / stats.total * 100).toFixed(1);
        console.log(`   ${make.padEnd(15)} Total: ${stats.total.toString().padStart(4)} | Zero: ${stats.zero.toString().padStart(3)} (${zeroPercent}%) | Low: ${stats.low.toString().padStart(3)} (${lowPercent}%)`);
      }
    }

    // Output JSON for further processing
    const outputPath = "./scripts/fitment-audit/audit-results.json";
    const fs = await import("fs/promises");
    await fs.writeFile(outputPath, JSON.stringify({
      timestamp: new Date().toISOString(),
      summary: {
        totalYMM: result.totalYMM,
        zeroTrims: result.zeroTrims.length,
        lowTrims: result.lowTrims.length,
        okTrims: result.totalYMM - result.zeroTrims.length - result.lowTrims.length,
      },
      zeroTrims: result.zeroTrims,
      lowTrims: result.lowTrims,
      byMake: Object.fromEntries(result.byMake),
    }, null, 2));
    console.log(`\n📄 Full results saved to: ${outputPath}`);

  } catch (err) {
    console.error("❌ Audit failed:", err);
    process.exit(1);
  }
}

main();
