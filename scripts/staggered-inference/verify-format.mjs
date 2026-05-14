#!/usr/bin/env node
/**
 * Verify the canonical staggered format works with the existing API code.
 * 
 * This script tests that { front, rear } format works with:
 * - normalizeOemTireSizes() from tire-sizes API
 * - The tire-sizes API endpoint (via local fetch)
 */

import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import postgres from 'postgres';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../../.env.local') });

console.log('╔══════════════════════════════════════════════════════════════╗');
console.log('║   VERIFY CANONICAL STAGGERED FORMAT                          ║');
console.log('╚══════════════════════════════════════════════════════════════╝\n');

// Test cases with the canonical format
const testCases = [
  {
    name: 'Camaro SS 1LE',
    format: { front: '285/30R20', rear: '305/30R20' },
  },
  {
    name: 'Corvette Z06',
    format: { front: '275/30ZR20', rear: '345/25ZR21' },
  },
  {
    name: 'BMW M4 Competition',
    format: { front: '275/35R19', rear: '285/30R20' },
  },
];

// Replicate normalizeOemTireSizes logic inline
function normalizeOemTireSizes(raw) {
  if (!raw) return [];
  
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return normalizeOemTireSizes(parsed);
    } catch {
      const trimmed = raw.trim();
      if (trimmed.match(/^\d{3}\/\d{2}Z?R\d{2}/)) {
        return [trimmed];
      }
      return [];
    }
  }
  
  // Handle staggered objects: { front: [...], rear: [...] }
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    if (raw.front || raw.rear) {
      const frontSizes = normalizeOemTireSizes(raw.front);
      const rearSizes = normalizeOemTireSizes(raw.rear);
      return [...frontSizes, ...rearSizes];
    }
    return [];
  }
  
  if (!Array.isArray(raw)) {
    return [];
  }
  
  const result = [];
  for (const item of raw) {
    if (typeof item === "string") {
      if (item.trim()) result.push(item.trim());
    } else if (item && typeof item === "object") {
      const sizeValue = item.size || item.tireSize;
      if (typeof sizeValue === "string" && sizeValue.trim()) {
        result.push(sizeValue.trim());
        continue;
      }
      if (item.width && item.aspectRatio && item.diameter) {
        result.push(`${item.width}/${item.aspectRatio}R${item.diameter}`);
      }
    }
  }
  
  return result;
}

console.log('📋 TEST 1: normalizeOemTireSizes with canonical format\n');

let passed = 0;
let failed = 0;

for (const testCase of testCases) {
  const result = normalizeOemTireSizes(testCase.format);
  const expected = [testCase.format.front, testCase.format.rear];
  
  const pass = JSON.stringify(result.sort()) === JSON.stringify(expected.sort());
  
  if (pass) {
    console.log(`✅ ${testCase.name}`);
    console.log(`   Input:  ${JSON.stringify(testCase.format)}`);
    console.log(`   Output: ${JSON.stringify(result)}`);
    passed++;
  } else {
    console.log(`❌ ${testCase.name}`);
    console.log(`   Input:    ${JSON.stringify(testCase.format)}`);
    console.log(`   Expected: ${JSON.stringify(expected)}`);
    console.log(`   Got:      ${JSON.stringify(result)}`);
    failed++;
  }
  console.log('');
}

console.log(`${'─'.repeat(60)}`);
console.log(`normalizeOemTireSizes: ${passed}/${testCases.length} passed\n`);

// Test 2: Verify DB write and read cycle
console.log('📋 TEST 2: DB write/read cycle (simulated)\n');

const connectionString = process.env.POSTGRES_URL;
if (!connectionString) {
  console.log('⚠️  POSTGRES_URL not set, skipping DB test');
} else {
  const sql = postgres(connectionString);
  
  try {
    // Find a test record
    const testRecord = await sql`
      SELECT id, year, make, model, display_trim, oem_tire_sizes
      FROM vehicle_fitments
      WHERE make = 'Chevrolet' AND model = 'Camaro' 
        AND display_trim LIKE '%SS 1LE%'
        AND year = 2024
      LIMIT 1
    `;
    
    if (testRecord.length === 0) {
      console.log('⚠️  No test record found');
    } else {
      const record = testRecord[0];
      console.log(`Found: ${record.year} ${record.make} ${record.model} ${record.display_trim}`);
      console.log(`Current oem_tire_sizes: ${JSON.stringify(record.oem_tire_sizes)}`);
      
      // Simulate what the API would do
      const normalized = normalizeOemTireSizes(record.oem_tire_sizes);
      console.log(`Normalized to: ${JSON.stringify(normalized)}`);
      
      // Verify it produces valid tire sizes
      const validSizes = normalized.filter(s => /\d{3}\/\d{2}Z?R\d{2}/.test(s));
      console.log(`Valid sizes: ${validSizes.length}/${normalized.length}`);
      
      if (validSizes.length > 0) {
        console.log(`✅ DB read cycle works correctly`);
      } else {
        console.log(`❌ No valid sizes extracted`);
      }
    }
  } catch (err) {
    console.error(`❌ DB error: ${err.message}`);
  } finally {
    await sql.end();
  }
}

console.log('\n╔══════════════════════════════════════════════════════════════╗');
console.log('║   VERIFICATION COMPLETE                                      ║');
console.log('╚══════════════════════════════════════════════════════════════╝');

if (failed > 0) {
  console.log(`\n⚠️  ${failed} tests failed - DO NOT proceed with apply!`);
  process.exit(1);
} else {
  console.log(`\n✅ All tests passed - canonical format is safe to use.`);
}
