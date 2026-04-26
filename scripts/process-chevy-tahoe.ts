/**
 * Process Chevrolet Tahoe with trim-level fitment data
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

// 2021-2026 (5th Gen)
const tahoe_2021_ls: TrimFitment = { trims: ['LS', 'Base'], yearStart: 2021, yearEnd: 2026, wheelDiameter: 18, wheelWidth: 8, tireSize: '265/65R18' };
const tahoe_2021_lt: TrimFitment = { trims: ['LT'], yearStart: 2021, yearEnd: 2026, wheelDiameter: 18, wheelWidth: 8, tireSize: '265/65R18' };
const tahoe_2021_z71: TrimFitment = { trims: ['Z71'], yearStart: 2021, yearEnd: 2026, wheelDiameter: 20, wheelWidth: 9, tireSize: '275/60R20' };
const tahoe_2021_rst: TrimFitment = { trims: ['RST', 'Premier'], yearStart: 2021, yearEnd: 2026, wheelDiameter: 20, wheelWidth: 9, tireSize: '275/60R20' };
const tahoe_2021_highcountry: TrimFitment = { trims: ['High Country'], yearStart: 2021, yearEnd: 2026, wheelDiameter: 22, wheelWidth: 9, tireSize: '275/50R22' };

// 2015-2020 (4th Gen - K2XX)
const tahoe_2015_ls: TrimFitment = { trims: ['LS', 'Base'], yearStart: 2015, yearEnd: 2020, wheelDiameter: 18, wheelWidth: 8, tireSize: '265/65R18' };
const tahoe_2015_lt: TrimFitment = { trims: ['LT', 'LT Z71'], yearStart: 2015, yearEnd: 2020, wheelDiameter: 18, wheelWidth: 8, tireSize: '265/65R18' };
const tahoe_2015_ltz: TrimFitment = { trims: ['LTZ', 'Premier'], yearStart: 2015, yearEnd: 2020, wheelDiameter: 20, wheelWidth: 9, tireSize: '275/55R20' };
const tahoe_2015_22: TrimFitment = { trims: ['LTZ 22', 'Premier 22'], yearStart: 2015, yearEnd: 2020, wheelDiameter: 22, wheelWidth: 9, tireSize: '285/45R22' };

// 2007-2014 (3rd Gen - GMT900)
const tahoe_2007_ls: TrimFitment = { trims: ['LS', 'Base'], yearStart: 2007, yearEnd: 2014, wheelDiameter: 17, wheelWidth: 7.5, tireSize: '265/70R17' };
const tahoe_2007_lt: TrimFitment = { trims: ['LT', 'LT Z71'], yearStart: 2007, yearEnd: 2014, wheelDiameter: 17, wheelWidth: 7.5, tireSize: '265/70R17' };
const tahoe_2007_ltz: TrimFitment = { trims: ['LTZ', 'Hybrid'], yearStart: 2007, yearEnd: 2014, wheelDiameter: 20, wheelWidth: 8.5, tireSize: '275/55R20' };

// 2000-2006 (2nd Gen - GMT800)
const tahoe_2000: TrimFitment = { trims: ['LS', 'LT', 'Base', 'Z71'], yearStart: 2000, yearEnd: 2006, wheelDiameter: 16, wheelWidth: 7, tireSize: '265/70R16' };
const tahoe_2000_17: TrimFitment = { trims: ['LT 17', 'Z71 17'], yearStart: 2000, yearEnd: 2006, wheelDiameter: 17, wheelWidth: 7.5, tireSize: '265/70R17' };

// 1995-1999 (1st Gen)
const tahoe_1995: TrimFitment = { trims: ['Base', 'LS', 'LT', 'Z71', '2wd', '4wd'], yearStart: 1995, yearEnd: 1999, wheelDiameter: 15, wheelWidth: 7, tireSize: '235/75R15' };
const tahoe_1995_16: TrimFitment = { trims: ['4wd 16', 'Z71 16'], yearStart: 1995, yearEnd: 1999, wheelDiameter: 16, wheelWidth: 7, tireSize: '245/75R16' };

const allFitments: TrimFitment[] = [
  tahoe_2021_ls, tahoe_2021_lt, tahoe_2021_z71, tahoe_2021_rst, tahoe_2021_highcountry,
  tahoe_2015_ls, tahoe_2015_lt, tahoe_2015_ltz, tahoe_2015_22,
  tahoe_2007_ls, tahoe_2007_lt, tahoe_2007_ltz,
  tahoe_2000, tahoe_2000_17,
  tahoe_1995, tahoe_1995_16
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

  if (normalized.includes('high country')) return yearMatches.find(tf => tf.trims.some(t => t.toLowerCase().includes('high country'))) || null;
  if (normalized.includes('premier')) return yearMatches.find(tf => tf.trims.some(t => t.toLowerCase().includes('premier') || t === 'RST')) || null;
  if (normalized.includes('rst')) return yearMatches.find(tf => tf.trims.some(t => t === 'RST')) || null;
  if (normalized.includes('ltz')) return yearMatches.find(tf => tf.trims.some(t => t === 'LTZ')) || null;
  if (normalized.includes('z71')) return yearMatches.find(tf => tf.trims.some(t => t === 'Z71' || t.toLowerCase().includes('z71'))) || null;
  if (normalized.includes('lt') && !normalized.includes('ltz')) return yearMatches.find(tf => tf.trims.some(t => t === 'LT')) || null;
  if (normalized.includes('hybrid')) return yearMatches.find(tf => tf.trims.some(t => t.toLowerCase().includes('hybrid') || t === 'LTZ')) || null;
  
  return yearMatches.find(tf => tf.trims.some(t => ['LS', 'Base'].includes(t))) || yearMatches[0];
}

async function main() {
  const dryRun = !process.argv.includes('--apply');
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'APPLYING CHANGES'}`);
  
  const records = await pool.query(`
    SELECT id, year, make, model, display_trim
    FROM vehicle_fitments
    WHERE LOWER(make) = 'chevrolet' AND LOWER(model) = 'tahoe'
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
