/**
 * Test pricing service
 */

// Quick test without imports (just validate the math)
console.log('🧪 Pricing Service Validation\n');

const WHEEL_MARKUP = 1.35;
const WHEEL_MSRP_DISCOUNT = 0.85;

function calculateWheelSellPrice(map, msrp) {
  if (map && map > 0) {
    return Math.round(map * WHEEL_MARKUP * 100) / 100;
  }
  if (msrp && msrp > 0) {
    return Math.round(msrp * WHEEL_MSRP_DISCOUNT * 100) / 100;
  }
  return 0;
}

const testCases = [
  { map: 200, msrp: 250, expected: 270, note: 'MAP × 1.35' },
  { map: 150, msrp: 200, expected: 202.50, note: 'MAP × 1.35' },
  { map: null, msrp: 300, expected: 255, note: 'MSRP × 0.85 (no MAP)' },
  { map: null, msrp: 400, expected: 340, note: 'MSRP × 0.85 (no MAP)' },
  { map: 0, msrp: 350, expected: 297.50, note: 'MSRP fallback (MAP=0)' },
  { map: null, msrp: null, expected: 0, note: 'No price data' },
];

console.log('Before/After Pricing Examples:');
console.log('─'.repeat(60));
console.log('MAP\t\tMSRP\t\tSELL\t\tMETHOD');
console.log('─'.repeat(60));

let passed = 0;
for (const tc of testCases) {
  const result = calculateWheelSellPrice(tc.map, tc.msrp);
  const status = result === tc.expected ? '✅' : '❌';
  
  const mapStr = tc.map !== null ? `$${tc.map}` : '-';
  const msrpStr = tc.msrp !== null ? `$${tc.msrp}` : '-';
  
  console.log(`${mapStr}\t\t${msrpStr}\t\t$${result}\t\t${tc.note} ${status}`);
  
  if (result === tc.expected) passed++;
}

console.log('─'.repeat(60));
console.log(`\n${passed}/${testCases.length} tests passed`);

// Show margin analysis
console.log('\n📊 Margin Analysis (MAP-based):');
console.log('─'.repeat(40));
for (const map of [100, 150, 200, 250, 300, 400, 500]) {
  const sell = calculateWheelSellPrice(map, null);
  const margin = ((sell - map) / sell * 100).toFixed(1);
  console.log(`MAP $${map} → Sell $${sell} (${margin}% margin)`);
}

console.log('\n✅ Pricing validation complete');
