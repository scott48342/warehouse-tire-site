/**
 * Process Ford Escape with trim-level fitment data
 * Bolt pattern: 5x108 (2020+), 5x114.3 (older)
 * Center bore: 63.4mm
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

// 2020-2026 (4th Gen - 5x108)
const escape_2020_s: TrimFitment = { trims: ['S', 'Base', 'Active'], yearStart: 2020, yearEnd: 2026, wheelDiameter: 17, wheelWidth: 7, tireSize: '225/65R17', boltPattern: '5x108' };
const escape_2020_se: TrimFitment = { trims: ['SE', 'Plug-in Hybrid', 'PHEV'], yearStart: 2020, yearEnd: 2026, wheelDiameter: 17, wheelWidth: 7, tireSize: '225/65R17', boltPattern: '5x108' };
const escape_2020_sel: TrimFitment = { trims: ['SEL', 'ST-Line', 'ST-Line Select'], yearStart: 2020, yearEnd: 2026, wheelDiameter: 18, wheelWidth: 7.5, tireSize: '225/60R18', boltPattern: '5x108' };
const escape_2020_titanium: TrimFitment = { trims: ['Titanium', 'ST-Line Elite', 'Platinum'], yearStart: 2020, yearEnd: 2026, wheelDiameter: 19, wheelWidth: 7.5, tireSize: '225/55R19', boltPattern: '5x108' };

// 2013-2019 (3rd Gen)
const escape_2013_s: TrimFitment = { trims: ['S', 'Base'], yearStart: 2013, yearEnd: 2019, wheelDiameter: 17, wheelWidth: 7.5, tireSize: '235/55R17' };
const escape_2013_se: TrimFitment = { trims: ['SE', 'SEL'], yearStart: 2013, yearEnd: 2019, wheelDiameter: 17, wheelWidth: 7.5, tireSize: '235/55R17' };
const escape_2013_titanium: TrimFitment = { trims: ['Titanium'], yearStart: 2013, yearEnd: 2019, wheelDiameter: 18, wheelWidth: 8, tireSize: '235/50R18' };
const escape_2013_titanium_19: TrimFitment = { trims: ['Titanium 19'], yearStart: 2013, yearEnd: 2019, wheelDiameter: 19, wheelWidth: 8, tireSize: '235/45R19' };

// 2008-2012 (2nd Gen)
const escape_2008_xls: TrimFitment = { trims: ['XLS', 'Base'], yearStart: 2008, yearEnd: 2012, wheelDiameter: 16, wheelWidth: 7, tireSize: '235/70R16' };
const escape_2008_xlt: TrimFitment = { trims: ['XLT', 'Hybrid'], yearStart: 2008, yearEnd: 2012, wheelDiameter: 16, wheelWidth: 7, tireSize: '235/70R16' };
const escape_2008_limited: TrimFitment = { trims: ['Limited'], yearStart: 2008, yearEnd: 2012, wheelDiameter: 17, wheelWidth: 7, tireSize: '225/65R17' };

// 2001-2007 (1st Gen)
const escape_2001: TrimFitment = { trims: ['XLS', 'XLT', 'Limited', 'Hybrid', 'Base'], yearStart: 2001, yearEnd: 2007, wheelDiameter: 15, wheelWidth: 6.5, tireSize: '225/70R15' };
const escape_2001_16: TrimFitment = { trims: ['XLT V6', 'Limited V6'], yearStart: 2001, yearEnd: 2007, wheelDiameter: 16, wheelWidth: 7, tireSize: '235/70R16' };

const allFitments: TrimFitment[] = [
  escape_2020_s, escape_2020_se, escape_2020_sel, escape_2020_titanium,
  escape_2013_s, escape_2013_se, escape_2013_titanium, escape_2013_titanium_19,
  escape_2008_xls, escape_2008_xlt, escape_2008_limited,
  escape_2001, escape_2001_16
];

const DEFAULT_BOLT_PATTERN = '5x114.3';
const CENTER_BORE = 63.4;

function normalizeTrim(trim: string): string {
  return trim.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
}

function matchTrimToFitment(year: number, displayTrim: string): TrimFitment | null {
  const normalized = normalizeTrim(displayTrim);
  const yearMatches = allFitments.filter(tf => year >= tf.yearStart && year <= tf.yearEnd);
  if (yearMatches.length === 0) return null;

  if (normalized.includes('titanium') || normalized.includes('platinum')) return yearMatches.find(tf => tf.trims.some(t => t.toLowerCase().includes('titanium'))) || null;
  if (normalized.includes('st-line elite')) return yearMatches.find(tf => tf.trims.some(t => t.toLowerCase().includes('st-line elite'))) || null;
  if (normalized.includes('st-line')) return yearMatches.find(tf => tf.trims.some(t => t.toLowerCase().includes('sel') || t.toLowerCase().includes('st-line'))) || null;
  if (normalized.includes('sel')) return yearMatches.find(tf => tf.trims.some(t => t === 'SEL' || t.toLowerCase().includes('sel'))) || null;
  if (normalized.includes('se') && !normalized.includes('sel')) return yearMatches.find(tf => tf.trims.some(t => t === 'SE')) || null;
  if (normalized.includes('limited')) return yearMatches.find(tf => tf.trims.some(t => t.toLowerCase().includes('limited'))) || null;
  if (normalized.includes('xlt')) return yearMatches.find(tf => tf.trims.some(t => t === 'XLT')) || null;
  if (normalized.includes('hybrid') || normalized.includes('phev') || normalized.includes('plug-in')) return yearMatches.find(tf => tf.trims.some(t => t.toLowerCase().includes('hybrid') || t.toLowerCase().includes('se'))) || null;
  
  return yearMatches.find(tf => tf.trims.some(t => ['S', 'Base', 'XLS'].includes(t))) || yearMatches[0];
}

async function main() {
  const dryRun = !process.argv.includes('--apply');
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'APPLYING CHANGES'}`);
  
  const records = await pool.query(`
    SELECT id, year, make, model, display_trim
    FROM vehicle_fitments
    WHERE LOWER(make) = 'ford' AND LOWER(model) = 'escape'
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
