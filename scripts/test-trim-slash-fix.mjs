/**
 * Test script for trim slash normalization fix
 * Validates that isGroupedTrim() and splitGroupedTrim() work correctly
 */

// Replicate the fixed functions
function isGroupedTrim(displayTrim) {
  if (displayTrim.includes(',')) return true;
  if (/ \/ /.test(displayTrim)) return true;
  return false;
}

function splitGroupedTrim(displayTrim) {
  let parts = displayTrim.split(',').map(t => t.trim()).filter(Boolean);
  const result = [];
  for (const part of parts) {
    if (/ \/ /.test(part)) {
      const subParts = part.split(' / ').map(t => t.trim()).filter(Boolean);
      result.push(...subParts);
    } else {
      result.push(part);
    }
  }
  return result;
}

// Test cases
const tests = [
  // Should NOT be grouped (slash-containing trim names)
  { input: 'R/T', expectGrouped: false, expectSplit: ['R/T'] },
  { input: 'R/T Scat Pack', expectGrouped: false, expectSplit: ['R/T Scat Pack'] },
  { input: 'R/T Scat Pack Widebody', expectGrouped: false, expectSplit: ['R/T Scat Pack Widebody'] },
  { input: 'GT/CS', expectGrouped: false, expectSplit: ['GT/CS'] },
  { input: '4x4/2x4', expectGrouped: false, expectSplit: ['4x4/2x4'] },
  { input: 'C/E', expectGrouped: false, expectSplit: ['C/E'] },
  { input: 'A/T', expectGrouped: false, expectSplit: ['A/T'] },
  { input: 'M/T', expectGrouped: false, expectSplit: ['M/T'] },
  
  // Should BE grouped (actual grouped trims)
  { input: 'SXT / SXT Plus', expectGrouped: true, expectSplit: ['SXT', 'SXT Plus'] },
  { input: 'Base, Premium', expectGrouped: true, expectSplit: ['Base', 'Premium'] },
  { input: 'LT, LT RS', expectGrouped: true, expectSplit: ['LT', 'LT RS'] },
  { input: 'LS / LT / Premier', expectGrouped: true, expectSplit: ['LS', 'LT', 'Premier'] },
  { input: 'Base, Sport / Sport Plus', expectGrouped: true, expectSplit: ['Base', 'Sport', 'Sport Plus'] },
  
  // Edge cases
  { input: 'Base', expectGrouped: false, expectSplit: ['Base'] },
  { input: 'SRT Hellcat', expectGrouped: false, expectSplit: ['SRT Hellcat'] },
  { input: '1LE', expectGrouped: false, expectSplit: ['1LE'] },
  { input: 'ZL1 1LE', expectGrouped: false, expectSplit: ['ZL1 1LE'] },
];

console.log('=== Trim Slash Normalization Fix Validation ===\n');

let passed = 0;
let failed = 0;

for (const test of tests) {
  const gotGrouped = isGroupedTrim(test.input);
  const gotSplit = splitGroupedTrim(test.input);
  
  const groupedMatch = gotGrouped === test.expectGrouped;
  const splitMatch = JSON.stringify(gotSplit) === JSON.stringify(test.expectSplit);
  
  if (groupedMatch && splitMatch) {
    console.log(`✅ PASS: "${test.input}"`);
    console.log(`   grouped=${gotGrouped}, split=${JSON.stringify(gotSplit)}`);
    passed++;
  } else {
    console.log(`❌ FAIL: "${test.input}"`);
    console.log(`   Expected: grouped=${test.expectGrouped}, split=${JSON.stringify(test.expectSplit)}`);
    console.log(`   Got:      grouped=${gotGrouped}, split=${JSON.stringify(gotSplit)}`);
    failed++;
  }
}

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);

if (failed > 0) {
  process.exit(1);
}
