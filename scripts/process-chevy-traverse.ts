/**
 * Process Chevrolet Traverse with trim-level fitment data
 * Bolt pattern: 6x120
 * Center bore: 67.1mm
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

// 2024-2026 (3rd Gen refresh)
const traverse_2024_ls: TrimFitment = { trims: ['LS', 'LT', 'Limited'], yearStart: 2024, yearEnd: 2026, wheelDiameter: 18, wheelWidth: 8, tireSize: '255/65R18' };
const traverse_2024_z71: TrimFitment = { trims: ['Z71'], yearStart: 2024, yearEnd: 2026, wheelDiameter: 18, wheelWidth: 8, tireSize: '265/65R18' };
const traverse_2024_rs: TrimFitment = { trims: ['RS', 'High Country'], yearStart: 2024, yearEnd: 2026, wheelDiameter: 22, wheelWidth: 9, tireSize: '275/45R22' };

// 2018-2023 (2nd Gen)
const traverse_2018_l: TrimFitment = { trims: ['L'], yearStart: 2018, yearEnd: 2023, wheelDiameter: 18, wheelWidth: 8, tireSize: '255/65R18' };
const traverse_2018_ls: TrimFitment = { trims: ['LS', 'LT'], yearStart: 2018, yearEnd: 2023, wheelDiameter: 18, wheelWidth: 8, tireSize: '255/65R18' };
const traverse_2018_rs: TrimFitment = { trims: ['RS', 'Premier', 'High Country'], yearStart: 2018, yearEnd: 2023, wheelDiameter: 20, wheelWidth: 8, tireSize: '255/55R20' };

// 2009-2017 (1st Gen)
const traverse_2009_ls: TrimFitment = { trims: ['LS', 'Base'], yearStart: 2009, yearEnd: 2017, wheelDiameter: 17, wheelWidth: 7.5, tireSize: '245/70R17' };
const traverse_2009_lt: TrimFitment = { trims: ['LT'], yearStart: 2009, yearEnd: 2017, wheelDiameter: 18, wheelWidth: 8, tireSize: '255/65R18' };
const traverse_2009_ltz: TrimFitment = { trims: ['LTZ', 'Premier'], yearStart: 2009, yearEnd: 2017, wheelDiameter: 20, wheelWidth: 8, tireSize: '255/55R20' };

const allFitments: TrimFitment[] = [
  traverse_2024_ls, traverse_2024_z71, traverse_2024_rs,
  traverse_2018_l, traverse_2018_ls, traverse_2018_rs,
  traverse_2009_ls, traverse_2009_lt, traverse_2009_ltz
];

const BOLT_PATTERN = '6x120';
const CENTER_BORE = 67.1;

function normalizeTrim(trim: string): string {
  return trim.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
}

function matchTrimToFitment(year: number, displayTrim: string): TrimFitment | null {
  const normalized = normalizeTrim(displayTrim);
  const yearMatches = allFitments.filter(tf => year >= tf.yearStart && year <= tf.yearEnd);
  if (yearMatches.length === 0) return null;

  if (normalized.includes('high country')) return yearMatches.find(tf => tf.trims.some(t => t.toLowerCase().includes('high country'))) || null;
  if (normalized.includes('rs')) return yearMatches.find(tf => tf.trims.some(t => t === 'RS')) || null;
  if (normalized.includes('premier')) return yearMatches.find(tf => tf.trims.some(t => t.toLowerCase().includes('premier'))) || null;
  if (normalized.includes('z71')) return yearMatches.find(tf => tf.trims.some(t => t === 'Z71')) || null;
  if (normalized.includes('ltz')) return yearMatches.find(tf => tf.trims.some(t => t === 'LTZ')) || null;
  if (normalized.includes('lt') && !normalized.includes('ltz')) return yearMatches.find(tf => tf.trims.some(t => t === 'LT')) || null;
  if (normalized.includes('limited')) return yearMatches.find(tf => tf.trims.some(t => t.toLowerCase().includes('limited'))) || null;
  
  return yearMatches.find(tf => tf.trims.some(t => ['LS', 'L', 'Base'].includes(t))) || yearMatches[0];
}

async function main() {
  const dryRun = !process.argv.includes('--apply');
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'APPLYING CHANGES'}`);
  
  const records = await pool.query(`
    SELECT id, year, make, model, display_trim
    FROM vehicle_fitments
    WHERE LOWER(make) = 'chevrolet' AND LOWER(model) = 'traverse'
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
