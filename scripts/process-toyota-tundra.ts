/**
 * Process Toyota Tundra with researched OEM fitment data
 * 
 * Tundra Generations:
 * - Gen III: 2022-2026 (All new twin-turbo i-FORCE MAX)
 * - Gen II: 2007-2021 (Full-size V8)
 * - Gen I: 2000-2006 (First full-size)
 * 
 * All generations: 5x150 bolt pattern, 110.1mm center bore
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
// Gen III (2022-2026) - All new platform
// ===========================================

const tundraGen3_SR: TrimFitment = {
  trims: ['SR', 'SR5', 'Base'],
  yearStart: 2022,
  yearEnd: 2026,
  wheels: [{ diameter: 18, width: 8, offset: 50, axle: "square", isStock: true }],
  tires: ['265/70R18']
};

const tundraGen3_Limited: TrimFitment = {
  trims: ['Limited', 'Platinum', '1794', '1794 Edition', 'Capstone'],
  yearStart: 2022,
  yearEnd: 2026,
  wheels: [{ diameter: 20, width: 8, offset: 50, axle: "square", isStock: true }],
  tires: ['275/55R20']
};

const tundraGen3_TRDOffRoad: TrimFitment = {
  trims: ['TRD Off-Road', 'TRD Off Road', 'TRD Sport'],
  yearStart: 2022,
  yearEnd: 2026,
  wheels: [{ diameter: 18, width: 8, offset: 50, axle: "square", isStock: true }],
  tires: ['275/65R18']
};

const tundraGen3_TRDPro: TrimFitment = {
  trims: ['TRD Pro', 'Pro'],
  yearStart: 2022,
  yearEnd: 2026,
  wheels: [{ diameter: 18, width: 8, offset: 45, axle: "square", isStock: true }],
  tires: ['275/65R18']
};

// ===========================================
// Gen II (2007-2021) - Full-size V8
// ===========================================

const tundraGen2_SR: TrimFitment = {
  trims: ['SR', 'Base', 'SR Double Cab', 'SR CrewMax'],
  yearStart: 2007,
  yearEnd: 2021,
  wheels: [{ diameter: 18, width: 8, offset: 50, axle: "square", isStock: true }],
  tires: ['255/70R18']
};

const tundraGen2_SR5: TrimFitment = {
  trims: ['SR5', 'SR5 CrewMax', 'SR5 Double Cab', 'TSS Off-Road'],
  yearStart: 2007,
  yearEnd: 2021,
  wheels: [{ diameter: 18, width: 8, offset: 50, axle: "square", isStock: true }],
  tires: ['275/65R18']
};

const tundraGen2_Limited: TrimFitment = {
  trims: ['Limited', 'Limited CrewMax', 'Platinum', '1794', '1794 Edition'],
  yearStart: 2007,
  yearEnd: 2021,
  wheels: [{ diameter: 20, width: 8, offset: 60, axle: "square", isStock: true }],
  tires: ['275/55R20']
};

const tundraGen2_TRDOffRoad: TrimFitment = {
  trims: ['TRD Off-Road', 'TRD Off Road', 'TRD Sport', 'TRD Rock Warrior'],
  yearStart: 2007,
  yearEnd: 2021,
  wheels: [{ diameter: 18, width: 8, offset: 50, axle: "square", isStock: true }],
  tires: ['275/65R18']
};

const tundraGen2_TRDPro: TrimFitment = {
  trims: ['TRD Pro', 'Pro'],
  yearStart: 2015,
  yearEnd: 2021,
  wheels: [{ diameter: 18, width: 8, offset: 50, axle: "square", isStock: true }],
  tires: ['275/65R18']
};

// ===========================================
// Gen I (2000-2006) - First full-size
// ===========================================

const tundraGen1_SR5: TrimFitment = {
  trims: ['SR5', 'Base', 'Access Cab', 'Double Cab'],
  yearStart: 2000,
  yearEnd: 2006,
  wheels: [{ diameter: 16, width: 7, offset: 45, axle: "square", isStock: true }],
  tires: ['265/70R16']
};

const tundraGen1_Limited: TrimFitment = {
  trims: ['Limited', 'Limited V8'],
  yearStart: 2000,
  yearEnd: 2006,
  wheels: [{ diameter: 17, width: 7.5, offset: 45, axle: "square", isStock: true }],
  tires: ['265/65R17']
};

const tundraGen1_StepSide: TrimFitment = {
  trims: ['StepSide', 'Stepside', 'Regular Cab'],
  yearStart: 2000,
  yearEnd: 2006,
  wheels: [{ diameter: 16, width: 7, offset: 45, axle: "square", isStock: true }],
  tires: ['245/75R16']
};

// Build the fitment object
const tundraFitment: ModelFitment = {
  make: 'Toyota',
  model: 'Tundra',
  boltPattern: '5x150',
  centerBore: 110.1,
  threadSize: null,
  trimFitments: [
    // Gen III (2022-2026)
    tundraGen3_SR,
    tundraGen3_Limited,
    tundraGen3_TRDOffRoad,
    tundraGen3_TRDPro,
    // Gen II (2007-2021)
    tundraGen2_SR,
    tundraGen2_SR5,
    tundraGen2_Limited,
    tundraGen2_TRDOffRoad,
    tundraGen2_TRDPro,
    // Gen I (2000-2006)
    tundraGen1_SR5,
    tundraGen1_Limited,
    tundraGen1_StepSide
  ]
};

function normalizeTrim(trim: string): string {
  return trim.toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\bhybrid\b/gi, '')
    .replace(/\biforce\s*max\b/gi, '')
    .replace(/\biforce\b/gi, '')
    .replace(/\bcrew\s*max\b/gi, '')
    .replace(/\bdouble\s*cab\b/gi, '')
    .replace(/\bregular\s*cab\b/gi, '')
    .replace(/\b4wd\b/gi, '')
    .replace(/\b4x4\b/gi, '')
    .replace(/\b2wd\b/gi, '')
    .replace(/\bedition\b/gi, '')
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
  
  // Priority 2: 1794/Capstone/Platinum special handling
  if (/1794/i.test(normalized) || /capstone/i.test(normalized)) {
    for (const tf of yearMatches) {
      if (tf.trims.some(t => /1794|capstone|platinum/i.test(t))) return tf;
    }
  }
  
  // Priority 3: TRD variants
  if (/trdpro/i.test(normalized)) {
    for (const tf of yearMatches) {
      if (tf.trims.some(t => /trd\s*pro/i.test(t))) return tf;
    }
  }
  if (/trdoffroad/i.test(normalized) || /trdsport/i.test(normalized)) {
    for (const tf of yearMatches) {
      if (tf.trims.some(t => /trd\s*off|trd\s*sport/i.test(t))) return tf;
    }
  }
  
  // Priority 4: DB trim starts with fitment trim
  for (const tf of sorted) {
    for (const trim of tf.trims) {
      const nt = normalizeTrim(trim);
      if (normalized.startsWith(nt)) return tf;
    }
  }
  
  // Priority 5: Contains
  for (const tf of sorted) {
    for (const trim of tf.trims) {
      const nt = normalizeTrim(trim);
      if (nt.includes(normalized) || normalized.includes(nt)) return tf;
    }
  }
  
  // Priority 6: Fallback to SR5 (most common)
  for (const tf of yearMatches) {
    if (tf.trims.some(t => /sr5/i.test(t))) return tf;
  }
  
  return yearMatches[0] || null;
}

async function main() {
  const dryRun = !process.argv.includes('--apply');
  
  console.log(`Processing Toyota Tundra...`);
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'APPLYING CHANGES'}`);
  
  const fitment = tundraFitment;
  
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
      AND LOWER(model) = 'tundra'
      AND (source LIKE 'generation_import%' OR source = 'wheelsize')
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
