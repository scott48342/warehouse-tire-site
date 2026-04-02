import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { db } from "../src/lib/fitment-db/db";
import { vehicleFitments, catalogModels } from "../src/lib/fitment-db/schema";
import { sql } from "drizzle-orm";
import * as fs from "fs";

interface GapAnalysis {
  make: string;
  model: string;
  hasYears: number[];
  missingYears: number[];
  priority: "critical" | "high" | "medium" | "low";
  reason: string;
}

// Popular models that MUST have full coverage
const CRITICAL_MODELS: Record<string, string[]> = {
  ford: ["f-150", "f-250", "f-350", "mustang", "explorer", "escape", "bronco", "ranger", "expedition", "edge"],
  chevrolet: ["silverado-1500", "silverado-2500", "silverado-3500", "camaro", "corvette", "tahoe", "suburban", "equinox", "traverse", "colorado", "malibu"],
  toyota: ["camry", "corolla", "rav4", "tacoma", "tundra", "4runner", "highlander", "sienna", "prius"],
  honda: ["civic", "accord", "cr-v", "pilot", "odyssey", "hr-v", "ridgeline"],
  ram: ["1500", "2500", "3500"],
  gmc: ["sierra-1500", "sierra-2500", "sierra-3500", "yukon", "acadia", "canyon", "terrain"],
  jeep: ["wrangler", "grand-cherokee", "cherokee", "gladiator", "compass", "renegade"],
  dodge: ["challenger", "charger", "durango"],
  nissan: ["altima", "maxima", "sentra", "rogue", "pathfinder", "murano", "frontier", "titan"],
  hyundai: ["elantra", "sonata", "tucson", "santa-fe", "palisade", "kona"],
  kia: ["forte", "k5", "sportage", "sorento", "telluride", "soul"],
  subaru: ["outback", "forester", "crosstrek", "impreza", "wrx", "legacy", "ascent"],
  mazda: ["3", "6", "cx-5", "cx-9", "cx-30", "mx-5-miata"],
  volkswagen: ["jetta", "passat", "tiguan", "atlas", "golf", "gti"],
  bmw: ["3-series", "5-series", "x3", "x5", "x1"],
  "mercedes-benz": ["c-class", "e-class", "gle", "glc", "gls"],
  audi: ["a4", "a6", "q5", "q7", "a3"],
  lexus: ["rx", "es", "nx", "gx", "is"],
  tesla: ["model-3", "model-y", "model-s", "model-x"],
};

// Year ranges when models were actually produced
const MODEL_PRODUCTION_YEARS: Record<string, Record<string, [number, number]>> = {
  ford: {
    "f-150": [1975, 2026],
    "f-250": [1975, 2026],
    "f-350": [1975, 2026],
    "mustang": [1964, 2026],
    "explorer": [1991, 2026],
    "escape": [2001, 2026],
    "bronco": [2021, 2026], // New gen only (old was 1966-1996)
    "ranger": [1983, 2026],
    "expedition": [1997, 2026],
    "edge": [2007, 2024],
  },
  chevrolet: {
    "silverado-1500": [1999, 2026],
    "camaro": [1967, 2024],
    "corvette": [1953, 2026],
    "tahoe": [1995, 2026],
    "equinox": [2005, 2026],
    "malibu": [1964, 2026],
    "traverse": [2009, 2026],
    "colorado": [2004, 2026],
  },
  toyota: {
    "camry": [1983, 2026],
    "corolla": [1966, 2026],
    "rav4": [1996, 2026],
    "tacoma": [1995, 2026],
    "tundra": [2000, 2026],
    "4runner": [1984, 2026],
    "highlander": [2001, 2026],
  },
  honda: {
    "civic": [1973, 2026],
    "accord": [1976, 2026],
    "cr-v": [1997, 2026],
    "pilot": [2003, 2026],
  },
  ram: {
    "1500": [1994, 2026],
    "2500": [1994, 2026],
    "3500": [1994, 2026],
  },
  jeep: {
    "wrangler": [1987, 2026],
    "grand-cherokee": [1993, 2026],
    "cherokee": [1984, 2026],
    "gladiator": [2020, 2026],
  },
  dodge: {
    "challenger": [2008, 2026], // Modern era
    "charger": [2006, 2026], // Modern era
    "durango": [1998, 2026],
  },
  tesla: {
    "model-s": [2012, 2026],
    "model-x": [2016, 2026],
    "model-3": [2017, 2026],
    "model-y": [2020, 2026],
  },
};

async function findGaps(): Promise<void> {
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  COVERAGE GAP ANALYSIS");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log();

  // Get all current coverage
  const coverage = await db.execute(sql`
    SELECT make, model, array_agg(DISTINCT year ORDER BY year) as years
    FROM vehicle_fitments
    GROUP BY make, model
  `);

  const coverageMap = new Map<string, number[]>();
  for (const row of coverage.rows as any[]) {
    coverageMap.set(`${row.make}|${row.model}`, row.years);
  }

  const gaps: GapAnalysis[] = [];
  const missingModels: { make: string; model: string; years: [number, number] }[] = [];

  // Check critical models
  for (const [make, models] of Object.entries(CRITICAL_MODELS)) {
    for (const model of models) {
      const key = `${make}|${model}`;
      const hasYears = coverageMap.get(key) || [];
      
      // Get expected production years
      const prodYears = MODEL_PRODUCTION_YEARS[make]?.[model];
      const startYear = prodYears ? Math.max(prodYears[0], 2000) : 2000; // Focus on 2000+
      const endYear = prodYears ? prodYears[1] : 2026;
      
      const expectedYears: number[] = [];
      for (let y = startYear; y <= endYear; y++) {
        expectedYears.push(y);
      }
      
      const missingYears = expectedYears.filter(y => !hasYears.includes(y));
      
      if (hasYears.length === 0) {
        missingModels.push({ make, model, years: [startYear, endYear] });
      } else if (missingYears.length > 0) {
        const coverage_pct = (hasYears.length / expectedYears.length) * 100;
        let priority: "critical" | "high" | "medium" | "low";
        let reason: string;
        
        if (missingYears.length > 15 || coverage_pct < 30) {
          priority = "critical";
          reason = `Only ${coverage_pct.toFixed(0)}% coverage (${hasYears.length}/${expectedYears.length} years)`;
        } else if (missingYears.length > 8 || coverage_pct < 60) {
          priority = "high";
          reason = `${coverage_pct.toFixed(0)}% coverage, missing ${missingYears.length} years`;
        } else if (missingYears.length > 3) {
          priority = "medium";
          reason = `${coverage_pct.toFixed(0)}% coverage, missing ${missingYears.length} years`;
        } else {
          priority = "low";
          reason = `Minor gaps: ${missingYears.join(", ")}`;
        }
        
        gaps.push({
          make,
          model,
          hasYears,
          missingYears,
          priority,
          reason,
        });
      }
    }
  }

  // Sort gaps by priority
  const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  gaps.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  // Output results
  console.log("COMPLETELY MISSING MODELS (0 coverage):");
  console.log("─────────────────────────────────────────");
  if (missingModels.length === 0) {
    console.log("  None! All critical models have some coverage.");
  } else {
    for (const m of missingModels) {
      console.log(`  🚫 ${m.make} ${m.model} (${m.years[0]}-${m.years[1]})`);
    }
  }
  console.log();

  console.log("MODELS WITH COVERAGE GAPS:");
  console.log("─────────────────────────────────────────");
  
  const criticalGaps = gaps.filter(g => g.priority === "critical");
  const highGaps = gaps.filter(g => g.priority === "high");
  const mediumGaps = gaps.filter(g => g.priority === "medium");
  const lowGaps = gaps.filter(g => g.priority === "low");

  if (criticalGaps.length > 0) {
    console.log();
    console.log("🔴 CRITICAL (need immediate fix):");
    for (const g of criticalGaps) {
      console.log(`  ${g.make} ${g.model}: ${g.reason}`);
      console.log(`    Has: ${g.hasYears.join(", ")}`);
      console.log(`    Missing: ${g.missingYears.slice(0, 10).join(", ")}${g.missingYears.length > 10 ? "..." : ""}`);
    }
  }

  if (highGaps.length > 0) {
    console.log();
    console.log("🟠 HIGH (should fix soon):");
    for (const g of highGaps) {
      console.log(`  ${g.make} ${g.model}: ${g.reason}`);
      console.log(`    Missing: ${g.missingYears.join(", ")}`);
    }
  }

  if (mediumGaps.length > 0) {
    console.log();
    console.log("🟡 MEDIUM:");
    for (const g of mediumGaps) {
      console.log(`  ${g.make} ${g.model}: ${g.reason}`);
    }
  }

  if (lowGaps.length > 0) {
    console.log();
    console.log("🟢 LOW (minor gaps):");
    for (const g of lowGaps) {
      console.log(`  ${g.make} ${g.model}: ${g.reason}`);
    }
  }

  // Generate fix list
  const toFix: { make: string; model: string; years: number[] }[] = [];
  
  for (const m of missingModels) {
    const years: number[] = [];
    for (let y = m.years[0]; y <= m.years[1]; y++) years.push(y);
    toFix.push({ make: m.make, model: m.model, years });
  }
  
  for (const g of [...criticalGaps, ...highGaps, ...mediumGaps]) {
    toFix.push({ make: g.make, model: g.model, years: g.missingYears });
  }

  // Save to file
  const output = {
    timestamp: new Date().toISOString(),
    summary: {
      missingModels: missingModels.length,
      criticalGaps: criticalGaps.length,
      highGaps: highGaps.length,
      mediumGaps: mediumGaps.length,
      lowGaps: lowGaps.length,
      totalYearsToFix: toFix.reduce((sum, t) => sum + t.years.length, 0),
    },
    toFix,
  };

  fs.writeFileSync("scripts/coverage-gaps-to-fix.json", JSON.stringify(output, null, 2));
  
  console.log();
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  SUMMARY");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log(`  Missing models:     ${missingModels.length}`);
  console.log(`  Critical gaps:      ${criticalGaps.length}`);
  console.log(`  High gaps:          ${highGaps.length}`);
  console.log(`  Medium gaps:        ${mediumGaps.length}`);
  console.log(`  Low gaps:           ${lowGaps.length}`);
  console.log(`  Total Y/M/M to fix: ${output.summary.totalYearsToFix}`);
  console.log();
  console.log(`  Fix list saved to: scripts/coverage-gaps-to-fix.json`);

  process.exit(0);
}

findGaps().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
