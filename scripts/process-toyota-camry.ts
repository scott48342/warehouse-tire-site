/**
 * Process Toyota Camry with trim-level fitment data
 * Bolt pattern: 5x114.3, Center bore: 60.1mm
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

// 9th Gen (XV80, 2025+)
const camry_2025_le: TrimFitment = { trims: ['LE', 'Base'], yearStart: 2025, yearEnd: 2026, wheelDiameter: 16, wheelWidth: 6.5, tireSize: '205/65R16' };
const camry_2025_se: TrimFitment = { trims: ['SE'], yearStart: 2025, yearEnd: 2026, wheelDiameter: 18, wheelWidth: 8, tireSize: '235/45R18' };
const camry_2025_xle: TrimFitment = { trims: ['XLE'], yearStart: 2025, yearEnd: 2026, wheelDiameter: 18, wheelWidth: 8, tireSize: '235/45R18' };
const camry_2025_xse: TrimFitment = { trims: ['XSE', 'TRD'], yearStart: 2025, yearEnd: 2026, wheelDiameter: 19, wheelWidth: 8, tireSize: '235/40R19' };

// 8th Gen (XV70, 2018-2024)
const camry_2018_le: TrimFitment = { trims: ['LE', 'L', 'Base'], yearStart: 2018, yearEnd: 2024, wheelDiameter: 17, wheelWidth: 7.5, tireSize: '215/55R17' };
const camry_2018_se: TrimFitment = { trims: ['SE'], yearStart: 2018, yearEnd: 2024, wheelDiameter: 18, wheelWidth: 8, tireSize: '235/45R18' };
const camry_2018_xle: TrimFitment = { trims: ['XLE'], yearStart: 2018, yearEnd: 2024, wheelDiameter: 18, wheelWidth: 8, tireSize: '235/45R18' };
const camry_2018_xse: TrimFitment = { trims: ['XSE', 'TRD'], yearStart: 2018, yearEnd: 2024, wheelDiameter: 19, wheelWidth: 8, tireSize: '235/40R19' };

// 7th Gen (XV50, 2012-2017)
const camry_2012_le: TrimFitment = { trims: ['LE', 'L', 'Base'], yearStart: 2012, yearEnd: 2017, wheelDiameter: 16, wheelWidth: 6.5, tireSize: '215/60R16' };
const camry_2012_se: TrimFitment = { trims: ['SE', 'SE Sport'], yearStart: 2012, yearEnd: 2017, wheelDiameter: 17, wheelWidth: 7, tireSize: '215/55R17' };
const camry_2012_xle: TrimFitment = { trims: ['XLE'], yearStart: 2012, yearEnd: 2017, wheelDiameter: 17, wheelWidth: 7, tireSize: '215/55R17' };
const camry_2012_xse: TrimFitment = { trims: ['XSE'], yearStart: 2015, yearEnd: 2017, wheelDiameter: 18, wheelWidth: 7.5, tireSize: '225/45R18' };

// 6th Gen (XV40, 2007-2011)
const camry_2007_le: TrimFitment = { trims: ['LE', 'Base', 'CE'], yearStart: 2007, yearEnd: 2011, wheelDiameter: 16, wheelWidth: 6.5, tireSize: '215/60R16' };
const camry_2007_se: TrimFitment = { trims: ['SE', 'SE V6'], yearStart: 2007, yearEnd: 2011, wheelDiameter: 17, wheelWidth: 7, tireSize: '215/55R17' };
const camry_2007_xle: TrimFitment = { trims: ['XLE'], yearStart: 2007, yearEnd: 2011, wheelDiameter: 17, wheelWidth: 7, tireSize: '215/55R17' };

// 5th Gen (XV30, 2002-2006)
const camry_2002_le: TrimFitment = { trims: ['LE', 'Base', 'CE', 'Standard'], yearStart: 2002, yearEnd: 2006, wheelDiameter: 15, wheelWidth: 6, tireSize: '205/65R15' };
const camry_2002_se: TrimFitment = { trims: ['SE', 'SE V6'], yearStart: 2002, yearEnd: 2006, wheelDiameter: 16, wheelWidth: 6.5, tireSize: '215/60R16' };
const camry_2002_xle: TrimFitment = { trims: ['XLE'], yearStart: 2002, yearEnd: 2006, wheelDiameter: 16, wheelWidth: 6.5, tireSize: '215/60R16' };

// 4th Gen (XV20, 1997-2001)
const camry_1997: TrimFitment = { trims: ['LE', 'CE', 'XLE', 'Base'], yearStart: 1997, yearEnd: 2001, wheelDiameter: 15, wheelWidth: 6, tireSize: '205/65R15' };

// 3rd Gen (XV10, 1992-1996)
const camry_1992: TrimFitment = { trims: ['LE', 'DX', 'XLE', 'SE', 'Base'], yearStart: 1992, yearEnd: 1996, wheelDiameter: 14, wheelWidth: 5.5, tireSize: '195/70R14' };

// Earlier gens
const camry_1987: TrimFitment = { trims: ['LE', 'DX', 'XLE', 'Base', 'Deluxe'], yearStart: 1983, yearEnd: 1991, wheelDiameter: 14, wheelWidth: 5.5, tireSize: '185/70R14' };

const allFitments: TrimFitment[] = [
  camry_2025_le, camry_2025_se, camry_2025_xle, camry_2025_xse,
  camry_2018_le, camry_2018_se, camry_2018_xle, camry_2018_xse,
  camry_2012_le, camry_2012_se, camry_2012_xle, camry_2012_xse,
  camry_2007_le, camry_2007_se, camry_2007_xle,
  camry_2002_le, camry_2002_se, camry_2002_xle,
  camry_1997, camry_1992, camry_1987
];

const BOLT_PATTERN = '5x114.3';
const CENTER_BORE = 60.1;

function normalizeTrim(trim: string): string {
  return trim.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
}

function matchTrimToFitment(year: number, displayTrim: string): TrimFitment | null {
  const normalized = normalizeTrim(displayTrim);
  const yearMatches = allFitments.filter(tf => year >= tf.yearStart && year <= tf.yearEnd);
  if (yearMatches.length === 0) return null;

  // Exact match
  for (const tf of yearMatches) {
    for (const trim of tf.trims) {
      if (normalizeTrim(trim) === normalized) return tf;
    }
  }
  // Contains match
  for (const tf of yearMatches) {
    for (const trim of tf.trims) {
      const nt = normalizeTrim(trim);
      if (normalized.includes(nt) || nt.includes(normalized)) return tf;
    }
  }
  // Keyword match
  if (normalized.includes('xse') || normalized.includes('trd')) return yearMatches.find(tf => tf.trims.some(t => ['XSE', 'TRD'].includes(t))) || null;
  if (normalized.includes('xle')) return yearMatches.find(tf => tf.trims.some(t => t === 'XLE')) || null;
  if (normalized.includes('se') && !normalized.includes('xse')) return yearMatches.find(tf => tf.trims.some(t => t === 'SE')) || null;
  
  // Fallback to base
  return yearMatches.find(tf => tf.trims.some(t => ['LE', 'Base', 'L'].includes(t))) || yearMatches[0];
}

async function main() {
  const dryRun = !process.argv.includes('--apply');
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'APPLYING CHANGES'}`);
  
  const records = await pool.query(`
    SELECT id, year, make, model, display_trim
    FROM vehicle_fitments
    WHERE LOWER(make) = 'toyota' AND LOWER(model) IN ('camry', 'camry hybrid')
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
