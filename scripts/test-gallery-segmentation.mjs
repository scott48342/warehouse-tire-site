/**
 * Gallery Segmentation Test
 * 
 * Tests that the gallery system correctly segments by vehicle type:
 * - Trucks/SUVs/Jeeps get truck/suv/jeep images (via /api/gallery/builds)
 * - Cars get car images only (via /api/gallery/match)
 * - NO cross-contamination between segments
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';

// Test cases
const testCases = [
  // TRUCKS - Should use BuildGalleryBlock, get truck images
  {
    name: 'Ford F-150 (lifted)',
    endpoint: '/api/gallery/builds',
    params: { make: 'Ford', model: 'F-150', buildType: 'lifted' },
    expectedVehicleTypes: ['truck', 'suv', 'jeep'],
    forbiddenVehicleTypes: ['car'],
    shouldHaveResults: true,
  },
  {
    name: 'Ram 1500 (leveled)',
    endpoint: '/api/gallery/builds',
    params: { make: 'Ram', model: '1500', buildType: 'leveled' },
    expectedVehicleTypes: ['truck', 'suv', 'jeep'],
    forbiddenVehicleTypes: ['car'],
    shouldHaveResults: true,
  },
  
  // SUVS - Should use BuildGalleryBlock, get SUV images
  {
    name: 'Ford Bronco (lifted)',
    endpoint: '/api/gallery/builds',
    params: { make: 'Ford', model: 'Bronco', buildType: 'lifted' },
    expectedVehicleTypes: ['truck', 'suv', 'jeep'],
    forbiddenVehicleTypes: ['car'],
    shouldHaveResults: true,
  },
  
  // JEEPS - Should use BuildGalleryBlock
  {
    name: 'Jeep Wrangler (lifted)',
    endpoint: '/api/gallery/builds',
    params: { make: 'Jeep', model: 'Wrangler', buildType: 'lifted' },
    expectedVehicleTypes: ['truck', 'suv', 'jeep'],
    forbiddenVehicleTypes: ['car'],
    shouldHaveResults: true,
  },
  
  // CARS - BuildGalleryBlock should return nothing (cars don't have builds)
  {
    name: 'Ford Mustang - BuildGalleryBlock (should be empty)',
    endpoint: '/api/gallery/builds',
    params: { make: 'Ford', model: 'Mustang', buildType: 'lifted' },
    expectedVehicleTypes: [],
    forbiddenVehicleTypes: ['truck', 'suv', 'jeep'],
    shouldHaveResults: false,
    expectReason: 'Car vehicle - use wheel gallery instead of build gallery',
  },
  {
    name: 'Dodge Challenger - BuildGalleryBlock (should be empty)',
    endpoint: '/api/gallery/builds',
    params: { make: 'Dodge', model: 'Challenger', buildType: 'lifted' },
    expectedVehicleTypes: [],
    forbiddenVehicleTypes: ['truck', 'suv', 'jeep'],
    shouldHaveResults: false,
    expectReason: 'Car vehicle - use wheel gallery instead of build gallery',
  },
  {
    name: 'Chevrolet Camaro - BuildGalleryBlock (should be empty)',
    endpoint: '/api/gallery/builds',
    params: { make: 'Chevrolet', model: 'Camaro', buildType: 'lifted' },
    expectedVehicleTypes: [],
    forbiddenVehicleTypes: ['truck', 'suv', 'jeep'],
    shouldHaveResults: false,
    expectReason: 'Car vehicle - use wheel gallery instead of build gallery',
  },
  
  // CARS - WheelGalleryBlock (match API) - should get car images
  {
    name: 'Ford Mustang - WheelGalleryBlock',
    endpoint: '/api/gallery/match',
    params: { make: 'Ford', model: 'Mustang', wheelBrand: 'Fuel', wheelModel: 'Contra', vehicleType: 'car' },
    expectedVehicleTypes: ['car'],
    forbiddenVehicleTypes: ['truck', 'suv', 'jeep'],
    shouldHaveResults: true, // depends on gallery having car images
    allowEmptyIfNoCarImages: true,
  },
  
  // TRUCKS - WheelGalleryBlock should get truck images (not cars)
  {
    name: 'Ford F-150 - WheelGalleryBlock',
    endpoint: '/api/gallery/match',
    params: { make: 'Ford', model: 'F-150', wheelBrand: 'Fuel', wheelModel: 'Contra', vehicleType: 'truck' },
    expectedVehicleTypes: ['truck', 'suv', 'jeep'],
    forbiddenVehicleTypes: ['car'],
    shouldHaveResults: true,
  },
];

async function runTest(testCase) {
  const url = new URL(testCase.endpoint, BASE_URL);
  for (const [key, value] of Object.entries(testCase.params)) {
    url.searchParams.set(key, value);
  }
  
  try {
    const res = await fetch(url.toString());
    const data = await res.json();
    
    const results = data.results || [];
    const reason = data.reason || '';
    
    // Check for expected reason (for car rejection cases)
    if (testCase.expectReason) {
      if (reason !== testCase.expectReason) {
        return { 
          pass: false, 
          error: `Expected reason "${testCase.expectReason}", got "${reason}"`,
          data 
        };
      }
    }
    
    // Check result count
    if (testCase.shouldHaveResults && results.length === 0) {
      if (testCase.allowEmptyIfNoCarImages) {
        return { pass: true, warning: 'No results (may not have car images in gallery)', data };
      }
      return { pass: false, error: 'Expected results but got none', data };
    }
    
    if (!testCase.shouldHaveResults && results.length > 0) {
      return { pass: false, error: `Expected no results but got ${results.length}`, data };
    }
    
    // Check vehicle type segmentation
    for (const result of results) {
      const vehicleType = result.vehicleType;
      
      // Check forbidden types (cross-contamination)
      if (testCase.forbiddenVehicleTypes.includes(vehicleType)) {
        return { 
          pass: false, 
          error: `CROSS-CONTAMINATION: Got forbidden vehicle type "${vehicleType}"`,
          data 
        };
      }
      
      // Check expected types (if specified and not empty)
      if (testCase.expectedVehicleTypes.length > 0 && !testCase.expectedVehicleTypes.includes(vehicleType) && vehicleType !== null) {
        return { 
          pass: false, 
          error: `Unexpected vehicle type "${vehicleType}", expected one of [${testCase.expectedVehicleTypes.join(', ')}]`,
          data 
        };
      }
    }
    
    return { pass: true, resultCount: results.length, data };
    
  } catch (err) {
    return { pass: false, error: err.message };
  }
}

async function main() {
  console.log('🧪 Gallery Segmentation Test\n');
  console.log(`Testing against: ${BASE_URL}\n`);
  console.log('─'.repeat(60));
  
  let passed = 0;
  let failed = 0;
  let warnings = 0;
  
  for (const testCase of testCases) {
    process.stdout.write(`Testing: ${testCase.name}... `);
    
    const result = await runTest(testCase);
    
    if (result.pass) {
      if (result.warning) {
        console.log(`⚠️  WARNING: ${result.warning}`);
        warnings++;
      } else {
        console.log(`✅ PASS (${result.resultCount || 0} results)`);
      }
      passed++;
    } else {
      console.log(`❌ FAIL: ${result.error}`);
      if (result.data) {
        console.log('   Response:', JSON.stringify(result.data, null, 2).split('\n').slice(0, 5).join('\n'));
      }
      failed++;
    }
  }
  
  console.log('─'.repeat(60));
  console.log(`\n📊 Results: ${passed} passed, ${failed} failed, ${warnings} warnings`);
  
  if (failed > 0) {
    console.log('\n❌ SEGMENTATION TEST FAILED - Cross-contamination risk detected!');
    process.exit(1);
  } else {
    console.log('\n✅ All segmentation tests passed - No cross-contamination detected');
  }
}

main();
