/**
 * Garage API Security Tests
 * Tests unauthenticated access rejection
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';

async function testEndpoint(method, path, body = null) {
  const options = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body) {
    options.body = JSON.stringify(body);
  }
  
  try {
    const res = await fetch(`${BASE_URL}${path}`, options);
    const data = await res.json();
    return { status: res.status, data };
  } catch (err) {
    return { error: err.message };
  }
}

async function runTests() {
  console.log('=== Garage API Security Tests ===');
  console.log(`Base URL: ${BASE_URL}\n`);
  
  let passed = 0;
  let failed = 0;
  
  function check(name, condition) {
    if (condition) {
      console.log(`✅ ${name}`);
      passed++;
    } else {
      console.log(`❌ ${name}`);
      failed++;
    }
  }
  
  // Test 1: GET /api/garage - unauthenticated
  console.log('\n--- Test 1: GET /api/garage (unauthenticated) ---');
  const get = await testEndpoint('GET', '/api/garage');
  console.log('Response:', get.status, get.data?.error || '');
  check('Returns 401', get.status === 401);
  check('Returns error message', get.data?.error === 'Unauthorized');
  check('Does NOT return vehicles array with data', !get.data?.vehicles?.length);
  
  // Test 2: POST /api/garage - unauthenticated
  console.log('\n--- Test 2: POST /api/garage (unauthenticated) ---');
  const post = await testEndpoint('POST', '/api/garage', {
    vehicle: { year: '2024', make: 'Ford', model: 'F-150', trim: 'XLT' }
  });
  console.log('Response:', post.status, post.data?.error || '');
  check('Returns 401', post.status === 401);
  check('Returns error message', post.data?.error === 'Unauthorized');
  
  // Test 3: PATCH /api/garage - unauthenticated
  console.log('\n--- Test 3: PATCH /api/garage (unauthenticated) ---');
  const patch = await testEndpoint('PATCH', '/api/garage', {
    vehicleId: 'v_fake_id',
    nickname: 'My Truck'
  });
  console.log('Response:', patch.status, patch.data?.error || '');
  check('Returns 401', patch.status === 401);
  check('Returns error message', patch.data?.error === 'Unauthorized');
  
  // Test 4: DELETE /api/garage - unauthenticated
  console.log('\n--- Test 4: DELETE /api/garage (unauthenticated) ---');
  const del = await testEndpoint('DELETE', '/api/garage', {
    vehicleId: 'v_fake_id'
  });
  console.log('Response:', del.status, del.data?.error || '');
  check('Returns 401', del.status === 401);
  check('Returns error message', del.data?.error === 'Unauthorized');
  
  // Test 5: POST /api/garage/sync - unauthenticated
  console.log('\n--- Test 5: POST /api/garage/sync (unauthenticated) ---');
  const sync = await testEndpoint('POST', '/api/garage/sync', {
    localVehicles: [{ year: '2024', make: 'Ford', model: 'F-150' }],
    activeId: 'v_fake'
  });
  console.log('Response:', sync.status, sync.data?.error || '');
  check('Returns 401', sync.status === 401);
  check('Returns error message', sync.data?.error === 'Unauthorized');
  
  // Summary
  console.log('\n=== Summary ===');
  console.log(`Passed: ${passed}/${passed + failed}`);
  console.log(`Failed: ${failed}`);
  
  if (failed > 0) {
    console.log('\n⚠️ SECURITY TESTS FAILED - API may be vulnerable');
    process.exit(1);
  } else {
    console.log('\n✅ All security tests passed - unauthenticated access blocked');
  }
}

runTests().catch(console.error);
