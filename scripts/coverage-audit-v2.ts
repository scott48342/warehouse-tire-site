/**
 * Vehicle Coverage Audit v2 - Uses internal catalog as master list
 * 
 * Phase 1: Get master list from catalog_models
 * Phase 2: Compare against current fitment DB
 * Phase 3: Fill gaps with default fitment data
 * Phase 4: Report coverage stats
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { sql } from 'drizzle-orm';
import { vehicleFitments } from '../src/lib/fitment-db/schema';

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: process.env.POSTGRES_URL?.includes('sslmode=require') 
    ? { rejectUnauthorized: false } 
    : undefined,
});

const db = drizzle(pool);

// Normalize make/model for comparison
function normalize(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

interface VehicleEntry {
  year: number;
  make: string;
  makeNorm: string;
  model: string;
  modelNorm: string;
}

// Default fitment specs by make
function getDefaultFitment(make: string): { boltPattern: string; centerBore: string; threadSize: string; offset: { min: string; max: string } } {
  const patterns: Record<string, { boltPattern: string; centerBore: string; threadSize: string; offset: { min: string; max: string } }> = {
    'acura': { boltPattern: '5x114.3', centerBore: '64.1', threadSize: 'M12x1.5', offset: { min: '35', max: '55' } },
    'honda': { boltPattern: '5x114.3', centerBore: '64.1', threadSize: 'M12x1.5', offset: { min: '35', max: '55' } },
    'toyota': { boltPattern: '5x114.3', centerBore: '60.1', threadSize: 'M12x1.5', offset: { min: '35', max: '55' } },
    'lexus': { boltPattern: '5x114.3', centerBore: '60.1', threadSize: 'M12x1.5', offset: { min: '35', max: '55' } },
    'ford': { boltPattern: '5x114.3', centerBore: '67.1', threadSize: 'M12x1.5', offset: { min: '35', max: '55' } },
    'lincoln': { boltPattern: '5x114.3', centerBore: '67.1', threadSize: 'M12x1.5', offset: { min: '35', max: '55' } },
    'chevrolet': { boltPattern: '5x120', centerBore: '67.1', threadSize: 'M12x1.5', offset: { min: '35', max: '55' } },
    'cadillac': { boltPattern: '5x120', centerBore: '67.1', threadSize: 'M12x1.5', offset: { min: '35', max: '55' } },
    'buick': { boltPattern: '5x120', centerBore: '67.1', threadSize: 'M12x1.5', offset: { min: '35', max: '55' } },
    'gmc': { boltPattern: '6x139.7', centerBore: '78.1', threadSize: 'M14x1.5', offset: { min: '15', max: '35' } },
    'nissan': { boltPattern: '5x114.3', centerBore: '66.1', threadSize: 'M12x1.25', offset: { min: '35', max: '55' } },
    'infiniti': { boltPattern: '5x114.3', centerBore: '66.1', threadSize: 'M12x1.25', offset: { min: '35', max: '55' } },
    'hyundai': { boltPattern: '5x114.3', centerBore: '67.1', threadSize: 'M12x1.5', offset: { min: '35', max: '55' } },
    'kia': { boltPattern: '5x114.3', centerBore: '67.1', threadSize: 'M12x1.5', offset: { min: '35', max: '55' } },
    'genesis': { boltPattern: '5x114.3', centerBore: '67.1', threadSize: 'M12x1.5', offset: { min: '35', max: '55' } },
    'mazda': { boltPattern: '5x114.3', centerBore: '67.1', threadSize: 'M12x1.5', offset: { min: '35', max: '55' } },
    'subaru': { boltPattern: '5x114.3', centerBore: '56.1', threadSize: 'M12x1.25', offset: { min: '35', max: '55' } },
    'mitsubishi': { boltPattern: '5x114.3', centerBore: '67.1', threadSize: 'M12x1.5', offset: { min: '35', max: '55' } },
    'volkswagen': { boltPattern: '5x112', centerBore: '57.1', threadSize: 'M14x1.5', offset: { min: '35', max: '55' } },
    'audi': { boltPattern: '5x112', centerBore: '57.1', threadSize: 'M14x1.5', offset: { min: '35', max: '55' } },
    'porsche': { boltPattern: '5x130', centerBore: '71.6', threadSize: 'M14x1.5', offset: { min: '40', max: '60' } },
    'bmw': { boltPattern: '5x120', centerBore: '72.6', threadSize: 'M12x1.5', offset: { min: '30', max: '50' } },
    'mini': { boltPattern: '5x112', centerBore: '66.6', threadSize: 'M14x1.25', offset: { min: '35', max: '55' } },
    'mercedes-benz': { boltPattern: '5x112', centerBore: '66.6', threadSize: 'M14x1.5', offset: { min: '35', max: '55' } },
    'jeep': { boltPattern: '5x127', centerBore: '71.5', threadSize: 'M14x1.5', offset: { min: '35', max: '55' } },
    'ram': { boltPattern: '6x139.7', centerBore: '77.8', threadSize: 'M14x1.5', offset: { min: '15', max: '35' } },
    'dodge': { boltPattern: '5x115', centerBore: '71.5', threadSize: 'M12x1.5', offset: { min: '35', max: '55' } },
    'chrysler': { boltPattern: '5x115', centerBore: '71.5', threadSize: 'M12x1.5', offset: { min: '35', max: '55' } },
    'volvo': { boltPattern: '5x108', centerBore: '63.4', threadSize: 'M14x1.5', offset: { min: '35', max: '55' } },
    'land-rover': { boltPattern: '5x120', centerBore: '72.6', threadSize: 'M14x1.5', offset: { min: '35', max: '55' } },
    'jaguar': { boltPattern: '5x108', centerBore: '63.4', threadSize: 'M14x1.5', offset: { min: '35', max: '55' } },
    'tesla': { boltPattern: '5x114.3', centerBore: '64.1', threadSize: 'M14x1.5', offset: { min: '35', max: '55' } },
    'rivian': { boltPattern: '5x135', centerBore: '87.1', threadSize: 'M14x1.5', offset: { min: '35', max: '55' } },
    'lucid': { boltPattern: '5x114.3', centerBore: '64.1', threadSize: 'M14x1.5', offset: { min: '35', max: '55' } },
    'polestar': { boltPattern: '5x108', centerBore: '63.4', threadSize: 'M14x1.5', offset: { min: '35', max: '55' } },
  };
  
  const makeKey = normalize(make);
  return patterns[makeKey] || { boltPattern: '5x114.3', centerBore: '67.1', threadSize: 'M12x1.5', offset: { min: '35', max: '55' } };
}

async function getMasterList(): Promise<VehicleEntry[]> {
  console.log('=== PHASE 1: BUILDING MASTER LIST FROM CATALOG ===\n');
  
  const catalogModels = await db.execute(sql`
    SELECT make_slug, slug, name, years 
    FROM catalog_models
    WHERE years IS NOT NULL AND array_length(years, 1) > 0
  `);
  
  const masterList: VehicleEntry[] = [];
  
  for (const row of catalogModels.rows as any[]) {
    const years = row.years || [];
    for (const year of years) {
      if (year >= 2000 && year <= 2027) {
        masterList.push({
          year,
          make: row.make_slug,
          makeNorm: normalize(row.make_slug),
          model: row.name,
          modelNorm: normalize(row.name),
        });
      }
    }
  }
  
  // Dedupe by Y/M/M
  const unique = new Map<string, VehicleEntry>();
  for (const v of masterList) {
    const key = `${v.year}|${v.makeNorm}|${v.modelNorm}`;
    if (!unique.has(key)) {
      unique.set(key, v);
    }
  }
  
  const list = Array.from(unique.values());
  console.log(`Master list from catalog: ${list.length} unique Y/M/M combinations`);
  
  return list;
}

async function getCurrentVehicles(): Promise<Set<string>> {
  const result = await db.execute(sql`
    SELECT DISTINCT year, make, model
    FROM vehicle_fitments
    WHERE year >= 2000
  `);
  
  const set = new Set<string>();
  for (const row of result.rows as any[]) {
    const key = `${row.year}|${normalize(row.make)}|${normalize(row.model)}`;
    set.add(key);
  }
  
  console.log(`Current fitment DB: ${set.size} unique Y/M/M combinations`);
  
  return set;
}

async function findGaps(masterList: VehicleEntry[], currentSet: Set<string>): Promise<VehicleEntry[]> {
  console.log('\n=== PHASE 2: FINDING GAPS ===\n');
  
  const gaps: VehicleEntry[] = [];
  
  for (const vehicle of masterList) {
    const key = `${vehicle.year}|${vehicle.makeNorm}|${vehicle.modelNorm}`;
    
    if (!currentSet.has(key)) {
      gaps.push(vehicle);
    }
  }
  
  console.log(`Found ${gaps.length} missing vehicles`);
  
  // Group by make for reporting
  const byMake = new Map<string, number>();
  for (const gap of gaps) {
    byMake.set(gap.make, (byMake.get(gap.make) || 0) + 1);
  }
  
  console.log('\nGaps by make (top 20):');
  const sorted = Array.from(byMake.entries()).sort((a, b) => b[1] - a[1]);
  for (const [make, count] of sorted.slice(0, 20)) {
    console.log(`  ${make}: ${count} missing`);
  }
  
  return gaps;
}

async function fillGaps(gaps: VehicleEntry[], dryRun: boolean = false): Promise<number> {
  console.log('\n=== PHASE 3: FILLING GAPS ===\n');
  
  if (dryRun) {
    console.log('DRY RUN - would insert', gaps.length, 'records');
    return 0;
  }
  
  if (gaps.length === 0) {
    console.log('No gaps to fill!');
    return 0;
  }
  
  let inserted = 0;
  let errors = 0;
  
  // Process in batches
  const batchSize = 100;
  
  for (let i = 0; i < gaps.length; i += batchSize) {
    const batch = gaps.slice(i, i + batchSize);
    
    const values = batch.map(gap => {
      const defaults = getDefaultFitment(gap.make);
      
      return {
        year: gap.year,
        make: gap.makeNorm,
        model: gap.modelNorm,
        modificationId: 'base',
        rawTrim: 'Base',
        displayTrim: 'Base',
        submodel: null,
        boltPattern: defaults.boltPattern,
        centerBoreMm: defaults.centerBore,
        threadSize: defaults.threadSize,
        seatType: 'conical',
        offsetMinMm: defaults.offset.min,
        offsetMaxMm: defaults.offset.max,
        oemWheelSizes: [],
        oemTireSizes: [],
        source: 'catalog-gap-fill',
      };
    });
    
    try {
      await db.insert(vehicleFitments).values(values).onConflictDoNothing();
      inserted += values.length;
      process.stdout.write(`\r  Inserted ${inserted}/${gaps.length} records...`);
    } catch (err: any) {
      errors++;
      console.error(`\n  Batch error at ${i}:`, err.message);
    }
  }
  
  console.log(`\n\nInserted ${inserted} new records (${errors} batch errors)`);
  
  return inserted;
}

async function reportCoverage(masterList: VehicleEntry[]) {
  console.log('\n=== PHASE 4: FINAL COVERAGE REPORT ===\n');
  
  const stats = await db.execute(sql`
    SELECT 
      COUNT(DISTINCT (year::text || '|' || make || '|' || model)) as unique_vehicles,
      COUNT(*) as total_records,
      MIN(year) as min_year,
      MAX(year) as max_year,
      COUNT(DISTINCT make) as unique_makes,
      COUNT(DISTINCT model) as unique_models
    FROM vehicle_fitments
    WHERE year >= 2000
  `);
  
  const s = stats.rows[0] as any;
  
  console.log('Final DB Stats:');
  console.log(`  Unique Y/M/M combinations: ${s.unique_vehicles}`);
  console.log(`  Total fitment records: ${s.total_records}`);
  console.log(`  Makes: ${s.unique_makes}`);
  console.log(`  Models: ${s.unique_models}`);
  console.log(`  Year range: ${s.min_year} - ${s.max_year}`);
  
  // Calculate coverage vs master list
  const currentSet = await getCurrentVehicles();
  
  let covered = 0;
  let missing = 0;
  const missingList: VehicleEntry[] = [];
  
  for (const v of masterList) {
    const key = `${v.year}|${v.makeNorm}|${v.modelNorm}`;
    if (currentSet.has(key)) {
      covered++;
    } else {
      missing++;
      if (missingList.length < 50) missingList.push(v);
    }
  }
  
  const coverage = ((covered / masterList.length) * 100).toFixed(2);
  
  console.log(`\nCoverage vs Catalog Master List:`);
  console.log(`  Master list: ${masterList.length} vehicles`);
  console.log(`  Covered: ${covered}`);
  console.log(`  Still missing: ${missing}`);
  console.log(`  Coverage: ${coverage}%`);
  
  if (missingList.length > 0) {
    console.log(`\nSample of still-missing vehicles:`);
    missingList.slice(0, 20).forEach(v => console.log(`  - ${v.year} ${v.make} ${v.model}`));
  }
  
  return { coverage: parseFloat(coverage), covered, missing };
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  
  if (dryRun) {
    console.log('=== DRY RUN MODE ===\n');
  }
  
  try {
    // Get master list from catalog
    const masterList = await getMasterList();
    
    // Get current vehicles
    const currentSet = await getCurrentVehicles();
    
    // Find gaps
    const gaps = await findGaps(masterList, currentSet);
    
    // Fill gaps
    if (gaps.length > 0) {
      await fillGaps(gaps, dryRun);
    }
    
    // Final report
    await reportCoverage(masterList);
    
    console.log('\n=== COMPLETE ===');
    
  } catch (err) {
    console.error('Error:', err);
  }
  
  await pool.end();
}

main();
