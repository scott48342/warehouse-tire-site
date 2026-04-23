#!/usr/bin/env node
/**
 * Prepare batches for researching missing wheel/tire data
 */

import pg from 'pg';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const { Client } = pg;

const envPath = join(__dirname, '..', '..', '.env.local');
const envContent = readFileSync(envPath, 'utf-8');
const match = envContent.match(/POSTGRES_URL="([^"]+)"/);
const connectionString = match ? match[1] : null;

const BATCH_SIZE = 50;

async function main() {
  const client = new Client({ connectionString });
  await client.connect();
  
  console.log('\n📋 PREPARING GAP RESEARCH BATCHES\n');
  
  // Get all vehicles missing wheel OR tire data
  const gaps = await client.query(`
    SELECT DISTINCT year, make, model,
           CASE WHEN oem_wheel_sizes IS NULL OR oem_wheel_sizes = '[]'::jsonb THEN true ELSE false END as missing_wheels,
           CASE WHEN oem_tire_sizes IS NULL OR oem_tire_sizes = '[]'::jsonb THEN true ELSE false END as missing_tires,
           oem_wheel_sizes::text as current_wheels,
           oem_tire_sizes::text as current_tires
    FROM vehicle_fitments 
    WHERE (oem_wheel_sizes IS NULL OR oem_wheel_sizes = '[]'::jsonb OR jsonb_array_length(oem_wheel_sizes) = 0)
       OR (oem_tire_sizes IS NULL OR oem_tire_sizes = '[]'::jsonb OR jsonb_array_length(oem_tire_sizes) = 0)
    ORDER BY make, model, year
  `);
  
  console.log(`Total gaps found: ${gaps.rows.length}`);
  
  // Group by make for better research efficiency
  const byMake = {};
  for (const row of gaps.rows) {
    if (!byMake[row.make]) byMake[row.make] = [];
    byMake[row.make].push({
      year: row.year,
      make: row.make,
      model: row.model,
      missingWheels: row.missing_wheels,
      missingTires: row.missing_tires,
      currentWheels: row.current_wheels,
      currentTires: row.current_tires
    });
  }
  
  console.log(`\nGaps by make:`);
  const makes = Object.keys(byMake).sort((a, b) => byMake[b].length - byMake[a].length);
  for (const make of makes.slice(0, 15)) {
    console.log(`  ${make}: ${byMake[make].length}`);
  }
  
  // Create batches
  const batchDir = join(__dirname, 'gap-batches');
  try { mkdirSync(batchDir, { recursive: true }); } catch {}
  
  const allVehicles = gaps.rows.map(r => ({
    year: r.year,
    make: r.make,
    model: r.model,
    missingWheels: r.missing_wheels,
    missingTires: r.missing_tires
  }));
  
  const batches = [];
  for (let i = 0; i < allVehicles.length; i += BATCH_SIZE) {
    const batch = allVehicles.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    batches.push({
      batchId: batchNum,
      vehicles: batch
    });
  }
  
  console.log(`\nCreating ${batches.length} batches of ${BATCH_SIZE} vehicles each...`);
  
  for (const batch of batches) {
    const filename = join(batchDir, `gap-batch-${String(batch.batchId).padStart(3, '0')}.json`);
    writeFileSync(filename, JSON.stringify(batch, null, 2));
  }
  
  console.log(`\n✅ Created ${batches.length} batch files in gap-batches/`);
  console.log(`\nSummary:`);
  console.log(`  Total vehicles needing research: ${allVehicles.length}`);
  console.log(`  Batches created: ${batches.length}`);
  console.log(`  Batch size: ${BATCH_SIZE}`);
  
  // Save summary
  const summary = {
    totalGaps: allVehicles.length,
    batchCount: batches.length,
    batchSize: BATCH_SIZE,
    byMake: Object.fromEntries(makes.map(m => [m, byMake[m].length])),
    generatedAt: new Date().toISOString()
  };
  writeFileSync(join(batchDir, 'summary.json'), JSON.stringify(summary, null, 2));
  
  await client.end();
}

main().catch(console.error);
