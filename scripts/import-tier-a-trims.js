/**
 * Import Tier A Trim Differentiation Data
 * 
 * Imports Ford Mustang, Chevrolet Camaro, Dodge Challenger, and Dodge Charger
 * trim-specific fitment data with staggered wheel support.
 * 
 * Usage:
 *   node scripts/import-tier-a-trims.js [--dry-run]
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Load environment
require('dotenv').config({ path: '.env.local' });

const DRY_RUN = process.argv.includes('--dry-run');
const VERBOSE = process.argv.includes('--verbose');

// Generate a consistent modificationId from trim data
function generateModificationId(make, model, trimKey, year) {
  // Create a stable hash for the modificationId
  const base = `${make}-${model}-${trimKey}`.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  const hash = crypto.createHash('sha256').update(`${base}-${year}`).digest('hex').slice(0, 10);
  return `${base}-${hash}`;
}

// Slugify for display
function slugify(str) {
  return str.toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-');
}

async function main() {
  console.log(`\n=== Tier A Trim Import ${DRY_RUN ? '(DRY RUN)' : ''} ===\n`);

  // Load the trim data
  const dataPath = path.join(__dirname, '..', 'data', 'tier-a-trims.json');
  const trimData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

  // Connect to database (use POSTGRES_URL for Prisma Postgres, fallback to DATABASE_URL)
  const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  console.log(`Connecting to: ${connectionString?.replace(/:[^:@]+@/, ':****@')}`);
  const client = new Client({
    connectionString,
  });
  await client.connect();
  console.log('Connected to database');

  const stats = {
    processed: 0,
    inserted: 0,
    skipped: 0,
    errors: 0,
    byVehicle: {},
  };

  try {
    // Process each vehicle
    for (const [vehicleKey, vehicle] of Object.entries(trimData.vehicles)) {
      console.log(`\n--- Processing ${vehicle.make} ${vehicle.model} ---`);
      stats.byVehicle[vehicleKey] = { inserted: 0, skipped: 0 };

      // Get year range for vehicle
      const [minYear, maxYear] = vehicle.yearRange;

      // Process each trim
      for (const [trimKey, trim] of Object.entries(vehicle.trims)) {
        // Determine year range for this trim (may be more restricted)
        const trimYearRange = trim.yearRange || vehicle.yearRange;
        const [trimMinYear, trimMaxYear] = trimYearRange;

        // Generate records for each year
        for (let year = Math.max(minYear, trimMinYear); year <= Math.min(maxYear, trimMaxYear); year++) {
          stats.processed++;

          const modificationId = generateModificationId(vehicle.make, vehicle.model, trimKey, year);
          
          // Check if record already exists
          const existingCheck = await client.query(
            `SELECT id FROM vehicle_fitments 
             WHERE year = $1 AND make = $2 AND model = $3 AND modification_id = $4`,
            [year, vehicle.make, vehicle.model, modificationId]
          );

          if (existingCheck.rows.length > 0) {
            if (VERBOSE) {
              console.log(`  SKIP: ${year} ${vehicle.make} ${vehicle.model} ${trim.displayTrim} (exists)`);
            }
            stats.skipped++;
            stats.byVehicle[vehicleKey].skipped++;
            continue;
          }

          // Also check for similar displayTrim to avoid duplicates
          const similarCheck = await client.query(
            `SELECT id FROM vehicle_fitments 
             WHERE year = $1 AND make = $2 AND model = $3 AND LOWER(display_trim) = LOWER($4)`,
            [year, vehicle.make, vehicle.model, trim.displayTrim]
          );

          if (similarCheck.rows.length > 0) {
            if (VERBOSE) {
              console.log(`  SKIP: ${year} ${vehicle.make} ${vehicle.model} ${trim.displayTrim} (similar trim exists)`);
            }
            stats.skipped++;
            stats.byVehicle[vehicleKey].skipped++;
            continue;
          }

          // Prepare the record
          const record = {
            year,
            make: vehicle.make,
            model: vehicle.model,
            modificationId,
            displayTrim: trim.displayTrim,
            rawTrim: trimKey,
            boltPattern: vehicle.boltPattern,
            centerBoreMm: vehicle.centerBoreMm,
            threadSize: vehicle.threadSize,
            seatType: vehicle.seatType,
            oemWheelSizes: trim.oemWheelSizes,
            oemTireSizes: trim.oemTireSizes,
            offsetMinMm: calculateOffsetRange(trim.oemWheelSizes).min,
            offsetMaxMm: calculateOffsetRange(trim.oemWheelSizes).max,
            source: 'tier-a-import',
          };

          if (DRY_RUN) {
            console.log(`  [DRY] Would insert: ${year} ${vehicle.make} ${vehicle.model} ${trim.displayTrim}`);
            if (trim.isStaggered) {
              console.log(`        Staggered: YES`);
              console.log(`        Wheels: ${JSON.stringify(trim.oemWheelSizes)}`);
            }
            stats.inserted++;
            stats.byVehicle[vehicleKey].inserted++;
          } else {
            // Insert the record
            try {
              await client.query(
                `INSERT INTO vehicle_fitments 
                 (year, make, model, modification_id, display_trim, raw_trim,
                  bolt_pattern, center_bore_mm, thread_size, seat_type,
                  oem_wheel_sizes, oem_tire_sizes, offset_min_mm, offset_max_mm, source)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
                [
                  record.year,
                  record.make,
                  record.model,
                  record.modificationId,
                  record.displayTrim,
                  record.rawTrim,
                  record.boltPattern,
                  record.centerBoreMm,
                  record.threadSize,
                  record.seatType,
                  JSON.stringify(record.oemWheelSizes),
                  JSON.stringify(record.oemTireSizes),
                  record.offsetMinMm,
                  record.offsetMaxMm,
                  record.source,
                ]
              );
              console.log(`  INSERT: ${year} ${vehicle.make} ${vehicle.model} ${trim.displayTrim}${trim.isStaggered ? ' (STAGGERED)' : ''}`);
              stats.inserted++;
              stats.byVehicle[vehicleKey].inserted++;
            } catch (err) {
              console.error(`  ERROR: ${year} ${vehicle.make} ${vehicle.model} ${trim.displayTrim}: ${err.message}`);
              stats.errors++;
            }
          }
        }
      }
    }

    // Print summary
    console.log('\n\n=== SUMMARY ===');
    console.log(`Processed: ${stats.processed}`);
    console.log(`Inserted:  ${stats.inserted}`);
    console.log(`Skipped:   ${stats.skipped} (already exist)`);
    console.log(`Errors:    ${stats.errors}`);
    console.log('\nBy Vehicle:');
    for (const [key, counts] of Object.entries(stats.byVehicle)) {
      console.log(`  ${key}: ${counts.inserted} inserted, ${counts.skipped} skipped`);
    }

    if (DRY_RUN) {
      console.log('\n*** DRY RUN - no changes made ***');
    }

  } finally {
    await client.end();
  }
}

// Calculate offset range from wheel specs
function calculateOffsetRange(wheelSizes) {
  const offsets = wheelSizes
    .filter(w => w.offset != null)
    .map(w => w.offset);
  
  if (offsets.length === 0) {
    return { min: null, max: null };
  }
  
  const min = Math.min(...offsets);
  const max = Math.max(...offsets);
  
  // Add some buffer for aftermarket fitment
  return {
    min: min - 10,
    max: max + 10,
  };
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
