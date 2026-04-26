/**
 * Process Chevrolet Camaro with trim-level fitment data
 * Bolt pattern: 5x120
 * Center bore: 67.1mm
 * NOTE: SS, ZL1, Z/28 trims are STAGGERED (different front/rear)
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
  rearWheelWidth?: number;
  rearTireSize?: string;
  isStaggered?: boolean;
}

// 2019-2024 (6th Gen refresh)
const camaro_2019_ls: TrimFitment = { trims: ['LS'], yearStart: 2019, yearEnd: 2024, wheelDiameter: 18, wheelWidth: 8, tireSize: '245/50R18' };
const camaro_2019_lt: TrimFitment = { trims: ['LT', 'LT1', 'LT RS'], yearStart: 2019, yearEnd: 2024, wheelDiameter: 20, wheelWidth: 8.5, tireSize: '245/40R20' };
const camaro_2019_ss: TrimFitment = { trims: ['SS', 'SS RS'], yearStart: 2019, yearEnd: 2024, wheelDiameter: 20, wheelWidth: 8.5, tireSize: '245/40R20', rearWheelWidth: 9.5, rearTireSize: '275/35R20', isStaggered: true };
const camaro_2019_ss_1le: TrimFitment = { trims: ['SS 1LE', 'SS 1LE Track'], yearStart: 2019, yearEnd: 2024, wheelDiameter: 20, wheelWidth: 10, tireSize: '285/30R20', rearWheelWidth: 11, rearTireSize: '305/30R20', isStaggered: true };
const camaro_2019_zl1: TrimFitment = { trims: ['ZL1'], yearStart: 2019, yearEnd: 2024, wheelDiameter: 20, wheelWidth: 10, tireSize: '285/30R20', rearWheelWidth: 11, rearTireSize: '305/30R20', isStaggered: true };
const camaro_2019_zl1_1le: TrimFitment = { trims: ['ZL1 1LE', 'ZL1 1LE Extreme'], yearStart: 2019, yearEnd: 2024, wheelDiameter: 19, wheelWidth: 11, tireSize: '305/30R19', rearWheelWidth: 11.5, rearTireSize: '325/30R19', isStaggered: true };

// 2016-2018 (6th Gen original)
const camaro_2016_lt: TrimFitment = { trims: ['LT', 'LS', '1LT', '2LT'], yearStart: 2016, yearEnd: 2018, wheelDiameter: 18, wheelWidth: 8, tireSize: '245/50R18' };
const camaro_2016_ss: TrimFitment = { trims: ['SS', '1SS', '2SS'], yearStart: 2016, yearEnd: 2018, wheelDiameter: 20, wheelWidth: 8.5, tireSize: '245/40R20', rearWheelWidth: 9.5, rearTireSize: '275/35R20', isStaggered: true };
const camaro_2017_zl1: TrimFitment = { trims: ['ZL1'], yearStart: 2017, yearEnd: 2018, wheelDiameter: 20, wheelWidth: 10, tireSize: '285/30R20', rearWheelWidth: 11, rearTireSize: '305/30R20', isStaggered: true };

// 2010-2015 (5th Gen)
const camaro_2010_ls: TrimFitment = { trims: ['LS', 'LT', '1LT', '2LT'], yearStart: 2010, yearEnd: 2015, wheelDiameter: 18, wheelWidth: 8, tireSize: '245/55R18' };
const camaro_2010_lt_rs: TrimFitment = { trims: ['LT RS', 'RS'], yearStart: 2010, yearEnd: 2015, wheelDiameter: 20, wheelWidth: 8, tireSize: '245/45R20', rearWheelWidth: 9, rearTireSize: '275/40R20', isStaggered: true };
const camaro_2010_ss: TrimFitment = { trims: ['SS', 'SS RS'], yearStart: 2010, yearEnd: 2015, wheelDiameter: 20, wheelWidth: 8, tireSize: '245/45R20', rearWheelWidth: 9, rearTireSize: '275/40R20', isStaggered: true };
const camaro_2012_zl1: TrimFitment = { trims: ['ZL1'], yearStart: 2012, yearEnd: 2015, wheelDiameter: 20, wheelWidth: 10, tireSize: '285/35R20', rearWheelWidth: 11, rearTireSize: '305/35R20', isStaggered: true };
const camaro_2014_z28: TrimFitment = { trims: ['Z/28', 'Z28'], yearStart: 2014, yearEnd: 2015, wheelDiameter: 19, wheelWidth: 11, tireSize: '305/30R19', isStaggered: false }; // Square setup

// 1993-2002 (4th Gen)
const camaro_1993_base: TrimFitment = { trims: ['Base', 'RS', 'Sport'], yearStart: 1993, yearEnd: 2002, wheelDiameter: 16, wheelWidth: 7.5, tireSize: '235/55R16' };
const camaro_1993_z28: TrimFitment = { trims: ['Z28'], yearStart: 1993, yearEnd: 2002, wheelDiameter: 16, wheelWidth: 8, tireSize: '245/50R16' };
const camaro_1998_ss: TrimFitment = { trims: ['SS'], yearStart: 1998, yearEnd: 2002, wheelDiameter: 17, wheelWidth: 9, tireSize: '275/40R17' };

const allFitments: TrimFitment[] = [
  camaro_2019_ls, camaro_2019_lt, camaro_2019_ss, camaro_2019_ss_1le, camaro_2019_zl1, camaro_2019_zl1_1le,
  camaro_2016_lt, camaro_2016_ss, camaro_2017_zl1,
  camaro_2010_ls, camaro_2010_lt_rs, camaro_2010_ss, camaro_2012_zl1, camaro_2014_z28,
  camaro_1993_base, camaro_1993_z28, camaro_1998_ss
];

const BOLT_PATTERN = '5x120';
const CENTER_BORE = 67.1;

function normalizeTrim(trim: string): string {
  return trim.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
}

function matchTrimToFitment(year: number, displayTrim: string): TrimFitment | null {
  const normalized = normalizeTrim(displayTrim);
  const yearMatches = allFitments.filter(tf => year >= tf.yearStart && year <= tf.yearEnd);
  if (yearMatches.length === 0) return null;

  if (normalized.includes('zl1 1le') || normalized.includes('zl1 extreme')) return yearMatches.find(tf => tf.trims.some(t => t.toLowerCase().includes('zl1 1le'))) || null;
  if (normalized.includes('zl1')) return yearMatches.find(tf => tf.trims.some(t => t === 'ZL1')) || null;
  if (normalized.includes('z28') || normalized.includes('z 28')) return yearMatches.find(tf => tf.trims.some(t => t.toLowerCase().includes('z28') || t.toLowerCase().includes('z/28'))) || null;
  if (normalized.includes('ss 1le') || normalized.includes('1le')) return yearMatches.find(tf => tf.trims.some(t => t.toLowerCase().includes('ss 1le'))) || null;
  if (normalized.includes('ss') && !normalized.includes('1ss') && !normalized.includes('2ss')) return yearMatches.find(tf => tf.trims.some(t => t === 'SS' || t.startsWith('SS'))) || null;
  if (normalized.includes('1ss') || normalized.includes('2ss')) return yearMatches.find(tf => tf.trims.some(t => t.toLowerCase().includes('ss'))) || null;
  if (normalized.includes('lt rs') || normalized.includes('rs')) return yearMatches.find(tf => tf.trims.some(t => t.toLowerCase().includes('rs'))) || null;
  if (normalized.includes('lt1')) return yearMatches.find(tf => tf.trims.some(t => t === 'LT1')) || null;
  if (normalized.includes('lt') && !normalized.includes('lt1')) return yearMatches.find(tf => tf.trims.some(t => t === 'LT' || t.includes('LT'))) || null;
  
  return yearMatches.find(tf => tf.trims.some(t => ['LS', 'Base', 'LT'].includes(t))) || yearMatches[0];
}

async function main() {
  const dryRun = !process.argv.includes('--apply');
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'APPLYING CHANGES'}`);
  
  const records = await pool.query(`
    SELECT id, year, make, model, display_trim
    FROM vehicle_fitments
    WHERE LOWER(make) = 'chevrolet' AND LOWER(model) = 'camaro'
    ORDER BY year, display_trim
  `);
  
  console.log(`Found ${records.rows.length} records`);
  
  let updated = 0, skipped = 0, staggered = 0;
  const flagged: string[] = [];
  
  for (const record of records.rows) {
    const matchedFitment = matchTrimToFitment(record.year, record.display_trim);
    if (!matchedFitment) { flagged.push(`${record.year} ${record.display_trim}`); skipped++; continue; }
    
    let oemWheelSizes;
    let oemTireSizes;
    
    if (matchedFitment.isStaggered && matchedFitment.rearWheelWidth && matchedFitment.rearTireSize) {
      oemWheelSizes = [
        { diameter: matchedFitment.wheelDiameter, width: matchedFitment.wheelWidth, offset: null, axle: 'front', isStock: true },
        { diameter: matchedFitment.wheelDiameter, width: matchedFitment.rearWheelWidth, offset: null, axle: 'rear', isStock: true }
      ];
      oemTireSizes = [matchedFitment.tireSize, matchedFitment.rearTireSize];
      staggered++;
    } else {
      oemWheelSizes = [{ diameter: matchedFitment.wheelDiameter, width: matchedFitment.wheelWidth, offset: null, axle: 'square', isStock: true }];
      oemTireSizes = [matchedFitment.tireSize];
    }
    
    if (dryRun) {
      if (matchedFitment.isStaggered) {
        console.log(`  [DRY] ${record.year} ${record.display_trim} → ${matchedFitment.wheelDiameter}" STAGGERED (F:${matchedFitment.tireSize} R:${matchedFitment.rearTireSize})`);
      } else {
        console.log(`  [DRY] ${record.year} ${record.display_trim} → ${matchedFitment.wheelDiameter}", ${matchedFitment.tireSize}`);
      }
    } else {
      await pool.query(`UPDATE vehicle_fitments SET oem_wheel_sizes = $1::jsonb, oem_tire_sizes = $2::jsonb, bolt_pattern = $3, center_bore_mm = $4, source = 'trim-research', quality_tier = 'complete', updated_at = NOW() WHERE id = $5`,
        [JSON.stringify(oemWheelSizes), JSON.stringify(oemTireSizes), BOLT_PATTERN, CENTER_BORE, record.id]);
    }
    updated++;
  }
  
  console.log(`\n✓ ${updated} updated (${staggered} staggered), ⚠ ${skipped} skipped (${(updated/(updated+skipped)*100).toFixed(1)}%)`);
  if (flagged.length > 0) console.log(`Flagged: ${flagged.slice(0, 5).join(', ')}${flagged.length > 5 ? '...' : ''}`);
  await pool.end();
}

main().catch(console.error);
