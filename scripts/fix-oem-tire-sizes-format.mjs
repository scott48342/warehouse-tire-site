#!/usr/bin/env node
/**
 * Audit and Fix OEM Tire Sizes Format
 * 
 * Problem: Some records have oem_tire_sizes stored as object arrays:
 *   [{"size": "275/65R18"}]
 * Instead of string arrays:
 *   ["275/65R18"]
 * 
 * This script:
 * 1. Audits all vehicle_fitments records for object-array format
 * 2. Reports counts by format type
 * 3. Optionally fixes safe records (--fix flag)
 * 
 * Usage:
 *   node scripts/fix-oem-tire-sizes-format.mjs           # Audit only
 *   node scripts/fix-oem-tire-sizes-format.mjs --fix     # Fix records
 * 
 * 2026-05-13: Created for F-150 Lightning fix
 */

import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const pool = new pg.Pool({ connectionString: process.env.POSTGRES_URL });
const DRY_RUN = !process.argv.includes('--fix');

// ============================================================================
// Helpers
// ============================================================================

function analyzeFormat(oemTireSizes) {
  if (!oemTireSizes) return { format: 'null', sizes: [] };
  if (!Array.isArray(oemTireSizes)) return { format: 'invalid', sizes: [] };
  if (oemTireSizes.length === 0) return { format: 'empty', sizes: [] };
  
  const firstItem = oemTireSizes[0];
  
  if (typeof firstItem === 'string') {
    return { format: 'string-array', sizes: oemTireSizes };
  }
  
  if (typeof firstItem === 'object' && firstItem !== null) {
    // Check if all items have valid size/tireSize property
    const extractedSizes = [];
    let allValid = true;
    
    for (const item of oemTireSizes) {
      const size = item?.size || item?.tireSize;
      if (typeof size === 'string' && size.trim()) {
        extractedSizes.push(size.trim());
      } else {
        allValid = false;
      }
    }
    
    if (allValid && extractedSizes.length === oemTireSizes.length) {
      return { format: 'object-array-safe', sizes: extractedSizes };
    } else {
      return { format: 'object-array-mixed', sizes: extractedSizes };
    }
  }
  
  return { format: 'unknown', sizes: [] };
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  console.log('='.repeat(70));
  console.log('OEM TIRE SIZES FORMAT AUDIT');
  console.log(DRY_RUN ? '(AUDIT ONLY - use --fix to apply changes)' : '(FIX MODE - will update records)');
  console.log('='.repeat(70));
  console.log('');
  
  // Fetch all records with oem_tire_sizes
  const result = await pool.query(`
    SELECT id, year, make, model, display_trim, oem_tire_sizes
    FROM vehicle_fitments
    WHERE oem_tire_sizes IS NOT NULL
    ORDER BY year DESC, make, model
  `);
  
  console.log(`Total records with oem_tire_sizes: ${result.rows.length}`);
  console.log('');
  
  // Categorize by format
  const byFormat = {
    'null': [],
    'empty': [],
    'string-array': [],
    'object-array-safe': [],
    'object-array-mixed': [],
    'invalid': [],
    'unknown': [],
  };
  
  for (const row of result.rows) {
    const analysis = analyzeFormat(row.oem_tire_sizes);
    byFormat[analysis.format].push({
      id: row.id,
      year: row.year,
      make: row.make,
      model: row.model,
      trim: row.display_trim,
      originalSizes: row.oem_tire_sizes,
      extractedSizes: analysis.sizes,
    });
  }
  
  // Report
  console.log('Format Distribution:');
  console.log('-'.repeat(50));
  for (const [format, records] of Object.entries(byFormat)) {
    if (records.length > 0) {
      console.log(`  ${format}: ${records.length} records`);
    }
  }
  console.log('');
  
  // Show object-array-safe records (these are fixable)
  const fixable = byFormat['object-array-safe'];
  if (fixable.length > 0) {
    console.log('Object-Array Records (fixable):');
    console.log('-'.repeat(50));
    for (const rec of fixable.slice(0, 20)) {
      console.log(`  ${rec.year} ${rec.make} ${rec.model} (${rec.trim})`);
      console.log(`    Original: ${JSON.stringify(rec.originalSizes)}`);
      console.log(`    Fixed:    ${JSON.stringify(rec.extractedSizes)}`);
    }
    if (fixable.length > 20) {
      console.log(`  ... and ${fixable.length - 20} more`);
    }
    console.log('');
  }
  
  // Show mixed/invalid records (need manual review)
  const needsReview = [...byFormat['object-array-mixed'], ...byFormat['invalid'], ...byFormat['unknown']];
  if (needsReview.length > 0) {
    console.log('⚠️  Records needing manual review:');
    console.log('-'.repeat(50));
    for (const rec of needsReview) {
      console.log(`  ${rec.year} ${rec.make} ${rec.model} (${rec.trim})`);
      console.log(`    Data: ${JSON.stringify(rec.originalSizes)}`);
    }
    console.log('');
  }
  
  // Fix if requested
  if (!DRY_RUN && fixable.length > 0) {
    console.log('Applying fixes...');
    console.log('-'.repeat(50));
    
    let fixed = 0;
    let errors = 0;
    
    for (const rec of fixable) {
      try {
        await pool.query(`
          UPDATE vehicle_fitments
          SET oem_tire_sizes = $1,
              updated_at = NOW()
          WHERE id = $2
        `, [JSON.stringify(rec.extractedSizes), rec.id]);
        fixed++;
      } catch (err) {
        console.error(`  ❌ Failed to fix ${rec.year} ${rec.make} ${rec.model}: ${err.message}`);
        errors++;
      }
    }
    
    console.log(`✅ Fixed ${fixed} records`);
    if (errors > 0) {
      console.log(`❌ ${errors} errors`);
    }
  } else if (fixable.length > 0) {
    console.log(`To fix ${fixable.length} records, run:`);
    console.log('  node scripts/fix-oem-tire-sizes-format.mjs --fix');
  }
  
  console.log('');
  console.log('='.repeat(70));
  
  await pool.end();
}

main().catch(err => {
  console.error('Error:', err);
  pool.end();
  process.exit(1);
});
