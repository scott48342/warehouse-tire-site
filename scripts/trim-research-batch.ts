/**
 * Trim-Level Fitment Research - Batch Processor
 * 
 * This script processes a batch of make+model combinations from research-list.json
 * and outputs the parsed fitment data for manual review or database update.
 * 
 * Usage: 
 *   npx tsx scripts/trim-research-batch.ts --make Toyota
 *   npx tsx scripts/trim-research-batch.ts --start 0 --count 10
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

// Parse AI Overview text into structured data
function parseAIOverview(make: string, model: string, text: string): ModelFitment {
  const fitment: ModelFitment = {
    make,
    model,
    boltPattern: null,
    centerBore: null,
    threadSize: null,
    trimFitments: []
  };

  // Extract bolt pattern
  const boltMatch = text.match(/(\d)x(\d{2,3}(?:\.\d)?)\s*(?:mm)?/i);
  if (boltMatch) {
    fitment.boltPattern = `${boltMatch[1]}x${boltMatch[2]}`;
  }

  // Extract center bore
  const boreMatch = text.match(/(\d{2,3}\.\d)\s*mm/i) ||
                    text.match(/center\s*bore[:\s]*(\d{2,3}(?:\.\d)?)/i);
  if (boreMatch) {
    fitment.centerBore = parseFloat(boreMatch[1]);
  }

  // Extract thread/lug size
  const threadMatch = text.match(/M(\d{2})x(\d\.\d)/i);
  if (threadMatch) {
    fitment.threadSize = `M${threadMatch[1]}x${threadMatch[2]}`;
  }

  // Parse line by line for generation and trim data
  const lines = text.split('\n');
  let currentYearStart = 2000;
  let currentYearEnd = 2026;

  for (const line of lines) {
    // Check for year range
    const yearMatch = line.match(/\(?\s*(\d{4})\s*[-–]\s*(\d{4}|present|current|2026)\s*\)?/i);
    if (yearMatch) {
      currentYearStart = parseInt(yearMatch[1]);
      const endYear = yearMatch[2].toLowerCase();
      currentYearEnd = (endYear === 'present' || endYear === 'current') ? 2026 : parseInt(endYear);
    }

    // Match trim lines
    const trimMatch = line.match(/^([A-Za-z][A-Za-z0-9\s\/\-]+?):\s*(?:Tires?:?\s*)?(\d{3}\/\d{2}[RZ]?\d{2})/i) ||
                      line.match(/^([A-Za-z][A-Za-z0-9\s\/\-]+?):\s*(\d{2})["\s]/);
    
    if (trimMatch) {
      const trimPart = trimMatch[1].trim();
      
      // Skip headers
      if (/generation|fitment|notes|key|bolt|pattern|specs/i.test(trimPart)) continue;
      
      const trimNames = trimPart.split(/[\/,]/).map(t => t.trim()).filter(t => t.length > 0 && t.length < 30);
      if (trimNames.length === 0) continue;

      // Extract wheel diameter
      const diamMatch = line.match(/(\d{2})["\s]*(?:inch|x|wheels?)/i);
      const diameter = diamMatch ? parseInt(diamMatch[1]) : null;

      // Extract tire size
      const tireMatch = line.match(/(\d{3}\/\d{2}[RZ]?\d{2})/);
      const tireSize = tireMatch ? tireMatch[1] : null;

      // Extract offset
      const offsetMatch = line.match(/ET\s*(\d+)/i) || line.match(/offset[:\s]*(\d+)/i);
      const offset = offsetMatch ? parseInt(offsetMatch[1]) : null;

      // Extract width
      const widthMatch = line.match(/(\d+(?:\.\d)?)\s*[Jx"]\s*(?:\d{2}|inch)/i);
      const width = widthMatch ? parseFloat(widthMatch[1]) : null;

      if (diameter || tireSize) {
        fitment.trimFitments.push({
          trims: trimNames,
          yearStart: currentYearStart,
          yearEnd: currentYearEnd,
          wheels: diameter ? [{
            diameter,
            width,
            offset,
            axle: "square",
            isStock: true
          }] : [],
          tires: tireSize ? [tireSize] : []
        });
      }
    }
  }

  return fitment;
}

// Normalize trim for matching
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
    .replace(/\s+/g, '')
    .trim();
}

// Match trim to fitment
function matchTrimToFitment(year: number, displayTrim: string, fitment: ModelFitment): TrimFitment | null {
  const normalizedDbTrim = normalizeTrim(displayTrim);
  
  const yearMatches = fitment.trimFitments.filter(
    tf => year >= tf.yearStart && year <= tf.yearEnd
  );
  
  if (yearMatches.length === 0) return null;
  
  // Priority 1: Exact match
  for (const tf of yearMatches) {
    for (const fitmentTrim of tf.trims) {
      if (normalizeTrim(fitmentTrim) === normalizedDbTrim) {
        return tf;
      }
    }
  }
  
  // Priority 2: DB trim starts with fitment trim (longest match first)
  const sortedByLength = [...yearMatches].sort((a, b) => {
    const aMax = Math.max(...a.trims.map(t => normalizeTrim(t).length));
    const bMax = Math.max(...b.trims.map(t => normalizeTrim(t).length));
    return bMax - aMax;
  });
  
  for (const tf of sortedByLength) {
    for (const fitmentTrim of tf.trims) {
      const normalizedFitmentTrim = normalizeTrim(fitmentTrim);
      if (normalizedDbTrim.startsWith(normalizedFitmentTrim)) {
        return tf;
      }
    }
  }
  
  // Priority 3: Fitment trim contains DB trim
  for (const tf of sortedByLength) {
    for (const fitmentTrim of tf.trims) {
      if (normalizeTrim(fitmentTrim).includes(normalizedDbTrim)) {
        return tf;
      }
    }
  }
  
  // Priority 4: Special cases
  for (const tf of yearMatches) {
    for (const fitmentTrim of tf.trims) {
      const normalizedFitmentTrim = normalizeTrim(fitmentTrim);
      if ((normalizedDbTrim === 'base' && normalizedFitmentTrim === 'l') ||
          (normalizedDbTrim === 'l' && normalizedFitmentTrim === 'base')) {
        return tf;
      }
    }
  }
  
  return null;
}

// Update records for a model
async function updateModelRecords(fitment: ModelFitment, dryRun: boolean = false): Promise<{updated: number, skipped: number, flagged: string[]}> {
  let updated = 0;
  let skipped = 0;
  const flagged: string[] = [];
  
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
    
    const oemWheelSizes = matchedFitment.wheels.map(w => ({
      diameter: w.diameter,
      width: w.width,
      offset: w.offset,
      axle: w.axle,
      isStock: true
    }));
    
    if (!dryRun) {
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

// Process a single model with provided AI Overview text
async function processModel(item: ResearchItem, aiOverviewText: string, dryRun: boolean = false): Promise<void> {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`Processing: ${item.make} ${item.model} (${item.minYear}-${item.maxYear})`);
  console.log(`Records: ${item.recordCount}, Trims: ${item.trimCount}`);
  console.log("=".repeat(60));
  
  const fitment = parseAIOverview(item.make, item.model, aiOverviewText);
  
  console.log(`\nParsed Data:`);
  console.log(`  Bolt: ${fitment.boltPattern || 'N/A'}, Bore: ${fitment.centerBore || 'N/A'}mm, Lug: ${fitment.threadSize || 'N/A'}`);
  console.log(`  Trim Fitments: ${fitment.trimFitments.length}`);
  
  for (const tf of fitment.trimFitments) {
    const wheelStr = tf.wheels.length > 0 ? `${tf.wheels[0].diameter}"` : 'N/A';
    const tireStr = tf.tires.length > 0 ? tf.tires[0] : 'N/A';
    console.log(`    ${tf.yearStart}-${tf.yearEnd} [${tf.trims.join(', ')}]: ${wheelStr}, ${tireStr}`);
  }
  
  const result = await updateModelRecords(fitment, dryRun);
  
  console.log(`\n  Results: ✓ ${result.updated} updated, ⚠ ${result.skipped} skipped`);
  
  if (result.flagged.length > 0 && result.flagged.length <= 5) {
    console.log(`  Flagged:`);
    for (const f of result.flagged) {
      console.log(`    - ${f}`);
    }
  } else if (result.flagged.length > 5) {
    console.log(`  Flagged: ${result.flagged.length} records (see log for details)`);
  }
}

// Main
async function main() {
  const args = process.argv.slice(2);
  
  // Load research list
  const researchList: ResearchItem[] = JSON.parse(
    fs.readFileSync('scripts/research-list.json', 'utf-8')
  );
  
  console.log(`Loaded ${researchList.length} models from research-list.json`);
  
  // Filter by make if specified
  let filtered = researchList;
  const makeArg = args.find(a => a.startsWith('--make='));
  if (makeArg) {
    const make = makeArg.split('=')[1];
    filtered = researchList.filter(r => r.make.toLowerCase() === make.toLowerCase());
    console.log(`Filtered to ${filtered.length} ${make} models`);
  }
  
  // Slice if start/count specified
  const startArg = args.find(a => a.startsWith('--start='));
  const countArg = args.find(a => a.startsWith('--count='));
  if (startArg || countArg) {
    const start = startArg ? parseInt(startArg.split('=')[1]) : 0;
    const count = countArg ? parseInt(countArg.split('=')[1]) : filtered.length;
    filtered = filtered.slice(start, start + count);
    console.log(`Processing items ${start} to ${start + count - 1}`);
  }
  
  // Show what we're about to process
  console.log(`\nModels to process:`);
  for (const item of filtered) {
    console.log(`  - ${item.make} ${item.model} (${item.recordCount} records)`);
  }
  
  console.log(`\nTo process these models:`);
  console.log(`1. Search Google for: "{Make} {Model} OEM wheel specs and tire sizes by submodel"`);
  console.log(`2. Copy the AI Overview text`);
  console.log(`3. Call processModel() with the text`);
  console.log(`\nThis script is ready for integration with browser automation.`);
  
  await pool.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

// Export for use by sub-agents
export { processModel, parseAIOverview, updateModelRecords, ResearchItem, ModelFitment };
