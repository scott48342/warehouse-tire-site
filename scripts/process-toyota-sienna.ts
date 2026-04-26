/**
 * Process Toyota Sienna with trim-level fitment data
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

// Sienna Gen 4 (2021-2026)
const sienna_2021_2026_le: TrimFitment = {
  trims: ['L', 'LE', 'XLE'],
  yearStart: 2021,
  yearEnd: 2026,
  wheels: [{ diameter: 17, width: 7, offset: 40, axle: "square", isStock: true }],
  tires: ['235/65R17']
};

const sienna_2021_2026_xse_fwd: TrimFitment = {
  trims: ['XSE'],  // FWD gets 20"
  yearStart: 2021,
  yearEnd: 2026,
  wheels: [{ diameter: 20, width: 7.5, offset: 40, axle: "square", isStock: true }],
  tires: ['235/50R20']
};

const sienna_2021_2026_limited_fwd: TrimFitment = {
  trims: ['Limited', 'Platinum'],  // FWD gets 20"
  yearStart: 2021,
  yearEnd: 2026,
  wheels: [{ diameter: 20, width: 7.5, offset: 40, axle: "square", isStock: true }],
  tires: ['235/50R20']
};

const sienna_2021_2026_woodland: TrimFitment = {
  trims: ['Woodland', 'Woodland Edition', 'Woodlands', 'Woodlands Edition'],
  yearStart: 2021,
  yearEnd: 2026,
  wheels: [{ diameter: 18, width: 7.5, offset: 40, axle: "square", isStock: true }],
  tires: ['235/60R18']
};

const sienna_2021_2026_25th: TrimFitment = {
  trims: ['25th Anniversary', '25th Anniversary Edition'],
  yearStart: 2023,
  yearEnd: 2023,
  wheels: [{ diameter: 18, width: 7.5, offset: 40, axle: "square", isStock: true }],
  tires: ['235/60R18']
};

// Sienna Gen 3 Facelift (2018-2020)
const sienna_2018_2020_base: TrimFitment = {
  trims: ['L', 'LE', 'XLE'],
  yearStart: 2018,
  yearEnd: 2020,
  wheels: [{ diameter: 17, width: 7, offset: 35, axle: "square", isStock: true }],
  tires: ['235/60R17']
};

const sienna_2018_2020_se: TrimFitment = {
  trims: ['SE', 'SE Premium'],
  yearStart: 2018,
  yearEnd: 2020,
  wheels: [{ diameter: 19, width: 7, offset: 35, axle: "square", isStock: true }],
  tires: ['235/50R19']
};

const sienna_2018_2020_limited: TrimFitment = {
  trims: ['Limited', 'Limited Premium'],
  yearStart: 2018,
  yearEnd: 2020,
  wheels: [{ diameter: 18, width: 7, offset: 35, axle: "square", isStock: true }],
  tires: ['235/55R18']
};

// Sienna Gen 3 Pre-Facelift (2011-2017)
const sienna_2011_2017_base: TrimFitment = {
  trims: ['Base', 'L', 'LE'],
  yearStart: 2011,
  yearEnd: 2017,
  wheels: [{ diameter: 17, width: 7, offset: 35, axle: "square", isStock: true }],
  tires: ['235/60R17']
};

const sienna_2011_2017_xle: TrimFitment = {
  trims: ['XLE', 'XLE Premium'],
  yearStart: 2011,
  yearEnd: 2017,
  wheels: [{ diameter: 18, width: 7, offset: 35, axle: "square", isStock: true }],
  tires: ['235/55R18']
};

const sienna_2011_2017_se: TrimFitment = {
  trims: ['SE', 'SE Premium'],
  yearStart: 2011,
  yearEnd: 2017,
  wheels: [{ diameter: 19, width: 7, offset: 35, axle: "square", isStock: true }],
  tires: ['235/50R19']
};

const sienna_2011_2017_limited: TrimFitment = {
  trims: ['Limited', 'Limited Premium'],
  yearStart: 2011,
  yearEnd: 2017,
  wheels: [{ diameter: 18, width: 7, offset: 35, axle: "square", isStock: true }],
  tires: ['235/55R18']
};

// Sienna Gen 2 (2004-2010)
const sienna_2004_2010_base: TrimFitment = {
  trims: ['Base', 'CE', 'LE'],
  yearStart: 2004,
  yearEnd: 2010,
  wheels: [{ diameter: 16, width: 6.5, offset: 35, axle: "square", isStock: true }],
  tires: ['215/65R16']
};

const sienna_2004_2010_xle: TrimFitment = {
  trims: ['XLE', 'XLE Limited', 'Limited'],
  yearStart: 2004,
  yearEnd: 2010,
  wheels: [{ diameter: 17, width: 7, offset: 35, axle: "square", isStock: true }],
  tires: ['225/60R17']
};

// Sienna Gen 1 (1998-2003)
const sienna_1998_2003_base: TrimFitment = {
  trims: ['Base', 'CE', 'LE', 'XLE', 'Symphony'],
  yearStart: 1998,
  yearEnd: 2003,
  wheels: [{ diameter: 15, width: 6, offset: 35, axle: "square", isStock: true }],
  tires: ['205/70R15']
};

// Build the fitment object
const siennaFitment: ModelFitment = {
  make: 'Toyota',
  model: 'Sienna',
  boltPattern: '5x114.3',
  centerBore: 60.1,
  threadSize: 'M12x1.5',
  trimFitments: [
    sienna_2021_2026_le,
    sienna_2021_2026_xse_fwd,
    sienna_2021_2026_limited_fwd,
    sienna_2021_2026_woodland,
    sienna_2021_2026_25th,
    sienna_2018_2020_base,
    sienna_2018_2020_se,
    sienna_2018_2020_limited,
    sienna_2011_2017_base,
    sienna_2011_2017_xle,
    sienna_2011_2017_se,
    sienna_2011_2017_limited,
    sienna_2004_2010_base,
    sienna_2004_2010_xle,
    sienna_1998_2003_base
  ]
};

function normalizeTrim(trim: string): string {
  return trim.toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\bhybrid\b/gi, '')
    .replace(/\bawd\b/gi, '')
    .replace(/\bfwd\b/gi, '')
    .replace(/\b4matic\b/gi, '')
    .replace(/\bedition\b/gi, '')
    .replace(/\bnightshade\b/gi, '')
    .replace(/\bplus\b/gi, '')
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
  
  // Priority 3: Contains
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
      if ((normalized === 'base' && nt === 'l') || (normalized === 'l' && nt === 'base')) return tf;
      if ((normalized === 'ce' && nt === 'base') || (normalized === 'base' && nt === 'ce')) return tf;
    }
  }
  
  return null;
}

async function main() {
  const dryRun = !process.argv.includes('--apply');
  
  console.log(`Processing Toyota Sienna...`);
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'APPLYING CHANGES'}`);
  
  const fitment = siennaFitment;
  
  console.log(`\nFitment Data:`);
  console.log(`  Bolt: ${fitment.boltPattern || 'N/A'}`);
  console.log(`  Bore: ${fitment.centerBore || 'N/A'}mm`);
  console.log(`  Thread: ${fitment.threadSize || 'N/A'}`);
  console.log(`  Trim Fitments: ${fitment.trimFitments.length}`);
  
  for (const tf of fitment.trimFitments) {
    const wheelStr = tf.wheels.map(w => `${w.diameter}"`).join('/') || 'N/A';
    const tireStr = tf.tires.join(', ') || 'N/A';
    console.log(`    ${tf.yearStart}-${tf.yearEnd} [${tf.trims.join(', ')}]: ${wheelStr}, ${tireStr}`);
  }
  
  // Get records
  const records = await pool.query(`
    SELECT id, year, make, model, display_trim
    FROM vehicle_fitments
    WHERE LOWER(make) = 'toyota' 
      AND LOWER(model) = 'sienna'
      AND source = 'google-ai-overview'
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
  
  const matchRate = updated + skipped > 0 ? (updated / (updated + skipped) * 100).toFixed(1) : '0';
  console.log(`\nMatch Rate: ${matchRate}%`);
  
  await pool.end();
}

main().catch(console.error);
