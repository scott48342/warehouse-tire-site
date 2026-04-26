/**
 * Trim-Level Fitment Research Script
 * 
 * Searches for OEM wheel/tire specs by submodel and updates database records
 * with trim-specific fitment data.
 * 
 * Usage: npx tsx scripts/trim-fitment-research.ts "Toyota" "Highlander"
 *        npx tsx scripts/trim-fitment-research.ts --test (runs test with simulated data)
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { Pool } from "pg";

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
  trims: string[];  // e.g., ["LE", "XLE", "Hybrid"]
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
  rawResponse?: string;
}

// Parse AI Overview response into structured fitment data
function parseAIOverview(make: string, model: string, response: string): ModelFitment {
  const fitment: ModelFitment = {
    make,
    model,
    boltPattern: null,
    centerBore: null,
    threadSize: null,
    trimFitments: [],
    rawResponse: response
  };

  // Extract bolt pattern (e.g., "5x114.3", "5x120", "6x139.7")
  const boltMatch = response.match(/(\d)x(\d{2,3}(?:\.\d)?)/i);
  if (boltMatch) {
    fitment.boltPattern = `${boltMatch[1]}x${boltMatch[2]}`;
  }

  // Extract center bore (e.g., "60.1mm", "66.6 mm")
  const boreMatch = response.match(/(\d{2,3}\.\d)\s*mm\s*center/i) ||
                    response.match(/center\s*bore[:\s]*(\d{2,3}(?:\.\d)?)/i) ||
                    response.match(/(\d{2}\.\d)\s*mm/i);
  if (boreMatch) {
    fitment.centerBore = parseFloat(boreMatch[1]);
  }

  // Extract thread size (e.g., "M12x1.5", "M14x1.5")
  const threadMatch = response.match(/M(\d{2})x(\d\.\d)/i);
  if (threadMatch) {
    fitment.threadSize = `M${threadMatch[1]}x${threadMatch[2]}`;
  }

  // Parse line by line
  const lines = response.split('\n');
  let currentYearStart = 2000;
  let currentYearEnd = 2026;

  for (const line of lines) {
    // Check for generation/year range header
    // Match: "4th Generation (2020-2025):" or "2017-2019:" or "(2020-2025)"
    const yearRangeMatch = line.match(/\(?\s*(\d{4})\s*[-–]\s*(\d{4}|present|current)\s*\)?/i);
    if (yearRangeMatch) {
      currentYearStart = parseInt(yearRangeMatch[1]);
      const endYear = yearRangeMatch[2].toLowerCase();
      currentYearEnd = (endYear === 'present' || endYear === 'current') ? 2026 : parseInt(endYear);
    }

    // Match trim lines like:
    // "LE/XLE/Hybrid: 18" alloy, Offset: 35mm, Tire: 235/65R18"
    // "Limited/Platinum: 20" alloy, Offset: 35mm, Tire: 235/55R20"
    const trimLineMatch = line.match(/^([A-Za-z][A-Za-z0-9\s\/\-]+?):\s*(\d{2})["\s]/);
    
    if (trimLineMatch) {
      const trimPart = trimLineMatch[1].trim();
      const wheelDiameter = parseInt(trimLineMatch[2]);
      
      // Skip if looks like a header
      if (/generation|fitment|notes|key|bolt|pattern/i.test(trimPart)) continue;
      
      // Split trim names on / or ,
      const trimNames = trimPart.split(/[\/,]/).map(t => t.trim()).filter(t => t.length > 0 && t.length < 30);
      
      if (trimNames.length === 0) continue;
      
      // Extract offset from line
      const offsetMatch = line.match(/offset[:\s]*(\d+)\s*mm/i) || line.match(/ET\s*(\d+)/i);
      const offset = offsetMatch ? parseInt(offsetMatch[1]) : null;
      
      // Extract tire size from line
      const tireMatch = line.match(/(\d{3}\/\d{2}[RZ]?\d{2})/);
      const tireSize = tireMatch ? tireMatch[1] : null;
      
      // Extract width (e.g., "8J" or "8.5x18")
      const widthMatch = line.match(/(\d+(?:\.\d)?)\s*[Jx]\s*\d{2}/i);
      const width = widthMatch ? parseFloat(widthMatch[1]) : null;
      
      // Check for staggered
      const isStaggered = /staggered|front.*rear|rear.*front/i.test(line);
      
      const wheels: WheelSpec[] = [{
        diameter: wheelDiameter,
        width,
        offset,
        axle: isStaggered ? "front" : "square",
        isStock: true
      }];
      
      fitment.trimFitments.push({
        trims: trimNames,
        yearStart: currentYearStart,
        yearEnd: currentYearEnd,
        wheels,
        tires: tireSize ? [tireSize] : []
      });
    }
  }

  return fitment;
}

// Normalize trim name for matching
function normalizeTrim(trim: string): string {
  return trim.toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')  // Keep spaces temporarily
    .replace(/\bhybrid\b/gi, '')   // Remove "hybrid" anywhere
    .replace(/\bawd\b/gi, '')      // Remove "AWD" anywhere
    .replace(/\b4matic\b/gi, '')   // Mercedes 4Matic
    .replace(/\bedition\b/gi, '')  // Remove "edition"
    .replace(/\bnightshade\b/gi, '') // Toyota Nightshade packages
    .replace(/\bbronze\b/gi, '')   // Bronze Edition
    .replace(/\bplus\b/gi, '')     // LE Plus -> LE
    .replace(/\s+/g, '')           // Now remove all spaces
    .trim();
}

// Match a database trim to parsed fitment data
function matchTrimToFitment(
  year: number,
  displayTrim: string,
  fitment: ModelFitment
): TrimFitment | null {
  const normalizedDbTrim = normalizeTrim(displayTrim);
  
  // Filter to matching year range first
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
  
  // Priority 2: DB trim starts with fitment trim (e.g., "Limited Platinum" starts with "Limited")
  // Sort by longest match first to prefer "Limited" over "L"
  const sortedByLength = [...yearMatches].sort((a, b) => {
    const aMax = Math.max(...a.trims.map(t => normalizeTrim(t).length));
    const bMax = Math.max(...b.trims.map(t => normalizeTrim(t).length));
    return bMax - aMax;  // Longest first
  });
  
  for (const tf of sortedByLength) {
    for (const fitmentTrim of tf.trims) {
      const normalizedFitmentTrim = normalizeTrim(fitmentTrim);
      // DB trim starts with or equals fitment trim
      if (normalizedDbTrim.startsWith(normalizedFitmentTrim)) {
        return tf;
      }
    }
  }
  
  // Priority 3: Fitment trim contains DB trim (e.g., "LE/XLE" contains "LE")
  for (const tf of sortedByLength) {
    for (const fitmentTrim of tf.trims) {
      const normalizedFitmentTrim = normalizeTrim(fitmentTrim);
      if (normalizedFitmentTrim.includes(normalizedDbTrim)) {
        return tf;
      }
    }
  }
  
  // Priority 4: Special cases
  for (const tf of yearMatches) {
    for (const fitmentTrim of tf.trims) {
      const normalizedFitmentTrim = normalizeTrim(fitmentTrim);
      // Base = L
      if ((normalizedDbTrim === 'base' && normalizedFitmentTrim === 'l') ||
          (normalizedDbTrim === 'l' && normalizedFitmentTrim === 'base')) {
        return tf;
      }
      // Hybrid variants match base trim
      if (normalizedDbTrim.startsWith('hybrid') && 
          normalizedDbTrim.replace('hybrid', '') === normalizedFitmentTrim) {
        return tf;
      }
    }
  }
  
  return null;
}

// Update database records for a model
async function updateModelRecords(fitment: ModelFitment, dryRun: boolean = false): Promise<{updated: number, skipped: number, flagged: string[]}> {
  let updated = 0;
  let skipped = 0;
  const flagged: string[] = [];
  
  // Get all records for this make+model
  const records = await pool.query(`
    SELECT id, year, make, model, display_trim
    FROM vehicle_fitments
    WHERE LOWER(make) = LOWER($1) 
      AND LOWER(model) = LOWER($2)
      AND source = 'google-ai-overview'
    ORDER BY year, display_trim
  `, [fitment.make, fitment.model]);
  
  console.log(`\nFound ${records.rows.length} database records to process`);
  
  for (const record of records.rows) {
    const matchedFitment = matchTrimToFitment(record.year, record.display_trim, fitment);
    
    if (!matchedFitment) {
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
      console.log(`  [DRY RUN] Would update ${record.year} ${record.display_trim}:`);
      console.log(`    Wheels: ${JSON.stringify(oemWheelSizes)}`);
      console.log(`    Tires: ${JSON.stringify(matchedFitment.tires)}`);
    } else {
      // Update the record
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

// Simulate search (for testing)
function simulateSearch(make: string, model: string): string {
  if (make.toLowerCase() === 'toyota' && model.toLowerCase() === 'highlander') {
    return `
Toyota Highlander OEM wheels use a 5x114.3 bolt pattern with 60.1mm center bore.

4th Generation (2020-2025):
LE/XLE/Hybrid: 18" alloy, Offset: 35mm, Tire: 235/65R18
Limited/Platinum: 20" alloy, Offset: 35mm, Tire: 235/55R20

3rd Generation Facelift (2017-2019):
LE/XLE: 18" alloy, Offset: 30mm, Tire: 245/60R18
SE/Limited: 19" alloy, Offset: 30mm, Tire: 245/55R19

3rd Generation (2013-2016):
Base/LE: 18" alloy, Offset: 30mm, Tire: 245/60R18
XLE/Limited: 19" alloy, Offset: 30mm, Tire: 245/55R19

2nd Generation (2007-2012):
Base/Sport: 17" alloy, Offset: 30mm, Tire: 245/65R17
Limited: 19" alloy, Offset: 30mm, Tire: 245/55R19

1st Generation (2001-2007):
Base/L: 16" alloy, Offset: 30mm, Tire: 225/70R16
Limited: 17" alloy, Offset: 30mm, Tire: 225/65R17

Lug nut: M12x1.5
    `;
  }
  
  return `No data found for ${make} ${model}`;
}

// Real web search function
async function webSearch(query: string): Promise<string> {
  // Use Clawdbot's web_search via fetch to local gateway
  // For now, we'll output the query and expect manual paste
  console.log(`\n[SEARCH QUERY]: "${query}"`);
  console.log("[Paste the AI Overview result below, then press Enter twice to continue]");
  
  // In a real implementation, this would call the web_search API
  // For now, return empty to trigger manual input
  return "";
}

// Main research function for a single model
async function researchModel(make: string, model: string, options: {simulate?: boolean, dryRun?: boolean, searchResult?: string} = {}): Promise<void> {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`Researching: ${make} ${model}`);
  console.log("=".repeat(60));
  
  let response: string;
  
  if (options.simulate) {
    response = simulateSearch(make, model);
  } else if (options.searchResult) {
    response = options.searchResult;
  } else {
    const query = `${make} ${model} OEM wheel specs and tire sizes by submodel`;
    response = await webSearch(query);
    if (!response) {
      console.log("\nNo search result provided. Use --simulate for test data.");
      return;
    }
  }
  
  console.log("\nSearch response preview:");
  console.log(response.substring(0, 600));
  
  // Parse the response
  const fitment = parseAIOverview(make, model, response);
  
  console.log("\n--- Parsed Fitment Data ---");
  console.log(`Bolt Pattern: ${fitment.boltPattern || 'NOT FOUND'}`);
  console.log(`Center Bore: ${fitment.centerBore || 'NOT FOUND'}mm`);
  console.log(`Thread Size: ${fitment.threadSize || 'NOT FOUND'}`);
  console.log(`\nTrim Fitments Found: ${fitment.trimFitments.length}`);
  
  for (const tf of fitment.trimFitments) {
    console.log(`\n  ${tf.yearStart}-${tf.yearEnd} → [${tf.trims.join(", ")}]`);
    for (const w of tf.wheels) {
      console.log(`    Wheel: ${w.diameter}" x ${w.width || '?'}J, ET${w.offset || '?'}`);
    }
    console.log(`    Tires: ${tf.tires.join(", ") || 'none'}`);
  }
  
  // Update database records
  console.log("\n--- Database Update ---");
  const result = await updateModelRecords(fitment, options.dryRun);
  
  console.log(`\nResults:`);
  console.log(`  ✓ Updated: ${result.updated}`);
  console.log(`  ⚠ Skipped (no match): ${result.skipped}`);
  
  if (result.flagged.length > 0) {
    console.log(`\n  Flagged for manual review:`);
    for (const f of result.flagged.slice(0, 5)) {
      console.log(`    - ${f}`);
    }
    if (result.flagged.length > 5) {
      console.log(`    ... and ${result.flagged.length - 5} more`);
    }
  }
}

// Main
async function main() {
  const args = process.argv.slice(2);
  
  if (args[0] === '--test') {
    console.log("TEST MODE: Simulated data, dry run (no DB changes)\n");
    await researchModel("Toyota", "Highlander", { simulate: true, dryRun: true });
  } else if (args.length >= 2) {
    const [make, model] = args;
    await researchModel(make, model, { simulate: true, dryRun: true });
  } else {
    console.log("Usage:");
    console.log('  npx tsx scripts/trim-fitment-research.ts --test');
    console.log('  npx tsx scripts/trim-fitment-research.ts "Toyota" "Highlander"');
  }
  
  await pool.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
