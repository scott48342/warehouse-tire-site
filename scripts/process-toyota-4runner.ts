/**
 * Process Toyota 4Runner with researched OEM fitment data
 * 
 * 4Runner Generations:
 * - Gen VI: 2025-2026 (All new)
 * - Gen V: 2010-2024
 * - Gen IV: 2003-2009
 * - Gen III: 1996-2002
 * - Gen II: 1990-1995
 * - Gen I: 1984-1989
 * 
 * All generations: 6x139.7 bolt pattern, 106.1mm center bore
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

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

// ===========================================
// Gen VI (2025-2026) - All new 6th generation
// ===========================================

const fourRunnerGen6_SR5: TrimFitment = {
  trims: ['SR5', 'SR5 Premium', 'Base'],
  yearStart: 2025,
  yearEnd: 2026,
  wheels: [{ diameter: 17, width: 7.5, offset: 25, axle: "square", isStock: true }],
  tires: ['265/70R17']
};

const fourRunnerGen6_TRDOffRoad: TrimFitment = {
  trims: ['TRD Off-Road', 'TRD Off Road', 'Off-Road', 'TRD Off-Road Premium'],
  yearStart: 2025,
  yearEnd: 2026,
  wheels: [{ diameter: 17, width: 7.5, offset: 25, axle: "square", isStock: true }],
  tires: ['265/70R17']
};

const fourRunnerGen6_TRDPro: TrimFitment = {
  trims: ['TRD Pro', 'Pro', 'Trailhunter'],
  yearStart: 2025,
  yearEnd: 2026,
  wheels: [{ diameter: 17, width: 7.5, offset: 25, axle: "square", isStock: true }],
  tires: ['265/70R17']
};

const fourRunnerGen6_Limited: TrimFitment = {
  trims: ['Limited', 'Platinum', 'Limited Nightshade'],
  yearStart: 2025,
  yearEnd: 2026,
  wheels: [{ diameter: 20, width: 8, offset: 35, axle: "square", isStock: true }],
  tires: ['245/60R20']
};

// ===========================================
// Gen V (2010-2024) - Fifth generation
// ===========================================

const fourRunnerGen5_SR5: TrimFitment = {
  trims: ['SR5', 'SR5 Premium', 'Base', 'Venture', 'Nightshade', '40th Anniversary', 'SR5 4x4', 'Trail'],
  yearStart: 2010,
  yearEnd: 2024,
  wheels: [{ diameter: 17, width: 7.5, offset: 25, axle: "square", isStock: true }],
  tires: ['265/70R17']
};

const fourRunnerGen5_TRDOffRoad: TrimFitment = {
  trims: ['TRD Off-Road', 'TRD Off-Road Premium', 'TRD Off Road', 'Trail', 'Trail Edition'],
  yearStart: 2010,
  yearEnd: 2024,
  wheels: [{ diameter: 17, width: 7.5, offset: 25, axle: "square", isStock: true }],
  tires: ['265/70R17']
};

const fourRunnerGen5_TRDPro: TrimFitment = {
  trims: ['TRD Pro', 'Pro'],
  yearStart: 2015,
  yearEnd: 2024,
  wheels: [{ diameter: 17, width: 7.5, offset: 25, axle: "square", isStock: true }],
  tires: ['265/70R17']
};

const fourRunnerGen5_Limited: TrimFitment = {
  trims: ['Limited', 'Limited Nightshade'],
  yearStart: 2010,
  yearEnd: 2024,
  wheels: [{ diameter: 20, width: 8, offset: 35, axle: "square", isStock: true }],
  tires: ['245/60R20']
};

// ===========================================
// Gen IV (2003-2009) - Fourth generation
// ===========================================

const fourRunnerGen4_SR5: TrimFitment = {
  trims: ['SR5', 'Base', 'SR5 V6', 'SR5 V8'],
  yearStart: 2003,
  yearEnd: 2009,
  wheels: [{ diameter: 17, width: 7.5, offset: 25, axle: "square", isStock: true }],
  tires: ['265/65R17']
};

const fourRunnerGen4_Sport: TrimFitment = {
  trims: ['Sport', 'Sport Edition', 'Sport V8'],
  yearStart: 2003,
  yearEnd: 2009,
  wheels: [{ diameter: 18, width: 7.5, offset: 25, axle: "square", isStock: true }],
  tires: ['265/60R18']
};

const fourRunnerGen4_Limited: TrimFitment = {
  trims: ['Limited', 'Limited V8'],
  yearStart: 2003,
  yearEnd: 2009,
  wheels: [{ diameter: 18, width: 7.5, offset: 25, axle: "square", isStock: true }],
  tires: ['265/60R18']
};

const fourRunnerGen4_Trail: TrimFitment = {
  trims: ['Trail', 'Trail Edition'],
  yearStart: 2005,
  yearEnd: 2009,
  wheels: [{ diameter: 17, width: 7.5, offset: 25, axle: "square", isStock: true }],
  tires: ['265/65R17']
};

// ===========================================
// Gen III (1996-2002) - Third generation
// ===========================================

const fourRunnerGen3_SR5: TrimFitment = {
  trims: ['SR5', 'Base', 'SR5 V6'],
  yearStart: 1996,
  yearEnd: 2002,
  wheels: [{ diameter: 16, width: 7, offset: 25, axle: "square", isStock: true }],
  tires: ['265/70R16']
};

const fourRunnerGen3_Limited: TrimFitment = {
  trims: ['Limited'],
  yearStart: 1996,
  yearEnd: 2002,
  wheels: [{ diameter: 17, width: 7.5, offset: 25, axle: "square", isStock: true }],
  tires: ['265/65R17']
};

// ===========================================
// Gen II (1990-1995) - Second generation
// ===========================================

const fourRunnerGen2_SR5: TrimFitment = {
  trims: ['SR5', 'Base', 'SR5 V6', 'DLX'],
  yearStart: 1990,
  yearEnd: 1995,
  wheels: [{ diameter: 15, width: 7, offset: 20, axle: "square", isStock: true }],
  tires: ['265/75R15', '31x10.50R15']
};

// ===========================================
// Gen I (1984-1989) - First generation
// ===========================================

const fourRunnerGen1_Base: TrimFitment = {
  trims: ['Base', 'DLX', '4x4'],
  yearStart: 1984,
  yearEnd: 1989,
  wheels: [{ diameter: 15, width: 6, offset: 20, axle: "square", isStock: true }],
  tires: ['225/75R15']
};

const fourRunnerGen1_SR5: TrimFitment = {
  trims: ['SR5', 'SR5 V6'],
  yearStart: 1984,
  yearEnd: 1989,
  wheels: [{ diameter: 15, width: 7, offset: 20, axle: "square", isStock: true }],
  tires: ['265/75R15', '31x10.50R15']
};

// Build the fitment object
const fourRunnerFitment: ModelFitment = {
  make: 'Toyota',
  model: '4Runner',
  boltPattern: '6x139.7',
  centerBore: 106.1,
  threadSize: null,
  trimFitments: [
    // Gen VI (2025-2026)
    fourRunnerGen6_SR5,
    fourRunnerGen6_TRDOffRoad,
    fourRunnerGen6_TRDPro,
    fourRunnerGen6_Limited,
    // Gen V (2010-2024)
    fourRunnerGen5_SR5,
    fourRunnerGen5_TRDOffRoad,
    fourRunnerGen5_TRDPro,
    fourRunnerGen5_Limited,
    // Gen IV (2003-2009)
    fourRunnerGen4_SR5,
    fourRunnerGen4_Sport,
    fourRunnerGen4_Limited,
    fourRunnerGen4_Trail,
    // Gen III (1996-2002)
    fourRunnerGen3_SR5,
    fourRunnerGen3_Limited,
    // Gen II (1990-1995)
    fourRunnerGen2_SR5,
    // Gen I (1984-1989)
    fourRunnerGen1_Base,
    fourRunnerGen1_SR5
  ]
};

function normalizeTrim(trim: string): string {
  return trim.toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\bhybrid\b/gi, '')
    .replace(/\bawd\b/gi, '')
    .replace(/\b4wd\b/gi, '')
    .replace(/\b4x4\b/gi, '')
    .replace(/\b2wd\b/gi, '')
    .replace(/\bedition\b/gi, '')
    .replace(/\bpackage\b/gi, '')
    .replace(/\bpremium\b/gi, '')
    .replace(/\s+/g, '')
    .trim();
}

function matchTrimToFitment(year: number, displayTrim: string, fitment: ModelFitment): TrimFitment | null {
  const normalized = normalizeTrim(displayTrim);
  
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
  
  // Priority 3: Contains TRD variants
  if (/trdpro/i.test(normalized)) {
    for (const tf of yearMatches) {
      if (tf.trims.some(t => /trd\s*pro/i.test(t))) return tf;
    }
  }
  if (/trdoffroad/i.test(normalized) || /trdoff-road/i.test(normalized)) {
    for (const tf of yearMatches) {
      if (tf.trims.some(t => /trd\s*off/i.test(t))) return tf;
    }
  }
  
  // Priority 4: Contains
  for (const tf of sorted) {
    for (const trim of tf.trims) {
      const nt = normalizeTrim(trim);
      if (nt.includes(normalized) || normalized.includes(nt)) return tf;
    }
  }
  
  // Priority 5: Fallback to SR5 (most common)
  for (const tf of yearMatches) {
    if (tf.trims.some(t => /sr5/i.test(t))) return tf;
  }
  
  return yearMatches[0] || null; // Last resort: return first match for year
}

async function main() {
  const dryRun = !process.argv.includes('--apply');
  
  console.log(`Processing Toyota 4Runner...`);
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'APPLYING CHANGES'}`);
  
  const fitment = fourRunnerFitment;
  
  console.log(`\nFitment Data:`);
  console.log(`  Bolt: ${fitment.boltPattern || 'N/A'}`);
  console.log(`  Bore: ${fitment.centerBore || 'N/A'}mm`);
  console.log(`  Trim Fitments: ${fitment.trimFitments.length}`);
  
  for (const tf of fitment.trimFitments) {
    const wheelStr = tf.wheels.map(w => `${w.diameter}x${w.width}`).join('/') || 'N/A';
    const tireStr = tf.tires.join(', ') || 'N/A';
    console.log(`    ${tf.yearStart}-${tf.yearEnd} [${tf.trims.slice(0, 3).join(', ')}${tf.trims.length > 3 ? '...' : ''}]: ${wheelStr}, ${tireStr}`);
  }
  
  // Get records that need processing
  const records = await pool.query(`
    SELECT id, year, make, model, display_trim, source
    FROM vehicle_fitments
    WHERE LOWER(make) = 'toyota' 
      AND (LOWER(model) = '4runner' OR LOWER(model) = '4-runner' OR LOWER(model) LIKE '%4runner%')
      AND source NOT LIKE 'trim-research%'
      AND source NOT LIKE 'verified%'
    ORDER BY year, display_trim
  `);
  
  console.log(`\nFound ${records.rows.length} records to process`);
  
  let updated = 0;
  let skipped = 0;
  const flagged: string[] = [];
  
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
    
    if (dryRun) {
      const wheelStr = oemWheelSizes.map(w => `${w.diameter}x${w.width}`).join('/');
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
          source = 'trim-research',
          quality_tier = 'complete',
          updated_at = NOW()
        WHERE id = $5
      `, [
        JSON.stringify(oemWheelSizes),
        JSON.stringify(matchedFitment.tires),
        fitment.boltPattern,
        fitment.centerBore,
        record.id
      ]);
    }
    
    updated++;
  }
  
  console.log(`\n========================================`);
  console.log(`Results: ✓ ${updated} updated, ⚠ ${skipped} skipped`);
  
  if (flagged.length > 0) {
    console.log(`\nFlagged for manual review (${flagged.length}):`);
    for (const f of flagged.slice(0, 10)) {
      console.log(`  - ${f}`);
    }
    if (flagged.length > 10) {
      console.log(`  ... and ${flagged.length - 10} more`);
    }
  }
  
  const matchRate = records.rows.length > 0 ? (updated / (updated + skipped) * 100).toFixed(1) : '0';
  console.log(`\nMatch Rate: ${matchRate}%`);
  
  await pool.end();
}

main().catch(console.error);
