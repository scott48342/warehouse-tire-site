/**
 * Fill Missing Wheel Sizes - From Audit Results
 * 
 * Uses the wheel-audit-results.json to identify records needing wheel sizes,
 * then finds donors using model normalization.
 * 
 * This approach is more accurate because the audit already parsed the data.
 * 
 * Usage: npx tsx scripts/fitment-audit/fill-from-audit.ts [--dry-run] [--analysis-only]
 */

import * as dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import pg from "pg";
import * as fs from "fs/promises";
import { getModelVariants, normalizeModel, getCrossMakeLookups } from "./model-normalization";

const { Pool } = pg;

// Load audit results
const auditResults = require("./wheel-audit-results.json");

// ═══════════════════════════════════════════════════════════════════════════
// PLATFORM GENERATIONS (from fill-wheel-sizes-v2.ts)
// ═══════════════════════════════════════════════════════════════════════════

const PLATFORM_GENERATIONS: Record<string, Record<string, [number, number][]>> = {
  chevrolet: {
    "silverado-1500": [[1999, 2006], [2007, 2013], [2014, 2018], [2019, 2026]],
    "silverado-2500hd": [[1999, 2006], [2007, 2014], [2015, 2019], [2020, 2026]],
    "silverado-2500-hd": [[1999, 2006], [2007, 2014], [2015, 2019], [2020, 2026]],
    "silverado-3500hd": [[2001, 2006], [2007, 2014], [2015, 2019], [2020, 2026]],
    "silverado-3500-hd": [[2001, 2006], [2007, 2014], [2015, 2019], [2020, 2026]],
    "silverado-3500": [[2001, 2006], [2007, 2014], [2015, 2019], [2020, 2026]],
    "tahoe": [[2000, 2006], [2007, 2014], [2015, 2020], [2021, 2026]],
    "suburban": [[2000, 2006], [2007, 2014], [2015, 2020], [2021, 2026]],
    "camaro": [[1998, 2002], [2010, 2015], [2016, 2026]],
    "corvette": [[1997, 2004], [2005, 2013], [2014, 2019], [2020, 2026]],
    "equinox": [[2005, 2009], [2010, 2017], [2018, 2026]],
    "traverse": [[2009, 2017], [2018, 2026]],
    "malibu": [[2000, 2003], [2004, 2007], [2008, 2012], [2013, 2015], [2016, 2026]],
    "impala": [[2000, 2005], [2006, 2013], [2014, 2020]],
    "colorado": [[2004, 2012], [2015, 2026]],
    "trailblazer": [[2002, 2009], [2021, 2026]],
    "cavalier": [[1995, 2005]],
    "monte-carlo": [[2000, 2007]],
    "lumina": [[1995, 2001]],
  },
  gmc: {
    "sierra-1500": [[1999, 2006], [2007, 2013], [2014, 2018], [2019, 2026]],
    "sierra-2500hd": [[1999, 2006], [2007, 2014], [2015, 2019], [2020, 2026]],
    "sierra-2500-hd": [[1999, 2006], [2007, 2014], [2015, 2019], [2020, 2026]],
    "sierra-3500hd": [[2001, 2006], [2007, 2014], [2015, 2019], [2020, 2026]],
    "sierra-3500-hd": [[2001, 2006], [2007, 2014], [2015, 2019], [2020, 2026]],
    "sierra-3500": [[2001, 2006], [2007, 2014], [2015, 2019], [2020, 2026]],
    "yukon": [[2000, 2006], [2007, 2014], [2015, 2020], [2021, 2026]],
    "yukon-xl": [[2000, 2006], [2007, 2014], [2015, 2020], [2021, 2026]],
    "acadia": [[2007, 2016], [2017, 2026]],
    "terrain": [[2010, 2017], [2018, 2026]],
    "canyon": [[2004, 2012], [2015, 2026]],
    "envoy": [[2002, 2009]],
  },
  ram: {
    "1500": [[2002, 2008], [2009, 2018], [2019, 2026]],
    "2500": [[2003, 2009], [2010, 2018], [2019, 2026]],
    "3500": [[2003, 2009], [2010, 2018], [2019, 2026]],
  },
  dodge: {
    "ram-1500": [[1994, 2001], [2002, 2008]],
    "ram-2500": [[1994, 2002], [2003, 2009]],
    "ram-3500": [[1994, 2002], [2003, 2009]],
    "challenger": [[2008, 2026]],
    "charger": [[2006, 2010], [2011, 2026]],
    "durango": [[1998, 2003], [2004, 2009], [2011, 2026]],
    "caravan": [[2001, 2007], [2008, 2020]],
    "grand-caravan": [[2001, 2007], [2008, 2020]],
  },
  ford: {
    "f-150": [[1997, 2003], [2004, 2008], [2009, 2014], [2015, 2020], [2021, 2026]],
    "f-250": [[1999, 2007], [2008, 2010], [2011, 2016], [2017, 2026]],
    "f-350": [[1999, 2007], [2008, 2010], [2011, 2016], [2017, 2026]],
    "mustang": [[1999, 2004], [2005, 2014], [2015, 2023], [2024, 2026]],
    "explorer": [[1995, 2001], [2002, 2005], [2006, 2010], [2011, 2019], [2020, 2026]],
    "expedition": [[1997, 2002], [2003, 2006], [2007, 2017], [2018, 2026]],
    "ranger": [[1998, 2011], [2019, 2026]],
    "escape": [[2001, 2007], [2008, 2012], [2013, 2019], [2020, 2026]],
    "focus": [[2000, 2007], [2008, 2011], [2012, 2018]],
    "fusion": [[2006, 2012], [2013, 2020]],
    "taurus": [[2000, 2007], [2008, 2009], [2010, 2019]],
  },
  toyota: {
    "tacoma": [[1995, 2004], [2005, 2015], [2016, 2026]],
    "tundra": [[2000, 2006], [2007, 2021], [2022, 2026]],
    "4runner": [[1996, 2002], [2003, 2009], [2010, 2026]],
    "camry": [[1997, 2001], [2002, 2006], [2007, 2011], [2012, 2017], [2018, 2026]],
    "corolla": [[1998, 2002], [2003, 2008], [2009, 2013], [2014, 2018], [2019, 2026]],
    "rav4": [[1996, 2000], [2001, 2005], [2006, 2012], [2013, 2018], [2019, 2026]],
    "highlander": [[2001, 2007], [2008, 2013], [2014, 2019], [2020, 2026]],
    "sienna": [[1998, 2003], [2004, 2010], [2011, 2020], [2021, 2026]],
    "sequoia": [[2001, 2007], [2008, 2022], [2023, 2026]],
    "avalon": [[2000, 2004], [2005, 2012], [2013, 2018], [2019, 2026]],
  },
  honda: {
    "accord": [[1998, 2002], [2003, 2007], [2008, 2012], [2013, 2017], [2018, 2022], [2023, 2026]],
    "civic": [[1996, 2000], [2001, 2005], [2006, 2011], [2012, 2015], [2016, 2021], [2022, 2026]],
    "cr-v": [[1997, 2001], [2002, 2006], [2007, 2011], [2012, 2016], [2017, 2022], [2023, 2026]],
    "pilot": [[2003, 2008], [2009, 2015], [2016, 2022], [2023, 2026]],
    "odyssey": [[1999, 2004], [2005, 2010], [2011, 2017], [2018, 2026]],
  },
  jeep: {
    "wrangler": [[1997, 2006], [2007, 2017], [2018, 2026]],
    "grand-cherokee": [[1999, 2004], [2005, 2010], [2011, 2021], [2022, 2026]],
    "cherokee": [[1997, 2001], [2014, 2026]],
    "liberty": [[2002, 2007], [2008, 2012]],
    "gladiator": [[2020, 2026]],
    "compass": [[2007, 2017], [2018, 2026]],
  },
  nissan: {
    "altima": [[1998, 2001], [2002, 2006], [2007, 2012], [2013, 2018], [2019, 2026]],
    "maxima": [[2000, 2003], [2004, 2008], [2009, 2014], [2016, 2026]],
    "titan": [[2004, 2015], [2016, 2026]],
    "frontier": [[1998, 2004], [2005, 2021], [2022, 2026]],
    "pathfinder": [[2000, 2004], [2005, 2012], [2013, 2020], [2022, 2026]],
    "rogue": [[2008, 2013], [2014, 2020], [2021, 2026]],
    "sentra": [[2000, 2006], [2007, 2012], [2013, 2019], [2020, 2026]],
  },
  cadillac: {
    "escalade": [[1999, 2006], [2007, 2014], [2015, 2020], [2021, 2026]],
    "escalade-esv": [[2003, 2006], [2007, 2014], [2015, 2020], [2021, 2026]],
    "cts": [[2003, 2007], [2008, 2013], [2014, 2019]],
    "deville": [[2000, 2005]],
    "xt5": [[2017, 2026]],
  },
  buick: {
    "century": [[1997, 2005]],
    "lesabre": [[2000, 2005]],
    "regal": [[1997, 2004], [2011, 2017], [2018, 2020]],
    "lacrosse": [[2005, 2009], [2010, 2016], [2017, 2019]],
    "enclave": [[2008, 2017], [2018, 2026]],
    "encore": [[2013, 2026]],
  },
  pontiac: {
    "grand-am": [[1999, 2005]],
    "grand-prix": [[1997, 2003], [2004, 2008]],
    "bonneville": [[2000, 2005]],
    "firebird": [[1998, 2002]],
    "g6": [[2005, 2010]],
    "vibe": [[2003, 2010]],
  },
  saturn: {
    "vue": [[2002, 2007], [2008, 2010]],
    "aura": [[2007, 2009]],
    "outlook": [[2007, 2010]],
    "ion": [[2003, 2007]],
    "l-series": [[2000, 2005]],
    "s-series": [[1991, 2002]],
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

interface WheelSize {
  diameter: number;
  width: number;
  offset?: number;
}

function getGeneration(make: string, model: string, year: number): [number, number] | null {
  const makeGens = PLATFORM_GENERATIONS[make.toLowerCase()];
  if (!makeGens) return null;
  
  // Try original, then normalized
  let modelGens = makeGens[model.toLowerCase()];
  if (!modelGens) {
    modelGens = makeGens[normalizeModel(model)];
  }
  if (!modelGens) return null;
  
  for (const gen of modelGens) {
    if (year >= gen[0] && year <= gen[1]) return gen;
  }
  return null;
}

function parseWheelSizes(oemWheelSizes: any): WheelSize[] {
  if (!oemWheelSizes || !Array.isArray(oemWheelSizes)) return [];
  return oemWheelSizes.map((ws: any) => {
    if (typeof ws === 'object' && ws !== null) {
      const d = parseFloat(ws.diameter || ws.rim_diameter || 0);
      const w = parseFloat(ws.width || ws.rim_width || 0);
      if (d > 0 && w > 0) {
        return { diameter: d, width: w, offset: ws.offset };
      }
    }
    return null;
  }).filter((ws): ws is WheelSize => ws !== null);
}

async function findDonor(
  pool: pg.Pool,
  make: string,
  model: string,
  year: number,
  generation: [number, number]
): Promise<{ donor: any; normalizedMatch: boolean; donorModel: string } | null> {
  const modelVariants = getModelVariants(model);
  
  for (const variant of modelVariants) {
    const { rows } = await pool.query(`
      SELECT year, display_trim, oem_wheel_sizes, source, model
      FROM vehicle_fitments
      WHERE make = $1 AND model = $2
        AND year >= $3 AND year <= $4
        AND oem_wheel_sizes IS NOT NULL
      ORDER BY ABS(year - $5)
      LIMIT 5
    `, [make, variant, generation[0], generation[1], year]);
    
    // Find one with valid wheel sizes
    for (const row of rows) {
      const parsed = parseWheelSizes(row.oem_wheel_sizes);
      if (parsed.length > 0) {
        return {
          donor: { ...row, parsedWheelSizes: parsed },
          normalizedMatch: variant !== model.toLowerCase(),
          donorModel: variant,
        };
      }
    }
  }
  
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const analysisOnly = process.argv.includes("--analysis-only");
  const pool = new Pool({ connectionString: process.env.POSTGRES_URL });
  
  console.log("╔════════════════════════════════════════════════════════════════╗");
  console.log("║    FILL FROM AUDIT - MODEL NORMALIZATION ANALYSIS              ║");
  console.log("╚════════════════════════════════════════════════════════════════╝");
  console.log(`Mode: ${analysisOnly ? "ANALYSIS ONLY" : dryRun ? "DRY RUN" : "LIVE"}\n`);
  
  // Get records with missing wheel specs from audit
  const missingRecords = auditResults.records.filter(
    (r: any) => r.issueTypes?.includes("missing_wheel_specs")
  );
  
  console.log(`Audit flagged ${missingRecords.length} records with missing wheel specs\n`);
  
  const results: any[] = [];
  let donorFoundCount = 0;
  let normalizedMatchCount = 0;
  let skippedNoGen = 0;
  let skippedNoDonor = 0;
  
  try {
    for (const rec of missingRecords) {
      const generation = getGeneration(rec.make, rec.model, rec.year);
      
      if (!generation) {
        skippedNoGen++;
        results.push({
          year: rec.year,
          make: rec.make,
          model: rec.model,
          status: "skipped",
          reason: "No generation defined",
        });
        continue;
      }
      
      const donorResult = await findDonor(pool, rec.make, rec.model, rec.year, generation);
      
      if (!donorResult) {
        skippedNoDonor++;
        results.push({
          year: rec.year,
          make: rec.make,
          model: rec.model,
          status: "no_donor",
          reason: `No donor in gen ${generation[0]}-${generation[1]}`,
        });
        continue;
      }
      
      const { donor, normalizedMatch, donorModel } = donorResult;
      donorFoundCount++;
      if (normalizedMatch) normalizedMatchCount++;
      
      results.push({
        year: rec.year,
        make: rec.make,
        model: rec.model,
        status: "donor_found",
        donorYear: donor.year,
        donorModel,
        normalizedMatch,
        wheelSizes: donor.parsedWheelSizes,
      });
    }
    
    // Summary
    console.log("═══════════════════════════════════════════════════════════════");
    console.log("                         SUMMARY                                ");
    console.log("═══════════════════════════════════════════════════════════════\n");
    
    console.log(`Total missing records: ${missingRecords.length}`);
    console.log(`✅ Donors found: ${donorFoundCount}`);
    console.log(`  🔗 Via normalization: ${normalizedMatchCount}`);
    console.log(`  📋 Direct match: ${donorFoundCount - normalizedMatchCount}`);
    console.log(`⏭️  Skipped (no generation): ${skippedNoGen}`);
    console.log(`⏭️  Skipped (no donor): ${skippedNoDonor}\n`);
    
    // Normalized matches breakdown
    const normalizedMatches = results.filter(r => r.normalizedMatch);
    if (normalizedMatches.length > 0) {
      console.log("═══ NORMALIZED MATCHES (donors found via alias) ═══\n");
      const byPattern: Record<string, number> = {};
      normalizedMatches.forEach(r => {
        const key = `${r.make}/${r.model} ← ${r.donorModel}`;
        byPattern[key] = (byPattern[key] || 0) + 1;
      });
      Object.entries(byPattern)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 15)
        .forEach(([pattern, count]) => {
          console.log(`  ${pattern}: ${count} records`);
        });
    }
    
    // By model summary
    console.log("\n═══ FILLABLE BY MODEL ═══\n");
    const fillable = results.filter(r => r.status === "donor_found");
    const byModel: Record<string, number> = {};
    fillable.forEach(r => {
      const key = `${r.make}/${r.model}`;
      byModel[key] = (byModel[key] || 0) + 1;
    });
    Object.entries(byModel)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .forEach(([model, count]) => {
        console.log(`  ${model}: ${count}`);
      });
    
    // Skipped breakdown
    console.log("\n═══ SKIPPED (NO DONOR) - TOP MODELS ═══\n");
    const noDonor = results.filter(r => r.status === "no_donor");
    const noDonorByModel: Record<string, number> = {};
    noDonor.forEach(r => {
      const key = `${r.make}/${r.model}`;
      noDonorByModel[key] = (noDonorByModel[key] || 0) + 1;
    });
    Object.entries(noDonorByModel)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .forEach(([model, count]) => {
        console.log(`  ${model}: ${count}`);
      });
    
    // Save results
    const logPath = path.resolve(__dirname, "fill-from-audit-log.json");
    await fs.writeFile(logPath, JSON.stringify({
      timestamp: new Date().toISOString(),
      mode: analysisOnly ? "analysis" : dryRun ? "dry-run" : "live",
      summary: {
        totalMissing: missingRecords.length,
        donorFound: donorFoundCount,
        normalizedMatches: normalizedMatchCount,
        skippedNoGen,
        skippedNoDonor,
      },
      fillableByModel: byModel,
      noDonorByModel: noDonorByModel,
    }, null, 2));
    console.log(`\n📄 Log saved to: ${logPath}`);
    
  } finally {
    await pool.end();
  }
}

main().catch(console.error);
