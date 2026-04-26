/**
 * Test: Toyota Highlander trim-level fitment update
 * Uses real AI Overview data from Google search
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

// Real AI Overview data from Google search
const AI_OVERVIEW = `
Toyota Highlander (2020–2026, 4th Gen) OEM wheels typically feature a 5x114.3mm bolt pattern, 60.1mm center bore, and 18-inch or 20-inch diameters. Common tire sizes include 235/65R18 (XLE/LE) and 235/55R20 (Limited/Platinum). Wheels are generally 7.5J-8J width with a +30mm to +35mm offset.

2020–2026 Toyota Highlander OEM Specs:
Bolt Pattern: 5x114.3 mm (5x4.5 inches)
Center Bore: 60.1 mm
Lug Nut Size: M12x1.5

Tire and Wheel Sizes by Submodel (Gen 4):
LE / XLE: Tires: 235/65R18, Wheels: 18" x 8"J (approx. ET35)
Limited / Platinum / XSE: Tires: 235/55R20, Wheels: 20" x 8"J (approx. ET30–35)

Key Differences in Previous Generations:
Gen 3 (2017–2019): Often used 245/60R18 or 245/55R19, with 7.5Jx18 or 7.5Jx19 wheels.
Gen 3 (2014-2016): Base/LE: 245/60R18, Higher trims: 245/55R19
Gen 2 (2008–2013): Base: 245/65R17, Limited: 245/55R19
Gen 1 (2001–2007): Base/L: 225/70R16, Limited: 225/65R17
`;

interface TrimFitment {
  trims: string[];
  yearStart: number;
  yearEnd: number;
  diameter: number | null;
  width: number | null;
  offset: number | null;
  tireSize: string | null;
}

interface ModelFitment {
  boltPattern: string | null;
  centerBore: number | null;
  threadSize: string | null;
  trimFitments: TrimFitment[];
}

function parseAIOverview(text: string): ModelFitment {
  const fitment: ModelFitment = {
    boltPattern: null,
    centerBore: null,
    threadSize: null,
    trimFitments: []
  };

  // Extract bolt pattern
  const boltMatch = text.match(/(\d)x(\d{2,3}(?:\.\d)?)\s*(?:mm)?/i);
  if (boltMatch) fitment.boltPattern = `${boltMatch[1]}x${boltMatch[2]}`;

  // Extract center bore (more specific pattern to avoid bolt pattern confusion)
  const boreMatch = text.match(/center\s*bore[:\s]*(\d{2,3}(?:\.\d)?)\s*mm/i) ||
                    text.match(/bore[:\s]*(\d{2}\.\d)\s*mm/i) ||
                    text.match(/(\d{2}\.\d)\s*mm\s*center/i);
  if (boreMatch) fitment.centerBore = parseFloat(boreMatch[1]);

  // Extract thread size
  const threadMatch = text.match(/M(\d{2})x(\d\.\d)/i);
  if (threadMatch) fitment.threadSize = `M${threadMatch[1]}x${threadMatch[2]}`;

  // Parse generations and trims
  const lines = text.split('\n');
  let currentYearStart = 2000;
  let currentYearEnd = 2026;

  for (const line of lines) {
    // Year range detection - multiple formats
    const yearMatch = line.match(/\(?\s*(\d{4})\s*[-–]\s*(\d{4}|present)\s*\)?/i) ||
                      line.match(/Gen\s*\d+\s*\((\d{4})\s*[-–]\s*(\d{4})\)/i);
    if (yearMatch) {
      currentYearStart = parseInt(yearMatch[1]);
      currentYearEnd = yearMatch[2].toLowerCase() === 'present' ? 2026 : parseInt(yearMatch[2]);
    }

    // Find ALL trim:spec pairs in the line
    // Pattern: "TrimName: 225/70R16" or "TrimName/TrimName2: 225/70R16"
    // Can have multiple on same line: "Base/L: 225/70R16, Limited: 225/65R17"
    const trimSpecPattern = /([A-Za-z][A-Za-z0-9\s\/\-]*?):\s*(?:Tires?:?\s*)?(\d{3}\/\d{2}[RZ]?\d{2})(?:[,\s]*(?:Wheels?:?\s*)?(\d{2})["\s]*(?:x\s*)?(\d+(?:\.\d)?)?[Jx"]?)?/gi;
    
    let match;
    while ((match = trimSpecPattern.exec(line)) !== null) {
      const trimPart = match[1].trim();
      
      // Skip if it looks like a header
      if (/^gen|generation|bolt|specs|key|differences|previous|tire and wheel/i.test(trimPart)) continue;
      
      // Skip if trim name is too long (probably not a trim)
      if (trimPart.length > 30) continue;
      
      const trimNames = trimPart.split(/[\/]/).map(t => t.trim()).filter(t => t.length > 0 && t.length < 25);
      if (trimNames.length === 0) continue;
      
      const tireSize = match[2];
      
      // Extract wheel diameter from tire size (e.g., R18 -> 18)
      const tireDiamMatch = tireSize.match(/R(\d{2})/i);
      let diameter = tireDiamMatch ? parseInt(tireDiamMatch[1]) : null;
      
      // Or from explicit capture group
      if (match[3]) diameter = parseInt(match[3]);
      
      // Extract wheel width from capture group or default
      const width = match[4] ? parseFloat(match[4]) : 8;
      
      // Look for offset in nearby text
      const lineFromMatch = line.substring(match.index);
      const offsetMatch = lineFromMatch.match(/ET\s*(\d+)/i) || lineFromMatch.match(/\+(\d+)\s*mm/i);
      const offset = offsetMatch ? parseInt(offsetMatch[1]) : 35;
      
      fitment.trimFitments.push({
        trims: trimNames,
        yearStart: currentYearStart,
        yearEnd: currentYearEnd,
        diameter,
        width,
        offset,
        tireSize
      });
    }
  }

  return fitment;
}

function normalizeTrim(trim: string): string {
  return trim.toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\bhybrid\b/gi, '')
    .replace(/\bawd\b/gi, '')
    .replace(/\bedition\b/gi, '')
    .replace(/\bnightshade\b/gi, '')
    .replace(/\bbronze\b/gi, '')
    .replace(/\bplus\b/gi, '')
    .replace(/\s+/g, '')
    .trim();
}

function matchTrim(year: number, displayTrim: string, fitment: ModelFitment): TrimFitment | null {
  const normalized = normalizeTrim(displayTrim);
  
  // Filter by year
  const yearMatches = fitment.trimFitments.filter(
    tf => year >= tf.yearStart && year <= tf.yearEnd
  );
  
  if (yearMatches.length === 0) return null;
  
  // Sort by trim name length (longest first)
  const sorted = [...yearMatches].sort((a, b) => {
    const aMax = Math.max(...a.trims.map(t => normalizeTrim(t).length));
    const bMax = Math.max(...b.trims.map(t => normalizeTrim(t).length));
    return bMax - aMax;
  });
  
  // Exact match
  for (const tf of sorted) {
    for (const trim of tf.trims) {
      if (normalizeTrim(trim) === normalized) return tf;
    }
  }
  
  // Starts with match
  for (const tf of sorted) {
    for (const trim of tf.trims) {
      const nt = normalizeTrim(trim);
      if (normalized.startsWith(nt) || nt.startsWith(normalized)) return tf;
    }
  }
  
  // Contains match
  for (const tf of sorted) {
    for (const trim of tf.trims) {
      if (normalizeTrim(trim).includes(normalized) || normalized.includes(normalizeTrim(trim))) {
        return tf;
      }
    }
  }
  
  // Special: base = l
  for (const tf of yearMatches) {
    for (const trim of tf.trims) {
      const nt = normalizeTrim(trim);
      if ((normalized === 'base' && nt === 'l') || (normalized === 'l' && nt === 'base')) {
        return tf;
      }
    }
  }
  
  return null;
}

async function main() {
  console.log("=== Testing Toyota Highlander Trim-Level Update ===\n");
  
  // Parse the AI Overview
  const fitment = parseAIOverview(AI_OVERVIEW);
  
  console.log("Parsed Model Data:");
  console.log(`  Bolt Pattern: ${fitment.boltPattern}`);
  console.log(`  Center Bore: ${fitment.centerBore}mm`);
  console.log(`  Thread Size: ${fitment.threadSize}`);
  console.log(`  Trim Fitments: ${fitment.trimFitments.length}`);
  
  for (const tf of fitment.trimFitments) {
    console.log(`\n  ${tf.yearStart}-${tf.yearEnd} [${tf.trims.join(", ")}]:`);
    console.log(`    Wheel: ${tf.diameter}" x ${tf.width}J, ET${tf.offset}`);
    console.log(`    Tire: ${tf.tireSize}`);
  }
  
  // Get records to update
  const records = await pool.query(`
    SELECT id, year, make, model, display_trim
    FROM vehicle_fitments
    WHERE (LOWER(make) = 'toyota' AND LOWER(model) = 'highlander')
       OR (LOWER(make) = 'toyota' AND LOWER(model) LIKE '%highlander%')
    AND source = 'google-ai-overview'
    ORDER BY year, display_trim
    LIMIT 30
  `);
  
  console.log(`\n\n=== Matching ${records.rows.length} Records ===\n`);
  
  let matched = 0;
  let unmatched = 0;
  
  for (const record of records.rows) {
    const match = matchTrim(record.year, record.display_trim, fitment);
    
    if (match) {
      console.log(`✓ ${record.year} ${record.display_trim} → ${match.diameter}", ${match.tireSize}`);
      matched++;
    } else {
      console.log(`✗ ${record.year} ${record.display_trim} → NO MATCH`);
      unmatched++;
    }
  }
  
  console.log(`\n=== Summary ===`);
  console.log(`Matched: ${matched}`);
  console.log(`Unmatched: ${unmatched}`);
  console.log(`Match rate: ${((matched / (matched + unmatched)) * 100).toFixed(1)}%`);
  
  // DRY RUN - show what would be updated
  console.log(`\n=== DRY RUN - Would Update ===`);
  
  for (const record of records.rows.slice(0, 10)) {
    const match = matchTrim(record.year, record.display_trim, fitment);
    if (match) {
      console.log(`UPDATE vehicle_fitments SET`);
      console.log(`  oem_wheel_sizes = '[{"diameter":${match.diameter},"width":${match.width},"offset":${match.offset},"axle":"square","isStock":true}]',`);
      console.log(`  oem_tire_sizes = '["${match.tireSize}"]',`);
      console.log(`  bolt_pattern = '${fitment.boltPattern}',`);
      console.log(`  center_bore_mm = ${fitment.centerBore},`);
      console.log(`  source = 'trim-research'`);
      console.log(`WHERE id = '${record.id}';`);
      console.log();
    }
  }
  
  await pool.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
