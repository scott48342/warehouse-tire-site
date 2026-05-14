// Fix Chevy Trax malformed JSON tire sizes
// Issue: 2024 records stored as raw strings instead of JSON arrays
// Usage: node fix-trax-tire-sizes.mjs [--apply]

import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '../.env.local') });

const DRY_RUN = !process.argv.includes('--apply');

async function main() {
  console.log(`\n🔍 Chevy Trax Malformed Tire Size Fix`);
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : '⚠️  APPLYING CHANGES'}\n`);

  const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('❌ No database connection string found');
    process.exit(1);
  }

  const pool = new pg.Pool({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    // Find all Chevy Trax records
    const result = await pool.query(`
      SELECT id, year, make, model, display_trim, oem_tire_sizes, modification_id
      FROM vehicle_fitments
      WHERE make = 'Chevrolet' AND model = 'Trax'
      ORDER BY year, display_trim
    `);

    const traxRecords = result.rows;
    console.log(`Found ${traxRecords.length} Chevy Trax records total\n`);

    // Find malformed records (stored as string instead of array)
    const malformedRecords = [];
    
    for (const record of traxRecords) {
      const tires = record.oem_tire_sizes;
      
      // Issue: JSONB column stores a raw string like "[\"215/55R17\"]" 
      // instead of a proper JSON array ["215/55R17"]
      if (typeof tires === 'string' && tires.startsWith('[')) {
        try {
          const parsed = JSON.parse(tires);
          if (Array.isArray(parsed)) {
            malformedRecords.push({
              id: record.id,
              year: record.year,
              make: record.make,
              model: record.model,
              displayTrim: record.display_trim,
              modificationId: record.modification_id,
              currentValue: tires,        // Raw string
              parsedValue: parsed         // Proper array
            });
          }
        } catch (e) {
          console.log(`⚠️  Unparseable record ${record.id}: ${tires}`);
        }
      }
    }

    // Show all records for context
    console.log(`📋 ALL TRAX RECORDS:\n`);
    for (const rec of traxRecords) {
      const tires = rec.oem_tire_sizes;
      const type = Array.isArray(tires) ? '✅ array' : `❌ ${typeof tires}`;
      console.log(`  ${rec.year} ${rec.display_trim}: ${type} → ${JSON.stringify(tires)}`);
    }

    console.log(`\n📋 SNAPSHOT - ${malformedRecords.length} Malformed Records:\n`);
    console.log('='.repeat(80));
    
    for (const rec of malformedRecords) {
      console.log(`ID: ${rec.id}`);
      console.log(`  Vehicle: ${rec.year} ${rec.make} ${rec.model} ${rec.displayTrim}`);
      console.log(`  ModificationID: ${rec.modificationId}`);
      console.log(`  BEFORE (string): ${JSON.stringify(rec.currentValue)}`);
      console.log(`  AFTER (array):   ${JSON.stringify(rec.parsedValue)}`);
      console.log('-'.repeat(80));
    }

    if (malformedRecords.length === 0) {
      console.log('✅ No malformed records found!');
      await pool.end();
      return;
    }

    if (DRY_RUN) {
      console.log(`\n🔒 DRY RUN - No changes made`);
      console.log(`Run with --apply to fix these ${malformedRecords.length} records`);
    } else {
      console.log(`\n⚠️  APPLYING FIXES...`);
      
      for (const rec of malformedRecords) {
        // Update with properly formatted JSON array
        await pool.query(
          `UPDATE vehicle_fitments SET oem_tire_sizes = $1::jsonb WHERE id = $2`,
          [JSON.stringify(rec.parsedValue), rec.id]
        );
        console.log(`✅ Fixed ${rec.id} (${rec.year} Trax ${rec.displayTrim})`);
      }
      
      console.log(`\n✅ Fixed ${malformedRecords.length} records`);
      
      // Verify fix
      console.log(`\n🔍 VERIFICATION:`);
      const verify = await pool.query(`
        SELECT year, display_trim, oem_tire_sizes
        FROM vehicle_fitments
        WHERE make = 'Chevrolet' AND model = 'Trax' AND year = 2024
        ORDER BY display_trim
      `);
      for (const rec of verify.rows) {
        const tires = rec.oem_tire_sizes;
        const type = Array.isArray(tires) ? '✅ array' : `❌ ${typeof tires}`;
        console.log(`  ${rec.year} ${rec.display_trim}: ${type} → ${JSON.stringify(tires)}`);
      }
    }

    await pool.end();
  } catch (error) {
    console.error('Error:', error);
    await pool.end();
    process.exit(1);
  }
}

main();
