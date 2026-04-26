/**
 * Process Toyota Corolla with trim-level fitment data
 * Bolt pattern: 5x100 (older) / 5x114.3 (2019+)
 */
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });

interface TrimFitment {
  trims: string[];
  yearStart: number;
  yearEnd: number;
  wheelDiameter: number;
  wheelWidth: number;
  tireSize: string;
  boltPattern: string;
  centerBore: number;
}

// 12th Gen (2019-2026) - new TNGA platform, 5x114.3
const corolla_2019_l: TrimFitment = { trims: ['L', 'LE', 'Base'], yearStart: 2019, yearEnd: 2026, wheelDiameter: 15, wheelWidth: 6.5, tireSize: '195/65R15', boltPattern: '5x114.3', centerBore: 60.1 };
const corolla_2019_se: TrimFitment = { trims: ['SE', 'SE Nightshade'], yearStart: 2019, yearEnd: 2026, wheelDiameter: 18, wheelWidth: 8, tireSize: '225/40R18', boltPattern: '5x114.3', centerBore: 60.1 };
const corolla_2019_xle: TrimFitment = { trims: ['XLE'], yearStart: 2019, yearEnd: 2026, wheelDiameter: 16, wheelWidth: 7, tireSize: '205/55R16', boltPattern: '5x114.3', centerBore: 60.1 };
const corolla_2019_xse: TrimFitment = { trims: ['XSE', 'Apex'], yearStart: 2019, yearEnd: 2026, wheelDiameter: 18, wheelWidth: 8, tireSize: '225/40R18', boltPattern: '5x114.3', centerBore: 60.1 };

// 11th Gen (2014-2018) - 5x100
const corolla_2014_l: TrimFitment = { trims: ['L', 'LE', 'LE Eco', 'Base'], yearStart: 2014, yearEnd: 2018, wheelDiameter: 15, wheelWidth: 6, tireSize: '195/65R15', boltPattern: '5x100', centerBore: 54.1 };
const corolla_2014_s: TrimFitment = { trims: ['S', 'S Plus', 'SE', 'XSE'], yearStart: 2014, yearEnd: 2018, wheelDiameter: 17, wheelWidth: 7, tireSize: '215/45R17', boltPattern: '5x100', centerBore: 54.1 };
const corolla_2014_xle: TrimFitment = { trims: ['XLE'], yearStart: 2014, yearEnd: 2018, wheelDiameter: 16, wheelWidth: 6.5, tireSize: '205/55R16', boltPattern: '5x100', centerBore: 54.1 };

// 10th Gen (2009-2013) - 5x100
const corolla_2009_base: TrimFitment = { trims: ['Base', 'LE', 'L'], yearStart: 2009, yearEnd: 2013, wheelDiameter: 15, wheelWidth: 6, tireSize: '195/65R15', boltPattern: '5x100', centerBore: 54.1 };
const corolla_2009_s: TrimFitment = { trims: ['S', 'XRS'], yearStart: 2009, yearEnd: 2013, wheelDiameter: 16, wheelWidth: 6.5, tireSize: '205/55R16', boltPattern: '5x100', centerBore: 54.1 };
const corolla_2009_xle: TrimFitment = { trims: ['XLE'], yearStart: 2009, yearEnd: 2013, wheelDiameter: 16, wheelWidth: 6.5, tireSize: '205/55R16', boltPattern: '5x100', centerBore: 54.1 };

// 9th Gen (2003-2008) - 5x100
const corolla_2003_ce: TrimFitment = { trims: ['CE', 'Base', 'LE'], yearStart: 2003, yearEnd: 2008, wheelDiameter: 15, wheelWidth: 6, tireSize: '195/65R15', boltPattern: '5x100', centerBore: 54.1 };
const corolla_2003_s: TrimFitment = { trims: ['S', 'XRS'], yearStart: 2003, yearEnd: 2008, wheelDiameter: 16, wheelWidth: 6.5, tireSize: '205/55R16', boltPattern: '5x100', centerBore: 54.1 };
const corolla_2003_xle: TrimFitment = { trims: ['XLE'], yearStart: 2003, yearEnd: 2008, wheelDiameter: 15, wheelWidth: 6, tireSize: '195/65R15', boltPattern: '5x100', centerBore: 54.1 };

// 8th Gen (1998-2002) - 5x100
const corolla_1998: TrimFitment = { trims: ['CE', 'LE', 'VE', 'S', 'Base'], yearStart: 1998, yearEnd: 2002, wheelDiameter: 14, wheelWidth: 5.5, tireSize: '185/65R14', boltPattern: '5x100', centerBore: 54.1 };

// Older gens - 4x100
const corolla_1993: TrimFitment = { trims: ['DX', 'LE', 'Base'], yearStart: 1993, yearEnd: 1997, wheelDiameter: 14, wheelWidth: 5.5, tireSize: '185/65R14', boltPattern: '4x100', centerBore: 54.1 };
const corolla_1988: TrimFitment = { trims: ['DX', 'LE', 'SR5', 'GTS', 'Base'], yearStart: 1984, yearEnd: 1992, wheelDiameter: 14, wheelWidth: 5.5, tireSize: '185/70R14', boltPattern: '4x100', centerBore: 54.1 };

const allFitments: TrimFitment[] = [
  corolla_2019_l, corolla_2019_se, corolla_2019_xle, corolla_2019_xse,
  corolla_2014_l, corolla_2014_s, corolla_2014_xle,
  corolla_2009_base, corolla_2009_s, corolla_2009_xle,
  corolla_2003_ce, corolla_2003_s, corolla_2003_xle,
  corolla_1998, corolla_1993, corolla_1988
];

function normalizeTrim(trim: string): string {
  return trim.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
}

function matchTrimToFitment(year: number, displayTrim: string): TrimFitment | null {
  const normalized = normalizeTrim(displayTrim);
  const yearMatches = allFitments.filter(tf => year >= tf.yearStart && year <= tf.yearEnd);
  if (yearMatches.length === 0) return null;

  for (const tf of yearMatches) {
    for (const trim of tf.trims) {
      if (normalizeTrim(trim) === normalized) return tf;
    }
  }
  for (const tf of yearMatches) {
    for (const trim of tf.trims) {
      const nt = normalizeTrim(trim);
      if (normalized.includes(nt) || nt.includes(normalized)) return tf;
    }
  }
  
  if (normalized.includes('xse') || normalized.includes('apex')) return yearMatches.find(tf => tf.trims.some(t => ['XSE', 'Apex'].includes(t))) || null;
  if (normalized.includes('xle')) return yearMatches.find(tf => tf.trims.some(t => t === 'XLE')) || null;
  if (normalized.includes('se') || normalized.includes('xrs')) return yearMatches.find(tf => tf.trims.some(t => ['SE', 'S', 'XRS'].includes(t))) || null;
  
  return yearMatches.find(tf => tf.trims.some(t => ['LE', 'L', 'Base', 'CE'].includes(t))) || yearMatches[0];
}

async function main() {
  const dryRun = !process.argv.includes('--apply');
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'APPLYING CHANGES'}`);
  
  const records = await pool.query(`
    SELECT id, year, make, model, display_trim
    FROM vehicle_fitments
    WHERE LOWER(make) = 'toyota' AND LOWER(model) IN ('corolla', 'corolla cross', 'corolla-cross')
    ORDER BY year, display_trim
  `);
  
  console.log(`Found ${records.rows.length} records`);
  
  let updated = 0, skipped = 0;
  
  for (const record of records.rows) {
    const fit = matchTrimToFitment(record.year, record.display_trim);
    if (!fit) { skipped++; continue; }
    
    const oemWheelSizes = [{ diameter: fit.wheelDiameter, width: fit.wheelWidth, offset: null, axle: 'square', isStock: true }];
    
    if (!dryRun) {
      await pool.query(`UPDATE vehicle_fitments SET oem_wheel_sizes = $1::jsonb, oem_tire_sizes = $2::jsonb, bolt_pattern = $3, center_bore_mm = $4, source = 'trim-research', quality_tier = 'complete', updated_at = NOW() WHERE id = $5`,
        [JSON.stringify(oemWheelSizes), JSON.stringify([fit.tireSize]), fit.boltPattern, fit.centerBore, record.id]);
    }
    updated++;
  }
  
  console.log(`✓ ${updated} updated, ⚠ ${skipped} skipped (${(updated/(updated+skipped)*100).toFixed(1)}%)`);
  await pool.end();
}

main().catch(console.error);
