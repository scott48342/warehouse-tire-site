/**
 * Fill Priority Models - Platform Sibling Strategy
 * 
 * Fills missing wheel specs for high-value non-HD models using
 * same-platform donors with strict validation.
 * 
 * NON-NEGOTIABLE: NO REGRESSION.
 * 
 * Usage: npx tsx scripts/fitment-audit/fill-priority-models.ts [--dry-run]
 */

import * as dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import pg from "pg";
import * as fs from "fs/promises";

const { Pool } = pg;

// ═══════════════════════════════════════════════════════════════════════════
// PLATFORM GROUPS
// ═══════════════════════════════════════════════════════════════════════════

// Group A: Half-ton trucks
const GROUP_A = ['silverado-1500', 'sierra-1500'];

// Group B: Full-size SUV
const GROUP_B = ['tahoe', 'suburban', 'yukon', 'yukon-xl', 'escalade', 'escalade-esv'];

// Platform generations (for generation matching)
const PLATFORM_GENERATIONS: Record<string, [number, number][]> = {
  // Group A - Half-ton
  "silverado-1500": [[1999, 2006], [2007, 2013], [2014, 2018], [2019, 2026]],
  "sierra-1500": [[1999, 2006], [2007, 2013], [2014, 2018], [2019, 2026]],
  
  // Group B - Full-size SUV
  "tahoe": [[2000, 2006], [2007, 2014], [2015, 2020], [2021, 2026]],
  "suburban": [[2000, 2006], [2007, 2014], [2015, 2020], [2021, 2026]],
  "yukon": [[2000, 2006], [2007, 2014], [2015, 2020], [2021, 2026]],
  "yukon-xl": [[2000, 2006], [2007, 2014], [2015, 2020], [2021, 2026]],
  "escalade": [[1999, 2006], [2007, 2014], [2015, 2020], [2021, 2026]],
  "escalade-esv": [[2003, 2006], [2007, 2014], [2015, 2020], [2021, 2026]],
};

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface FillResult {
  targetId: string;
  year: number;
  make: string;
  model: string;
  trim: string;
  status: 'filled' | 'skipped' | 'blocked' | 'error';
  reason?: string;
  donorId?: string;
  donorModel?: string;
  donorTrim?: string;
  donorYear?: number;
  confidence: 'high' | 'medium' | 'low';
  wheelSizes?: any;
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

function getGeneration(model: string, year: number): [number, number] | null {
  const gens = PLATFORM_GENERATIONS[model.toLowerCase()];
  if (!gens) return null;
  for (const gen of gens) {
    if (year >= gen[0] && year <= gen[1]) return gen;
  }
  return null;
}

function getPlatformGroup(model: string): string[] | null {
  const modelLower = model.toLowerCase();
  if (GROUP_A.includes(modelLower)) return GROUP_A;
  if (GROUP_B.includes(modelLower)) return GROUP_B;
  return null;
}

function hasValidWheelSpecs(oemWheelSizes: any): boolean {
  if (!oemWheelSizes || !Array.isArray(oemWheelSizes)) return false;
  if (oemWheelSizes.length === 0) return false;
  return oemWheelSizes.some((ws: any) => 
    ws && typeof ws === 'object' && 
    (ws.diameter > 0 || ws.rim_diameter > 0)
  );
}

function specsMatch(
  targetBolt: string | null, 
  targetBore: number | null,
  donorBolt: string | null,
  donorBore: number | null
): boolean {
  // Bolt pattern must match exactly
  if (targetBolt && donorBolt && targetBolt !== donorBolt) {
    return false;
  }
  
  // Center bore must match within 1mm tolerance
  if (targetBore && donorBore) {
    if (Math.abs(targetBore - donorBore) > 1) {
      return false;
    }
  }
  
  return true;
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const pool = new Pool({ connectionString: process.env.POSTGRES_URL });
  
  console.log("╔════════════════════════════════════════════════════════════════╗");
  console.log("║    FILL PRIORITY MODELS - PLATFORM SIBLING STRATEGY            ║");
  console.log("╚════════════════════════════════════════════════════════════════╝");
  console.log(`Mode: ${dryRun ? "DRY RUN" : "🔴 LIVE"}\n`);
  
  // Target models
  const targetModels = [
    'silverado-1500',
    'escalade-esv', 
    'suburban',
    'yukon',
    'yukon-xl'
  ];
  
  console.log(`Target models: ${targetModels.join(', ')}\n`);
  
  const results: FillResult[] = [];
  let filledCount = 0;
  let skippedHasData = 0;
  let skippedNoDonor = 0;
  let blockedGenMismatch = 0;
  let blockedSpecMismatch = 0;
  let errorCount = 0;
  
  const client = await pool.connect();
  
  try {
    for (const targetModel of targetModels) {
      console.log(`\n═══ ${targetModel.toUpperCase()} ═══`);
      
      // Get platform sibling group
      const siblingGroup = getPlatformGroup(targetModel);
      if (!siblingGroup) {
        console.log(`  ⚠️ No platform group found`);
        continue;
      }
      
      // Get records missing wheel specs for this model
      // Check for NULL, empty array, or array with no valid wheel sizes
      const { rows: missingRecords } = await client.query(`
        SELECT id, year, make, model, display_trim, bolt_pattern, 
               center_bore_mm, oem_wheel_sizes
        FROM vehicle_fitments
        WHERE model = $1
          AND (
            oem_wheel_sizes IS NULL 
            OR oem_wheel_sizes = '[]'::jsonb
            OR oem_wheel_sizes = 'null'::jsonb
            OR jsonb_array_length(COALESCE(oem_wheel_sizes, '[]'::jsonb)) = 0
            OR NOT EXISTS (
              SELECT 1 FROM jsonb_array_elements(oem_wheel_sizes) elem
              WHERE (elem->>'diameter')::numeric > 0 
                 OR (elem->>'rim_diameter')::numeric > 0
            )
          )
        ORDER BY year
      `, [targetModel]);
      
      console.log(`  Found ${missingRecords.length} missing records`);
      
      for (const target of missingRecords) {
        const generation = getGeneration(targetModel, target.year);
        
        if (!generation) {
          results.push({
            targetId: target.id,
            year: target.year,
            make: target.make,
            model: target.model,
            trim: target.display_trim,
            status: 'skipped',
            reason: 'No generation defined',
            confidence: 'low',
          });
          skippedNoDonor++;
          continue;
        }
        
        // Find donor - try same model first, then siblings
        let donor: any = null;
        let donorSource = '';
        
        // Strategy 1: Same model, same year, different trim
        const { rows: sameModelSameYear } = await client.query(`
          SELECT id, year, make, model, display_trim, bolt_pattern, 
                 center_bore_mm, oem_wheel_sizes
          FROM vehicle_fitments
          WHERE model = $1 AND year = $2
            AND oem_wheel_sizes IS NOT NULL
            AND jsonb_array_length(oem_wheel_sizes) > 0
          LIMIT 5
        `, [targetModel, target.year]);
        
        for (const d of sameModelSameYear) {
          if (hasValidWheelSpecs(d.oem_wheel_sizes)) {
            if (specsMatch(target.bolt_pattern, parseFloat(target.center_bore_mm), 
                          d.bolt_pattern, parseFloat(d.center_bore_mm))) {
              donor = d;
              donorSource = 'same-model-same-year';
              break;
            }
          }
        }
        
        // Strategy 2: Platform sibling, same year
        if (!donor) {
          for (const sibling of siblingGroup) {
            if (sibling === targetModel) continue;
            
            const { rows: siblingDonors } = await client.query(`
              SELECT id, year, make, model, display_trim, bolt_pattern, 
                     center_bore_mm, oem_wheel_sizes
              FROM vehicle_fitments
              WHERE model = $1 AND year = $2
                AND oem_wheel_sizes IS NOT NULL
                AND jsonb_array_length(oem_wheel_sizes) > 0
              LIMIT 3
            `, [sibling, target.year]);
            
            for (const d of siblingDonors) {
              if (hasValidWheelSpecs(d.oem_wheel_sizes)) {
                if (specsMatch(target.bolt_pattern, parseFloat(target.center_bore_mm), 
                              d.bolt_pattern, parseFloat(d.center_bore_mm))) {
                  donor = d;
                  donorSource = 'sibling-same-year';
                  break;
                }
              }
            }
            if (donor) break;
          }
        }
        
        // Strategy 3: Same model, year gap ≤2 within generation
        if (!donor) {
          const { rows: sameModelNearYear } = await client.query(`
            SELECT id, year, make, model, display_trim, bolt_pattern, 
                   center_bore_mm, oem_wheel_sizes
            FROM vehicle_fitments
            WHERE model = $1 
              AND year >= $2 AND year <= $3
              AND ABS(year - $4) <= 2
              AND oem_wheel_sizes IS NOT NULL
              AND jsonb_array_length(oem_wheel_sizes) > 0
            ORDER BY ABS(year - $4)
            LIMIT 5
          `, [targetModel, generation[0], generation[1], target.year]);
          
          for (const d of sameModelNearYear) {
            // Verify same generation
            const donorGen = getGeneration(d.model, d.year);
            if (!donorGen || donorGen[0] !== generation[0]) continue;
            
            if (hasValidWheelSpecs(d.oem_wheel_sizes)) {
              if (specsMatch(target.bolt_pattern, parseFloat(target.center_bore_mm), 
                            d.bolt_pattern, parseFloat(d.center_bore_mm))) {
                donor = d;
                donorSource = 'same-model-near-year';
                break;
              }
            }
          }
        }
        
        // Strategy 4: Platform sibling, year gap ≤2 within generation
        if (!donor) {
          for (const sibling of siblingGroup) {
            if (sibling === targetModel) continue;
            
            const siblingGen = PLATFORM_GENERATIONS[sibling];
            if (!siblingGen) continue;
            
            // Find matching generation for sibling
            let siblingGenMatch: [number, number] | null = null;
            for (const sg of siblingGen) {
              if (target.year >= sg[0] && target.year <= sg[1]) {
                siblingGenMatch = sg;
                break;
              }
            }
            if (!siblingGenMatch) continue;
            
            const { rows: siblingNearYear } = await client.query(`
              SELECT id, year, make, model, display_trim, bolt_pattern, 
                     center_bore_mm, oem_wheel_sizes
              FROM vehicle_fitments
              WHERE model = $1 
                AND year >= $2 AND year <= $3
                AND ABS(year - $4) <= 2
                AND oem_wheel_sizes IS NOT NULL
                AND jsonb_array_length(oem_wheel_sizes) > 0
              ORDER BY ABS(year - $4)
              LIMIT 3
            `, [sibling, siblingGenMatch[0], siblingGenMatch[1], target.year]);
            
            for (const d of siblingNearYear) {
              if (hasValidWheelSpecs(d.oem_wheel_sizes)) {
                if (specsMatch(target.bolt_pattern, parseFloat(target.center_bore_mm), 
                              d.bolt_pattern, parseFloat(d.center_bore_mm))) {
                  donor = d;
                  donorSource = 'sibling-near-year';
                  break;
                }
              }
            }
            if (donor) break;
          }
        }
        
        if (!donor) {
          results.push({
            targetId: target.id,
            year: target.year,
            make: target.make,
            model: target.model,
            trim: target.display_trim,
            status: 'skipped',
            reason: 'No valid donor found',
            confidence: 'low',
          });
          skippedNoDonor++;
          continue;
        }
        
        // Determine confidence
        const yearGap = Math.abs(donor.year - target.year);
        const isSameModel = donor.model === targetModel;
        const confidence: 'high' | 'medium' | 'low' = 
          yearGap === 0 && isSameModel ? 'high' :
          yearGap === 0 ? 'high' :
          yearGap <= 1 ? 'high' :
          yearGap <= 2 ? 'medium' : 'low';
        
        // Apply fill
        if (!dryRun) {
          try {
            // Keep source short to avoid varchar overflow
            const srcShort = donorSource.replace('same-model-', 'sm-').replace('sibling-', 'sib-');
            const sourceNote = ` [${srcShort}:${donor.model.substring(0,8)}:${donor.year}]`;
            await client.query(`
              UPDATE vehicle_fitments
              SET 
                oem_wheel_sizes = $1,
                source = COALESCE(source, '') || $2::text
              WHERE id = $3
            `, [JSON.stringify(donor.oem_wheel_sizes), sourceNote, target.id]);
            
            filledCount++;
          } catch (err: any) {
            results.push({
              targetId: target.id,
              year: target.year,
              make: target.make,
              model: target.model,
              trim: target.display_trim,
              status: 'error',
              reason: err.message,
              confidence,
            });
            errorCount++;
            continue;
          }
        } else {
          filledCount++;
        }
        
        results.push({
          targetId: target.id,
          year: target.year,
          make: target.make,
          model: target.model,
          trim: target.display_trim,
          status: 'filled',
          donorId: donor.id,
          donorModel: donor.model,
          donorTrim: donor.display_trim,
          donorYear: donor.year,
          confidence,
          wheelSizes: donor.oem_wheel_sizes,
        });
      }
    }
    
  } finally {
    client.release();
    await pool.end();
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // SUMMARY
  // ═══════════════════════════════════════════════════════════════════════════
  
  console.log("\n");
  console.log("╔════════════════════════════════════════════════════════════════╗");
  console.log("║                        FILL SUMMARY                            ║");
  console.log("╚════════════════════════════════════════════════════════════════╝\n");
  
  console.log(`✅ Filled: ${filledCount}`);
  console.log(`⏭️  Skipped (already has data): ${skippedHasData}`);
  console.log(`⏭️  Skipped (no donor): ${skippedNoDonor}`);
  console.log(`🚫 Blocked (gen mismatch): ${blockedGenMismatch}`);
  console.log(`🚫 Blocked (spec mismatch): ${blockedSpecMismatch}`);
  console.log(`❌ Errors: ${errorCount}`);
  console.log(`\nTotal processed: ${results.length}`);
  
  // By confidence
  const filled = results.filter(r => r.status === 'filled');
  const byConfidence = {
    high: filled.filter(r => r.confidence === 'high').length,
    medium: filled.filter(r => r.confidence === 'medium').length,
    low: filled.filter(r => r.confidence === 'low').length,
  };
  console.log(`\nBy confidence: high=${byConfidence.high}, medium=${byConfidence.medium}, low=${byConfidence.low}`);
  
  // By model
  const byModel: Record<string, number> = {};
  filled.forEach(r => {
    byModel[r.model] = (byModel[r.model] || 0) + 1;
  });
  console.log("\n═══ TOP MODELS FILLED ═══");
  Object.entries(byModel).sort((a, b) => b[1] - a[1])
    .forEach(([m, c]) => console.log(`  ${m}: ${c}`));
  
  // Sample outputs
  console.log("\n═══ SAMPLE FILLED RECORDS ═══");
  filled.slice(0, 5).forEach(r => {
    console.log(`\n${r.year} ${r.make} ${r.model} "${r.trim}":`);
    console.log(`  Donor: ${r.donorYear} ${r.donorModel} "${r.donorTrim}"`);
    console.log(`  Confidence: ${r.confidence}`);
    if (r.wheelSizes) {
      console.log(`  Wheel sizes: ${JSON.stringify(r.wheelSizes).substring(0, 80)}...`);
    }
  });
  
  // Save log
  const logPath = path.resolve(__dirname, "fill-priority-models-log.json");
  await fs.writeFile(logPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    mode: dryRun ? "dry-run" : "live",
    summary: {
      filled: filledCount,
      skippedHasData,
      skippedNoDonor,
      blockedGenMismatch,
      blockedSpecMismatch,
      errors: errorCount,
      total: results.length,
      byConfidence,
    },
    byModel,
    results,
  }, null, 2));
  console.log(`\n📄 Log saved to: ${logPath}`);
  
  if (dryRun) {
    console.log("\n⚠️  DRY RUN - No changes made. Run without --dry-run to apply.");
  } else {
    console.log("\n✅ FILL COMPLETE. Run wheel audit to verify.");
  }
}

main().catch(console.error);
