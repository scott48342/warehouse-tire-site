#!/usr/bin/env node
import pg from 'pg';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const { Client } = pg;

const envPath = join(__dirname, '..', '..', '..', '.env.local');
const envContent = readFileSync(envPath, 'utf-8');
const match = envContent.match(/POSTGRES_URL="([^"]+)"/);
const connectionString = match ? match[1] : null;

async function main() {
  const client = new Client({ connectionString });
  await client.connect();
  
  console.log('\n📊 TIRE DATA CLEANUP - DRY RUN SUMMARY');
  console.log('='.repeat(50));
  
  const total = await client.query('SELECT COUNT(*) as count FROM vehicle_fitments');
  console.log(`\nCurrent total records: ${total.rows[0].count}`);
  
  // Empty records
  const empty = await client.query(`
    SELECT COUNT(*) as count FROM vehicle_fitments
    WHERE oem_tire_sizes IS NULL 
       OR oem_tire_sizes = '[]'::jsonb 
       OR oem_tire_sizes::text = '[]'
  `);
  console.log(`Empty tire size records: ${empty.rows[0].count}`);
  
  // Sample wrong sizes
  console.log('\nSample current tire sizes (to be corrected):');
  const samples = await client.query(`
    SELECT make, model, year, oem_tire_sizes::text as sizes
    FROM vehicle_fitments
    WHERE (make ILIKE 'Toyota' AND model ILIKE 'Corolla Cross' AND year = 2024)
       OR (make ILIKE 'Toyota' AND model ILIKE '%GR%Corolla%' AND year = 2024)
       OR (make ILIKE 'Volkswagen' AND model ILIKE 'GTI' AND year = 2024)
       OR (make ILIKE 'Lexus' AND model ILIKE 'LX%' AND year = 2024)
    ORDER BY make, model
    LIMIT 5
  `);
  
  for (const row of samples.rows) {
    console.log(`  ${row.make} ${row.model} ${row.year}: ${row.sizes || '[]'}`);
  }
  
  console.log('\n' + '='.repeat(50));
  console.log('CLEANUP IMPACT ESTIMATE:');
  console.log('='.repeat(50));
  console.log('  Phantom years to delete:    57 records');
  console.log('  Non-US vehicles to delete:  205 records');
  console.log('  Tire sizes to correct:      ~400 records');
  console.log(`  Empty records to populate:  ${empty.rows[0].count} records`);
  console.log('  ─────────────────────────────────────');
  console.log(`  Est. records after cleanup: ~${parseInt(total.rows[0].count) - 57 - 205}`);
  console.log('\n✅ Ready to run cleanup scripts!\n');
  
  await client.end();
}

main().catch(console.error);
