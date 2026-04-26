/**
 * Process Ford F-150 with trim-level fitment data
 * Bolt pattern: 6x135, Center bore: 87.1mm
 * Source: tiresize.com (2026-04-26)
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

// 2021-2026 (14th Gen)
const f150_2021_xl: TrimFitment = { trims: ['XL', 'Base', 'XL 2wd', 'XL 4wd'], yearStart: 2021, yearEnd: 2026, wheelDiameter: 17, wheelWidth: 7.5, tireSize: '265/70R17' };
const f150_2021_xlt: TrimFitment = { trims: ['XLT', 'XLT 2wd', 'XLT 4wd', 'STX'], yearStart: 2021, yearEnd: 2026, wheelDiameter: 18, wheelWidth: 8, tireSize: '265/60R18' };
const f150_2021_lariat: TrimFitment = { trims: ['Lariat', 'King Ranch', 'Platinum'], yearStart: 2021, yearEnd: 2026, wheelDiameter: 20, wheelWidth: 8.5, tireSize: '275/60R20' };
const f150_2021_limited: TrimFitment = { trims: ['Limited', 'Platinum 22'], yearStart: 2021, yearEnd: 2026, wheelDiameter: 22, wheelWidth: 9, tireSize: '275/50R22' };
const f150_2021_tremor: TrimFitment = { trims: ['Tremor'], yearStart: 2021, yearEnd: 2026, wheelDiameter: 18, wheelWidth: 8.5, tireSize: '275/70R18' };
const f150_2021_raptor: TrimFitment = { trims: ['Raptor', 'SVT Raptor'], yearStart: 2021, yearEnd: 2026, wheelDiameter: 17, wheelWidth: 8.5, tireSize: '315/70R17' };

// 2015-2020 (13th Gen)
const f150_2015_xl: TrimFitment = { trims: ['XL', 'Base', 'XL 2wd', 'XL 4wd'], yearStart: 2015, yearEnd: 2020, wheelDiameter: 17, wheelWidth: 7.5, tireSize: '265/70R17' };
const f150_2015_xlt: TrimFitment = { trims: ['XLT', 'STX', 'XLT 2wd', 'XLT 4wd'], yearStart: 2015, yearEnd: 2020, wheelDiameter: 18, wheelWidth: 8, tireSize: '275/65R18' };
const f150_2015_lariat: TrimFitment = { trims: ['Lariat', 'King Ranch', 'Platinum'], yearStart: 2015, yearEnd: 2020, wheelDiameter: 20, wheelWidth: 8.5, tireSize: '275/55R20' };
const f150_2015_limited: TrimFitment = { trims: ['Limited'], yearStart: 2015, yearEnd: 2020, wheelDiameter: 22, wheelWidth: 9, tireSize: '275/45R22' };
const f150_2015_raptor: TrimFitment = { trims: ['Raptor', 'SVT Raptor'], yearStart: 2017, yearEnd: 2020, wheelDiameter: 17, wheelWidth: 8.5, tireSize: '315/70R17' };

// 2009-2014 (12th Gen)
const f150_2009_xl: TrimFitment = { trims: ['XL', 'Base', 'XL 2wd', 'XL 4wd', 'Regular Cab'], yearStart: 2009, yearEnd: 2014, wheelDiameter: 17, wheelWidth: 7.5, tireSize: '245/70R17' };
const f150_2009_xlt: TrimFitment = { trims: ['XLT', 'STX', 'FX2', 'XLT 2wd', 'XLT 4wd'], yearStart: 2009, yearEnd: 2014, wheelDiameter: 18, wheelWidth: 7.5, tireSize: '275/65R18' };
const f150_2009_fx4: TrimFitment = { trims: ['FX4', 'FX4 4wd'], yearStart: 2009, yearEnd: 2014, wheelDiameter: 18, wheelWidth: 8, tireSize: '275/65R18' };
const f150_2009_lariat: TrimFitment = { trims: ['Lariat', 'King Ranch', 'Platinum'], yearStart: 2009, yearEnd: 2014, wheelDiameter: 20, wheelWidth: 8.5, tireSize: '275/55R20' };
const f150_2009_svt: TrimFitment = { trims: ['SVT Raptor', 'Raptor'], yearStart: 2010, yearEnd: 2014, wheelDiameter: 17, wheelWidth: 8.5, tireSize: '315/70R17' };

// 2004-2008 (11th Gen)
const f150_2004_xl: TrimFitment = { trims: ['XL', 'Base', 'STX'], yearStart: 2004, yearEnd: 2008, wheelDiameter: 17, wheelWidth: 7.5, tireSize: '245/70R17' };
const f150_2004_xlt: TrimFitment = { trims: ['XLT', 'FX4'], yearStart: 2004, yearEnd: 2008, wheelDiameter: 18, wheelWidth: 7.5, tireSize: '265/70R17' };
const f150_2004_lariat: TrimFitment = { trims: ['Lariat', 'King Ranch'], yearStart: 2004, yearEnd: 2008, wheelDiameter: 18, wheelWidth: 8, tireSize: '275/65R18' };
const f150_2004_hd: TrimFitment = { trims: ['Harley Davidson', 'Lightning'], yearStart: 2004, yearEnd: 2008, wheelDiameter: 20, wheelWidth: 8.5, tireSize: '295/50R20' };

// 1997-2003 (10th Gen)
const f150_1997: TrimFitment = { trims: ['XL', 'XLT', 'Lariat', 'Base', 'Lightning', 'Harley Davidson', 'King Ranch'], yearStart: 1997, yearEnd: 2003, wheelDiameter: 17, wheelWidth: 7.5, tireSize: '255/65R17' };

const allFitments: TrimFitment[] = [
  f150_2021_xl, f150_2021_xlt, f150_2021_lariat, f150_2021_limited, f150_2021_tremor, f150_2021_raptor,
  f150_2015_xl, f150_2015_xlt, f150_2015_lariat, f150_2015_limited, f150_2015_raptor,
  f150_2009_xl, f150_2009_xlt, f150_2009_fx4, f150_2009_lariat, f150_2009_svt,
  f150_2004_xl, f150_2004_xlt, f150_2004_lariat, f150_2004_hd,
  f150_1997
];

const BOLT_PATTERN = '6x135';
const CENTER_BORE = 87.1;

function normalizeTrim(trim: string): string {
  return trim.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
}

function matchTrimToFitment(year: number, displayTrim: string): TrimFitment | null {
  const normalized = normalizeTrim(displayTrim);
  const yearMatches = allFitments.filter(tf => year >= tf.yearStart && year <= tf.yearEnd);
  if (yearMatches.length === 0) return null;

  // Raptor/SVT priority
  if (normalized.includes('raptor') || normalized.includes('svt')) {
    return yearMatches.find(tf => tf.trims.some(t => t.toLowerCase().includes('raptor'))) || null;
  }
  // Tremor
  if (normalized.includes('tremor')) {
    return yearMatches.find(tf => tf.trims.some(t => t.toLowerCase().includes('tremor'))) || null;
  }
  // Limited
  if (normalized.includes('limited')) {
    return yearMatches.find(tf => tf.trims.some(t => t.toLowerCase().includes('limited'))) || null;
  }
  // Platinum/King Ranch
  if (normalized.includes('platinum') || normalized.includes('king ranch')) {
    return yearMatches.find(tf => tf.trims.some(t => ['Platinum', 'King Ranch', 'Lariat'].includes(t))) || null;
  }
  // Lariat
  if (normalized.includes('lariat')) {
    return yearMatches.find(tf => tf.trims.some(t => t.toLowerCase().includes('lariat'))) || null;
  }
  // FX4
  if (normalized.includes('fx4')) {
    return yearMatches.find(tf => tf.trims.some(t => t.toLowerCase().includes('fx4'))) || yearMatches.find(tf => tf.trims.includes('XLT')) || null;
  }
  // XLT/STX
  if (normalized.includes('xlt') || normalized.includes('stx')) {
    return yearMatches.find(tf => tf.trims.some(t => ['XLT', 'STX'].includes(t))) || null;
  }
  // XL/Base
  if (normalized.includes('xl') && !normalized.includes('xlt')) {
    return yearMatches.find(tf => tf.trims.some(t => ['XL', 'Base'].includes(t))) || null;
  }
  
  // Fallback to base
  return yearMatches.find(tf => tf.trims.some(t => ['XL', 'Base'].includes(t))) || yearMatches[0];
}

async function main() {
  const dryRun = !process.argv.includes('--apply');
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'APPLYING CHANGES'}`);
  
  const records = await pool.query(`
    SELECT id, year, make, model, display_trim
    FROM vehicle_fitments
    WHERE LOWER(make) = 'ford' AND LOWER(model) IN ('f-150', 'f150')
    ORDER BY year, display_trim
  `);
  
  console.log(`Found ${records.rows.length} records`);
  
  let updated = 0, skipped = 0;
  const flagged: string[] = [];
  
  for (const record of records.rows) {
    const matchedFitment = matchTrimToFitment(record.year, record.display_trim);
    if (!matchedFitment) { flagged.push(`${record.year} ${record.display_trim}`); skipped++; continue; }
    
    const oemWheelSizes = [{ diameter: matchedFitment.wheelDiameter, width: matchedFitment.wheelWidth, offset: null, axle: 'square', isStock: true }];
    
    if (dryRun) {
      console.log(`  [DRY] ${record.year} ${record.display_trim} → ${matchedFitment.wheelDiameter}", ${matchedFitment.tireSize}`);
    } else {
      await pool.query(`UPDATE vehicle_fitments SET oem_wheel_sizes = $1::jsonb, oem_tire_sizes = $2::jsonb, bolt_pattern = $3, center_bore_mm = $4, source = 'trim-research', quality_tier = 'complete', updated_at = NOW() WHERE id = $5`,
        [JSON.stringify(oemWheelSizes), JSON.stringify([matchedFitment.tireSize]), BOLT_PATTERN, CENTER_BORE, record.id]);
    }
    updated++;
  }
  
  console.log(`\n✓ ${updated} updated, ⚠ ${skipped} skipped (${(updated/(updated+skipped)*100).toFixed(1)}%)`);
  if (flagged.length > 0) console.log(`Flagged: ${flagged.slice(0, 5).join(', ')}${flagged.length > 5 ? '...' : ''}`);
  await pool.end();
}

main().catch(console.error);
