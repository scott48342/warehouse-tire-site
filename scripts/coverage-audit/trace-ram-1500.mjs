#!/usr/bin/env node
/**
 * Trace 2018 Ram 1500 through all fitment tables
 * Find where data is disappearing
 */
import postgres from 'postgres';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '../../.env.local') });

const sql = postgres(process.env.POSTGRES_URL);

async function trace() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('TRACING 2018 RAM 1500 THROUGH ALL DATA LAYERS');
  console.log('═══════════════════════════════════════════════════════════════\n');
  
  // 1. vehicle_fitments (canonical table)
  console.log('1. vehicle_fitments (CANONICAL SOURCE OF TRUTH):');
  console.log('─────────────────────────────────────────────────');
  const vf = await sql`
    SELECT id, make, model, display_trim, modification_id, bolt_pattern, 
           center_bore_mm, source, quality_tier, confidence_tag,
           created_at, updated_at 
    FROM vehicle_fitments 
    WHERE year = 2018 
      AND LOWER(make) = 'ram' 
      AND LOWER(model) LIKE '%1500%'
  `;
  console.log(`   Records found: ${vf.length}`);
  if (vf.length > 0) {
    vf.forEach(r => {
      console.log(`   • ${r.id.slice(0,8)}... | ${r.make} ${r.model} | ${r.display_trim}`);
      console.log(`     Bolt: ${r.bolt_pattern} | CB: ${r.center_bore_mm}mm | Source: ${r.source}`);
      console.log(`     Created: ${r.created_at} | Updated: ${r.updated_at}`);
    });
  } else {
    console.log('   ⚠️  NO RECORDS FOUND - This is the problem!');
  }
  
  // 2. Check ALL Ram vehicles in vehicle_fitments
  console.log('\n2. ALL RAM VEHICLES in vehicle_fitments:');
  console.log('─────────────────────────────────────────');
  const allRam = await sql`
    SELECT year, model, COUNT(*) as cnt
    FROM vehicle_fitments 
    WHERE LOWER(make) = 'ram'
    GROUP BY year, model
    ORDER BY model, year
  `;
  console.log(`   Total RAM year/model combos: ${allRam.length}`);
  if (allRam.length > 0) {
    const models = {};
    allRam.forEach(r => {
      if (!models[r.model]) models[r.model] = [];
      models[r.model].push(r.year);
    });
    for (const [model, years] of Object.entries(models)) {
      console.log(`   • ${model}: years ${Math.min(...years)}-${Math.max(...years)} (${years.length} records)`);
    }
  } else {
    console.log('   ⚠️  NO RAM VEHICLES AT ALL!');
  }
  
  // 3. vehicle_fitment_configurations (deprecated but check anyway)
  console.log('\n3. vehicle_fitment_configurations (DEPRECATED):');
  console.log('────────────────────────────────────────────────');
  const vfc = await sql`
    SELECT id, make_key, model_key, display_trim, source, created_at 
    FROM vehicle_fitment_configurations 
    WHERE year = 2018 
      AND LOWER(make_key) = 'ram' 
      AND LOWER(model_key) LIKE '%1500%'
    LIMIT 10
  `;
  console.log(`   Records found: ${vfc.length}`);
  
  // 4. wheel_size_trim_mappings
  console.log('\n4. wheel_size_trim_mappings:');
  console.log('────────────────────────────');
  const wstm = await sql`
    SELECT id, make, model, our_trim, status, match_method, created_at 
    FROM wheel_size_trim_mappings 
    WHERE year = 2018 
      AND LOWER(make) = 'ram' 
      AND LOWER(model) LIKE '%1500%'
    LIMIT 10
  `;
  console.log(`   Records found: ${wstm.length}`);
  if (wstm.length > 0) {
    wstm.forEach(r => console.log(`   • ${r.our_trim} | status: ${r.status} | method: ${r.match_method}`));
  }
  
  // 5. fitment_overrides
  console.log('\n5. fitment_overrides:');
  console.log('─────────────────────');
  const fo = await sql`
    SELECT * FROM fitment_overrides 
    WHERE year = 2018 
      AND LOWER(make) = 'ram' 
      AND LOWER(model) LIKE '%1500%'
  `;
  console.log(`   Records found: ${fo.length}`);
  
  // 6. fitment_import_jobs (check recent)
  console.log('\n6. fitment_import_jobs (last 10):');
  console.log('──────────────────────────────────');
  const fij = await sql`
    SELECT id, source, status, total_records, imported_records, skipped_records, 
           error_count, started_at, completed_at 
    FROM fitment_import_jobs 
    ORDER BY created_at DESC 
    LIMIT 10
  `;
  console.log(`   Recent jobs: ${fij.length}`);
  fij.forEach(r => {
    console.log(`   • ${r.source} | ${r.status} | imported: ${r.imported_records}/${r.total_records} | errors: ${r.error_count}`);
  });
  
  // 7. researched_fitment_cache
  console.log('\n7. researched_fitment_cache:');
  console.log('────────────────────────────');
  const rfc = await sql`
    SELECT id, vehicle_key, status, confidence, use_count, created_at 
    FROM researched_fitment_cache 
    WHERE year = 2018 
      AND LOWER(make) = 'ram' 
      AND LOWER(model) LIKE '%1500%'
  `;
  console.log(`   Records found: ${rfc.length}`);
  
  // 8. Check for any scheduled jobs or cron
  console.log('\n8. Looking for sync/ETL patterns in codebase...');
  console.log('───────────────────────────────────────────────');
  
  // 9. Check if there are DELETE statements anywhere recent
  console.log('\n9. Database activity check:');
  console.log('───────────────────────────');
  // Check recently updated records
  const recentUpdates = await sql`
    SELECT make, model, year, updated_at
    FROM vehicle_fitments
    WHERE updated_at > NOW() - INTERVAL '7 days'
    ORDER BY updated_at DESC
    LIMIT 20
  `;
  console.log(`   Records updated in last 7 days: ${recentUpdates.length}`);
  if (recentUpdates.length > 0) {
    console.log('   Recent updates:');
    recentUpdates.slice(0, 10).forEach(r => {
      console.log(`   • ${r.year} ${r.make} ${r.model} @ ${r.updated_at}`);
    });
  }
  
  // 10. Check total record counts
  console.log('\n10. Total record counts:');
  console.log('────────────────────────');
  const totalVf = await sql`SELECT COUNT(*) as cnt FROM vehicle_fitments`;
  const totalVfc = await sql`SELECT COUNT(*) as cnt FROM vehicle_fitment_configurations`;
  const totalWstm = await sql`SELECT COUNT(*) as cnt FROM wheel_size_trim_mappings`;
  console.log(`   vehicle_fitments: ${totalVf[0].cnt}`);
  console.log(`   vehicle_fitment_configurations: ${totalVfc[0].cnt}`);
  console.log(`   wheel_size_trim_mappings: ${totalWstm[0].cnt}`);
  
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('ANALYSIS COMPLETE');
  console.log('═══════════════════════════════════════════════════════════════');
  
  await sql.end();
}

trace().catch(e => { console.error(e); process.exit(1); });
