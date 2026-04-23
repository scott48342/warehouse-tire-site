/**
 * Prepare vehicle batches for parallel wheel spec research
 */
import pg from 'pg';
import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const BATCH_SIZE = 75; // vehicles per batch
const OUTPUT_DIR = 'scripts/wheel-research/batches';

const client = new pg.Client({ connectionString: process.env.POSTGRES_URL });
await client.connect();

// Get all vehicles needing wheel specs
const { rows: vehicles } = await client.query(`
  SELECT DISTINCT year, make, model
  FROM vehicle_fitments
  WHERE quality_tier != 'complete'
    AND year >= 2000
  ORDER BY make, model, year DESC
`);

console.log(`Total vehicles needing research: ${vehicles.length}`);

// Create output directory
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Split into batches
const batches = [];
for (let i = 0; i < vehicles.length; i += BATCH_SIZE) {
  batches.push(vehicles.slice(i, i + BATCH_SIZE));
}

console.log(`Created ${batches.length} batches of ~${BATCH_SIZE} vehicles each`);

// Write batch files
for (let i = 0; i < batches.length; i++) {
  const batchNum = String(i + 1).padStart(2, '0');
  const filename = `${OUTPUT_DIR}/batch-${batchNum}.json`;
  fs.writeFileSync(filename, JSON.stringify({
    batchId: batchNum,
    totalBatches: batches.length,
    vehicleCount: batches[i].length,
    vehicles: batches[i]
  }, null, 2));
}

console.log(`\nBatch files written to ${OUTPUT_DIR}/`);
console.log(`\nBatch summary:`);
console.log(`  - Total vehicles: ${vehicles.length}`);
console.log(`  - Batch count: ${batches.length}`);
console.log(`  - Batch size: ${BATCH_SIZE}`);

// Also create a manifest
fs.writeFileSync(`${OUTPUT_DIR}/manifest.json`, JSON.stringify({
  createdAt: new Date().toISOString(),
  totalVehicles: vehicles.length,
  batchCount: batches.length,
  batchSize: BATCH_SIZE,
  batches: batches.map((b, i) => ({
    id: String(i + 1).padStart(2, '0'),
    count: b.length,
    file: `batch-${String(i + 1).padStart(2, '0')}.json`
  }))
}, null, 2));

console.log(`\nManifest written to ${OUTPUT_DIR}/manifest.json`);

await client.end();
