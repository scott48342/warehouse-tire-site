/**
 * Trim-Level Fitment Research - Final Version
 * 
 * This script properly parses Google AI Overview data and updates
 * vehicle fitment records with trim-specific wheel and tire sizes.
 * 
 * Usage:
 *   npx tsx scripts/trim-research-final.ts --make Toyota --apply
 *   npx tsx scripts/trim-research-final.ts --make Toyota --dry-run
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { Pool } from "pg";
import * as fs from "fs";

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

// Types
interface WheelSpec {
  diameter: number;
  width: number | null;
  offset: number | null;
  axle: "front" | "rear" | "square";
  isStock: boolean;
}

interface TrimFitment {
  trims: string[];
  yearStart: number;
  yearEnd: number;
  wheels: WheelSpec[];
  tires: string[];
}

interface ModelFitment {
  make: string;
  model: string;
  boltPattern: string | null;
  centerBore: number | null;
  threadSize: string | null;
  trimFitments: TrimFitment[];
}

interface ResearchItem {
  make: string;
  model: string;
  minYear: number;
  maxYear: number;
  recordCount: number;
  trimCount: number;
  trims: string[];
}

/**
 * Parse Google AI Overview text into structured fitment data
 * Handles multiple trim:spec pairs per line and various formats
 */
function parseAIOverview(make: string, model: string, text: string): ModelFitment {
  const fitment: ModelFitment = {
    make,
    model,
    boltPattern: null,
    centerBore: null,
    threadSize: null,
    trimFitments: []
  };

  // Extract bolt pattern (e.g., "5x114.3", "5x120", "6x139.7")
  const boltMatch = text.match(/(\d)x(\d{2,3}(?:\.\d)?)\s*(?:mm)?/i);
  if (boltMatch) {
    fitment.boltPattern = `${boltMatch[1]}x${boltMatch[2]}`;
  }

  // Extract center bore (careful not to match bolt pattern)
  const boreMatch = text.match(/center\s*bore[:\s]*(\d{2,3}(?:\.\d)?)\s*mm/i) ||
                    text.match(/bore[:\s]*(\d{2}\.\d)\s*mm/i) ||
                    text.match(/hub\s*bore[:\s]*(\d{2,3}(?:\.\d)?)/i);
  if (boreMatch) {
    fitment.centerBore = parseFloat(boreMatch[1]);
  }

  // Extract thread/lug size
  const threadMatch = text.match(/M(\d{2})x(\d\.\d)/i);
  if (threadMatch) {
    fitment.threadSize = `M${threadMatch[1]}x${threadMatch[2]}`;
  }

  // Parse line by line
  const lines = text.split('\n');
  let currentYearStart = 2000;
  let currentYearEnd = 2026;

  for (const line of lines) {
    // Year range detection - multiple formats
    const yearMatch = line.match(/\(?\s*(\d{4})\s*[-–]\s*(\d{4}|present|current)\s*\)?/i) ||
                      line.match(/Gen\s*\d+\s*\((\d{4})\s*[-–]\s*(\d{4})\)/i);
    if (yearMatch) {
      currentYearStart = parseInt(yearMatch[1]);
      const endYear = yearMatch[2].toLowerCase();
      currentYearEnd = (endYear === 'present' || endYear === 'current') ? 2026 : parseInt(endYear);
    }

    // Find ALL trim:spec pairs in the line
    // Handles: "LE/XLE: 235/65R18" and "Base/L: 225/70R16, Limited: 225/65R17"
    const trimSpecPattern = /([A-Za-z][A-Za-z0-9\s\/\-]*?):\s*(?:Tires?:?\s*)?(\d{3}\/\d{2}[RZ]?\d{2})(?:[,\s]*(?:Wheels?:?\s*)?(\d{2})["\s]*(?:x\s*)?(\d+(?:\.\d)?)?[Jx"]?)?/gi;
    
    let match;
    while ((match = trimSpecPattern.exec(line)) !== null) {
      const trimPart = match[1].trim();
      
      // Skip headers and non-trim text
      if (/^gen|generation|bolt|specs|key|differences|previous|tire and wheel|common|standard/i.test(trimPart)) continue;
      if (trimPart.length > 30) continue;
      
      // Split trim names on /
      const trimNames = trimPart.split(/[\/]/).map(t => t.trim()).filter(t => t.length > 0 && t.length < 25);
      if (trimNames.length === 0) continue;
      
      const tireSize = match[2];
      
      // Get wheel diameter from tire size (R18 -> 18) or explicit match
      const tireDiamMatch = tireSize.match(/R(\d{2})/i);
      let diameter = tireDiamMatch ? parseInt(tireDiamMatch[1]) : null;
      if (match[3]) diameter = parseInt(match[3]);
      
      // Get width from capture or default
      const width = match[4] ? parseFloat(match[4]) : 8;
      
      // Look for offset
      const lineFromMatch = line.substring(match.index);
      const offsetMatch = lineFromMatch.match(/ET\s*(\d+)/i) || lineFromMatch.match(/\+(\d+)\s*mm/i);
      const offset = offsetMatch ? parseInt(offsetMatch[1]) : 35;
      
      // Check for staggered setup
      const isStaggered = /staggered|front.*rear|rear.*front/i.test(line);
      
      const wheels: WheelSpec[] = [];
      if (diameter) {
        wheels.push({
          diameter,
          width,
          offset,
          axle: isStaggered ? "front" : "square",
          isStock: true
        });
      }
      
      // If staggered, try to find rear specs
      if (isStaggered) {
        const rearMatch = line.match(/rear[:\s]*(\d{2})["\s]*(?:x\s*)?(\d+(?:\.\d)?)?/i);
        if (rearMatch) {
          wheels.push({
            diameter: parseInt(rearMatch[1]),
            width: rearMatch[2] ? parseFloat(rearMatch[2]) : width,
            offset: offset,
            axle: "rear",
            isStock: true
          });
        }
      }
      
      fitment.trimFitments.push({
        trims: trimNames,
        yearStart: currentYearStart,
        yearEnd: currentYearEnd,
        wheels,
        tires: [tireSize]
      });
    }
  }

  return fitment;
}

/**
 * Normalize trim name for matching
 */
function normalizeTrim(trim: string): string {
  return trim.toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\bhybrid\b/gi, '')
    .replace(/\bawd\b/gi, '')
    .replace(/\b4matic\b/gi, '')
    .replace(/\bedition\b/gi, '')
    .replace(/\bnightshade\b/gi, '')
    .replace(/\bbronze\b/gi, '')
    .replace(/\bplus\b/gi, '')
    .replace(/\bpackage\b/gi, '')
    .replace(/\s+/g, '')
    .trim();
}

/**
 * Match a database trim to parsed fitment data
 */
function matchTrimToFitment(year: number, displayTrim: string, fitment: ModelFitment): TrimFitment | null {
  const normalized = normalizeTrim(displayTrim);
  
  // Filter by year range
  const yearMatches = fitment.trimFitments.filter(
    tf => year >= tf.yearStart && year <= tf.yearEnd
  );
  
  if (yearMatches.length === 0) return null;
  
  // Sort by trim name length (longest first) for best match
  const sorted = [...yearMatches].sort((a, b) => {
    const aMax = Math.max(...a.trims.map(t => normalizeTrim(t).length));
    const bMax = Math.max(...b.trims.map(t => normalizeTrim(t).length));
    return bMax - aMax;
  });
  
  // Priority 1: Exact match
  for (const tf of sorted) {
    for (const trim of tf.trims) {
      if (normalizeTrim(trim) === normalized) return tf;
    }
  }
  
  // Priority 2: DB trim starts with fitment trim
  for (const tf of sorted) {
    for (const trim of tf.trims) {
      const nt = normalizeTrim(trim);
      if (normalized.startsWith(nt)) return tf;
    }
  }
  
  // Priority 3: Fitment trim contains DB trim or vice versa
  for (const tf of sorted) {
    for (const trim of tf.trims) {
      const nt = normalizeTrim(trim);
      if (nt.includes(normalized) || normalized.includes(nt)) return tf;
    }
  }
  
  // Priority 4: Special cases
  for (const tf of yearMatches) {
    for (const trim of tf.trims) {
      const nt = normalizeTrim(trim);
      // base = l
      if ((normalized === 'base' && nt === 'l') || (normalized === 'l' && nt === 'base')) return tf;
      // higher trims = limited, platinum, etc.
      if (nt === 'highertrims' && /limited|platinum|premium|touring/i.test(displayTrim)) return tf;
    }
  }
  
  return null;
}

/**
 * Update database records for a model
 */
async function updateModelRecords(
  fitment: ModelFitment, 
  dryRun: boolean = true
): Promise<{updated: number, skipped: number, flagged: string[]}> {
  let updated = 0;
  let skipped = 0;
  const flagged: string[] = [];
  
  // Get all records for this make+model with google-ai-overview source
  const records = await pool.query(`
    SELECT id, year, make, model, display_trim
    FROM vehicle_fitments
    WHERE LOWER(make) = LOWER($1) 
      AND LOWER(model) = LOWER($2)
      AND source = 'google-ai-overview'
    ORDER BY year, display_trim
  `, [fitment.make, fitment.model]);
  
  for (const record of records.rows) {
    const matchedFitment = matchTrimToFitment(record.year, record.display_trim, fitment);
    
    if (!matchedFitment || (matchedFitment.wheels.length === 0 && matchedFitment.tires.length === 0)) {
      flagged.push(`${record.year} ${record.make} ${record.model} [${record.display_trim}]`);
      skipped++;
      continue;
    }
    
    // Build wheel sizes array
    const oemWheelSizes = matchedFitment.wheels.map(w => ({
      diameter: w.diameter,
      width: w.width,
      offset: w.offset,
      axle: w.axle,
      isStock: true
    }));
    
    if (dryRun) {
      const wheelStr = oemWheelSizes.map(w => `${w.diameter}"`).join('/');
      const tireStr = matchedFitment.tires.join(', ');
      console.log(`  [DRY] ${record.year} ${record.display_trim} → ${wheelStr}, ${tireStr}`);
    } else {
      await pool.query(`
        UPDATE vehicle_fitments
        SET 
          oem_wheel_sizes = $1::jsonb,
          oem_tire_sizes = $2::jsonb,
          bolt_pattern = COALESCE($3, bolt_pattern),
          center_bore_mm = COALESCE($4, center_bore_mm),
          thread_size = COALESCE($5, thread_size),
          source = 'trim-research',
          quality_tier = 'complete',
          updated_at = NOW()
        WHERE id = $6
      `, [
        JSON.stringify(oemWheelSizes),
        JSON.stringify(matchedFitment.tires),
        fitment.boltPattern,
        fitment.centerBore,
        fitment.threadSize,
        record.id
      ]);
    }
    
    updated++;
  }
  
  return { updated, skipped, flagged };
}

/**
 * Process a single model with AI Overview text
 */
async function processModel(
  item: ResearchItem, 
  aiOverviewText: string, 
  dryRun: boolean = true
): Promise<{updated: number, skipped: number, flagged: string[]}> {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`Processing: ${item.make} ${item.model} (${item.minYear}-${item.maxYear})`);
  console.log(`Records: ${item.recordCount}, Trims: ${item.trimCount}`);
  console.log("=".repeat(60));
  
  // Parse AI Overview
  const fitment = parseAIOverview(item.make, item.model, aiOverviewText);
  
  console.log(`\nParsed Data:`);
  console.log(`  Bolt: ${fitment.boltPattern || 'N/A'}`);
  console.log(`  Bore: ${fitment.centerBore || 'N/A'}mm`);
  console.log(`  Lug: ${fitment.threadSize || 'N/A'}`);
  console.log(`  Trim Fitments: ${fitment.trimFitments.length}`);
  
  for (const tf of fitment.trimFitments) {
    const wheelStr = tf.wheels.map(w => `${w.diameter}"`).join('/') || 'N/A';
    const tireStr = tf.tires.join(', ') || 'N/A';
    console.log(`    ${tf.yearStart}-${tf.yearEnd} [${tf.trims.join(', ')}]: ${wheelStr}, ${tireStr}`);
  }
  
  // Update records
  console.log(`\n${dryRun ? '[DRY RUN]' : '[APPLYING]'} Updating records...`);
  const result = await updateModelRecords(fitment, dryRun);
  
  console.log(`\nResults: ✓ ${result.updated} updated, ⚠ ${result.skipped} skipped`);
  
  if (result.flagged.length > 0) {
    console.log(`Flagged for manual review (${result.flagged.length}):`);
    for (const f of result.flagged.slice(0, 5)) {
      console.log(`  - ${f}`);
    }
    if (result.flagged.length > 5) {
      console.log(`  ... and ${result.flagged.length - 5} more`);
    }
  }
  
  return result;
}

// Main
async function main() {
  const args = process.argv.slice(2);
  
  // Load research list
  let researchList: ResearchItem[];
  try {
    researchList = JSON.parse(fs.readFileSync('scripts/research-list.json', 'utf-8'));
  } catch {
    console.error("Error: scripts/research-list.json not found. Run list-models-to-research.ts first.");
    process.exit(1);
  }
  
  console.log(`Loaded ${researchList.length} models from research-list.json`);
  
  // Filter by make
  const makeArg = args.find(a => a.startsWith('--make='));
  if (makeArg) {
    const make = makeArg.split('=')[1];
    researchList = researchList.filter(r => r.make.toLowerCase() === make.toLowerCase());
    console.log(`Filtered to ${researchList.length} ${make} models`);
  }
  
  // Check for dry run flag
  const dryRun = !args.includes('--apply');
  if (dryRun) {
    console.log("\nDRY RUN MODE - No database changes will be made");
    console.log("Use --apply to actually update the database");
  }
  
  // Show models to process
  console.log(`\nModels to process:`);
  for (const item of researchList) {
    console.log(`  - ${item.make} ${item.model} (${item.recordCount} records, ${item.trimCount} trims)`);
  }
  
  console.log(`\n${"=".repeat(60)}`);
  console.log("INSTRUCTIONS FOR SUB-AGENTS:");
  console.log("=".repeat(60));
  console.log(`
For each model:
1. Search Google: "{Make} {Model} OEM wheel specs and tire sizes by submodel"
2. Copy the AI Overview text
3. Call: processModel(item, aiOverviewText, ${dryRun})
4. Review results before applying

The parsing handles:
- Multiple trim:spec pairs per line
- Generation year ranges
- Staggered setups
- Various trim name formats
`);
  
  await pool.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

// Export for sub-agents
export { processModel, parseAIOverview, updateModelRecords, ResearchItem, ModelFitment };
