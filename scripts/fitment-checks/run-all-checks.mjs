#!/usr/bin/env node
/**
 * Run All Fitment Checks
 * 
 * Executes all fitment compliance checks in sequence.
 * Used by CI and pre-deploy validation.
 * 
 * Part of FITMENT_CHANGE_CONTROL.md compliance.
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const checks = [
  {
    name: 'Canonical Source Check',
    script: join(__dirname, 'canonical-source-check.mjs'),
  },
  {
    name: 'Deprecated Usage Check',
    script: join(__dirname, 'deprecated-usage-check.mjs'),
  },
];

async function runCheck(check) {
  return new Promise((resolve) => {
    console.log(`\n${'═'.repeat(60)}`);
    console.log(`Running: ${check.name}`);
    console.log('═'.repeat(60));
    
    const proc = spawn('node', [check.script], {
      stdio: 'inherit',
      cwd: join(__dirname, '../..'),
    });
    
    proc.on('close', (code) => {
      resolve({ name: check.name, passed: code === 0 });
    });
    
    proc.on('error', (err) => {
      console.error(`Error running ${check.name}:`, err);
      resolve({ name: check.name, passed: false });
    });
  });
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║   FITMENT COMPLIANCE CHECKS                                    ║');
  console.log('║   See docs/FITMENT_CHANGE_CONTROL.md                           ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  
  const results = [];
  
  for (const check of checks) {
    const result = await runCheck(check);
    results.push(result);
  }
  
  console.log('\n' + '═'.repeat(60));
  console.log('FITMENT CHECK SUMMARY');
  console.log('═'.repeat(60));
  
  let allPassed = true;
  for (const result of results) {
    const status = result.passed ? '✅ PASS' : '❌ FAIL';
    console.log(`  ${status}  ${result.name}`);
    if (!result.passed) allPassed = false;
  }
  
  console.log('═'.repeat(60));
  
  if (allPassed) {
    console.log('\n✅ ALL FITMENT CHECKS PASSED\n');
    process.exit(0);
  } else {
    console.log('\n❌ FITMENT CHECKS FAILED\n');
    console.log('See docs/FITMENT_CHANGE_CONTROL.md for remediation steps.\n');
    process.exit(1);
  }
}

main();
