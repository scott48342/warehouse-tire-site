/**
 * Overnight Verification Runner
 * 
 * This script orchestrates the overnight verification sweep.
 * It reads the manifest, processes batches, and imports results.
 * 
 * Run with: node --env-file=../../.env.local overnight-runner.mjs [start] [end]
 */

import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const BATCHES_DIR = './batches-overnight';
const RESULTS_DIR = './results-overnight';
const CONCURRENT = 1; // Single-threaded for sub-agent spawning

// Ensure results directory exists
if (!fs.existsSync(RESULTS_DIR)) {
  fs.mkdirSync(RESULTS_DIR, { recursive: true });
}

// Read manifest
const manifest = JSON.parse(fs.readFileSync(path.join(BATCHES_DIR, 'manifest.json'), 'utf-8'));

// Get command line args for range
const startBatch = parseInt(process.argv[2]) || 1;
const endBatch = parseInt(process.argv[3]) || manifest.length;

console.log(`\n=== OVERNIGHT VERIFICATION RUNNER ===`);
console.log(`Processing batches ${startBatch} to ${endBatch} of ${manifest.length}`);
console.log(`Start time: ${new Date().toISOString()}\n`);

// Filter to range
const toProcess = manifest.filter(m => m.batch >= startBatch && m.batch <= endBatch);
console.log(`Batches to process: ${toProcess.length}`);

// Check which are already done
const done = new Set(
  fs.readdirSync(RESULTS_DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => f.replace('.json', ''))
);

const remaining = toProcess.filter(m => !done.has(m.name));
console.log(`Already completed: ${toProcess.length - remaining.length}`);
console.log(`Remaining: ${remaining.length}\n`);

if (remaining.length === 0) {
  console.log('All batches in range already processed!');
  process.exit(0);
}

// Process batches
let processed = 0;
let errors = 0;

for (const batch of remaining) {
  const startTime = Date.now();
  console.log(`[${++processed}/${remaining.length}] Processing ${batch.name} (${batch.count} vehicles)...`);
  
  try {
    // The actual verification will be done by the main agent spawning sub-agents
    // This script just tracks what needs to be done
    console.log(`  Batch file: ${BATCHES_DIR}/${batch.file}`);
    console.log(`  Make: ${batch.make}`);
    console.log(`  Ready for verification`);
    
  } catch (err) {
    console.error(`  ERROR: ${err.message}`);
    errors++;
  }
  
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`  Elapsed: ${elapsed}s\n`);
}

console.log(`\n=== SUMMARY ===`);
console.log(`Batches checked: ${processed}`);
console.log(`Errors: ${errors}`);
console.log(`End time: ${new Date().toISOString()}`);
