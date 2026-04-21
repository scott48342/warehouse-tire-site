/**
 * Full Vehicle Coverage Audit & Gap-Filling Script
 * 
 * Phase 1: Get master vehicle list from NHTSA vPIC API
 * Phase 2: Compare against current DB
 * Phase 3: Fill gaps with minimal fitment data
 * Phase 4: Report coverage stats
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { sql } from 'drizzle-orm';
import { vehicleFitments } from '../src/lib/fitment-db/schema';
import * as fs from 'fs';

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: process.env.POSTGRES_URL?.includes('sslmode=require') 
    ? { rejectUnauthorized: false } 
    : undefined,
});

const db = drizzle(pool);

// Rate limit helper
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Common passenger vehicle makes we care about
const PRIORITY_MAKES = [
  'Acura', 'Alfa Romeo', 'Audi', 'BMW', 'Buick', 'Cadillac', 'Chevrolet', 
  'Chrysler', 'Dodge', 'Ferrari', 'Fiat', 'Ford', 'Genesis', 'GMC', 'Honda', 
  'Hyundai', 'Infiniti', 'Jaguar', 'Jeep', 'Kia', 'Lamborghini', 'Land Rover', 
  'Lexus', 'Lincoln', 'Lucid', 'Maserati', 'Mazda', 'McLaren', 'Mercedes-Benz', 
  'Mini', 'Mitsubishi', 'Nissan', 'Polestar', 'Porsche', 'Ram', 'Rivian', 
  'Rolls-Royce', 'Subaru', 'Tesla', 'Toyota', 'Volkswagen', 'Volvo'
];

// Normalize make name for comparison
function normalizeMake(make: string): string {
  return make.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

// Normalize model name
function normalizeModel(model: string): string {
  return model.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

interface VehicleEntry {
  year: number;
  make: string;
  makeNorm: string;
  model: string;
  modelNorm: string;
}

async function fetchNHTSAModels(make: string, year: number): Promise<string[]> {
  const url = `https://vpic.nhtsa.dot.gov/api/vehicles/getmodelsformakeyear/make/${encodeURIComponent(make)}/modelyear/${year}?format=json`;
  
  try {
    const response = await fetch(url);
    if (!response.ok) return [];
    
    const data = await response.json();
    if (!data.Results) return [];
    
    return data.Results.map((r: any) => r.Model_Name).filter(Boolean);
  } catch (err) {
    console.error(`  Error fetching ${make} ${year}:`, err);
    return [];
  }
}

async function getCurrentVehicles(): Promise<Set<string>> {
  const result = await db.execute(sql`
    SELECT DISTINCT year, make, model
    FROM vehicle_fitments
    WHERE year >= 2000
  `);
  
  const set = new Set<string>();
  for (const row of result.rows as any[]) {
    const key = `${row.year}|${normalizeMake(row.make)}|${normalizeModel(row.model)}`;
    set.add(key);
  }
  
  return set;
}

async function fixCaseInconsistencies() {
  console.log('Fixing case inconsistencies...');
  
  // Update GMC -> gmc
  await db.execute(sql`
    UPDATE vehicle_fitments 
    SET make = lower(make)
    WHERE make != lower(make)
  `);
  
  console.log('Done fixing case.\n');
}

async function getMasterList(): Promise<VehicleEntry[]> {
  console.log('=== PHASE 1: BUILDING MASTER VEHICLE LIST ===\n');
  
  const currentYear = new Date().getFullYear();
  const startYear = 2000;
  const endYear = currentYear + 1; // Include next year for pre-release models
  
  const masterList: VehicleEntry[] = [];
  
  // Check if we have a cached master list
  const cacheFile = './scripts/nhtsa-master-cache.json';
  if (fs.existsSync(cacheFile)) {
    const cached = JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
    const cacheAge = Date.now() - cached.timestamp;
    const oneWeek = 7 * 24 * 60 * 60 * 1000;
    
    if (cacheAge < oneWeek) {
      console.log(`Using cached master list (${cached.vehicles.length} vehicles)`);
      return cached.vehicles;
    }
  }
  
  console.log(`Fetching vehicle data from NHTSA for years ${startYear}-${endYear}...`);
  console.log(`Makes to check: ${PRIORITY_MAKES.length}`);
  
  for (const make of PRIORITY_MAKES) {
    process.stdout.write(`  ${make}: `);
    let makeCount = 0;
    
    for (let year = startYear; year <= endYear; year++) {
      const models = await fetchNHTSAModels(make, year);
      
      for (const model of models) {
        masterList.push({
          year,
          make,
          makeNorm: normalizeMake(make),
          model,
          modelNorm: normalizeModel(model),
        });
        makeCount++;
      }
      
      // Rate limiting - NHTSA asks for 10 requests/second max
      await sleep(120);
    }
    
    console.log(`${makeCount} models`);
  }
  
  // Cache the results
  fs.writeFileSync(cacheFile, JSON.stringify({
    timestamp: Date.now(),
    vehicles: masterList,
  }));
  
  console.log(`\nMaster list: ${masterList.length} total vehicle entries`);
  
  return masterList;
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
  
  // Dedupe by Y/M/M
  const uniqueGaps = new Map<string, VehicleEntry>();
  for (const gap of gaps) {
    const key = `${gap.year}|${gap.makeNorm}|${gap.modelNorm}`;
    if (!uniqueGaps.has(key)) {
      uniqueGaps.set(key, gap);
    }
  }
  
  const gapList = Array.from(uniqueGaps.values());
  
  console.log(`Found ${gapList.length} missing vehicles`);
  
  // Group by make for reporting
  const byMake = new Map<string, number>();
  for (const gap of gapList) {
    byMake.set(gap.make, (byMake.get(gap.make) || 0) + 1);
  }
  
  console.log('\nGaps by make:');
  const sorted = Array.from(byMake.entries()).sort((a, b) => b[1] - a[1]);
  for (const [make, count] of sorted.slice(0, 20)) {
    console.log(`  ${make}: ${count} missing`);
  }
  
  return gapList;
}

// Default fitment specs for gap-filling (conservative values)
function getDefaultFitment(make: string): { boltPattern: string; centerBore: string; threadSize: string; offset: { min: string; max: string } } {
  // Most common patterns by make
  const patterns: Record<string, { boltPattern: string; centerBore: string; threadSize: string; offset: { min: string; max: string } }> = {
    'honda': { boltPattern: '5x114.3', centerBore: '64.1', threadSize: 'M12x1.5', offset: { min: '35', max: '55' } },
    'toyota': { boltPattern: '5x114.3', centerBore: '60.1', threadSize: 'M12x1.5', offset: { min: '35', max: '55' } },
    'ford': { boltPattern: '5x114.3', centerBore: '67.1', threadSize: 'M12x1.5', offset: { min: '35', max: '55' } },
    'chevrolet': { boltPattern: '5x120', centerBore: '67.1', threadSize: 'M12x1.5', offset: { min: '35', max: '55' } },
    'gmc': { boltPattern: '6x139.7', centerBore: '78.1', threadSize: 'M14x1.5', offset: { min: '15', max: '35' } },
    'nissan': { boltPattern: '5x114.3', centerBore: '66.1', threadSize: 'M12x1.25', offset: { min: '35', max: '55' } },
    'hyundai': { boltPattern: '5x114.3', centerBore: '67.1', threadSize: 'M12x1.5', offset: { min: '35', max: '55' } },
    'kia': { boltPattern: '5x114.3', centerBore: '67.1', threadSize: 'M12x1.5', offset: { min: '35', max: '55' } },
    'mazda': { boltPattern: '5x114.3', centerBore: '67.1', threadSize: 'M12x1.5', offset: { min: '35', max: '55' } },
    'subaru': { boltPattern: '5x114.3', centerBore: '56.1', threadSize: 'M12x1.25', offset: { min: '35', max: '55' } },
    'volkswagen': { boltPattern: '5x112', centerBore: '57.1', threadSize: 'M14x1.5', offset: { min: '35', max: '55' } },
    'audi': { boltPattern: '5x112', centerBore: '57.1', threadSize: 'M14x1.5', offset: { min: '35', max: '55' } },
    'bmw': { boltPattern: '5x120', centerBore: '72.6', threadSize: 'M12x1.5', offset: { min: '30', max: '50' } },
    'mercedes-benz': { boltPattern: '5x112', centerBore: '66.6', threadSize: 'M14x1.5', offset: { min: '35', max: '55' } },
    'jeep': { boltPattern: '5x127', centerBore: '71.5', threadSize: 'M14x1.5', offset: { min: '35', max: '55' } },
    'ram': { boltPattern: '6x139.7', centerBore: '77.8', threadSize: 'M14x1.5', offset: { min: '15', max: '35' } },
    'dodge': { boltPattern: '5x115', centerBore: '71.5', threadSize: 'M12x1.5', offset: { min: '35', max: '55' } },
  };
  
  const makeKey = normalizeMake(make);
  return patterns[makeKey] || { boltPattern: '5x114.3', centerBore: '67.1', threadSize: 'M12x1.5', offset: { min: '35', max: '55' } };
}

async function fillGaps(gaps: VehicleEntry[], dryRun: boolean = false): Promise<number> {
  console.log('\n=== PHASE 3: FILLING GAPS ===\n');
  
  if (dryRun) {
    console.log('DRY RUN - not inserting data');
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
        source: 'nhtsa-gap-fill',
      };
    });
    
    try {
      await db.insert(vehicleFitments).values(values).onConflictDoNothing();
      inserted += values.length;
      process.stdout.write(`\r  Inserted ${inserted}/${gaps.length} records...`);
    } catch (err: any) {
      errors++;
      console.error(`\n  Batch error:`, err.message);
    }
  }
  
  console.log(`\n\nInserted ${inserted} new records (${errors} batch errors)`);
  
  return inserted;
}

async function reportCoverage() {
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
  
  console.log('Final Coverage:');
  console.log(`  Unique Y/M/M combinations: ${s.unique_vehicles}`);
  console.log(`  Total fitment records: ${s.total_records}`);
  console.log(`  Makes: ${s.unique_makes}`);
  console.log(`  Models: ${s.unique_models}`);
  console.log(`  Year range: ${s.min_year} - ${s.max_year}`);
  
  // Check for any remaining gaps against NHTSA
  const masterList = await getMasterList();
  const currentSet = await getCurrentVehicles();
  
  let covered = 0;
  let missing = 0;
  
  const uniqueMaster = new Set<string>();
  for (const v of masterList) {
    uniqueMaster.add(`${v.year}|${v.makeNorm}|${v.modelNorm}`);
  }
  
  for (const key of uniqueMaster) {
    if (currentSet.has(key)) {
      covered++;
    } else {
      missing++;
    }
  }
  
  const coverage = ((covered / uniqueMaster.size) * 100).toFixed(2);
  
  console.log(`\nCoverage vs NHTSA Master List:`);
  console.log(`  Master list vehicles: ${uniqueMaster.size}`);
  console.log(`  Covered: ${covered}`);
  console.log(`  Missing: ${missing}`);
  console.log(`  Coverage: ${coverage}%`);
  
  return { coverage: parseFloat(coverage), covered, missing };
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  
  if (dryRun) {
    console.log('=== DRY RUN MODE ===\n');
  }
  
  try {
    // Fix case issues first
    await fixCaseInconsistencies();
    
    // Get master list
    const masterList = await getMasterList();
    
    // Get current vehicles
    const currentSet = await getCurrentVehicles();
    console.log(`Current DB has ${currentSet.size} unique Y/M/M combinations`);
    
    // Find gaps
    const gaps = await findGaps(masterList, currentSet);
    
    // Fill gaps
    if (gaps.length > 0) {
      await fillGaps(gaps, dryRun);
    }
    
    // Final report
    const coverage = await reportCoverage();
    
    console.log('\n=== COMPLETE ===');
    console.log(`Final coverage: ${coverage.coverage}%`);
    
  } catch (err) {
    console.error('Error:', err);
  }
  
  await pool.end();
}

main();
