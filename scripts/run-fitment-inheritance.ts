#!/usr/bin/env npx tsx

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * FITMENT INHERITANCE ENGINE
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Expands fitment coverage by intelligently copying data between related vehicles.
 * 
 * CONFIDENCE LEVELS:
 * - HIGH: Same generation (e.g., 2019-2025 RAM 1500 DT platform)
 *         Fitment specs are virtually identical within a generation
 * - MEDIUM: Adjacent generation, same model (e.g., 2018 RAM 1500 DS → 2019 RAM 1500 DT)
 *           Fitment MAY be similar but platform changed - manual review recommended
 * - LOW: Same make/model family across distant years
 *        Too risky for auto-application
 * 
 * INHERITANCE RULES:
 * 1. SAME_GENERATION: Copy within known generation boundaries
 * 2. SIBLING_PLATFORM: GMC Sierra = Chevy Silverado (shared platform)
 * 3. ADJACENT_YEAR: Copy to adjacent years when no generation data exists
 * 
 * @created 2026-03-27
 */

import * as dotenv from "dotenv";
import pg from "pg";

dotenv.config({ path: ".env.local" });

const { Pool } = pg;

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

const CONFIDENCE_LEVELS = {
  HIGH: 'high',
  MEDIUM: 'medium', 
  LOW: 'low',
} as const;

type ConfidenceLevel = typeof CONFIDENCE_LEVELS[keyof typeof CONFIDENCE_LEVELS];

// Vehicle generations - fitment is identical within a generation
const GENERATIONS: Record<string, Record<string, Array<{ start: number; end: number; name: string }>>> = {
  ford: {
    'f-150': [
      { start: 2021, end: 2025, name: '14th Gen' },
      { start: 2015, end: 2020, name: '13th Gen' },
      { start: 2009, end: 2014, name: '12th Gen' },
      { start: 2004, end: 2008, name: '11th Gen' },
    ],
    'f-250': [
      { start: 2023, end: 2025, name: '5th Gen Super Duty' },
      { start: 2017, end: 2022, name: '4th Gen Super Duty' },
      { start: 2011, end: 2016, name: '3rd Gen Super Duty' },
    ],
    'ranger': [
      { start: 2019, end: 2025, name: '6th Gen' },
    ],
    'bronco': [
      { start: 2021, end: 2025, name: '6th Gen' },
    ],
    'explorer': [
      { start: 2020, end: 2025, name: '6th Gen' },
      { start: 2011, end: 2019, name: '5th Gen' },
    ],
  },
  chevrolet: {
    'silverado-1500': [
      { start: 2019, end: 2025, name: '4th Gen T1' },
      { start: 2014, end: 2018, name: '3rd Gen K2' },
      { start: 2007, end: 2013, name: '2nd Gen GMT900' },
    ],
    'colorado': [
      { start: 2023, end: 2025, name: '3rd Gen' },
      { start: 2015, end: 2022, name: '2nd Gen' },
    ],
    'tahoe': [
      { start: 2021, end: 2025, name: '5th Gen' },
      { start: 2015, end: 2020, name: '4th Gen' },
      { start: 2007, end: 2014, name: '3rd Gen' },
    ],
    'suburban': [
      { start: 2021, end: 2025, name: '12th Gen' },
      { start: 2015, end: 2020, name: '11th Gen' },
    ],
  },
  ram: {
    '1500': [
      { start: 2019, end: 2025, name: '5th Gen DT' },
      { start: 2013, end: 2018, name: '4th Gen DS' },
      { start: 2009, end: 2012, name: '4th Gen DS Early' },
    ],
    '2500': [
      { start: 2019, end: 2025, name: '5th Gen' },
      { start: 2014, end: 2018, name: '4th Gen' },
    ],
    'ram-1500': [
      { start: 2019, end: 2025, name: '5th Gen DT' },
      { start: 2013, end: 2018, name: '4th Gen DS' },
    ],
  },
  gmc: {
    'sierra-1500': [
      { start: 2019, end: 2025, name: '5th Gen' },
      { start: 2014, end: 2018, name: '4th Gen' },
      { start: 2007, end: 2013, name: '3rd Gen' },
    ],
    'yukon': [
      { start: 2021, end: 2025, name: '5th Gen' },
      { start: 2015, end: 2020, name: '4th Gen' },
    ],
    'canyon': [
      { start: 2023, end: 2025, name: '3rd Gen' },
      { start: 2015, end: 2022, name: '2nd Gen' },
    ],
  },
  toyota: {
    'tacoma': [
      { start: 2024, end: 2025, name: '4th Gen' },
      { start: 2016, end: 2023, name: '3rd Gen' },
      { start: 2005, end: 2015, name: '2nd Gen' },
    ],
    'tundra': [
      { start: 2022, end: 2025, name: '3rd Gen' },
      { start: 2014, end: 2021, name: '2nd Gen Facelift' },
      { start: 2007, end: 2013, name: '2nd Gen' },
    ],
    '4runner': [
      { start: 2010, end: 2025, name: '5th Gen' },
    ],
    'rav4': [
      { start: 2019, end: 2025, name: '5th Gen XA50' },
      { start: 2013, end: 2018, name: '4th Gen XA40' },
    ],
  },
  jeep: {
    'wrangler': [
      { start: 2018, end: 2025, name: 'JL' },
      { start: 2007, end: 2017, name: 'JK' },
    ],
    'grand-cherokee': [
      { start: 2022, end: 2025, name: 'WL' },
      { start: 2011, end: 2021, name: 'WK2' },
    ],
    'gladiator': [
      { start: 2020, end: 2025, name: 'JT' },
    ],
  },
  honda: {
    'cr-v': [
      { start: 2023, end: 2025, name: '6th Gen' },
      { start: 2017, end: 2022, name: '5th Gen' },
      { start: 2012, end: 2016, name: '4th Gen' },
    ],
    'pilot': [
      { start: 2023, end: 2025, name: '4th Gen' },
      { start: 2016, end: 2022, name: '3rd Gen' },
    ],
  },
  subaru: {
    'outback': [
      { start: 2020, end: 2025, name: '6th Gen' },
      { start: 2015, end: 2019, name: '5th Gen' },
    ],
    'forester': [
      { start: 2019, end: 2025, name: '5th Gen SK' },
      { start: 2014, end: 2018, name: '4th Gen SJ' },
    ],
  },
};

// Sibling platforms (shared fitment across brands)
const SIBLING_PLATFORMS: Record<string, string[]> = {
  'chevrolet/silverado-1500': ['gmc/sierra-1500'],
  'gmc/sierra-1500': ['chevrolet/silverado-1500'],
  'chevrolet/tahoe': ['gmc/yukon', 'chevrolet/suburban'],
  'gmc/yukon': ['chevrolet/tahoe', 'chevrolet/suburban'],
  'chevrolet/suburban': ['chevrolet/tahoe', 'gmc/yukon'],
  'chevrolet/colorado': ['gmc/canyon'],
  'gmc/canyon': ['chevrolet/colorado'],
  'toyota/tacoma': [],
  'toyota/tundra': [],
};

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface InheritanceCandidate {
  targetYear: number;
  targetMake: string;
  targetModel: string;
  sourceFitmentId: string;
  sourceYear: number;
  sourceMake: string;
  sourceModel: string;
  rule: 'SAME_GENERATION' | 'SIBLING_PLATFORM' | 'ADJACENT_YEAR';
  confidence: ConfidenceLevel;
  generationName?: string;
  reason: string;
}

interface InheritanceReport {
  timestamp: string;
  dryRun: boolean;
  summary: {
    totalCandidates: number;
    highConfidence: number;
    mediumConfidence: number;
    lowConfidence: number;
    conflicts: number;
    applied: number;
    skipped: number;
  };
  byRule: Record<string, number>;
  byMakeModel: Record<string, number>;
  candidates: InheritanceCandidate[];
  conflicts: Array<{
    target: string;
    sources: string[];
    reason: string;
  }>;
  examples: Array<{
    target: string;
    source: string;
    rule: string;
    confidence: string;
  }>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

function normalizeMake(make: string): string {
  return make.toLowerCase().trim();
}

function normalizeModel(model: string): string {
  return model.toLowerCase().trim().replace(/\s+/g, '-');
}

function getGeneration(make: string, model: string, year: number) {
  const normalMake = normalizeMake(make);
  const normalModel = normalizeModel(model);
  
  const makeGens = GENERATIONS[normalMake];
  if (!makeGens) return null;
  
  const modelGens = makeGens[normalModel];
  if (!modelGens) return null;
  
  for (const gen of modelGens) {
    if (year >= gen.start && year <= gen.end) {
      return {
        name: gen.name,
        start: gen.start,
        end: gen.end,
        years: Array.from({ length: gen.end - gen.start + 1 }, (_, i) => gen.start + i),
      };
    }
  }
  
  return null;
}

function getSiblingKey(make: string, model: string): string {
  return `${normalizeMake(make)}/${normalizeModel(model)}`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN ENGINE
// ═══════════════════════════════════════════════════════════════════════════════

async function runInheritanceEngine(options: {
  dryRun?: boolean;
  applyHighConfidence?: boolean;
  verbose?: boolean;
}) {
  const { dryRun = true, applyHighConfidence = false, verbose = false } = options;
  
  const pool = new Pool({
    connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL,
    max: 5,
  });

  const report: InheritanceReport = {
    timestamp: new Date().toISOString(),
    dryRun,
    summary: {
      totalCandidates: 0,
      highConfidence: 0,
      mediumConfidence: 0,
      lowConfidence: 0,
      conflicts: 0,
      applied: 0,
      skipped: 0,
    },
    byRule: {},
    byMakeModel: {},
    candidates: [],
    conflicts: [],
    examples: [],
  };

  try {
    console.log('═══════════════════════════════════════════════════════════════════════════════');
    console.log('                    FITMENT INHERITANCE ENGINE');
    console.log('═══════════════════════════════════════════════════════════════════════════════');
    console.log(`Mode: ${dryRun ? 'DRY RUN' : applyHighConfidence ? 'APPLY HIGH CONFIDENCE' : 'ANALYSIS ONLY'}`);
    console.log('');

    // Step 1: Get all existing fitments with bolt_pattern (source records)
    const sourcesResult = await pool.query(`
      SELECT DISTINCT 
        id, year, make, model, modification_id,
        bolt_pattern, center_bore_mm, thread_size, seat_type,
        offset_min_mm, offset_max_mm, oem_wheel_sizes, oem_tire_sizes,
        source, display_trim
      FROM vehicle_fitments
      WHERE bolt_pattern IS NOT NULL
      ORDER BY make, model, year
    `);
    
    console.log(`📊 Found ${sourcesResult.rows.length} source fitment records with bolt pattern`);

    // Step 2: Get target vehicles (year/make/model combinations we want to populate)
    // These come from the catalog or target list
    const targetResult = await pool.query(`
      SELECT DISTINCT year, make_slug as make, slug as model
      FROM catalog_models cm
      CROSS JOIN LATERAL unnest(years) as year
      WHERE year >= 2010
      ORDER BY make_slug, slug, year
    `);
    
    let targetVehicles = targetResult.rows;
    
    // Fallback: generate targets from existing sources if no catalog
    if (targetVehicles.length === 0) {
      console.log('⚠️  No catalog found, generating targets from source data generations...');
      const uniqueModels = new Set<string>();
      for (const src of sourcesResult.rows) {
        const gen = getGeneration(src.make, src.model, src.year);
        if (gen) {
          for (const y of gen.years) {
            uniqueModels.add(`${y}|${src.make}|${src.model}`);
          }
        } else {
          // No generation data - try adjacent years
          for (let y = src.year - 2; y <= src.year + 2; y++) {
            if (y >= 2010 && y <= 2026) {
              uniqueModels.add(`${y}|${src.make}|${src.model}`);
            }
          }
        }
      }
      targetVehicles = Array.from(uniqueModels).map(key => {
        const [year, make, model] = key.split('|');
        return { year: parseInt(year), make, model };
      });
    }
    
    console.log(`🎯 ${targetVehicles.length} target vehicle combinations to check`);

    // Step 3: Check which targets already have fitment data
    const existingResult = await pool.query(`
      SELECT DISTINCT year, make, model
      FROM vehicle_fitments
      WHERE bolt_pattern IS NOT NULL
    `);
    
    const existingSet = new Set(
      existingResult.rows.map(r => `${r.year}|${normalizeMake(r.make)}|${normalizeModel(r.model)}`)
    );
    
    console.log(`✅ ${existingSet.size} vehicles already have fitment data`);

    // Step 4: Build source lookup by make/model
    const sourceByMakeModel = new Map<string, typeof sourcesResult.rows>();
    for (const src of sourcesResult.rows) {
      const key = `${normalizeMake(src.make)}|${normalizeModel(src.model)}`;
      if (!sourceByMakeModel.has(key)) {
        sourceByMakeModel.set(key, []);
      }
      sourceByMakeModel.get(key)!.push(src);
    }

    // Step 5: Find inheritance candidates
    console.log('\n🔍 Analyzing inheritance candidates...\n');
    
    for (const target of targetVehicles) {
      const targetKey = `${target.year}|${normalizeMake(target.make)}|${normalizeModel(target.model)}`;
      
      // Skip if already has data
      if (existingSet.has(targetKey)) continue;
      
      const makeModelKey = `${normalizeMake(target.make)}|${normalizeModel(target.model)}`;
      const sources = sourceByMakeModel.get(makeModelKey) || [];
      
      // Rule 1: SAME_GENERATION (HIGH confidence)
      const targetGen = getGeneration(target.make, target.model, target.year);
      if (targetGen) {
        // Find a source in the same generation
        const sameGenSource = sources.find(s => {
          const sourceGen = getGeneration(s.make, s.model, s.year);
          return sourceGen && sourceGen.name === targetGen.name;
        });
        
        if (sameGenSource) {
          report.candidates.push({
            targetYear: target.year,
            targetMake: target.make,
            targetModel: target.model,
            sourceFitmentId: sameGenSource.id,
            sourceYear: sameGenSource.year,
            sourceMake: sameGenSource.make,
            sourceModel: sameGenSource.model,
            rule: 'SAME_GENERATION',
            confidence: CONFIDENCE_LEVELS.HIGH,
            generationName: targetGen.name,
            reason: `Same generation: ${targetGen.name} (${targetGen.start}-${targetGen.end})`,
          });
          continue;
        }
      }
      
      // Rule 2: SIBLING_PLATFORM (HIGH confidence for same gen, MEDIUM otherwise)
      const siblingKey = getSiblingKey(target.make, target.model);
      const siblings = SIBLING_PLATFORMS[siblingKey] || [];
      
      for (const siblingPath of siblings) {
        const [siblingMake, siblingModel] = siblingPath.split('/');
        const siblingMakeModelKey = `${siblingMake}|${siblingModel}`;
        const siblingSources = sourceByMakeModel.get(siblingMakeModelKey) || [];
        
        // Check for same year sibling
        const sameYearSibling = siblingSources.find(s => s.year === target.year);
        if (sameYearSibling) {
          report.candidates.push({
            targetYear: target.year,
            targetMake: target.make,
            targetModel: target.model,
            sourceFitmentId: sameYearSibling.id,
            sourceYear: sameYearSibling.year,
            sourceMake: sameYearSibling.make,
            sourceModel: sameYearSibling.model,
            rule: 'SIBLING_PLATFORM',
            confidence: CONFIDENCE_LEVELS.HIGH,
            reason: `Sibling platform: ${sameYearSibling.make} ${sameYearSibling.model} ${sameYearSibling.year}`,
          });
          break;
        }
        
        // Check for same generation sibling
        if (targetGen) {
          const sameGenSibling = siblingSources.find(s => {
            const sibGen = getGeneration(s.make, s.model, s.year);
            return sibGen && sibGen.start === targetGen.start && sibGen.end === targetGen.end;
          });
          
          if (sameGenSibling) {
            report.candidates.push({
              targetYear: target.year,
              targetMake: target.make,
              targetModel: target.model,
              sourceFitmentId: sameGenSibling.id,
              sourceYear: sameGenSibling.year,
              sourceMake: sameGenSibling.make,
              sourceModel: sameGenSibling.model,
              rule: 'SIBLING_PLATFORM',
              confidence: CONFIDENCE_LEVELS.HIGH,
              generationName: targetGen.name,
              reason: `Sibling platform same gen: ${sameGenSibling.make} ${sameGenSibling.model} ${sameGenSibling.year}`,
            });
            break;
          }
        }
      }
      
      // Rule 3: ADJACENT_YEAR (MEDIUM confidence for ±1 year, LOW for ±2-3)
      if (!report.candidates.find(c => 
        c.targetYear === target.year && 
        c.targetMake === target.make && 
        c.targetModel === target.model
      )) {
        // Find closest year with data
        const sortedSources = [...sources].sort((a, b) => 
          Math.abs(a.year - target.year) - Math.abs(b.year - target.year)
        );
        
        const closestSource = sortedSources[0];
        if (closestSource) {
          const yearDiff = Math.abs(closestSource.year - target.year);
          
          let confidence: ConfidenceLevel;
          if (yearDiff === 1) {
            confidence = CONFIDENCE_LEVELS.MEDIUM;
          } else if (yearDiff <= 3) {
            confidence = CONFIDENCE_LEVELS.LOW;
          } else {
            continue; // Too far, skip
          }
          
          report.candidates.push({
            targetYear: target.year,
            targetMake: target.make,
            targetModel: target.model,
            sourceFitmentId: closestSource.id,
            sourceYear: closestSource.year,
            sourceMake: closestSource.make,
            sourceModel: closestSource.model,
            rule: 'ADJACENT_YEAR',
            confidence,
            reason: `Adjacent year: ${closestSource.year} (${yearDiff} year${yearDiff > 1 ? 's' : ''} away)`,
          });
        }
      }
    }

    // Step 6: Calculate summary statistics
    for (const candidate of report.candidates) {
      report.summary.totalCandidates++;
      
      if (candidate.confidence === CONFIDENCE_LEVELS.HIGH) {
        report.summary.highConfidence++;
      } else if (candidate.confidence === CONFIDENCE_LEVELS.MEDIUM) {
        report.summary.mediumConfidence++;
      } else {
        report.summary.lowConfidence++;
      }
      
      report.byRule[candidate.rule] = (report.byRule[candidate.rule] || 0) + 1;
      
      const mmKey = `${candidate.targetMake}/${candidate.targetModel}`;
      report.byMakeModel[mmKey] = (report.byMakeModel[mmKey] || 0) + 1;
    }

    // Step 7: Print report
    console.log('═══════════════════════════════════════════════════════════════════════════════');
    console.log('                           DRY RUN SUMMARY');
    console.log('═══════════════════════════════════════════════════════════════════════════════');
    console.log(`Total Candidates: ${report.summary.totalCandidates}`);
    console.log(`  HIGH confidence:   ${report.summary.highConfidence}`);
    console.log(`  MEDIUM confidence: ${report.summary.mediumConfidence}`);
    console.log(`  LOW confidence:    ${report.summary.lowConfidence}`);
    console.log('');
    
    console.log('By Rule:');
    for (const [rule, count] of Object.entries(report.byRule).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${rule}: ${count}`);
    }
    console.log('');
    
    console.log('By Make/Model (top 15):');
    const sortedMM = Object.entries(report.byMakeModel).sort((a, b) => b[1] - a[1]).slice(0, 15);
    for (const [mm, count] of sortedMM) {
      console.log(`  ${mm}: ${count}`);
    }
    console.log('');

    // Step 8: Show examples
    console.log('Example Candidates:');
    const highExamples = report.candidates.filter(c => c.confidence === CONFIDENCE_LEVELS.HIGH).slice(0, 5);
    for (const ex of highExamples) {
      console.log(`  [${ex.confidence.toUpperCase()}] ${ex.targetYear} ${ex.targetMake} ${ex.targetModel}`);
      console.log(`    ← ${ex.sourceYear} ${ex.sourceMake} ${ex.sourceModel} (${ex.rule})`);
      console.log(`    ${ex.reason}`);
      report.examples.push({
        target: `${ex.targetYear} ${ex.targetMake} ${ex.targetModel}`,
        source: `${ex.sourceYear} ${ex.sourceMake} ${ex.sourceModel}`,
        rule: ex.rule,
        confidence: ex.confidence,
      });
    }
    console.log('');

    // Step 9: Apply HIGH confidence if requested
    if (applyHighConfidence && !dryRun) {
      console.log('═══════════════════════════════════════════════════════════════════════════════');
      console.log('                    APPLYING HIGH CONFIDENCE INHERITANCE');
      console.log('═══════════════════════════════════════════════════════════════════════════════');
      
      const highCandidates = report.candidates.filter(c => c.confidence === CONFIDENCE_LEVELS.HIGH);
      
      for (const candidate of highCandidates) {
        // Get source fitment data
        const sourceResult = await pool.query(
          `SELECT * FROM vehicle_fitments WHERE id = $1`,
          [candidate.sourceFitmentId]
        );
        
        if (sourceResult.rows.length === 0) continue;
        
        const src = sourceResult.rows[0];
        
        // Create inherited record
        const newModificationId = `inherited_${candidate.sourceYear}_${src.modification_id}`;
        
        try {
          await pool.query(`
            INSERT INTO vehicle_fitments (
              year, make, model, modification_id,
              raw_trim, display_trim, submodel,
              bolt_pattern, center_bore_mm, thread_size, seat_type,
              offset_min_mm, offset_max_mm,
              oem_wheel_sizes, oem_tire_sizes,
              source
            ) VALUES (
              $1, $2, $3, $4,
              $5, $6, $7,
              $8, $9, $10, $11,
              $12, $13,
              $14, $15,
              $16
            )
            ON CONFLICT (year, make, model, modification_id) DO NOTHING
          `, [
            candidate.targetYear,
            normalizeMake(candidate.targetMake),
            normalizeModel(candidate.targetModel),
            newModificationId,
            src.raw_trim,
            src.display_trim,
            src.submodel,
            src.bolt_pattern,
            src.center_bore_mm,
            src.thread_size,
            src.seat_type,
            src.offset_min_mm,
            src.offset_max_mm,
            JSON.stringify(src.oem_wheel_sizes || []),
            JSON.stringify(src.oem_tire_sizes || []),
            `inherited_from_${candidate.sourceYear}_${candidate.rule}`,
          ]);
          
          report.summary.applied++;
          if (verbose) {
            console.log(`  ✅ ${candidate.targetYear} ${candidate.targetMake} ${candidate.targetModel}`);
          }
        } catch (err: any) {
          if (verbose) {
            console.log(`  ❌ ${candidate.targetYear} ${candidate.targetMake} ${candidate.targetModel}: ${err.message}`);
          }
          report.summary.skipped++;
        }
      }
      
      console.log(`\nApplied: ${report.summary.applied}`);
      console.log(`Skipped: ${report.summary.skipped}`);
    }

    // Step 10: Calculate updated coverage
    if (!dryRun && applyHighConfidence) {
      console.log('\n═══════════════════════════════════════════════════════════════════════════════');
      console.log('                         UPDATED COVERAGE');
      console.log('═══════════════════════════════════════════════════════════════════════════════');
      
      const updatedStats = await pool.query(`
        SELECT 
          COUNT(*) as total,
          COUNT(bolt_pattern) as with_bolt_pattern,
          COUNT(DISTINCT year || '|' || make || '|' || model) as unique_vehicles
        FROM vehicle_fitments
      `);
      
      const targetCount = await pool.query(`
        SELECT COUNT(DISTINCT year || '|' || make_slug || '|' || slug) as count
        FROM catalog_models cm
        CROSS JOIN LATERAL unnest(cm.years) as year
        WHERE year >= 2010
      `);
      
      const stats = updatedStats.rows[0];
      const targets = targetCount.rows[0]?.count || stats.unique_vehicles;
      
      console.log(`Total Records: ${stats.total}`);
      console.log(`With Bolt Pattern: ${stats.with_bolt_pattern}`);
      console.log(`Unique Vehicles: ${stats.unique_vehicles}`);
      console.log(`Target Vehicles: ${targets}`);
      console.log(`Coverage: ${((stats.unique_vehicles / targets) * 100).toFixed(1)}%`);
    }

    return report;

  } finally {
    await pool.end();
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// CLI
// ═══════════════════════════════════════════════════════════════════════════════

const args = process.argv.slice(2);
const dryRun = !args.includes('--apply');
const verbose = args.includes('--verbose') || args.includes('-v');

runInheritanceEngine({
  dryRun,
  applyHighConfidence: !dryRun,
  verbose,
}).then(report => {
  // Write report to file
  const fs = require('fs');
  const reportPath = `inheritance-report-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\n📄 Full report written to: ${reportPath}`);
  process.exit(0);
}).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
