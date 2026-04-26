/**
 * Process Toyota Highlander with AI Overview data
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

// Manually structured fitment data for Toyota Highlander
// Based on Google AI Overview research

const highlander2020_2026_base: TrimFitment = {
  trims: ['Base', 'L', 'LE', 'XLE'],
  yearStart: 2020,
  yearEnd: 2026,
  wheels: [{ diameter: 18, width: 8, offset: 35, axle: "square", isStock: true }],
  tires: ['235/65R18']
};

const highlander2020_2026_limited: TrimFitment = {
  trims: ['Limited', 'Platinum'],
  yearStart: 2020,
  yearEnd: 2026,
  wheels: [{ diameter: 20, width: 8, offset: 35, axle: "square", isStock: true }],
  tires: ['235/55R20']
};

const highlander2020_2026_xse: TrimFitment = {
  trims: ['XSE'],
  yearStart: 2020,
  yearEnd: 2026,
  wheels: [{ diameter: 20, width: 8.5, offset: 35, axle: "square", isStock: true }],
  tires: ['235/55R20']
};

const highlander2014_2019_base: TrimFitment = {
  trims: ['Base', 'L', 'LE', 'LE Plus', 'XLE'],
  yearStart: 2014,
  yearEnd: 2019,
  wheels: [{ diameter: 18, width: 7.5, offset: 40, axle: "square", isStock: true }],
  tires: ['245/60R18']
};

const highlander2014_2019_limited: TrimFitment = {
  trims: ['Limited', 'Limited Platinum', 'SE'],
  yearStart: 2014,
  yearEnd: 2019,
  wheels: [{ diameter: 19, width: 7.5, offset: 40, axle: "square", isStock: true }],
  tires: ['245/55R19']
};

const highlander2008_2013_base: TrimFitment = {
  trims: ['Base', 'L', 'LE', 'SE', 'Sport', 'Plus', 'SE'],
  yearStart: 2008,
  yearEnd: 2013,
  wheels: [{ diameter: 17, width: 7.5, offset: 35, axle: "square", isStock: true }],
  tires: ['245/65R17']
};

const highlander2008_2013_limited: TrimFitment = {
  trims: ['Limited'],
  yearStart: 2008,
  yearEnd: 2013,
  wheels: [{ diameter: 19, width: 7.5, offset: 35, axle: "square", isStock: true }],
  tires: ['245/55R19']
};

const highlander2001_2007_base: TrimFitment = {
  trims: ['Base', 'L', 'LE', 'Limited'],
  yearStart: 2001,
  yearEnd: 2007,
  wheels: [{ diameter: 16, width: 6.5, offset: 35, axle: "square", isStock: true }],
  tires: ['225/70R16']
};

const highlander2001_2007_v6: TrimFitment = {
  trims: ['Limited V6', 'V6', 'Sport'],
  yearStart: 2001,
  yearEnd: 2007,
  wheels: [{ diameter: 17, width: 7, offset: 35, axle: "square", isStock: true }],
  tires: ['225/65R17']
};

// Build the fitment object directly with our structured data
const highlanderFitment: ModelFitment = {
  make: 'Toyota',
  model: 'Highlander',
  boltPattern: '5x114.3',
  centerBore: 60.1,
  threadSize: null,
  trimFitments: [
    highlander2020_2026_base,
    highlander2020_2026_limited,
    highlander2020_2026_xse,
    highlander2014_2019_base,
    highlander2014_2019_limited,
    highlander2008_2013_base,
    highlander2008_2013_limited,
    highlander2001_2007_base,
    highlander2001_2007_v6
  ]
};

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
      if (nt === 'highertrims' && /limited|platinum|premium|touring/i.test(displayTrim)) return tf;
    }
  }
  
  return null;
}

async function main() {
  const dryRun = !process.argv.includes('--apply');
  
  console.log(`Processing Toyota Highlander...`);
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'APPLYING CHANGES'}`);
  
  const fitment = highlanderFitment;
  
  console.log(`\nFitment Data:`);
  console.log(`  Bolt: ${fitment.boltPattern || 'N/A'}`);
  console.log(`  Bore: ${fitment.centerBore || 'N/A'}mm`);
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
      AND LOWER(model) = 'highlander'
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
  
  const matchRate = (updated / (updated + skipped) * 100).toFixed(1);
  console.log(`\nMatch Rate: ${matchRate}%`);
  
  await pool.end();
}

main().catch(console.error);
