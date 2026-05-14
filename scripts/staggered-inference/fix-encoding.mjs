#!/usr/bin/env node
/**
 * Fix double-encoded JSON in oem_tire_sizes
 * 
 * The Phase A apply wrote JSON strings instead of JSONB objects.
 * This script fixes the encoding.
 */

import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import postgres from 'postgres';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../../.env.local') });

const sql = postgres(process.env.POSTGRES_URL);

console.log('🔧 Fixing double-encoded oem_tire_sizes...\n');

// Find records that have double-encoded JSON (string starts with "[{")
const badRecords = await sql`
  SELECT id, year, make, model, display_trim, oem_tire_sizes
  FROM vehicle_fitments
  WHERE oem_tire_sizes::text LIKE '"[{%'
    OR oem_tire_sizes::text LIKE '"[\\{%'
`;

console.log(`Found ${badRecords.length} records with double-encoded data\n`);

let fixedCount = 0;
let errorCount = 0;

for (const record of badRecords) {
  try {
    // The data is stored as a JSON string, so we need to parse it
    let tireSizes = record.oem_tire_sizes;
    
    // If it's a string (double-encoded), parse it
    if (typeof tireSizes === 'string') {
      tireSizes = JSON.parse(tireSizes);
    }
    
    // Now write it back properly as JSONB
    await sql`
      UPDATE vehicle_fitments
      SET oem_tire_sizes = ${sql.json(tireSizes)},
          updated_at = NOW()
      WHERE id = ${record.id}::uuid
    `;
    
    fixedCount++;
    if (fixedCount % 20 === 0) {
      console.log(`  Fixed ${fixedCount}/${badRecords.length}...`);
    }
  } catch (err) {
    errorCount++;
    console.error(`  ❌ Error fixing ${record.id}: ${err.message}`);
  }
}

console.log(`\n✅ Fixed ${fixedCount} records`);
if (errorCount > 0) {
  console.log(`⚠️  ${errorCount} errors`);
}

// Verify fix
console.log('\n📋 Verifying fix...');
const verifyRecords = await sql`
  SELECT id, year, make, model, display_trim, oem_tire_sizes
  FROM vehicle_fitments
  WHERE make = 'Chevrolet' AND model = 'Camaro' 
    AND display_trim LIKE '%SS 1LE%'
    AND year = 2024
  LIMIT 2
`;

for (const row of verifyRecords) {
  console.log(`\n${row.year} ${row.make} ${row.model} ${row.display_trim}`);
  console.log('  Type:', typeof row.oem_tire_sizes);
  console.log('  Data:', JSON.stringify(row.oem_tire_sizes, null, 2));
}

await sql.end();
