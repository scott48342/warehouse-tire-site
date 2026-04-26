/**
 * Process Toyota Tacoma with trim-level fitment data
 * Bolt pattern: 6x139.7 (6x5.5"), Center bore: 106.1mm
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

interface TrimFitment {
  trims: string[];
  yearStart: number;
  yearEnd: number;
  wheelDiameter: number;
  wheelWidth: number;
  tireSize: string;
}

// ==========================================
// 4TH GEN (2024-2026)
// ==========================================

const tacoma_2024_2026_sr: TrimFitment = {
  trims: ['SR', 'SR5', 'TRD PreRunner', 'PreRunner'],
  yearStart: 2024,
  yearEnd: 2026,
  wheelDiameter: 17,
  wheelWidth: 7,
  tireSize: '245/70R17'
};

const tacoma_2024_2026_trd: TrimFitment = {
  trims: ['TRD Off-Road', 'TRD Off Road', 'TRD Sport', 'TRD Pro'],
  yearStart: 2024,
  yearEnd: 2026,
  wheelDiameter: 18,
  wheelWidth: 7.5,
  tireSize: '265/70R18'
};

const tacoma_2024_2026_limited: TrimFitment = {
  trims: ['Limited', 'Trailhunter'],
  yearStart: 2024,
  yearEnd: 2026,
  wheelDiameter: 18,
  wheelWidth: 7.5,
  tireSize: '265/60R18'
};

// ==========================================
// 3RD GEN (2016-2023)
// ==========================================

const tacoma_2016_2023_sr: TrimFitment = {
  trims: ['SR', 'Base'],
  yearStart: 2016,
  yearEnd: 2023,
  wheelDiameter: 16,
  wheelWidth: 7,
  tireSize: '245/75R16'
};

const tacoma_2016_2023_sr5: TrimFitment = {
  trims: ['SR5'],
  yearStart: 2016,
  yearEnd: 2023,
  wheelDiameter: 16,
  wheelWidth: 7,
  tireSize: '265/70R16'
};

const tacoma_2016_2023_trd_offroad: TrimFitment = {
  trims: ['TRD Off-Road', 'TRD Off Road', 'TRD Pro'],
  yearStart: 2016,
  yearEnd: 2023,
  wheelDiameter: 16,
  wheelWidth: 7,
  tireSize: '265/75R16'
};

const tacoma_2016_2023_trd_sport: TrimFitment = {
  trims: ['TRD Sport'],
  yearStart: 2016,
  yearEnd: 2023,
  wheelDiameter: 17,
  wheelWidth: 7,
  tireSize: '265/65R17'
};

const tacoma_2016_2023_limited: TrimFitment = {
  trims: ['Limited'],
  yearStart: 2016,
  yearEnd: 2023,
  wheelDiameter: 18,
  wheelWidth: 7,
  tireSize: '265/60R18'
};

// ==========================================
// 2ND GEN (2005-2015)
// ==========================================

const tacoma_2005_2015_base: TrimFitment = {
  trims: ['Base', 'SR', 'Regular Cab', 'Access Cab'],
  yearStart: 2005,
  yearEnd: 2015,
  wheelDiameter: 16,
  wheelWidth: 7,
  tireSize: '245/75R16'
};

const tacoma_2005_2015_prerunner: TrimFitment = {
  trims: ['PreRunner', 'SR5', 'TRD Sport', 'TRD Off-Road', 'TRD Off Road'],
  yearStart: 2005,
  yearEnd: 2015,
  wheelDiameter: 17,
  wheelWidth: 7.5,
  tireSize: '265/65R17'
};

const tacoma_2005_2015_xrunner: TrimFitment = {
  trims: ['X-Runner', 'XRunner'],
  yearStart: 2005,
  yearEnd: 2015,
  wheelDiameter: 18,
  wheelWidth: 7.5,
  tireSize: '255/45R18'
};

// ==========================================
// 1ST GEN (1995-2004)
// ==========================================

const tacoma_1995_2004_base: TrimFitment = {
  trims: ['Base', 'DLX', 'SR5', 'Limited', 'PreRunner', 'S-Runner'],
  yearStart: 1995,
  yearEnd: 2004,
  wheelDiameter: 15,
  wheelWidth: 7,
  tireSize: '225/75R15'
};

const tacoma_1995_2004_trd: TrimFitment = {
  trims: ['TRD', 'TRD Off-Road'],
  yearStart: 1998,
  yearEnd: 2004,
  wheelDiameter: 16,
  wheelWidth: 7,
  tireSize: '265/70R16'
};

// ==========================================
// ALL FITMENTS
// ==========================================

const allFitments: TrimFitment[] = [
  // 4th gen
  tacoma_2024_2026_sr,
  tacoma_2024_2026_trd,
  tacoma_2024_2026_limited,
  // 3rd gen
  tacoma_2016_2023_sr,
  tacoma_2016_2023_sr5,
  tacoma_2016_2023_trd_offroad,
  tacoma_2016_2023_trd_sport,
  tacoma_2016_2023_limited,
  // 2nd gen
  tacoma_2005_2015_base,
  tacoma_2005_2015_prerunner,
  tacoma_2005_2015_xrunner,
  // 1st gen
  tacoma_1995_2004_base,
  tacoma_1995_2004_trd
];

const BOLT_PATTERN = '6x139.7';
const CENTER_BORE = 106.1;

function normalizeTrim(trim: string): string {
  return trim.toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function matchTrimToFitment(year: number, displayTrim: string): TrimFitment | null {
  const normalized = normalizeTrim(displayTrim);
  
  // Filter by year first
  const yearMatches = allFitments.filter(
    tf => year >= tf.yearStart && year <= tf.yearEnd
  );
  
  if (yearMatches.length === 0) return null;
  
  // Priority 1: Exact match
  for (const tf of yearMatches) {
    for (const trim of tf.trims) {
      if (normalizeTrim(trim) === normalized) return tf;
    }
  }
  
  // Priority 2: Contains match (longer patterns first)
  const sorted = [...yearMatches].sort((a, b) => {
    const aMax = Math.max(...a.trims.map(t => t.length));
    const bMax = Math.max(...b.trims.map(t => t.length));
    return bMax - aMax;
  });
  
  for (const tf of sorted) {
    for (const trim of tf.trims) {
      const nt = normalizeTrim(trim);
      if (normalized.includes(nt) || nt.includes(normalized)) return tf;
    }
  }
  
  // Priority 3: Keyword matching
  if (normalized.includes('limited')) {
    return yearMatches.find(tf => tf.trims.some(t => t.toLowerCase().includes('limited'))) || null;
  }
  if (normalized.includes('trd pro') || normalized.includes('trdpro')) {
    return yearMatches.find(tf => tf.trims.some(t => t.toLowerCase().includes('trd'))) || null;
  }
  if (normalized.includes('trd off') || normalized.includes('offroad')) {
    return yearMatches.find(tf => tf.trims.some(t => t.toLowerCase().includes('off-road') || t.toLowerCase().includes('off road'))) || null;
  }
  if (normalized.includes('trd sport')) {
    return yearMatches.find(tf => tf.trims.some(t => t.toLowerCase().includes('sport'))) || null;
  }
  if (normalized.includes('sr5')) {
    return yearMatches.find(tf => tf.trims.some(t => t === 'SR5')) || null;
  }
  if (normalized.includes('prerunner') || normalized.includes('pre runner')) {
    return yearMatches.find(tf => tf.trims.some(t => t.toLowerCase().includes('prerunner'))) || null;
  }
  
  // Fallback: return base trim for year
  return yearMatches.find(tf => tf.trims.some(t => ['Base', 'SR', 'DLX'].includes(t))) || yearMatches[0];
}

async function main() {
  const dryRun = !process.argv.includes('--apply');
  
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'APPLYING CHANGES'}`);
  console.log(`\nToyota Tacoma Specs:`);
  console.log(`  Bolt Pattern: ${BOLT_PATTERN}`);
  console.log(`  Center Bore: ${CENTER_BORE}mm`);
  
  const records = await pool.query(`
    SELECT id, year, make, model, display_trim
    FROM vehicle_fitments
    WHERE LOWER(make) = 'toyota'
      AND LOWER(model) = 'tacoma'
    ORDER BY year, display_trim
  `);
  
  console.log(`\nFound ${records.rows.length} records`);
  
  let updated = 0;
  let skipped = 0;
  const flagged: string[] = [];
  
  for (const record of records.rows) {
    const matchedFitment = matchTrimToFitment(record.year, record.display_trim);
    
    if (!matchedFitment) {
      flagged.push(`${record.year} ${record.display_trim}`);
      skipped++;
      continue;
    }
    
    const oemWheelSizes = [{
      diameter: matchedFitment.wheelDiameter,
      width: matchedFitment.wheelWidth,
      offset: null,
      axle: 'square',
      isStock: true
    }];
    
    if (dryRun) {
      console.log(`  [DRY] ${record.year} ${record.display_trim} → ${matchedFitment.wheelDiameter}", ${matchedFitment.tireSize}`);
    } else {
      await pool.query(`
        UPDATE vehicle_fitments
        SET 
          oem_wheel_sizes = $1::jsonb,
          oem_tire_sizes = $2::jsonb,
          bolt_pattern = $3,
          center_bore_mm = $4,
          source = 'trim-research',
          quality_tier = 'complete',
          updated_at = NOW()
        WHERE id = $5
      `, [
        JSON.stringify(oemWheelSizes),
        JSON.stringify([matchedFitment.tireSize]),
        BOLT_PATTERN,
        CENTER_BORE,
        record.id
      ]);
    }
    
    updated++;
  }
  
  console.log(`\n========================================`);
  console.log(`✓ ${updated} updated, ⚠ ${skipped} skipped`);
  console.log(`Match Rate: ${records.rows.length > 0 ? (updated / records.rows.length * 100).toFixed(1) : 0}%`);
  
  if (flagged.length > 0) {
    console.log(`\nFlagged (${flagged.length}):`);
    flagged.slice(0, 10).forEach(f => console.log(`  - ${f}`));
    if (flagged.length > 10) console.log(`  ... and ${flagged.length - 10} more`);
  }
  
  await pool.end();
}

main().catch(console.error);
