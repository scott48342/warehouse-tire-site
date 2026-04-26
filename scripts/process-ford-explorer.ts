/**
 * Process Ford Explorer with trim-level fitment data
 * Bolt pattern: 5x114.3, Center bore: 63.4mm
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

// 2020-2026 (6th Gen)
const explorer_2020_base: TrimFitment = { trims: ['Base', 'Active'], yearStart: 2020, yearEnd: 2026, wheelDiameter: 18, wheelWidth: 8, tireSize: '255/65R18' };
const explorer_2020_xlt: TrimFitment = { trims: ['XLT'], yearStart: 2020, yearEnd: 2026, wheelDiameter: 18, wheelWidth: 8, tireSize: '255/65R18' };
const explorer_2020_limited: TrimFitment = { trims: ['Limited', 'King Ranch'], yearStart: 2020, yearEnd: 2026, wheelDiameter: 20, wheelWidth: 8.5, tireSize: '255/55R20' };
const explorer_2020_st: TrimFitment = { trims: ['ST', 'ST-Line'], yearStart: 2020, yearEnd: 2026, wheelDiameter: 20, wheelWidth: 8.5, tireSize: '255/55R20' };
const explorer_2020_platinum: TrimFitment = { trims: ['Platinum'], yearStart: 2020, yearEnd: 2026, wheelDiameter: 21, wheelWidth: 9, tireSize: '275/45R21' };
const explorer_2021_timberline: TrimFitment = { trims: ['Timberline', 'Tremor'], yearStart: 2021, yearEnd: 2026, wheelDiameter: 18, wheelWidth: 8, tireSize: '265/65R18' };

// 2011-2019 (5th Gen)
const explorer_2011_base: TrimFitment = { trims: ['Base'], yearStart: 2011, yearEnd: 2019, wheelDiameter: 17, wheelWidth: 7.5, tireSize: '245/65R17' };
const explorer_2011_xlt: TrimFitment = { trims: ['XLT'], yearStart: 2011, yearEnd: 2019, wheelDiameter: 18, wheelWidth: 8, tireSize: '245/60R18' };
const explorer_2011_limited: TrimFitment = { trims: ['Limited', 'Sport', 'Platinum'], yearStart: 2011, yearEnd: 2019, wheelDiameter: 20, wheelWidth: 8.5, tireSize: '255/50R20' };

// 2006-2010 (4th Gen)
const explorer_2006_xls: TrimFitment = { trims: ['XLS', 'XLT', 'Base'], yearStart: 2006, yearEnd: 2010, wheelDiameter: 16, wheelWidth: 7, tireSize: '235/70R16' };
const explorer_2006_eddie: TrimFitment = { trims: ['Eddie Bauer', 'Limited'], yearStart: 2006, yearEnd: 2010, wheelDiameter: 17, wheelWidth: 7.5, tireSize: '245/65R17' };
const explorer_2006_sport: TrimFitment = { trims: ['XLT Sport', 'Limited Sport'], yearStart: 2006, yearEnd: 2010, wheelDiameter: 20, wheelWidth: 8, tireSize: '255/50R20' };

// 2002-2005 (3rd Gen)
const explorer_2002_xls: TrimFitment = { trims: ['XLS', 'XLT', 'Base'], yearStart: 2002, yearEnd: 2005, wheelDiameter: 16, wheelWidth: 7, tireSize: '235/70R16' };
const explorer_2002_eddie: TrimFitment = { trims: ['Eddie Bauer', 'Limited'], yearStart: 2002, yearEnd: 2005, wheelDiameter: 17, wheelWidth: 7.5, tireSize: '245/65R17' };

// 1995-2001 (2nd Gen)
const explorer_1995: TrimFitment = { trims: ['XL', 'XLT', 'Eddie Bauer', 'Limited', 'Sport', 'Base'], yearStart: 1995, yearEnd: 2001, wheelDiameter: 15, wheelWidth: 7, tireSize: '235/75R15' };

// 1991-1994 (1st Gen)
const explorer_1991: TrimFitment = { trims: ['XL', 'XLT', 'Eddie Bauer', 'Sport', 'Base'], yearStart: 1991, yearEnd: 1994, wheelDiameter: 15, wheelWidth: 6.5, tireSize: '225/70R15' };

const allFitments: TrimFitment[] = [
  explorer_2020_base, explorer_2020_xlt, explorer_2020_limited, explorer_2020_st, explorer_2020_platinum, explorer_2021_timberline,
  explorer_2011_base, explorer_2011_xlt, explorer_2011_limited,
  explorer_2006_xls, explorer_2006_eddie, explorer_2006_sport,
  explorer_2002_xls, explorer_2002_eddie,
  explorer_1995, explorer_1991
];

const BOLT_PATTERN = '5x114.3';
const CENTER_BORE = 63.4;

function normalizeTrim(trim: string): string {
  return trim.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
}

function matchTrimToFitment(year: number, displayTrim: string): TrimFitment | null {
  const normalized = normalizeTrim(displayTrim);
  const yearMatches = allFitments.filter(tf => year >= tf.yearStart && year <= tf.yearEnd);
  if (yearMatches.length === 0) return null;

  if (normalized.includes('platinum')) return yearMatches.find(tf => tf.trims.some(t => t.toLowerCase().includes('platinum'))) || null;
  if (normalized.includes('timberline') || normalized.includes('tremor')) return yearMatches.find(tf => tf.trims.some(t => t.toLowerCase().includes('timberline'))) || null;
  if (normalized.includes('st') || normalized.includes('sport')) {
    const stMatch = yearMatches.find(tf => tf.trims.some(t => t === 'ST' || t === 'ST-Line'));
    return stMatch || yearMatches.find(tf => tf.trims.some(t => t.toLowerCase().includes('sport'))) || null;
  }
  if (normalized.includes('limited') || normalized.includes('king ranch')) return yearMatches.find(tf => tf.trims.some(t => t.toLowerCase().includes('limited'))) || null;
  if (normalized.includes('eddie bauer')) return yearMatches.find(tf => tf.trims.some(t => t.toLowerCase().includes('eddie'))) || null;
  if (normalized.includes('xlt')) return yearMatches.find(tf => tf.trims.some(t => t === 'XLT')) || null;
  if (normalized.includes('xls') || normalized.includes('xl')) return yearMatches.find(tf => tf.trims.some(t => ['XLS', 'XL', 'Base'].includes(t))) || null;
  
  // Fallback
  return yearMatches.find(tf => tf.trims.some(t => ['Base', 'XLT', 'XLS'].includes(t))) || yearMatches[0];
}

async function main() {
  const dryRun = !process.argv.includes('--apply');
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'APPLYING CHANGES'}`);
  
  const records = await pool.query(`
    SELECT id, year, make, model, display_trim
    FROM vehicle_fitments
    WHERE LOWER(make) = 'ford' AND LOWER(model) = 'explorer'
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
