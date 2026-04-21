#!/usr/bin/env node
/**
 * Tire Data Cleanup Runner
 * Executes all cleanup SQL scripts in sequence
 * 
 * Usage:
 *   node run-cleanup.mjs           # Run all scripts
 *   node run-cleanup.mjs --dry-run # Show what would be done
 */

import { readFile } from 'fs/promises';
import pg from 'pg';
import 'dotenv/config';

const { Client } = pg;

const scripts = [
  { file: '01-delete-phantom-years.sql', desc: 'Delete phantom years' },
  { file: '02-delete-non-us-vehicles.sql', desc: 'Delete non-US vehicles' },
  { file: '03-fix-tire-sizes.sql', desc: 'Fix wrong tire sizes' },
  { file: '04-populate-empty-records.sql', desc: 'Populate empty records' },
  { file: '05-validate-cleanup.sql', desc: 'Validate cleanup' },
];

const isDryRun = process.argv.includes('--dry-run');

async function main() {
  const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  
  if (!connectionString) {
    console.error('❌ No database connection string found (POSTGRES_URL or DATABASE_URL)');
    process.exit(1);
  }

  console.log('🔧 Tire Data Cleanup Runner');
  console.log('='.repeat(50));
  
  if (isDryRun) {
    console.log('🏃 DRY RUN MODE - No changes will be made\n');
  }

  const client = new Client({ connectionString });
  
  try {
    await client.connect();
    console.log('✅ Connected to database\n');

    // Get initial count
    const beforeCount = await client.query('SELECT COUNT(*) as count FROM vehicle_fitments');
    console.log(`📊 Records before cleanup: ${beforeCount.rows[0].count}\n`);

    for (const script of scripts) {
      console.log(`\n${'='.repeat(50)}`);
      console.log(`📄 ${script.desc}`);
      console.log(`   File: ${script.file}`);
      console.log('='.repeat(50));

      const sql = await readFile(new URL(script.file, import.meta.url), 'utf-8');
      
      if (isDryRun) {
        // In dry run, just show the SQL
        console.log('\n[DRY RUN] Would execute:');
        console.log(sql.substring(0, 500) + '...\n');
      } else {
        try {
          const result = await client.query(sql);
          console.log(`✅ Completed successfully`);
          if (result.rowCount !== null) {
            console.log(`   Rows affected: ${result.rowCount}`);
          }
        } catch (err) {
          console.error(`❌ Error: ${err.message}`);
          // Continue with next script
        }
      }
    }

    // Get final count
    if (!isDryRun) {
      const afterCount = await client.query('SELECT COUNT(*) as count FROM vehicle_fitments');
      console.log(`\n${'='.repeat(50)}`);
      console.log('📊 CLEANUP SUMMARY');
      console.log('='.repeat(50));
      console.log(`   Before: ${beforeCount.rows[0].count} records`);
      console.log(`   After:  ${afterCount.rows[0].count} records`);
      console.log(`   Removed: ${beforeCount.rows[0].count - afterCount.rows[0].count} records`);
    }

  } catch (err) {
    console.error('❌ Database error:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }

  console.log('\n✅ Cleanup complete!');
  console.log('\nNext steps:');
  console.log('  1. Clear cache: node scripts/clear-tire-cache.js');
  console.log('  2. Test vehicle selector flow on dev site');
  console.log('  3. Deploy to production when satisfied');
}

main();
