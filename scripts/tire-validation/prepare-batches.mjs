/**
 * Prepare vehicle batches for tire size validation
 * Uses same vehicles from wheel research, validates/updates tire sizes
 */
import pg from 'pg';
import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const BATCH_SIZE = 75;
const OUTPUT_DIR = 'scripts/tire-validation/batches';

const client = new pg.Client({ connectionString: process.env.POSTGRES_URL });
await client.connect();

// Get all vehicles - include current tire sizes for validation
const { rows: vehicles } = await client.query(`
  SELECT DISTINCT 
    year, 
    make, 
    model,
    oem_tire_sizes
  FROM vehicle_fitments
  WHERE year >= 2000
  ORDER BY make, model, year DESC
`);

console.log(`Total vehicles for tire validation: ${vehicles.length}`);

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
    vehicles: batches[i].map(v => ({
      year: v.year,
      make: v.make,
      model: v.model,
      currentTireSizes: v.oem_tire_sizes || []
    }))
  }, null, 2));
}

console.log(`\nBatch files written to ${OUTPUT_DIR}/`);

// Create manifest
fs.writeFileSync(`${OUTPUT_DIR}/manifest.json`, JSON.stringify({
  createdAt: new Date().toISOString(),
  totalVehicles: vehicles.length,
  batchCount: batches.length,
  batchSize: BATCH_SIZE,
  purpose: 'tire_size_validation'
}, null, 2));

console.log(`Manifest written to ${OUTPUT_DIR}/manifest.json`);

await client.end();
