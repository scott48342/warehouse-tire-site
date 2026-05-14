#!/usr/bin/env node
/**
 * Deprecated Usage Check
 * 
 * Scans for deprecated fitment patterns that should not be in active code paths.
 * 
 * Part of FITMENT_CHANGE_CONTROL.md compliance.
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '../..');

// Patterns that should not appear in active runtime code
const DEPRECATED_RUNTIME_PATTERNS = [
  {
    pattern: /getFitmentFromConfig\s*\(/,
    message: 'Config table fitment lookup - should use canonicalResolver',
    severity: 'error',
  },
  {
    pattern: /getStaticFitment\s*\(/,
    message: 'Static JSON fitment lookup - removed in green state',
    severity: 'error',
  },
  {
    pattern: /wheel-size\.com.*api/i,
    message: 'Wheel-Size API call - banned source',
    severity: 'error',
  },
  {
    pattern: /simpletire\.com/i,
    message: 'SimpleTire reference - banned source',
    severity: 'error',
  },
  {
    pattern: /tirerack\.com/i,
    message: 'TireRack reference - banned source',
    severity: 'error',
  },
  {
    pattern: /discounttire\.com/i,
    message: 'DiscountTire reference - banned source',
    severity: 'error',
  },
  {
    pattern: /certification_status\s*[!=]=\s*['"]deprecated/,
    message: 'Query includes deprecated records - should filter to certified only',
    severity: 'warning',
  },
];

// Files to scan (fitment-specific paths only)
const SCAN_PATHS = [
  'src/app/api/vehicles',
  'src/app/api/wheels/fitment-search',
  'src/app/api/tires/search',
  'src/lib/fitment',
  'src/lib/fitment-db',
];

// Skip patterns
const SKIP_PATTERNS = [
  /__tests__/,
  /\.test\./,
  /\.spec\./,
  /node_modules/,
  /\.d\.ts$/,
];

let errors = [];
let warnings = [];
let filesChecked = 0;

function shouldSkip(filePath) {
  return SKIP_PATTERNS.some(p => p.test(filePath));
}

function checkFile(filePath) {
  if (shouldSkip(filePath)) return;
  
  const ext = filePath.split('.').pop();
  if (!['ts', 'tsx', 'js', 'mjs'].includes(ext)) return;
  
  const content = readFileSync(filePath, 'utf-8');
  const relativePath = relative(ROOT, filePath);
  const lines = content.split('\n');
  filesChecked++;
  
  for (const check of DEPRECATED_RUNTIME_PATTERNS) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Skip comments
      if (line.trim().startsWith('//') || line.trim().startsWith('*')) continue;
      
      if (check.pattern.test(line)) {
        const issue = {
          file: relativePath,
          line: i + 1,
          message: check.message,
          content: line.trim().substring(0, 100),
        };
        
        if (check.severity === 'error') {
          errors.push(issue);
        } else {
          warnings.push(issue);
        }
      }
    }
  }
}

function walkDir(dir) {
  try {
    const entries = readdirSync(dir);
    for (const entry of entries) {
      const fullPath = join(dir, entry);
      if (shouldSkip(fullPath)) continue;
      
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        walkDir(fullPath);
      } else {
        checkFile(fullPath);
      }
    }
  } catch (e) {
    // Directory doesn't exist, skip
  }
}

console.log('╔════════════════════════════════════════════════════════════════╗');
console.log('║   DEPRECATED USAGE CHECK                                       ║');
console.log('║   Scanning for banned patterns in runtime code                 ║');
console.log('╚════════════════════════════════════════════════════════════════╝\n');

// Run checks
for (const path of SCAN_PATHS) {
  const fullPath = join(ROOT, path);
  console.log(`Scanning: ${path}`);
  walkDir(fullPath);
}

console.log(`\nFiles scanned: ${filesChecked}`);

if (warnings.length > 0) {
  console.log('\n⚠️  Warnings:');
  for (const w of warnings) {
    console.log(`  ${w.file}:${w.line} - ${w.message}`);
    console.log(`    ${w.content}`);
  }
}

if (errors.length > 0) {
  console.log('\n❌ DEPRECATED USAGE DETECTED:\n');
  for (const err of errors) {
    console.log(`  ${err.file}:${err.line}`);
    console.log(`    ${err.message}`);
    console.log(`    ${err.content}`);
    console.log('');
  }
  console.log('See docs/FITMENT_CHANGE_CONTROL.md for approved patterns.\n');
  process.exit(1);
} else {
  console.log('\n✅ DEPRECATED USAGE CHECK PASSED');
  console.log('   No banned patterns found in runtime code.\n');
  process.exit(0);
}
