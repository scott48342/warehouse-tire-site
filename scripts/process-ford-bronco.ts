/**
 * Process Ford Bronco with trim-level fitment data
 * Bolt pattern: 6x139.7 (full-size 2021+)
 * Center bore: 93.1mm
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

// 2021-2026 (6th Gen - Full-Size)
const bronco_2021_base: TrimFitment = { trims: ['Base', '2-door', '4-door'], yearStart: 2021, yearEnd: 2026, wheelDiameter: 16, wheelWidth: 7, tireSize: '255/70R16' };
const bronco_2021_bigbend: TrimFitment = { trims: ['Big Bend'], yearStart: 2021, yearEnd: 2026, wheelDiameter: 17, wheelWidth: 7.5, tireSize: '255/75R17' };
const bronco_2021_blackdiamond: TrimFitment = { trims: ['Black Diamond'], yearStart: 2021, yearEnd: 2026, wheelDiameter: 17, wheelWidth: 8, tireSize: '265/70R17' };
const bronco_2021_outerbanks: TrimFitment = { trims: ['Outer Banks'], yearStart: 2021, yearEnd: 2026, wheelDiameter: 18, wheelWidth: 8, tireSize: '255/70R18' };
const bronco_2021_badlands: TrimFitment = { trims: ['Badlands'], yearStart: 2021, yearEnd: 2026, wheelDiameter: 17, wheelWidth: 8, tireSize: '285/70R17' };
const bronco_2021_wildtrak: TrimFitment = { trims: ['Wildtrak', 'Sasquatch', 'Sasquatch Package', 'Heritage', 'Heritage Limited', 'Everglades'], yearStart: 2021, yearEnd: 2026, wheelDiameter: 17, wheelWidth: 8.5, tireSize: '315/70R17' };
const bronco_2021_raptor: TrimFitment = { trims: ['Raptor'], yearStart: 2022, yearEnd: 2026, wheelDiameter: 17, wheelWidth: 8.5, tireSize: '37X12.50R17' };

const allFitments: TrimFitment[] = [
  bronco_2021_base, bronco_2021_bigbend, bronco_2021_blackdiamond, bronco_2021_outerbanks,
  bronco_2021_badlands, bronco_2021_wildtrak, bronco_2021_raptor
];

const BOLT_PATTERN = '6x139.7';
const CENTER_BORE = 93.1;

function normalizeTrim(trim: string): string {
  return trim.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
}

function matchTrimToFitment(year: number, displayTrim: string): TrimFitment | null {
  const normalized = normalizeTrim(displayTrim);
  const yearMatches = allFitments.filter(tf => year >= tf.yearStart && year <= tf.yearEnd);
  if (yearMatches.length === 0) return null;

  if (normalized.includes('raptor')) return yearMatches.find(tf => tf.trims.some(t => t.toLowerCase().includes('raptor'))) || null;
  if (normalized.includes('wildtrak') || normalized.includes('sasquatch') || normalized.includes('heritage') || normalized.includes('everglades')) {
    return yearMatches.find(tf => tf.trims.some(t => t.toLowerCase().includes('wildtrak'))) || null;
  }
  if (normalized.includes('badlands')) return yearMatches.find(tf => tf.trims.some(t => t.toLowerCase().includes('badlands'))) || null;
  if (normalized.includes('outer banks')) return yearMatches.find(tf => tf.trims.some(t => t.toLowerCase().includes('outer'))) || null;
  if (normalized.includes('black diamond')) return yearMatches.find(tf => tf.trims.some(t => t.toLowerCase().includes('black diamond'))) || null;
  if (normalized.includes('big bend')) return yearMatches.find(tf => tf.trims.some(t => t.toLowerCase().includes('big bend'))) || null;
  
  return yearMatches.find(tf => tf.trims.some(t => t === 'Base')) || yearMatches[0];
}

async function main() {
  const dryRun = !process.argv.includes('--apply');
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'APPLYING CHANGES'}`);
  
  const records = await pool.query(`
    SELECT id, year, make, model, display_trim
    FROM vehicle_fitments
    WHERE LOWER(make) = 'ford' AND LOWER(model) = 'bronco'
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
