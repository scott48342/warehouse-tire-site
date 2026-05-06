/**
 * Validate staggered detection for Challenger GT and Scat Pack Widebody
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:3010';

const testVehicles = [
  { year: 2022, make: 'Dodge', model: 'Challenger', trim: 'GT', expectStaggered: false, expectWidths: [7.5, 7.5] },
  { year: 2023, make: 'Dodge', model: 'Challenger', trim: 'GT', expectStaggered: false, expectWidths: [7.5, 7.5] },
  { year: 2022, make: 'Dodge', model: 'Challenger', trim: 'R/T Scat Pack Widebody', expectStaggered: true, expectWidths: [9.5, 11] },
  { year: 2023, make: 'Dodge', model: 'Challenger', trim: 'R/T Scat Pack Widebody', expectStaggered: true, expectWidths: [9.5, 11] },
];

console.log('🧪 Validating Challenger staggered detection\n');
console.log('='.repeat(70));

let passed = 0;
let failed = 0;
const results = [];

for (const vehicle of testVehicles) {
  const url = `${BASE_URL}/api/wheels/fitment-search?year=${vehicle.year}&make=${vehicle.make}&model=${vehicle.model}&trim=${encodeURIComponent(vehicle.trim)}&pageSize=1`;
  
  try {
    const response = await fetch(url);
    const data = await response.json();
    
    const fitment = data.fitment || {};
    const staggered = fitment.staggered || {};
    const dbProfile = fitment.dbProfile || {};
    const wheels = dbProfile.oemWheelSizes || [];
    
    // Extract validation data
    const isStaggered = staggered.isStaggered === true;
    const frontWidth = staggered.frontSpec?.width;
    const rearWidth = staggered.rearSpec?.width;
    const frontTire = staggered.frontSpec?.tireSize;
    const rearTire = staggered.rearSpec?.tireSize;
    const wheelCount = wheels.length;
    const modId = dbProfile.modificationId;
    const resultCount = data.totalCount || 0;
    
    // Validate expectations
    const staggeredMatch = isStaggered === vehicle.expectStaggered;
    const widthsCorrect = vehicle.expectStaggered
      ? frontWidth === vehicle.expectWidths[0] && rearWidth === vehicle.expectWidths[1]
      : true;
    const hasTireSizes = vehicle.expectStaggered ? (frontTire && rearTire) : true;
    const hasResults = resultCount > 0;
    const noFalseSquare = vehicle.expectStaggered ? isStaggered : true;
    
    const allPassed = staggeredMatch && widthsCorrect && hasTireSizes && hasResults && noFalseSquare;
    
    if (allPassed) {
      passed++;
      console.log(`\n✅ ${vehicle.year} ${vehicle.model} ${vehicle.trim}`);
    } else {
      failed++;
      console.log(`\n❌ ${vehicle.year} ${vehicle.model} ${vehicle.trim}`);
    }
    
    console.log(`   modId: ${modId}`);
    console.log(`   isStaggered: ${isStaggered} (expected: ${vehicle.expectStaggered}) ${staggeredMatch ? '✓' : '✗'}`);
    console.log(`   wheelCount: ${wheelCount}`);
    if (vehicle.expectStaggered) {
      console.log(`   frontWidth: ${frontWidth}" (expected: ${vehicle.expectWidths[0]}") ${frontWidth === vehicle.expectWidths[0] ? '✓' : '✗'}`);
      console.log(`   rearWidth: ${rearWidth}" (expected: ${vehicle.expectWidths[1]}") ${rearWidth === vehicle.expectWidths[1] ? '✓' : '✗'}`);
      console.log(`   frontTire: ${frontTire || 'N/A'}`);
      console.log(`   rearTire: ${rearTire || 'N/A'}`);
    }
    console.log(`   resultCount: ${resultCount} ${hasResults ? '✓' : '✗'}`);
    console.log(`   reason: ${staggered.reason || 'N/A'}`);
    
    results.push({
      vehicle: `${vehicle.year} ${vehicle.model} ${vehicle.trim}`,
      passed: allPassed,
      isStaggered,
      frontWidth,
      rearWidth,
      wheelCount,
      resultCount,
    });
    
  } catch (err) {
    failed++;
    console.log(`\n❌ ${vehicle.year} ${vehicle.model} ${vehicle.trim}`);
    console.log(`   ERROR: ${err.message}`);
    results.push({
      vehicle: `${vehicle.year} ${vehicle.model} ${vehicle.trim}`,
      passed: false,
      error: err.message,
    });
  }
}

console.log('\n' + '='.repeat(70));
console.log(`\n📊 SUMMARY: ${passed}/${testVehicles.length} passed, ${failed} failed`);

if (failed === 0) {
  console.log('\n✅ ALL VALIDATIONS PASSED');
} else {
  console.log('\n⚠️  SOME VALIDATIONS FAILED');
  process.exit(1);
}
