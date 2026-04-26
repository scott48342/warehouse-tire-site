/**
 * Process Chevrolet Silverado 1500 with trim-level fitment data
 * Bolt pattern: 6x139.7
 * Center bore: 78.1mm
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

// 2019-2026 (4th Gen - T1XX)
const silverado_2019_wt: TrimFitment = { trims: ['WT', 'Work Truck', 'Base'], yearStart: 2019, yearEnd: 2026, wheelDiameter: 17, wheelWidth: 7.5, tireSize: '255/70R17' };
const silverado_2019_custom: TrimFitment = { trims: ['Custom'], yearStart: 2019, yearEnd: 2026, wheelDiameter: 20, wheelWidth: 8.5, tireSize: '275/60R20' };
const silverado_2019_lt: TrimFitment = { trims: ['LT', 'RST'], yearStart: 2019, yearEnd: 2026, wheelDiameter: 18, wheelWidth: 8, tireSize: '265/65R18' };
const silverado_2019_ltz: TrimFitment = { trims: ['LTZ'], yearStart: 2019, yearEnd: 2026, wheelDiameter: 20, wheelWidth: 8.5, tireSize: '275/60R20' };
const silverado_2019_highcountry: TrimFitment = { trims: ['High Country'], yearStart: 2019, yearEnd: 2026, wheelDiameter: 22, wheelWidth: 9, tireSize: '275/50R22' };
const silverado_2019_trailboss: TrimFitment = { trims: ['Trail Boss', 'Custom Trail Boss', 'LT Trail Boss'], yearStart: 2019, yearEnd: 2026, wheelDiameter: 18, wheelWidth: 8.5, tireSize: '275/65R18' };
const silverado_2022_zr2: TrimFitment = { trims: ['ZR2'], yearStart: 2022, yearEnd: 2026, wheelDiameter: 18, wheelWidth: 8.5, tireSize: '275/70R18' };

// 2014-2018 (3rd Gen - K2XX)
const silverado_2014_wt: TrimFitment = { trims: ['WT', 'Work Truck', 'Base', 'LS'], yearStart: 2014, yearEnd: 2018, wheelDiameter: 17, wheelWidth: 7.5, tireSize: '265/70R17' };
const silverado_2014_lt: TrimFitment = { trims: ['LT', 'Custom'], yearStart: 2014, yearEnd: 2018, wheelDiameter: 17, wheelWidth: 7.5, tireSize: '265/70R17' };
const silverado_2014_ltz: TrimFitment = { trims: ['LTZ', 'Z71'], yearStart: 2014, yearEnd: 2018, wheelDiameter: 18, wheelWidth: 8, tireSize: '275/65R18' };
const silverado_2014_highcountry: TrimFitment = { trims: ['High Country'], yearStart: 2014, yearEnd: 2018, wheelDiameter: 22, wheelWidth: 9, tireSize: '285/45R22' };

// 2007-2013 (2nd Gen - GMT900)
const silverado_2007_wt: TrimFitment = { trims: ['WT', 'Base', 'LS', 'LT'], yearStart: 2007, yearEnd: 2013, wheelDiameter: 17, wheelWidth: 7.5, tireSize: '265/70R17' };
const silverado_2007_ltz: TrimFitment = { trims: ['LTZ', 'Z71'], yearStart: 2007, yearEnd: 2013, wheelDiameter: 18, wheelWidth: 8, tireSize: '265/65R18' };
const silverado_2007_20: TrimFitment = { trims: ['LTZ 20', 'High Country'], yearStart: 2007, yearEnd: 2013, wheelDiameter: 20, wheelWidth: 8.5, tireSize: '275/55R20' };

// 1999-2006 (1st Gen - GMT800)
const silverado_1999: TrimFitment = { trims: ['WT', 'LS', 'LT', 'Z71', 'Base', 'SS', 'HD'], yearStart: 1999, yearEnd: 2006, wheelDiameter: 16, wheelWidth: 7, tireSize: '265/75R16' };
const silverado_1999_17: TrimFitment = { trims: ['SS 17', 'LT 17'], yearStart: 1999, yearEnd: 2006, wheelDiameter: 17, wheelWidth: 7.5, tireSize: '265/70R17' };

const allFitments: TrimFitment[] = [
  silverado_2019_wt, silverado_2019_custom, silverado_2019_lt, silverado_2019_ltz, 
  silverado_2019_highcountry, silverado_2019_trailboss, silverado_2022_zr2,
  silverado_2014_wt, silverado_2014_lt, silverado_2014_ltz, silverado_2014_highcountry,
  silverado_2007_wt, silverado_2007_ltz, silverado_2007_20,
  silverado_1999, silverado_1999_17
];

const BOLT_PATTERN = '6x139.7';
const CENTER_BORE = 78.1;

function normalizeTrim(trim: string): string {
  return trim.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
}

function matchTrimToFitment(year: number, displayTrim: string): TrimFitment | null {
  const normalized = normalizeTrim(displayTrim);
  const yearMatches = allFitments.filter(tf => year >= tf.yearStart && year <= tf.yearEnd);
  if (yearMatches.length === 0) return null;

  if (normalized.includes('zr2')) return yearMatches.find(tf => tf.trims.some(t => t.toLowerCase().includes('zr2'))) || null;
  if (normalized.includes('trail boss')) return yearMatches.find(tf => tf.trims.some(t => t.toLowerCase().includes('trail boss'))) || null;
  if (normalized.includes('high country')) return yearMatches.find(tf => tf.trims.some(t => t.toLowerCase().includes('high country'))) || null;
  if (normalized.includes('ltz')) return yearMatches.find(tf => tf.trims.some(t => t === 'LTZ')) || null;
  if (normalized.includes('custom')) return yearMatches.find(tf => tf.trims.some(t => t === 'Custom')) || null;
  if (normalized.includes('rst')) return yearMatches.find(tf => tf.trims.some(t => t === 'RST')) || null;
  if (normalized.includes('lt') && !normalized.includes('ltz')) return yearMatches.find(tf => tf.trims.some(t => t === 'LT')) || null;
  if (normalized.includes('z71')) return yearMatches.find(tf => tf.trims.some(t => t.toLowerCase().includes('z71') || t === 'LTZ')) || null;
  if (normalized.includes('ls')) return yearMatches.find(tf => tf.trims.some(t => t === 'LS' || t === 'WT')) || null;
  
  return yearMatches.find(tf => tf.trims.some(t => ['WT', 'Base', 'Work Truck'].includes(t))) || yearMatches[0];
}

async function main() {
  const dryRun = !process.argv.includes('--apply');
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'APPLYING CHANGES'}`);
  
  const records = await pool.query(`
    SELECT id, year, make, model, display_trim
    FROM vehicle_fitments
    WHERE LOWER(make) = 'chevrolet' AND LOWER(model) IN ('silverado', 'silverado 1500')
    ORDER BY year, display_trim
  `);
  
  console.log(`Found ${records.rows.length} Silverado 1500 records`);
  
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
