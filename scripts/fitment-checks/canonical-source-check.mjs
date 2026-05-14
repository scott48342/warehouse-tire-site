#!/usr/bin/env node
/**
 * Canonical Source Check
 * 
 * Verifies that fitment APIs use ONLY vehicle_fitments table at runtime.
 * Fails if config table or static JSON fallbacks are detected.
 * 
 * Part of FITMENT_CHANGE_CONTROL.md compliance.
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '../..');

// Files to check
const PATHS_TO_CHECK = [
  'src/app/api/vehicles',
  'src/app/api/wheels/fitment-search',
  'src/app/api/tires/search',
  'src/lib/fitment',
  'src/lib/fitment-db',
];

// Patterns that indicate deprecated source usage
const DEPRECATED_PATTERNS = [
  // Config table usage (should be disabled)
  /getConfigTableFitment/,
  /vehicleFitmentConfigs/,
  /fitment_configs/,
  
  // Static JSON fallback
  /staticFitmentData/,
  /STATIC_FITMENT/,
  /fitment\.json/,
  
  // Old wheel-size.com integration
  /wheel-size\.com/,
  /wheelsize\.com/,
  
  // Direct WheelPros fitment (should only be for products)
  /WheelPros.*fitment/i,
];

// Allowed patterns (these are OK)
const ALLOWED_PATTERNS = [
  /vehicle_fitments/,        // Our canonical table
  /vehicleFitments/,         // Drizzle model
  /canonicalResolver/,       // Our resolver
  /STEP 0.*DISABLED/,        // Disabled steps are OK
  /STEP 3.*DISABLED/,        // Disabled steps are OK
];

let errors = [];
let warnings = [];
let filesChecked = 0;

function checkFile(filePath) {
  const ext = filePath.split('.').pop();
  if (!['ts', 'tsx', 'js', 'mjs'].includes(ext)) return;
  
  const content = readFileSync(filePath, 'utf-8');
  const relativePath = relative(ROOT, filePath);
  filesChecked++;
  
  for (const pattern of DEPRECATED_PATTERNS) {
    const matches = content.match(pattern);
    if (matches) {
      // Check if it's in a disabled/commented section
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (pattern.test(lines[i])) {
          const line = lines[i];
          // Skip if commented out or in disabled block
          if (line.trim().startsWith('//') || line.trim().startsWith('*')) continue;
          if (line.includes('DISABLED') || line.includes('disabled')) continue;
          
          errors.push({
            file: relativePath,
            line: i + 1,
            pattern: pattern.toString(),
            content: line.trim().substring(0, 100),
          });
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
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        if (!entry.startsWith('.') && entry !== 'node_modules' && entry !== '__tests__') {
          walkDir(fullPath);
        }
      } else {
        checkFile(fullPath);
      }
    }
  } catch (e) {
    warnings.push(`Could not read directory: ${dir}`);
  }
}

console.log('╔════════════════════════════════════════════════════════════════╗');
console.log('║   CANONICAL SOURCE CHECK                                       ║');
console.log('║   Verifying fitment uses vehicle_fitments ONLY                 ║');
console.log('╚════════════════════════════════════════════════════════════════╝\n');

// Run checks
for (const path of PATHS_TO_CHECK) {
  const fullPath = join(ROOT, path);
  console.log(`Checking: ${path}`);
  walkDir(fullPath);
}

console.log(`\nFiles checked: ${filesChecked}`);

if (warnings.length > 0) {
  console.log('\n⚠️  Warnings:');
  for (const w of warnings) {
    console.log(`  - ${w}`);
  }
}

if (errors.length > 0) {
  console.log('\n❌ DEPRECATED SOURCE USAGE DETECTED:\n');
  for (const err of errors) {
    console.log(`  ${err.file}:${err.line}`);
    console.log(`    Pattern: ${err.pattern}`);
    console.log(`    Content: ${err.content}`);
    console.log('');
  }
  console.log('See docs/FITMENT_CHANGE_CONTROL.md for approved sources.\n');
  process.exit(1);
} else {
  console.log('\n✅ CANONICAL SOURCE CHECK PASSED');
  console.log('   All fitment code uses vehicle_fitments table only.\n');
  process.exit(0);
}
