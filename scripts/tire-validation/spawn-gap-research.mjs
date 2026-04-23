#!/usr/bin/env node
/**
 * Spawn research agents for all gap batches
 * Run from Clawdbot main session
 */

import { readFileSync, readdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const batchDir = join(__dirname, 'gap-batches');

// Get all batch files
const batchFiles = readdirSync(batchDir)
  .filter(f => f.match(/^gap-batch-\d+\.json$/))
  .sort();

console.log(`Found ${batchFiles.length} batch files to process`);

// Output spawn commands for Clawdbot
console.log('\n// Copy these spawn commands to execute:\n');

for (const file of batchFiles) {
  const batchNum = file.match(/gap-batch-(\d+)/)[1];
  console.log(`// Batch ${batchNum}`);
  console.log(`sessions_spawn({ label: "gap-${batchNum}", task: "Research batch ${batchNum}", runTimeoutSeconds: 3600 })`);
}

console.log(`\n// Total: ${batchFiles.length} agents to spawn`);
