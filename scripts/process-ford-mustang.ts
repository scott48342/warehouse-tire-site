/**
 * Process Ford Mustang with trim-level fitment data
 * Bolt pattern: 5x114.3, Center bore: 70.5mm
 * NOTE: Many trims are STAGGERED (different front/rear)
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

// 2024-2026 (S650, 7th Gen)
const mustang_2024_eco: TrimFitment = { trims: ['EcoBoost', 'EcoBoost Premium', 'Base'], yearStart: 2024, yearEnd: 2026, wheelDiameter: 18, wheelWidth: 8, tireSize: '235/50R18' };
const mustang_2024_gt: TrimFitment = { trims: ['GT', 'GT Premium'], yearStart: 2024, yearEnd: 2026, wheelDiameter: 18, wheelWidth: 8, tireSize: '255/45R18' };
const mustang_2024_gt_perf: TrimFitment = { trims: ['GT Performance Package', 'GT Performance', 'Brembo'], yearStart: 2024, yearEnd: 2026, wheelDiameter: 19, wheelWidth: 9, tireSize: '255/40R19', rearWheelWidth: 9.5, rearTireSize: '275/40R19', isStaggered: true };
const mustang_2024_darkhorse: TrimFitment = { trims: ['Dark Horse', 'Dark Horse Premium'], yearStart: 2024, yearEnd: 2026, wheelDiameter: 19, wheelWidth: 9.5, tireSize: '255/40R19', rearWheelWidth: 10, rearTireSize: '275/40R19', isStaggered: true };
const mustang_2024_darkhorse_hp: TrimFitment = { trims: ['Dark Horse Handling Package'], yearStart: 2024, yearEnd: 2026, wheelDiameter: 19, wheelWidth: 10.5, tireSize: '305/30R19', rearWheelWidth: 11, rearTireSize: '315/30R19', isStaggered: true };

// 2015-2023 (S550, 6th Gen)
const mustang_2015_v6: TrimFitment = { trims: ['V6', 'Base', 'Coupe', 'Convertible'], yearStart: 2015, yearEnd: 2017, wheelDiameter: 17, wheelWidth: 8, tireSize: '235/55R17' };
const mustang_2015_eco: TrimFitment = { trims: ['EcoBoost', 'EcoBoost Premium'], yearStart: 2015, yearEnd: 2023, wheelDiameter: 18, wheelWidth: 8, tireSize: '235/50R18' };
const mustang_2015_eco_perf: TrimFitment = { trims: ['EcoBoost Performance', 'Performance Package'], yearStart: 2015, yearEnd: 2023, wheelDiameter: 19, wheelWidth: 9, tireSize: '255/40R19', rearWheelWidth: 9.5, rearTireSize: '275/40R19', isStaggered: true };
const mustang_2015_gt: TrimFitment = { trims: ['GT', 'GT Premium', 'Bullitt'], yearStart: 2015, yearEnd: 2023, wheelDiameter: 18, wheelWidth: 8, tireSize: '255/45R18' };
const mustang_2015_gt_perf: TrimFitment = { trims: ['GT Performance Package', 'GT Premium Performance'], yearStart: 2015, yearEnd: 2023, wheelDiameter: 19, wheelWidth: 9, tireSize: '255/40R19', rearWheelWidth: 9.5, rearTireSize: '275/40R19', isStaggered: true };
const mustang_2015_gt350: TrimFitment = { trims: ['Shelby GT350', 'GT350', 'GT350R'], yearStart: 2016, yearEnd: 2020, wheelDiameter: 19, wheelWidth: 10.5, tireSize: '295/35R19', rearWheelWidth: 11, rearTireSize: '305/35R19', isStaggered: true };
const mustang_2020_gt500: TrimFitment = { trims: ['Shelby GT500', 'GT500'], yearStart: 2020, yearEnd: 2023, wheelDiameter: 20, wheelWidth: 11, tireSize: '305/30R20', rearWheelWidth: 11.5, rearTireSize: '315/30R20', isStaggered: true };
const mustang_2021_mach1: TrimFitment = { trims: ['Mach 1', 'Mach 1 Premium'], yearStart: 2021, yearEnd: 2023, wheelDiameter: 19, wheelWidth: 9.5, tireSize: '255/40R19', rearWheelWidth: 10, rearTireSize: '275/40R19', isStaggered: true };

// 2010-2014 (S197 II, 5th Gen)
const mustang_2010_v6: TrimFitment = { trims: ['V6', 'Base'], yearStart: 2010, yearEnd: 2014, wheelDiameter: 17, wheelWidth: 7.5, tireSize: '235/55R17' };
const mustang_2010_gt: TrimFitment = { trims: ['GT', 'GT Premium'], yearStart: 2010, yearEnd: 2014, wheelDiameter: 18, wheelWidth: 8, tireSize: '235/50R18' };
const mustang_2010_gt500: TrimFitment = { trims: ['Shelby GT500', 'GT500'], yearStart: 2010, yearEnd: 2014, wheelDiameter: 19, wheelWidth: 9.5, tireSize: '255/40R19', rearWheelWidth: 9.5, rearTireSize: '285/35R19', isStaggered: true };
const mustang_2012_boss: TrimFitment = { trims: ['Boss 302', 'Boss 302 Laguna Seca'], yearStart: 2012, yearEnd: 2013, wheelDiameter: 19, wheelWidth: 9, tireSize: '255/40R19', rearWheelWidth: 9, rearTireSize: '285/35R19', isStaggered: true };

// 2005-2009 (S197 I, 5th Gen)
const mustang_2005_v6: TrimFitment = { trims: ['V6', 'Base', 'Deluxe', 'Premium'], yearStart: 2005, yearEnd: 2009, wheelDiameter: 16, wheelWidth: 7, tireSize: '215/65R16' };
const mustang_2005_gt: TrimFitment = { trims: ['GT', 'GT Premium', 'GT Deluxe', 'Bullitt'], yearStart: 2005, yearEnd: 2009, wheelDiameter: 17, wheelWidth: 8, tireSize: '235/55R17' };
const mustang_2007_gt500: TrimFitment = { trims: ['Shelby GT500', 'GT500', 'Shelby GT', 'GT-H'], yearStart: 2007, yearEnd: 2009, wheelDiameter: 18, wheelWidth: 9, tireSize: '255/45R18', rearWheelWidth: 9.5, rearTireSize: '285/40R18', isStaggered: true };

const allFitments: TrimFitment[] = [
  mustang_2024_eco, mustang_2024_gt, mustang_2024_gt_perf, mustang_2024_darkhorse, mustang_2024_darkhorse_hp,
  mustang_2015_v6, mustang_2015_eco, mustang_2015_eco_perf, mustang_2015_gt, mustang_2015_gt_perf, mustang_2015_gt350, mustang_2020_gt500, mustang_2021_mach1,
  mustang_2010_v6, mustang_2010_gt, mustang_2010_gt500, mustang_2012_boss,
  mustang_2005_v6, mustang_2005_gt, mustang_2007_gt500
];

const BOLT_PATTERN = '5x114.3';
const CENTER_BORE = 70.5;

function normalizeTrim(trim: string): string {
  return trim.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
}

function matchTrimToFitment(year: number, displayTrim: string): TrimFitment | null {
  const normalized = normalizeTrim(displayTrim);
  const yearMatches = allFitments.filter(tf => year >= tf.yearStart && year <= tf.yearEnd);
  if (yearMatches.length === 0) return null;

  // Check specific trims first (most to least specific)
  if (normalized.includes('gt500') || normalized.includes('shelby gt500')) return yearMatches.find(tf => tf.trims.some(t => t.toLowerCase().includes('gt500'))) || null;
  if (normalized.includes('gt350') || normalized.includes('shelby gt350')) return yearMatches.find(tf => tf.trims.some(t => t.toLowerCase().includes('gt350'))) || null;
  if (normalized.includes('dark horse handling')) return yearMatches.find(tf => tf.trims.some(t => t.toLowerCase().includes('dark horse handling'))) || null;
  if (normalized.includes('dark horse')) return yearMatches.find(tf => tf.trims.some(t => t.toLowerCase().includes('dark horse'))) || null;
  if (normalized.includes('mach 1')) return yearMatches.find(tf => tf.trims.some(t => t.toLowerCase().includes('mach 1'))) || null;
  if (normalized.includes('boss 302')) return yearMatches.find(tf => tf.trims.some(t => t.toLowerCase().includes('boss'))) || null;
  if (normalized.includes('bullitt')) return yearMatches.find(tf => tf.trims.some(t => t.toLowerCase().includes('bullitt'))) || null;
  if (normalized.includes('gt performance') || normalized.includes('performance pack')) return yearMatches.find(tf => tf.trims.some(t => t.toLowerCase().includes('performance'))) || null;
  if (normalized.includes('gt') && !normalized.includes('gt h')) return yearMatches.find(tf => tf.trims.some(t => t === 'GT' || t === 'GT Premium')) || null;
  if (normalized.includes('ecoboost performance')) return yearMatches.find(tf => tf.trims.some(t => t.toLowerCase().includes('ecoboost performance'))) || null;
  if (normalized.includes('ecoboost')) return yearMatches.find(tf => tf.trims.some(t => t.toLowerCase().includes('ecoboost'))) || null;
  if (normalized.includes('v6')) return yearMatches.find(tf => tf.trims.some(t => t === 'V6')) || null;
  
  // Fallback to base/V6/EcoBoost
  return yearMatches.find(tf => tf.trims.some(t => ['V6', 'Base', 'EcoBoost'].includes(t))) || yearMatches[0];
}

async function main() {
  const dryRun = !process.argv.includes('--apply');
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'APPLYING CHANGES'}`);
  
  const records = await pool.query(`
    SELECT id, year, make, model, display_trim
    FROM vehicle_fitments
    WHERE LOWER(make) = 'ford' AND LOWER(model) = 'mustang'
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
