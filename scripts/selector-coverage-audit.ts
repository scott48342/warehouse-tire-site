/**
 * Selector Coverage Audit
 * 
 * Compares all vehicle combinations the selector can generate against
 * actual fitment coverage in the production fitment DB.
 * 
 * Run: npx tsx scripts/selector-coverage-audit.ts
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { db } from "../src/lib/fitment-db/db";
import { vehicleFitments, catalogMakes, catalogModels } from "../src/lib/fitment-db/schema";
import { sql, eq, and } from "drizzle-orm";
import * as fs from "fs";
import * as path from "path";

// ============================================================================
// TYPES
// ============================================================================

interface YMMCoverage {
  year: number;
  make: string;
  model: string;
  status: "fully_covered" | "selector_only" | "db_only";
  selectorSource: "catalog" | "static" | "fitment_db";
  fitmentCount: number;
}

interface TrimCoverage {
  year: number;
  make: string;
  model: string;
  trim: string;
  modificationId: string;
  status: "exact_match" | "selector_only" | "db_only";
  source: "supplement" | "fitment_db" | "fallback";
}

interface AuditReport {
  timestamp: string;
  phase1: {
    totalSelectorCombinations: number;
    totalFitmentCombinations: number;
    fullyCovered: number;
    selectorOnly: number;
    dbOnly: number;
    byMake: Record<string, { fullyCovered: number; selectorOnly: number; dbOnly: number }>;
    selectorOnlyExamples: YMMCoverage[];
    dbOnlyExamples: YMMCoverage[];
  };
  phase2: {
    totalTrimsChecked: number;
    exactMatch: number;
    selectorOnlyTrims: number;
    dbOnlyTrims: number;
    trimMismatchExamples: TrimCoverage[];
  };
  problemAreas: {
    make: string;
    model: string;
    issue: string;
    severity: "high" | "medium" | "low";
    selectorYears: number[];
    fitmentYears: number[];
  }[];
  recommendations: {
    blockImmediately: string[];
    backfillFitmentDB: string[];
    permanentValidation: string[];
  };
}

// ============================================================================
// STATIC FALLBACK DATA (from old models API)
// ============================================================================

const COMMON_MODELS: Record<string, string[]> = {
  ford: ["Bronco", "Bronco Sport", "Edge", "Escape", "Expedition", "Explorer", "F-150", "F-250", "F-350", "Fusion", "Maverick", "Mustang", "Ranger", "Transit"],
  chevrolet: ["Blazer", "Camaro", "Colorado", "Corvette", "Equinox", "Malibu", "Silverado 1500", "Silverado 2500 HD", "Silverado 3500 HD", "Suburban", "Tahoe", "Trailblazer", "Traverse", "Cavalier", "Chevelle", "Cobalt", "Caprice", "Impala", "Lumina", "Monte Carlo", "Cruze"],
  ram: ["1500", "2500", "3500", "ProMaster"],
  toyota: ["4Runner", "Camry", "Corolla", "GR86", "Highlander", "Land Cruiser", "Prius", "RAV4", "Sequoia", "Sienna", "Tacoma", "Tundra"],
  honda: ["Accord", "Civic", "CR-V", "HR-V", "Odyssey", "Passport", "Pilot", "Ridgeline"],
  nissan: ["370Z", "Altima", "Armada", "Frontier", "Kicks", "Maxima", "Murano", "Pathfinder", "Rogue", "Sentra", "Titan", "Versa", "Z"],
  jeep: ["Cherokee", "Compass", "Gladiator", "Grand Cherokee", "Grand Cherokee L", "Grand Wagoneer", "Renegade", "Wagoneer", "Wrangler"],
  gmc: ["Acadia", "Canyon", "Sierra 1500", "Sierra 2500 HD", "Sierra 3500 HD", "Terrain", "Yukon", "Yukon XL"],
  dodge: ["Challenger", "Charger", "Durango", "Hornet", "Ram 1500"],
  hyundai: ["Elantra", "Ioniq 5", "Ioniq 6", "Kona", "Palisade", "Santa Cruz", "Santa Fe", "Sonata", "Tucson", "Venue"],
  kia: ["Carnival", "EV6", "Forte", "K5", "Niro", "Rio", "Seltos", "Sorento", "Soul", "Sportage", "Stinger", "Telluride"],
  subaru: ["Ascent", "BRZ", "Crosstrek", "Forester", "Impreza", "Legacy", "Outback", "Solterra", "WRX"],
  mazda: ["3", "CX-30", "CX-5", "CX-50", "CX-9", "CX-90", "MX-5 Miata"],
  volkswagen: ["Atlas", "Atlas Cross Sport", "Golf", "Golf GTI", "Golf R", "ID.4", "Jetta", "Passat", "Taos", "Tiguan"],
  bmw: ["2 Series", "3 Series", "4 Series", "5 Series", "7 Series", "8 Series", "iX", "X1", "X3", "X4", "X5", "X6", "X7", "Z4"],
  "mercedes-benz": ["A-Class", "C-Class", "CLA", "CLE", "E-Class", "GLA", "GLB", "GLC", "GLE", "GLS", "S-Class"],
  audi: ["A3", "A4", "A5", "A6", "A7", "A8", "e-tron", "Q3", "Q4 e-tron", "Q5", "Q7", "Q8", "RS 3", "RS 5", "RS 6", "RS 7", "S3", "S4", "S5", "TT"],
  lexus: ["ES", "GX", "IS", "LC", "LS", "LX", "NX", "RC", "RX", "RZ", "TX", "UX"],
  acura: ["ILX", "Integra", "MDX", "RDX", "TLX"],
  infiniti: ["Q50", "Q60", "QX50", "QX55", "QX60", "QX80"],
  cadillac: ["CT4", "CT5", "Escalade", "Escalade ESV", "Lyriq", "XT4", "XT5", "XT6", "CTS", "DeVille", "Eldorado", "Seville", "STS"],
  lincoln: ["Aviator", "Corsair", "Nautilus", "Navigator", "Town Car", "Continental", "MKZ"],
  buick: ["Enclave", "Encore", "Encore GX", "Envision", "Century", "LeSabre", "Park Avenue", "Regal", "Riviera", "Skylark"],
  chrysler: ["300", "Pacifica", "Voyager", "PT Cruiser", "Sebring", "Town & Country"],
  tesla: ["Model 3", "Model S", "Model X", "Model Y"],
  porsche: ["718 Boxster", "718 Cayman", "911", "Cayenne", "Macan", "Panamera", "Taycan"],
  "land-rover": ["Defender", "Discovery", "Discovery Sport", "Range Rover", "Range Rover Evoque", "Range Rover Sport", "Range Rover Velar"],
  volvo: ["C40 Recharge", "S60", "S90", "V60", "V90", "XC40", "XC60", "XC90"],
  mini: ["Clubman", "Convertible", "Countryman", "Hardtop 2 Door", "Hardtop 4 Door"],
  mitsubishi: ["Eclipse Cross", "Mirage", "Outlander", "Outlander Sport", "Eclipse", "Lancer"],
  pontiac: ["Firebird", "Trans Am", "GTO", "Grand Am", "Grand Prix", "Bonneville", "Sunfire", "G6", "G8", "Solstice", "Vibe", "Aztek", "Montana"],
  oldsmobile: ["442", "Alero", "Aurora", "Bravada", "Cutlass", "Cutlass Supreme", "Delta 88", "Intrigue", "Silhouette", "Toronado"],
  saturn: ["Astra", "Aura", "Ion", "L-Series", "Outlook", "Relay", "S-Series", "SC", "SL", "SW", "Sky", "Vue"],
  mercury: ["Cougar", "Grand Marquis", "Mariner", "Milan", "Montego", "Monterey", "Mountaineer", "Sable", "Tracer", "Villager"],
  plymouth: ["Barracuda", "Breeze", "Duster", "Fury", "Grand Voyager", "Neon", "Prowler", "Road Runner", "Sundance", "Voyager"],
  hummer: ["H1", "H2", "H3", "H3T"],
  scion: ["FR-S", "iA", "iM", "iQ", "tC", "xA", "xB", "xD"],
};

// ============================================================================
// HELPERS
// ============================================================================

function normalizeSlug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function generateStaticYears(): number[] {
  const currentYear = new Date().getFullYear();
  const years: number[] = [];
  for (let y = currentYear + 1; y >= 2000; y--) {
    years.push(y);
  }
  return years;
}

// ============================================================================
// DATA LOADERS
// ============================================================================

async function loadCatalogData(): Promise<Map<string, Map<string, number[]>>> {
  // Map: make -> model -> years[]
  const catalog = new Map<string, Map<string, number[]>>();
  
  const models = await db.select().from(catalogModels);
  
  for (const m of models) {
    if (!catalog.has(m.makeSlug)) {
      catalog.set(m.makeSlug, new Map());
    }
    catalog.get(m.makeSlug)!.set(m.slug, (m.years || []) as number[]);
  }
  
  console.log(`[audit] Loaded catalog: ${catalog.size} makes`);
  return catalog;
}

async function loadFitmentData(): Promise<{
  ymm: Map<string, Set<string>>; // "make|model" -> Set<year>
  trims: Map<string, Array<{ modificationId: string; displayTrim: string }>>; // "year|make|model" -> trims
}> {
  const ymm = new Map<string, Set<string>>();
  const trims = new Map<string, Array<{ modificationId: string; displayTrim: string }>>();
  
  // Get all distinct Y/M/M combinations
  const fitments = await db
    .select({
      year: vehicleFitments.year,
      make: vehicleFitments.make,
      model: vehicleFitments.model,
      modificationId: vehicleFitments.modificationId,
      displayTrim: vehicleFitments.displayTrim,
    })
    .from(vehicleFitments);
  
  for (const f of fitments) {
    const mmKey = `${f.make}|${f.model}`;
    const ymmKey = `${f.year}|${f.make}|${f.model}`;
    
    if (!ymm.has(mmKey)) {
      ymm.set(mmKey, new Set());
    }
    ymm.get(mmKey)!.add(String(f.year));
    
    if (!trims.has(ymmKey)) {
      trims.set(ymmKey, []);
    }
    trims.get(ymmKey)!.push({
      modificationId: f.modificationId,
      displayTrim: f.displayTrim,
    });
  }
  
  console.log(`[audit] Loaded fitments: ${ymm.size} make/model combinations, ${fitments.length} total records`);
  return { ymm, trims };
}

function loadSubmodelSupplements(): Map<string, Map<string, string[]>> {
  // Map: "make|model" -> "yearRange" -> trims[]
  const supplements = new Map<string, Map<string, string[]>>();
  
  try {
    const data = JSON.parse(
      fs.readFileSync(path.join(__dirname, "../src/data/submodel-supplements.json"), "utf-8")
    );
    
    for (const [make, models] of Object.entries(data as Record<string, Record<string, Record<string, { value: string }[]>>>)) {
      for (const [model, yearRanges] of Object.entries(models)) {
        const key = `${make}|${model}`;
        if (!supplements.has(key)) {
          supplements.set(key, new Map());
        }
        for (const [yearRange, entries] of Object.entries(yearRanges)) {
          supplements.get(key)!.set(yearRange, entries.map(e => e.value));
        }
      }
    }
    
    console.log(`[audit] Loaded supplements: ${supplements.size} make/model combinations`);
  } catch (err) {
    console.warn(`[audit] Could not load supplements: ${err}`);
  }
  
  return supplements;
}

// ============================================================================
// PHASE 1: Y/M/M COVERAGE
// ============================================================================

async function auditPhase1(
  catalog: Map<string, Map<string, number[]>>,
  fitmentData: { ymm: Map<string, Set<string>>; trims: Map<string, Array<{ modificationId: string; displayTrim: string }>> }
): Promise<AuditReport["phase1"]> {
  const results: YMMCoverage[] = [];
  const byMake: Record<string, { fullyCovered: number; selectorOnly: number; dbOnly: number }> = {};
  
  // Track all Y/M/M combinations
  const allSelectorYMM = new Set<string>();
  const allFitmentYMM = new Set<string>();
  
  // Build set of all fitment Y/M/M
  for (const [mmKey, years] of fitmentData.ymm) {
    for (const year of years) {
      const [make, model] = mmKey.split("|");
      allFitmentYMM.add(`${year}|${make}|${model}`);
    }
  }
  
  // Check catalog combinations
  for (const [make, models] of catalog) {
    for (const [model, years] of models) {
      const mmKey = `${make}|${model}`;
      const fitmentYears = fitmentData.ymm.get(mmKey);
      
      for (const year of years) {
        const ymmKey = `${year}|${make}|${model}`;
        allSelectorYMM.add(ymmKey);
        
        const hasFitment = fitmentYears?.has(String(year)) || false;
        const fitmentCount = hasFitment ? (fitmentData.trims.get(ymmKey)?.length || 0) : 0;
        
        results.push({
          year,
          make,
          model,
          status: hasFitment ? "fully_covered" : "selector_only",
          selectorSource: "catalog",
          fitmentCount,
        });
      }
    }
  }
  
  // Check static fallback combinations (COMMON_MODELS + static year range)
  const staticYears = generateStaticYears();
  for (const [make, models] of Object.entries(COMMON_MODELS)) {
    const makeSlug = normalizeSlug(make);
    const catalogMake = catalog.get(makeSlug);
    
    for (const model of models) {
      const modelSlug = normalizeSlug(model);
      const catalogModel = catalogMake?.get(modelSlug);
      
      // If not in catalog, these would be shown via static fallback
      if (!catalogModel) {
        const mmKey = `${makeSlug}|${modelSlug}`;
        const fitmentYears = fitmentData.ymm.get(mmKey);
        
        for (const year of staticYears) {
          const ymmKey = `${year}|${makeSlug}|${modelSlug}`;
          if (!allSelectorYMM.has(ymmKey)) {
            allSelectorYMM.add(ymmKey);
            
            const hasFitment = fitmentYears?.has(String(year)) || false;
            const fitmentCount = hasFitment ? (fitmentData.trims.get(ymmKey)?.length || 0) : 0;
            
            results.push({
              year,
              make: makeSlug,
              model: modelSlug,
              status: hasFitment ? "fully_covered" : "selector_only",
              selectorSource: "static",
              fitmentCount,
            });
          }
        }
      }
    }
  }
  
  // Find DB-only combinations (in fitment DB but not reachable from selector)
  for (const ymmKey of allFitmentYMM) {
    if (!allSelectorYMM.has(ymmKey)) {
      const [year, make, model] = ymmKey.split("|");
      const fitmentCount = fitmentData.trims.get(ymmKey)?.length || 0;
      
      results.push({
        year: parseInt(year),
        make,
        model,
        status: "db_only",
        selectorSource: "fitment_db",
        fitmentCount,
      });
    }
  }
  
  // Aggregate by make
  for (const r of results) {
    if (!byMake[r.make]) {
      byMake[r.make] = { fullyCovered: 0, selectorOnly: 0, dbOnly: 0 };
    }
    if (r.status === "fully_covered") byMake[r.make].fullyCovered++;
    else if (r.status === "selector_only") byMake[r.make].selectorOnly++;
    else if (r.status === "db_only") byMake[r.make].dbOnly++;
  }
  
  const fullyCovered = results.filter(r => r.status === "fully_covered").length;
  const selectorOnly = results.filter(r => r.status === "selector_only").length;
  const dbOnly = results.filter(r => r.status === "db_only").length;
  
  // Get examples
  const selectorOnlyExamples = results
    .filter(r => r.status === "selector_only")
    .sort((a, b) => b.year - a.year)
    .slice(0, 25);
  
  const dbOnlyExamples = results
    .filter(r => r.status === "db_only")
    .sort((a, b) => b.fitmentCount - a.fitmentCount)
    .slice(0, 25);
  
  return {
    totalSelectorCombinations: allSelectorYMM.size,
    totalFitmentCombinations: allFitmentYMM.size,
    fullyCovered,
    selectorOnly,
    dbOnly,
    byMake,
    selectorOnlyExamples,
    dbOnlyExamples,
  };
}

// ============================================================================
// PHASE 2: TRIM/MODIFICATION COVERAGE
// ============================================================================

async function auditPhase2(
  fitmentData: { ymm: Map<string, Set<string>>; trims: Map<string, Array<{ modificationId: string; displayTrim: string }>> },
  supplements: Map<string, Map<string, string[]>>
): Promise<AuditReport["phase2"]> {
  const trimResults: TrimCoverage[] = [];
  
  // For each supported Y/M/M, check trim coverage
  for (const [ymmKey, dbTrims] of fitmentData.trims) {
    const [year, make, model] = ymmKey.split("|");
    const yearNum = parseInt(year);
    const mmKey = `${make}|${model}`;
    
    // Get supplement trims for this Y/M/M
    const supplementYearRanges = supplements.get(mmKey);
    const supplementTrims: string[] = [];
    
    if (supplementYearRanges) {
      for (const [range, trims] of supplementYearRanges) {
        const [startStr, endStr] = range.split("-");
        const start = parseInt(startStr);
        const end = parseInt(endStr);
        if (yearNum >= start && yearNum <= end) {
          supplementTrims.push(...trims);
        }
      }
    }
    
    // Check each DB trim
    for (const dbTrim of dbTrims) {
      const inSupplement = supplementTrims.some(s => 
        normalizeSlug(s) === normalizeSlug(dbTrim.displayTrim) ||
        normalizeSlug(s) === normalizeSlug(dbTrim.modificationId)
      );
      
      trimResults.push({
        year: yearNum,
        make,
        model,
        trim: dbTrim.displayTrim,
        modificationId: dbTrim.modificationId,
        status: inSupplement ? "exact_match" : "db_only",
        source: "fitment_db",
      });
    }
    
    // Check supplement trims not in DB
    for (const suppTrim of supplementTrims) {
      const inDB = dbTrims.some(t => 
        normalizeSlug(t.displayTrim) === normalizeSlug(suppTrim) ||
        normalizeSlug(t.modificationId) === normalizeSlug(suppTrim)
      );
      
      if (!inDB) {
        trimResults.push({
          year: yearNum,
          make,
          model,
          trim: suppTrim,
          modificationId: `supp_${normalizeSlug(suppTrim)}`,
          status: "selector_only",
          source: "supplement",
        });
      }
    }
  }
  
  const exactMatch = trimResults.filter(r => r.status === "exact_match").length;
  const selectorOnlyTrims = trimResults.filter(r => r.status === "selector_only").length;
  const dbOnlyTrims = trimResults.filter(r => r.status === "db_only").length;
  
  const trimMismatchExamples = trimResults
    .filter(r => r.status !== "exact_match")
    .slice(0, 50);
  
  return {
    totalTrimsChecked: trimResults.length,
    exactMatch,
    selectorOnlyTrims,
    dbOnlyTrims,
    trimMismatchExamples,
  };
}

// ============================================================================
// PROBLEM AREAS ANALYSIS
// ============================================================================

function analyzeProblemAreas(
  phase1: AuditReport["phase1"]
): AuditReport["problemAreas"] {
  const problems: AuditReport["problemAreas"] = [];
  
  // Find makes with high selector-only rates
  for (const [make, stats] of Object.entries(phase1.byMake)) {
    const total = stats.fullyCovered + stats.selectorOnly;
    if (total === 0) continue;
    
    const selectorOnlyRate = stats.selectorOnly / total;
    
    if (stats.selectorOnly > 50 && selectorOnlyRate > 0.8) {
      problems.push({
        make,
        model: "*",
        issue: `${stats.selectorOnly} selector-only combinations (${Math.round(selectorOnlyRate * 100)}% dead ends)`,
        severity: "high",
        selectorYears: [],
        fitmentYears: [],
      });
    } else if (stats.selectorOnly > 20 && selectorOnlyRate > 0.5) {
      problems.push({
        make,
        model: "*",
        issue: `${stats.selectorOnly} selector-only combinations (${Math.round(selectorOnlyRate * 100)}% dead ends)`,
        severity: "medium",
        selectorYears: [],
        fitmentYears: [],
      });
    }
  }
  
  // Sort by severity
  problems.sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 };
    return order[a.severity] - order[b.severity];
  });
  
  return problems.slice(0, 20);
}

// ============================================================================
// RECOMMENDATIONS
// ============================================================================

function generateRecommendations(
  phase1: AuditReport["phase1"],
  phase2: AuditReport["phase2"]
): AuditReport["recommendations"] {
  const blockImmediately: string[] = [];
  const backfillFitmentDB: string[] = [];
  const permanentValidation: string[] = [];
  
  // Find selector-only entries that need blocking
  const selectorOnlyByMakeModel = new Map<string, number>();
  for (const ex of phase1.selectorOnlyExamples) {
    const key = `${ex.make} ${ex.model}`;
    selectorOnlyByMakeModel.set(key, (selectorOnlyByMakeModel.get(key) || 0) + 1);
  }
  
  // Block entire models that have no coverage
  for (const [makeModel, count] of selectorOnlyByMakeModel) {
    if (count >= 10) {
      blockImmediately.push(`Block ${makeModel} - ${count}+ years with no fitment coverage`);
    }
  }
  
  // Recommend backfill for DB-only entries (good coverage hidden from selector)
  const dbOnlyByMakeModel = new Map<string, { years: number[]; count: number }>();
  for (const ex of phase1.dbOnlyExamples) {
    const key = `${ex.make} ${ex.model}`;
    if (!dbOnlyByMakeModel.has(key)) {
      dbOnlyByMakeModel.set(key, { years: [], count: 0 });
    }
    const entry = dbOnlyByMakeModel.get(key)!;
    entry.years.push(ex.year);
    entry.count += ex.fitmentCount;
  }
  
  for (const [makeModel, data] of dbOnlyByMakeModel) {
    if (data.count >= 5) {
      const yearRange = data.years.length > 2 
        ? `${Math.min(...data.years)}-${Math.max(...data.years)}`
        : data.years.join(", ");
      backfillFitmentDB.push(`Add ${makeModel} (${yearRange}) to catalog - ${data.count} fitment records hidden`);
    }
  }
  
  // Permanent validation recommendations
  permanentValidation.push("✅ IMPLEMENTED: Coverage validation in /api/vehicles/years");
  permanentValidation.push("✅ IMPLEMENTED: Coverage validation in /api/vehicles/models");
  permanentValidation.push("✅ IMPLEMENTED: Coverage validation in /api/vehicles/trims");
  permanentValidation.push("Add coverage check to vehicle profile pages (show 'no fitment data' message)");
  permanentValidation.push("Add admin dashboard showing coverage gaps");
  permanentValidation.push("Schedule weekly audit cron job to detect new gaps");
  
  return {
    blockImmediately: blockImmediately.slice(0, 15),
    backfillFitmentDB: backfillFitmentDB.slice(0, 15),
    permanentValidation,
  };
}

// ============================================================================
// MAIN
// ============================================================================

async function runAudit() {
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  SELECTOR COVERAGE AUDIT");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log();
  
  // Load data
  console.log("[1/4] Loading catalog data...");
  const catalog = await loadCatalogData();
  
  console.log("[2/4] Loading fitment data...");
  const fitmentData = await loadFitmentData();
  
  console.log("[3/4] Loading submodel supplements...");
  const supplements = loadSubmodelSupplements();
  
  console.log("[4/4] Running audit...");
  console.log();
  
  // Run phases
  const phase1 = await auditPhase1(catalog, fitmentData);
  const phase2 = await auditPhase2(fitmentData, supplements);
  const problemAreas = analyzeProblemAreas(phase1);
  const recommendations = generateRecommendations(phase1, phase2);
  
  const report: AuditReport = {
    timestamp: new Date().toISOString(),
    phase1,
    phase2,
    problemAreas,
    recommendations,
  };
  
  // Output report
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  PHASE 1: Y/M/M COVERAGE");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log();
  console.log(`Total selector combinations:  ${phase1.totalSelectorCombinations.toLocaleString()}`);
  console.log(`Total fitment combinations:   ${phase1.totalFitmentCombinations.toLocaleString()}`);
  console.log();
  console.log(`✅ Fully covered:    ${phase1.fullyCovered.toLocaleString()}`);
  console.log(`❌ Selector-only:    ${phase1.selectorOnly.toLocaleString()} (dead ends)`);
  console.log(`⚠️  DB-only:          ${phase1.dbOnly.toLocaleString()} (hidden coverage)`);
  console.log();
  
  console.log("Top makes by selector-only dead ends:");
  const sortedMakes = Object.entries(phase1.byMake)
    .sort((a, b) => b[1].selectorOnly - a[1].selectorOnly)
    .slice(0, 10);
  for (const [make, stats] of sortedMakes) {
    if (stats.selectorOnly > 0) {
      console.log(`  ${make}: ${stats.selectorOnly} dead ends, ${stats.fullyCovered} covered`);
    }
  }
  console.log();
  
  console.log("Selector-only examples (dead ends):");
  for (const ex of phase1.selectorOnlyExamples.slice(0, 10)) {
    console.log(`  ${ex.year} ${ex.make} ${ex.model} [${ex.selectorSource}]`);
  }
  console.log();
  
  console.log("DB-only examples (hidden support):");
  for (const ex of phase1.dbOnlyExamples.slice(0, 10)) {
    console.log(`  ${ex.year} ${ex.make} ${ex.model} (${ex.fitmentCount} trims)`);
  }
  console.log();
  
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  PHASE 2: TRIM/MODIFICATION COVERAGE");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log();
  console.log(`Total trims checked:   ${phase2.totalTrimsChecked.toLocaleString()}`);
  console.log(`✅ Exact match:        ${phase2.exactMatch.toLocaleString()}`);
  console.log(`❌ Selector-only:      ${phase2.selectorOnlyTrims.toLocaleString()}`);
  console.log(`⚠️  DB-only:            ${phase2.dbOnlyTrims.toLocaleString()}`);
  console.log();
  
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  PROBLEM AREAS");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log();
  for (const p of problemAreas) {
    const icon = p.severity === "high" ? "🔴" : p.severity === "medium" ? "🟡" : "🟢";
    console.log(`${icon} ${p.make} ${p.model}: ${p.issue}`);
  }
  console.log();
  
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  RECOMMENDATIONS");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log();
  console.log("BLOCK IMMEDIATELY:");
  for (const r of recommendations.blockImmediately) {
    console.log(`  🚫 ${r}`);
  }
  console.log();
  console.log("BACKFILL FITMENT DB:");
  for (const r of recommendations.backfillFitmentDB) {
    console.log(`  📥 ${r}`);
  }
  console.log();
  console.log("PERMANENT VALIDATION:");
  for (const r of recommendations.permanentValidation) {
    console.log(`  ${r}`);
  }
  console.log();
  
  // Save full report
  const reportPath = path.join(__dirname, "selector-coverage-audit-report.json");
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`Full report saved to: ${reportPath}`);
  
  // Close DB connection
  process.exit(0);
}

runAudit().catch(err => {
  console.error("Audit failed:", err);
  process.exit(1);
});
