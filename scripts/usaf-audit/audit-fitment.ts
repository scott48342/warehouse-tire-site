#!/usr/bin/env npx tsx
/**
 * USAF Fitment Audit Script
 * 
 * Compares our canonical fitment data against USAF GetVehicleOptions.
 * Produces discrepancy reports for review.
 * 
 * Usage:
 *   npx tsx scripts/usaf-audit/audit-fitment.ts [options]
 * 
 * Options:
 *   --year <year>       Audit specific year
 *   --make <make>       Audit specific make
 *   --model <model>     Audit specific model
 *   --limit <n>         Limit number of vehicles
 *   --output <file>     Output JSON file
 *   --category <cat>    Category: passenger, truck, hd, ev, sports
 * 
 * Example:
 *   npx tsx scripts/usaf-audit/audit-fitment.ts --year 2024 --make Ford --limit 10
 */

import { PrismaClient } from '@prisma/client';
import {
  compareFitment,
  summarizeAuditBatch,
  type OurFitmentData,
  type VehicleAuditResult,
  type UsafVehicleOption,
} from '../../src/lib/usaf-fitment';
import { getVehicleOptions } from './usaf-vehicle-api';
import * as fs from 'fs';

const prisma = new PrismaClient();

// ============================================================================
// CLI PARSING
// ============================================================================

interface AuditOptions {
  year?: number;
  make?: string;
  model?: string;
  limit: number;
  output?: string;
  category?: 'passenger' | 'truck' | 'hd' | 'ev' | 'sports';
  verbose: boolean;
}

function parseArgs(): AuditOptions {
  const args = process.argv.slice(2);
  const options: AuditOptions = {
    limit: 100,
    verbose: false,
  };
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const next = args[i + 1];
    
    switch (arg) {
      case '--year':
        options.year = parseInt(next);
        i++;
        break;
      case '--make':
        options.make = next;
        i++;
        break;
      case '--model':
        options.model = next;
        i++;
        break;
      case '--limit':
        options.limit = parseInt(next);
        i++;
        break;
      case '--output':
        options.output = next;
        i++;
        break;
      case '--category':
        options.category = next as AuditOptions['category'];
        i++;
        break;
      case '--verbose':
      case '-v':
        options.verbose = true;
        break;
    }
  }
  
  return options;
}

// ============================================================================
// DATA FETCHING
// ============================================================================

async function getVehiclesFromDB(options: AuditOptions): Promise<OurFitmentData[]> {
  const where: any = {};
  
  if (options.year) where.year = options.year;
  if (options.make) where.make = { contains: options.make, mode: 'insensitive' };
  if (options.model) where.model = { contains: options.model, mode: 'insensitive' };
  
  // Fetch vehicles with fitment data
  const vehicles = await prisma.vehicle_fitments.findMany({
    where,
    take: options.limit,
    orderBy: [
      { year: 'desc' },
      { make: 'asc' },
      { model: 'asc' },
    ],
  });
  
  return vehicles.map(v => ({
    vehicleId: v.id,
    year: v.year,
    make: v.make,
    model: v.model,
    trim: v.trim || undefined,
    tireSizes: parseTireSizes(v),
    isStaggered: v.is_staggered || false,
    wheelDiameters: parseWheelDiameters(v),
    loadRanges: v.load_ranges ? JSON.parse(v.load_ranges as string) : undefined,
    speedRatings: v.speed_ratings ? JSON.parse(v.speed_ratings as string) : undefined,
  }));
}

function parseTireSizes(v: any): string[] {
  const sizes: string[] = [];
  
  if (v.front_tire_size) sizes.push(v.front_tire_size);
  if (v.rear_tire_size && v.rear_tire_size !== v.front_tire_size) {
    sizes.push(v.rear_tire_size);
  }
  
  // Also check tire_sizes JSON array if present
  if (v.tire_sizes) {
    try {
      const parsed = JSON.parse(v.tire_sizes as string);
      if (Array.isArray(parsed)) {
        for (const size of parsed) {
          if (!sizes.includes(size)) sizes.push(size);
        }
      }
    } catch {}
  }
  
  return sizes;
}

function parseWheelDiameters(v: any): number[] {
  const diameters: number[] = [];
  
  if (v.wheel_diameter) diameters.push(v.wheel_diameter);
  if (v.rear_wheel_diameter && v.rear_wheel_diameter !== v.wheel_diameter) {
    diameters.push(v.rear_wheel_diameter);
  }
  
  return diameters;
}

// ============================================================================
// AUDIT RUNNER
// ============================================================================

async function runAudit(options: AuditOptions): Promise<VehicleAuditResult[]> {
  console.log('🔍 USAF Fitment Audit');
  console.log('====================');
  console.log(`Options: ${JSON.stringify(options, null, 2)}\n`);
  
  // 1. Fetch vehicles from our DB
  console.log('📦 Fetching vehicles from DB...');
  const vehicles = await getVehiclesFromDB(options);
  console.log(`   Found ${vehicles.length} vehicles\n`);
  
  if (vehicles.length === 0) {
    console.log('No vehicles found matching criteria.');
    return [];
  }
  
  // 2. Audit each vehicle
  const results: VehicleAuditResult[] = [];
  let errors = 0;
  
  for (let i = 0; i < vehicles.length; i++) {
    const vehicle = vehicles[i];
    const label = `${vehicle.year} ${vehicle.make} ${vehicle.model}${vehicle.trim ? ' ' + vehicle.trim : ''}`;
    
    if (options.verbose) {
      console.log(`[${i + 1}/${vehicles.length}] Auditing: ${label}`);
    } else {
      process.stdout.write(`\r[${i + 1}/${vehicles.length}] Auditing vehicles...`);
    }
    
    try {
      // Query USAF
      const usafResponse = await getVehicleOptions(
        vehicle.year,
        vehicle.make,
        vehicle.model
      );
      
      if (!usafResponse.success || !usafResponse.options) {
        if (options.verbose) {
          console.log(`   ⚠️  USAF has no data for this vehicle`);
        }
        continue;
      }
      
      // Compare
      const result = compareFitment(vehicle, usafResponse.options);
      results.push(result);
      
      if (options.verbose && result.discrepancies.length > 0) {
        console.log(`   Found ${result.discrepancies.length} discrepancies`);
        for (const d of result.discrepancies) {
          console.log(`     - ${d.type}: ${d.notes || d.field}`);
        }
      }
      
      // Rate limit - be nice to USAF
      await new Promise(r => setTimeout(r, 200));
      
    } catch (error) {
      errors++;
      if (options.verbose) {
        console.log(`   ❌ Error: ${error}`);
      }
    }
  }
  
  console.log('\n');
  
  // 3. Summary
  if (results.length > 0) {
    const summary = summarizeAuditBatch(results);
    
    console.log('📊 Audit Summary');
    console.log('================');
    console.log(`Total audited: ${summary.total}`);
    console.log(`Full matches: ${summary.fullMatches} (${(summary.fullMatches / summary.total * 100).toFixed(1)}%)`);
    console.log(`Partial matches: ${summary.partialMatches}`);
    console.log(`Mismatches: ${summary.mismatches}`);
    console.log(`Average confidence: ${summary.avgConfidence.toFixed(1)}%`);
    console.log(`Errors: ${errors}`);
    console.log();
    console.log('Discrepancies by type:');
    for (const [type, count] of Object.entries(summary.byType)) {
      console.log(`  ${type}: ${count}`);
    }
    console.log();
    console.log('Discrepancies by severity:');
    console.log(`  High: ${summary.bySeverity.high}`);
    console.log(`  Medium: ${summary.bySeverity.medium}`);
    console.log(`  Low: ${summary.bySeverity.low}`);
  }
  
  // 4. Save output
  if (options.output) {
    const output = {
      auditedAt: new Date().toISOString(),
      options,
      summary: results.length > 0 ? summarizeAuditBatch(results) : null,
      results,
    };
    
    fs.writeFileSync(options.output, JSON.stringify(output, null, 2));
    console.log(`\n💾 Results saved to: ${options.output}`);
  }
  
  return results;
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  const options = parseArgs();
  
  try {
    await runAudit(options);
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
