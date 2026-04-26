/**
 * Process Chevrolet Equinox with trim-level fitment data
 * Bolt pattern: 5x115 (2018+), 5x120 (2010-2017), 5x114.3 (older)
 * Center bore: 70.3mm
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
  boltPattern?: string;
}

// 2025-2026 (4th Gen)
const equinox_2025_activ: TrimFitment = { trims: ['ACTIV', 'Active'], yearStart: 2025, yearEnd: 2026, wheelDiameter: 17, wheelWidth: 7, tireSize: '235/65R17', boltPattern: '5x115' };
const equinox_2025_lt: TrimFitment = { trims: ['LT'], yearStart: 2025, yearEnd: 2026, wheelDiameter: 17, wheelWidth: 7, tireSize: '235/65R17', boltPattern: '5x115' };
const equinox_2025_rs: TrimFitment = { trims: ['RS'], yearStart: 2025, yearEnd: 2026, wheelDiameter: 19, wheelWidth: 8, tireSize: '235/55R19', boltPattern: '5x115' };

// 2018-2024 (3rd Gen)
const equinox_2018_l: TrimFitment = { trims: ['L', 'LS', 'Base'], yearStart: 2018, yearEnd: 2024, wheelDiameter: 17, wheelWidth: 7, tireSize: '225/65R17', boltPattern: '5x115' };
const equinox_2018_lt: TrimFitment = { trims: ['LT'], yearStart: 2018, yearEnd: 2024, wheelDiameter: 17, wheelWidth: 7, tireSize: '225/65R17', boltPattern: '5x115' };
const equinox_2018_premier: TrimFitment = { trims: ['Premier'], yearStart: 2018, yearEnd: 2024, wheelDiameter: 18, wheelWidth: 7, tireSize: '225/60R18', boltPattern: '5x115' };
const equinox_2018_rs: TrimFitment = { trims: ['RS', 'LT Redline'], yearStart: 2018, yearEnd: 2024, wheelDiameter: 19, wheelWidth: 7.5, tireSize: '235/50R19', boltPattern: '5x115' };

// 2010-2017 (2nd Gen)
const equinox_2010_ls: TrimFitment = { trims: ['LS', 'L', 'Base'], yearStart: 2010, yearEnd: 2017, wheelDiameter: 17, wheelWidth: 7, tireSize: '225/65R17', boltPattern: '5x120' };
const equinox_2010_lt: TrimFitment = { trims: ['LT', 'LTZ'], yearStart: 2010, yearEnd: 2017, wheelDiameter: 17, wheelWidth: 7, tireSize: '225/65R17', boltPattern: '5x120' };
const equinox_2010_premier: TrimFitment = { trims: ['Premier', 'LTZ 18'], yearStart: 2010, yearEnd: 2017, wheelDiameter: 18, wheelWidth: 7.5, tireSize: '235/55R18', boltPattern: '5x120' };

// 2005-2009 (1st Gen)
const equinox_2005_ls: TrimFitment = { trims: ['LS', 'Base'], yearStart: 2005, yearEnd: 2009, wheelDiameter: 16, wheelWidth: 6.5, tireSize: '235/65R16', boltPattern: '5x114.3' };
const equinox_2005_lt: TrimFitment = { trims: ['LT', 'LTZ'], yearStart: 2005, yearEnd: 2009, wheelDiameter: 17, wheelWidth: 7, tireSize: '235/60R17', boltPattern: '5x114.3' };
const equinox_2008_sport: TrimFitment = { trims: ['Sport'], yearStart: 2008, yearEnd: 2009, wheelDiameter: 18, wheelWidth: 7.5, tireSize: '235/50R18', boltPattern: '5x114.3' };

const allFitments: TrimFitment[] = [
  equinox_2025_activ, equinox_2025_lt, equinox_2025_rs,
  equinox_2018_l, equinox_2018_lt, equinox_2018_premier, equinox_2018_rs,
  equinox_2010_ls, equinox_2010_lt, equinox_2010_premier,
  equinox_2005_ls, equinox_2005_lt, equinox_2008_sport
];

const DEFAULT_BOLT_PATTERN = '5x115';
const CENTER_BORE = 70.3;

function normalizeTrim(trim: string): string {
  return trim.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
}

function matchTrimToFitment(year: number, displayTrim: string): TrimFitment | null {
  const normalized = normalizeTrim(displayTrim);
  const yearMatches = allFitments.filter(tf => year >= tf.yearStart && year <= tf.yearEnd);
  if (yearMatches.length === 0) return null;

  if (normalized.includes('rs') || normalized.includes('redline')) return yearMatches.find(tf => tf.trims.some(t => t === 'RS' || t.toLowerCase().includes('redline'))) || null;
  if (normalized.includes('premier')) return yearMatches.find(tf => tf.trims.some(t => t.toLowerCase().includes('premier'))) || null;
  if (normalized.includes('ltz')) return yearMatches.find(tf => tf.trims.some(t => t === 'LTZ' || t.toLowerCase().includes('ltz'))) || null;
  if (normalized.includes('sport')) return yearMatches.find(tf => tf.trims.some(t => t === 'Sport')) || null;
  if (normalized.includes('activ')) return yearMatches.find(tf => tf.trims.some(t => t.toLowerCase().includes('activ'))) || null;
  if (normalized.includes('lt') && !normalized.includes('ltz')) return yearMatches.find(tf => tf.trims.some(t => t === 'LT')) || null;
  
  return yearMatches.find(tf => tf.trims.some(t => ['LS', 'L', 'Base'].includes(t))) || yearMatches[0];
}

async function main() {
  const dryRun = !process.argv.includes('--apply');
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'APPLYING CHANGES'}`);
  
  const records = await pool.query(`
    SELECT id, year, make, model, display_trim
    FROM vehicle_fitments
    WHERE LOWER(make) = 'chevrolet' AND LOWER(model) = 'equinox'
    ORDER BY year, display_trim
  `);
  
  console.log(`Found ${records.rows.length} records`);
  
  let updated = 0, skipped = 0;
  const flagged: string[] = [];
  
  for (const record of records.rows) {
    const matchedFitment = matchTrimToFitment(record.year, record.display_trim);
    if (!matchedFitment) { flagged.push(`${record.year} ${record.display_trim}`); skipped++; continue; }
    
    const oemWheelSizes = [{ diameter: matchedFitment.wheelDiameter, width: matchedFitment.wheelWidth, offset: null, axle: 'square', isStock: true }];
    const boltPattern = matchedFitment.boltPattern || DEFAULT_BOLT_PATTERN;
    
    if (dryRun) {
      console.log(`  [DRY] ${record.year} ${record.display_trim} → ${matchedFitment.wheelDiameter}", ${matchedFitment.tireSize} (${boltPattern})`);
    } else {
      await pool.query(`UPDATE vehicle_fitments SET oem_wheel_sizes = $1::jsonb, oem_tire_sizes = $2::jsonb, bolt_pattern = $3, center_bore_mm = $4, source = 'trim-research', quality_tier = 'complete', updated_at = NOW() WHERE id = $5`,
        [JSON.stringify(oemWheelSizes), JSON.stringify([matchedFitment.tireSize]), boltPattern, CENTER_BORE, record.id]);
    }
    updated++;
  }
  
  console.log(`\n✓ ${updated} updated, ⚠ ${skipped} skipped (${(updated/(updated+skipped)*100).toFixed(1)}%)`);
  if (flagged.length > 0) console.log(`Flagged: ${flagged.slice(0, 5).join(', ')}${flagged.length > 5 ? '...' : ''}`);
  await pool.end();
}

main().catch(console.error);
