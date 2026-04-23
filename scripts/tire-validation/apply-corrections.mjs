#!/usr/bin/env node
/**
 * Apply Tire Data Corrections
 * 
 * Reads consolidated-issues.json and applies corrections to the database.
 * 
 * Usage:
 *   node apply-corrections.mjs --dry-run           # Preview changes
 *   node apply-corrections.mjs                      # Apply all changes
 *   node apply-corrections.mjs --category=deletes  # Apply only deletes
 *   node apply-corrections.mjs --category=updates  # Apply only updates
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Parse CLI args
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const CATEGORY = args.find(a => a.startsWith('--category='))?.split('=')[1] || 'all';

// Load consolidated issues
const issuesPath = path.join(__dirname, 'consolidated-issues.json');
if (!fs.existsSync(issuesPath)) {
  console.error('ERROR: consolidated-issues.json not found. Run parse-all-batches.mjs first.');
  process.exit(1);
}

const { issues } = JSON.parse(fs.readFileSync(issuesPath, 'utf8'));

// Stats tracking
const stats = {
  deleted: 0,
  updated: 0,
  inserted: 0,
  skipped: 0,
  errors: [],
};

/**
 * Initialize database connection
 */
async function initDb() {
  // Dynamic import to handle ESM
  const { drizzle } = await import('drizzle-orm/postgres-js');
  const postgres = (await import('postgres')).default;
  
  // Load env
  const dotenv = await import('dotenv');
  dotenv.config({ path: path.join(__dirname, '../../.env.local') });
  
  const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('No database connection string found in environment');
  }
  
  console.log('Connecting to database...');
  const client = postgres(connectionString);
  
  // Import schema
  const schema = await import('../../src/lib/fitment-db/schema.js');
  const db = drizzle(client, { schema });
  
  return { db, client, schema };
}

/**
 * Delete invalid year entries
 */
async function deleteInvalidYears(db, schema) {
  console.log('\n=== Deleting Invalid Year Entries ===');
  
  const { eq, and } = await import('drizzle-orm');
  const toDelete = issues.deletes.invalidYears;
  
  for (const entry of toDelete) {
    const { year, make, model, reason } = entry;
    
    try {
      if (DRY_RUN) {
        console.log(`  [DRY RUN] Would delete: ${year} ${make} ${model} (${reason})`);
        stats.deleted++;
      } else {
        const result = await db
          .delete(schema.vehicleFitments)
          .where(
            and(
              eq(schema.vehicleFitments.year, year),
              eq(schema.vehicleFitments.make, make),
              eq(schema.vehicleFitments.model, model)
            )
          );
        
        console.log(`  Deleted: ${year} ${make} ${model}`);
        stats.deleted++;
      }
    } catch (err) {
      console.error(`  ERROR deleting ${year} ${make} ${model}: ${err.message}`);
      stats.errors.push({ type: 'delete', entry, error: err.message });
    }
  }
  
  console.log(`  Total: ${toDelete.length} entries`);
}

/**
 * Mark non-US market vehicles
 * Instead of deleting, we'll add a note to the record
 */
async function markNonUsMarket(db, schema) {
  console.log('\n=== Marking Non-US Market Vehicles ===');
  
  const { eq, and, sql } = await import('drizzle-orm');
  const toMark = issues.deletes.nonUsMarket;
  
  // Group by make/model for efficiency
  const grouped = new Map();
  for (const entry of toMark) {
    const key = `${entry.make}|${entry.model}`;
    if (!grouped.has(key)) {
      grouped.set(key, { make: entry.make, model: entry.model, years: [], reason: entry.reason });
    }
    grouped.get(key).years.push(entry.year);
  }
  
  for (const [key, data] of grouped) {
    const { make, model, years, reason } = data;
    
    try {
      if (DRY_RUN) {
        console.log(`  [DRY RUN] Would mark as non-US: ${make} ${model} (${years.length} years) - ${reason}`);
        stats.updated += years.length;
      } else {
        // Add override entry marking as non-US
        for (const year of years) {
          await db.insert(schema.fitmentOverrides).values({
            scope: 'model',
            year,
            make,
            model,
            notes: `Non-US market: ${reason}`,
            reason: 'Automated QA - Non-US market vehicle',
            createdBy: 'tire-validation-qa',
            active: true,
          }).onConflictDoNothing();
          
          stats.updated++;
        }
        console.log(`  Marked: ${make} ${model} (${years.length} years)`);
      }
    } catch (err) {
      console.error(`  ERROR marking ${make} ${model}: ${err.message}`);
      stats.errors.push({ type: 'mark-nonus', data, error: err.message });
    }
  }
  
  console.log(`  Total: ${toMark.length} entries`);
}

/**
 * Apply tire size corrections
 */
async function updateTireSizes(db, schema) {
  console.log('\n=== Updating Wrong Tire Sizes ===');
  
  const toUpdate = issues.updates.wrongTireSizes;
  
  // These need manual review since the format varies
  // For now, log them for manual correction
  
  console.log(`  Found ${toUpdate.length} entries needing tire size corrections`);
  console.log('  NOTE: Tire size updates require manual review. See consolidated-issues.json');
  
  if (!DRY_RUN) {
    // Write to a separate file for manual processing
    const outputPath = path.join(__dirname, 'tire-size-corrections-needed.json');
    fs.writeFileSync(outputPath, JSON.stringify(toUpdate, null, 2));
    console.log(`  Written to: ${outputPath}`);
  }
  
  stats.skipped += toUpdate.length;
}

/**
 * Flag missing staggered rear sizes for research
 */
async function flagMissingRearSizes(db, schema) {
  console.log('\n=== Flagging Missing Rear Sizes ===');
  
  const missing = issues.inserts.missingRearSizes;
  
  console.log(`  Found ${missing.length} staggered vehicles missing rear tire sizes`);
  
  if (!DRY_RUN) {
    const outputPath = path.join(__dirname, 'missing-rear-sizes.json');
    fs.writeFileSync(outputPath, JSON.stringify(missing, null, 2));
    console.log(`  Written to: ${outputPath}`);
  }
  
  stats.skipped += missing.length;
}

/**
 * Generate SQL for bulk operations
 */
function generateBulkDeleteSQL() {
  console.log('\n=== Generating Bulk SQL ===');
  
  const sqlStatements = [];
  
  // Invalid years
  for (const entry of issues.deletes.invalidYears) {
    const { year, make, model } = entry;
    sqlStatements.push(
      `DELETE FROM vehicle_fitments WHERE year = ${year} AND LOWER(make) = '${make.toLowerCase()}' AND LOWER(model) = '${model.toLowerCase()}';`
    );
  }
  
  // Write SQL file
  const sqlPath = path.join(__dirname, 'corrections.sql');
  fs.writeFileSync(sqlPath, sqlStatements.join('\n'));
  console.log(`  SQL written to: ${sqlPath}`);
  console.log(`  Total statements: ${sqlStatements.length}`);
}

/**
 * Generate report
 */
function generateReport() {
  console.log('\n=== CORRECTION SUMMARY ===');
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
  console.log(`Category: ${CATEGORY}`);
  console.log('');
  console.log(`Deleted:  ${stats.deleted}`);
  console.log(`Updated:  ${stats.updated}`);
  console.log(`Inserted: ${stats.inserted}`);
  console.log(`Skipped:  ${stats.skipped}`);
  console.log(`Errors:   ${stats.errors.length}`);
  
  if (stats.errors.length > 0) {
    console.log('\nErrors:');
    for (const err of stats.errors.slice(0, 10)) {
      console.log(`  - ${err.type}: ${err.error}`);
    }
    if (stats.errors.length > 10) {
      console.log(`  ... and ${stats.errors.length - 10} more`);
    }
  }
}

/**
 * Main execution
 */
async function main() {
  console.log('========================================');
  console.log('  TIRE DATA CORRECTION TOOL');
  console.log('========================================');
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no changes)' : 'LIVE (will modify database)'}`);
  console.log(`Category: ${CATEGORY}`);
  console.log('');
  
  if (!DRY_RUN) {
    console.log('⚠️  WARNING: This will modify the production database!');
    console.log('    Press Ctrl+C within 5 seconds to abort...');
    await new Promise(r => setTimeout(r, 5000));
  }
  
  let db, client, schema;
  
  try {
    // For dry run, we don't need DB connection
    if (!DRY_RUN) {
      ({ db, client, schema } = await initDb());
    }
    
    // Run corrections based on category
    if (CATEGORY === 'all' || CATEGORY === 'deletes') {
      await deleteInvalidYears(db, { vehicleFitments: {} });
      await markNonUsMarket(db, { fitmentOverrides: {} });
    }
    
    if (CATEGORY === 'all' || CATEGORY === 'updates') {
      await updateTireSizes(db, {});
    }
    
    if (CATEGORY === 'all' || CATEGORY === 'inserts') {
      await flagMissingRearSizes(db, {});
    }
    
    // Always generate SQL for review
    generateBulkDeleteSQL();
    
    // Final report
    generateReport();
    
  } catch (err) {
    console.error('Fatal error:', err);
    process.exit(1);
  } finally {
    if (client) {
      await client.end();
    }
  }
}

main();
