/**
 * Process Toyota RAV4 with researched OEM fitment data
 * 
 * RAV4 Generations:
 * - Gen V: 2019-2026 (TNGA-K)
 * - Gen IV: 2013-2018
 * - Gen III: 2006-2012
 * - Gen II: 2001-2005
 * - Gen I: 1996-2000
 * 
 * Bolt pattern: 5x114.3 (Gen 2+), 5x100 (Gen 1)
 * Center bore: 60.1mm
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
  boltPattern?: string;
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
// Gen V (2019-2026) - TNGA-K platform
// ===========================================

const rav4Gen5_LE: TrimFitment = {
  trims: ['LE', 'Base', 'LE FWD', 'LE AWD'],
  yearStart: 2019,
  yearEnd: 2026,
  wheels: [{ diameter: 17, width: 7, offset: 35, axle: "square", isStock: true }],
  tires: ['225/65R17']
};

const rav4Gen5_XLE: TrimFitment = {
  trims: ['XLE', 'XLE Premium', 'SE', 'Woodland'],
  yearStart: 2019,
  yearEnd: 2026,
  wheels: [{ diameter: 18, width: 7, offset: 35, axle: "square", isStock: true }],
  tires: ['225/60R18']
};

const rav4Gen5_XSE: TrimFitment = {
  trims: ['XSE', 'XSE Prime'],
  yearStart: 2019,
  yearEnd: 2026,
  wheels: [{ diameter: 19, width: 7.5, offset: 35, axle: "square", isStock: true }],
  tires: ['235/55R19']
};

const rav4Gen5_Limited: TrimFitment = {
  trims: ['Limited'],
  yearStart: 2019,
  yearEnd: 2026,
  wheels: [{ diameter: 19, width: 7.5, offset: 35, axle: "square", isStock: true }],
  tires: ['235/55R19']
};

const rav4Gen5_Adventure: TrimFitment = {
  trims: ['Adventure', 'TRD Off-Road', 'TRD Off Road'],
  yearStart: 2019,
  yearEnd: 2026,
  wheels: [{ diameter: 18, width: 7, offset: 35, axle: "square", isStock: true }],
  tires: ['225/60R18']
};

const rav4Gen5_Prime: TrimFitment = {
  trims: ['Prime', 'Prime SE', 'Prime XSE', 'Hybrid'],
  yearStart: 2021,
  yearEnd: 2026,
  wheels: [{ diameter: 18, width: 7, offset: 35, axle: "square", isStock: true }],
  tires: ['225/60R18']
};

// ===========================================
// Gen IV (2013-2018) - Fourth generation
// ===========================================

const rav4Gen4_LE: TrimFitment = {
  trims: ['LE', 'Base', 'LE FWD', 'LE AWD'],
  yearStart: 2013,
  yearEnd: 2018,
  wheels: [{ diameter: 17, width: 7, offset: 35, axle: "square", isStock: true }],
  tires: ['225/65R17']
};

const rav4Gen4_XLE: TrimFitment = {
  trims: ['XLE', 'XLE Premium', 'SE', 'Adventure'],
  yearStart: 2013,
  yearEnd: 2018,
  wheels: [{ diameter: 18, width: 7.5, offset: 35, axle: "square", isStock: true }],
  tires: ['235/55R18']
};

const rav4Gen4_Limited: TrimFitment = {
  trims: ['Limited', 'Platinum'],
  yearStart: 2013,
  yearEnd: 2018,
  wheels: [{ diameter: 18, width: 7.5, offset: 35, axle: "square", isStock: true }],
  tires: ['235/55R18']
};

// ===========================================
// Gen III (2006-2012) - Third generation
// ===========================================

const rav4Gen3_Base: TrimFitment = {
  trims: ['Base', '4-Cylinder', 'I4'],
  yearStart: 2006,
  yearEnd: 2012,
  wheels: [{ diameter: 16, width: 6.5, offset: 35, axle: "square", isStock: true }],
  tires: ['225/70R16']
};

const rav4Gen3_Sport: TrimFitment = {
  trims: ['Sport', 'V6', 'Limited'],
  yearStart: 2006,
  yearEnd: 2012,
  wheels: [{ diameter: 17, width: 7, offset: 35, axle: "square", isStock: true }],
  tires: ['235/55R17']
};

const rav4Gen3_Limited: TrimFitment = {
  trims: ['Limited V6'],
  yearStart: 2006,
  yearEnd: 2012,
  wheels: [{ diameter: 18, width: 7.5, offset: 35, axle: "square", isStock: true }],
  tires: ['235/55R18']
};

// ===========================================
// Gen II (2001-2005) - Second generation
// ===========================================

const rav4Gen2_Base: TrimFitment = {
  trims: ['Base', '4-Cylinder', '2WD', '4WD'],
  yearStart: 2001,
  yearEnd: 2005,
  wheels: [{ diameter: 16, width: 6.5, offset: 35, axle: "square", isStock: true }],
  tires: ['215/70R16']
};

const rav4Gen2_L: TrimFitment = {
  trims: ['L', 'Sport'],
  yearStart: 2001,
  yearEnd: 2005,
  wheels: [{ diameter: 17, width: 7, offset: 35, axle: "square", isStock: true }],
  tires: ['225/65R17']
};

// ===========================================
// Gen I (1996-2000) - First generation
// ===========================================

const rav4Gen1: TrimFitment = {
  trims: ['Base', '2-Door', '4-Door', 'L', 'Soft Top'],
  yearStart: 1996,
  yearEnd: 2000,
  wheels: [{ diameter: 16, width: 6, offset: 35, axle: "square", isStock: true }],
  tires: ['215/70R16'],
  boltPattern: '5x100'
};

// Build the fitment object
const rav4Fitment: ModelFitment = {
  make: 'Toyota',
  model: 'RAV4',
  boltPattern: '5x114.3',
  centerBore: 60.1,
  threadSize: null,
  trimFitments: [
    // Gen V (2019-2026)
    rav4Gen5_LE,
    rav4Gen5_XLE,
    rav4Gen5_XSE,
    rav4Gen5_Limited,
    rav4Gen5_Adventure,
    rav4Gen5_Prime,
    // Gen IV (2013-2018)
    rav4Gen4_LE,
    rav4Gen4_XLE,
    rav4Gen4_Limited,
    // Gen III (2006-2012)
    rav4Gen3_Base,
    rav4Gen3_Sport,
    rav4Gen3_Limited,
    // Gen II (2001-2005)
    rav4Gen2_Base,
    rav4Gen2_L,
    // Gen I (1996-2000)
    rav4Gen1
  ]
};

function normalizeTrim(trim: string): string {
  return trim.toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\bhybrid\b/gi, '')
    .replace(/\bawd\b/gi, '')
    .replace(/\bfwd\b/gi, '')
    .replace(/\b4wd\b/gi, '')
    .replace(/\b2wd\b/gi, '')
    .replace(/\bedition\b/gi, '')
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
  
  // Priority 2: Special handling for Prime/XSE
  if (/prime/i.test(normalized)) {
    for (const tf of yearMatches) {
      if (tf.trims.some(t => /prime/i.test(t))) return tf;
    }
  }
  if (/xse/i.test(normalized)) {
    for (const tf of yearMatches) {
      if (tf.trims.some(t => /xse/i.test(t))) return tf;
    }
  }
  if (/adventure|trdoff/i.test(normalized)) {
    for (const tf of yearMatches) {
      if (tf.trims.some(t => /adventure|trd\s*off/i.test(t))) return tf;
    }
  }
  
  // Priority 3: DB trim starts with fitment trim
  for (const tf of sorted) {
    for (const trim of tf.trims) {
      const nt = normalizeTrim(trim);
      if (normalized.startsWith(nt)) return tf;
    }
  }
  
  // Priority 4: Contains
  for (const tf of sorted) {
    for (const trim of tf.trims) {
      const nt = normalizeTrim(trim);
      if (nt.includes(normalized) || normalized.includes(nt)) return tf;
    }
  }
  
  // Priority 5: Fallback to LE (most common)
  for (const tf of yearMatches) {
    if (tf.trims.some(t => /^le$/i.test(t) || /base/i.test(t))) return tf;
  }
  
  return yearMatches[0] || null;
}

async function main() {
  const dryRun = !process.argv.includes('--apply');
  
  console.log(`Processing Toyota RAV4...`);
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'APPLYING CHANGES'}`);
  
  const fitment = rav4Fitment;
  
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
      AND (LOWER(model) = 'rav4' OR LOWER(model) = 'rav-4' OR LOWER(model) LIKE '%rav4%')
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
    
    // Use trim-specific bolt pattern if available
    const boltPattern = matchedFitment.boltPattern || fitment.boltPattern;
    
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
        boltPattern,
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
