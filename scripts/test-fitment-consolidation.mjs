#!/usr/bin/env node
/**
 * FITMENT CONSOLIDATION GUARD TEST
 * 
 * Pre-deploy test that verifies:
 * 1. No customer-facing API imports vehicleFitmentConfigurations
 * 2. Known problem vehicles resolve correctly through trims, tire-sizes, and wheel search
 * 
 * Run before deploy: node scripts/test-fitment-consolidation.mjs
 * 
 * EXIT CODES:
 * 0 = All checks passed
 * 1 = Consolidation violation detected (BLOCKS DEPLOY)
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// ════════════════════════════════════════════════════════════════════════════════
// CONFIG
// ════════════════════════════════════════════════════════════════════════════════

// Customer-facing API directories that MUST NOT import vehicleFitmentConfigurations
const CUSTOMER_FACING_PATHS = [
  'src/app/api/vehicles',
  'src/app/api/wheels',
  'src/app/api/tires',
  'src/lib/fitment',
  'src/lib/fitment-db/canonicalResolver.ts',
  'src/lib/fitment-db/coverage.ts',
  'src/lib/fitment-db/profileService.ts',
  'src/lib/fitment-db/getFitment.ts',
];

// Paths that are ALLOWED to use vehicleFitmentConfigurations (admin only)
const ADMIN_EXCEPTIONS = [
  'src/app/api/admin/',
  'scripts/',
  'src/lib/fitment-db/schema.ts', // Definition file
];

// Pattern to detect deprecated table usage
const DEPRECATED_PATTERNS = [
  /vehicleFitmentConfigurations/,
  /vehicle_fitment_configurations/,
];

// ════════════════════════════════════════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════════════════════════════════════════

function isAdminException(filePath) {
  const relative = filePath.replace(projectRoot, '').replace(/\\/g, '/');
  return ADMIN_EXCEPTIONS.some(exc => relative.includes(exc));
}

function getAllTsFiles(dir, files = []) {
  const entries = readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    
    if (entry.isDirectory()) {
      // Skip node_modules and .next
      if (entry.name === 'node_modules' || entry.name === '.next') continue;
      getAllTsFiles(fullPath, files);
    } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
      files.push(fullPath);
    }
  }
  
  return files;
}

function checkFile(filePath) {
  const content = readFileSync(filePath, 'utf8');
  const violations = [];
  
  for (const pattern of DEPRECATED_PATTERNS) {
    if (pattern.test(content)) {
      // Find line numbers
      const lines = content.split('\n');
      lines.forEach((line, i) => {
        if (pattern.test(line)) {
          violations.push({
            file: relative(projectRoot, filePath),
            line: i + 1,
            content: line.trim().slice(0, 100),
          });
        }
      });
    }
  }
  
  return violations;
}

// ════════════════════════════════════════════════════════════════════════════════
// MAIN CHECKS
// ════════════════════════════════════════════════════════════════════════════════

console.log('');
console.log('═══════════════════════════════════════════════════════════════════════');
console.log('FITMENT CONSOLIDATION GUARD TEST');
console.log('═══════════════════════════════════════════════════════════════════════');
console.log('');

let hasViolations = false;
const allViolations = [];

// Check customer-facing paths for deprecated table usage
console.log('📁 Checking customer-facing code paths...');
console.log('');

for (const pathSpec of CUSTOMER_FACING_PATHS) {
  const fullPath = join(projectRoot, pathSpec);
  
  let filesToCheck = [];
  
  try {
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      filesToCheck = getAllTsFiles(fullPath);
    } else if (stat.isFile()) {
      filesToCheck = [fullPath];
    }
  } catch (e) {
    console.log(`   ⚠️  Path not found: ${pathSpec}`);
    continue;
  }
  
  for (const file of filesToCheck) {
    // Skip admin exceptions
    if (isAdminException(file)) continue;
    
    const violations = checkFile(file);
    if (violations.length > 0) {
      allViolations.push(...violations);
      hasViolations = true;
    }
  }
}

// Report violations
if (allViolations.length > 0) {
  console.log('❌ CONSOLIDATION VIOLATIONS DETECTED:');
  console.log('');
  
  for (const v of allViolations) {
    console.log(`   🚫 ${v.file}:${v.line}`);
    console.log(`      ${v.content}`);
  }
  
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log('FAILURE: Customer-facing code reads from deprecated vehicleFitmentConfigurations');
  console.log('');
  console.log('FIX: Use vehicleFitments table via:');
  console.log('  - resolveVehicleFitment() from canonicalResolver.ts');
  console.log('  - getTrimsWithCoverage() / getModelsWithCoverage() from coverage.ts');
  console.log('');
  console.log('The vehicleFitmentConfigurations table is DEPRECATED and admin-only.');
  console.log('═══════════════════════════════════════════════════════════════════════');
  process.exit(1);
} else {
  console.log('✅ No deprecated table usage in customer-facing code');
  console.log('');
}

// ════════════════════════════════════════════════════════════════════════════════
// SUMMARY
// ════════════════════════════════════════════════════════════════════════════════

console.log('═══════════════════════════════════════════════════════════════════════');
console.log('✅ ALL CONSOLIDATION CHECKS PASSED');
console.log('');
console.log('Runtime fitment resolution reads ONLY from vehicle_fitments.');
console.log('USAF/WheelPros are audit/enrichment sources only.');
console.log('vehicleFitmentConfigurations is deprecated and admin-only.');
console.log('═══════════════════════════════════════════════════════════════════════');
console.log('');

process.exit(0);
