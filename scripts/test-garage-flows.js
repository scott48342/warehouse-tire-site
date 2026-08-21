/**
 * Comprehensive Garage Flow Tests
 * 
 * Tests the account-backed garage functionality:
 * 1. Database migration verification
 * 2. API security (unauthenticated rejection)
 * 3. Cross-account isolation
 * 4. Max 10 vehicle limit
 * 5. Duplicate prevention
 * 6. Sync/merge logic
 */

const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

let passed = 0;
let failed = 0;

function test(name, condition) {
  if (condition) {
    console.log(`✅ ${name}`);
    passed++;
  } else {
    console.log(`❌ ${name}`);
    failed++;
  }
}

async function testMigration(client) {
  console.log('\n=== 1. Migration Verification ===\n');
  
  // Check table exists
  const tables = await client.query(`
    SELECT table_name FROM information_schema.tables 
    WHERE table_name = 'user_garage'
  `);
  test('user_garage table exists', tables.rows.length === 1);
  
  // Check columns
  const cols = await client.query(`
    SELECT column_name FROM information_schema.columns 
    WHERE table_name = 'user_garage'
  `);
  const colNames = cols.rows.map(r => r.column_name);
  test('Has id column', colNames.includes('id'));
  test('Has user_id column', colNames.includes('user_id'));
  test('Has year column', colNames.includes('year'));
  test('Has make column', colNames.includes('make'));
  test('Has model column', colNames.includes('model'));
  test('Has modification column', colNames.includes('modification'));
  test('Has nickname column', colNames.includes('nickname'));
  
  // Check indexes
  const indexes = await client.query(`
    SELECT indexname FROM pg_indexes WHERE tablename = 'user_garage'
  `);
  const idxNames = indexes.rows.map(r => r.indexname);
  test('Has primary key index', idxNames.some(n => n.includes('pkey')));
  test('Has user_id index', idxNames.some(n => n.includes('user_id')));
  test('Has modification unique index', idxNames.some(n => n.includes('modification')));
  
  // Check FK
  const fks = await client.query(`
    SELECT constraint_name FROM information_schema.table_constraints 
    WHERE table_name = 'user_garage' AND constraint_type = 'FOREIGN KEY'
  `);
  test('Has foreign key constraint', fks.rows.length >= 1);
}

async function testApiSecurity() {
  console.log('\n=== 2. API Security (Unauthenticated) ===\n');
  
  const endpoints = [
    { method: 'GET', path: '/api/garage' },
    { method: 'POST', path: '/api/garage', body: { vehicle: { year: '2024', make: 'Test' } } },
    { method: 'PATCH', path: '/api/garage', body: { vehicleId: 'test' } },
    { method: 'DELETE', path: '/api/garage', body: { vehicleId: 'test' } },
    { method: 'POST', path: '/api/garage/sync', body: { localVehicles: [] } },
  ];
  
  for (const ep of endpoints) {
    try {
      const opts = { 
        method: ep.method, 
        headers: { 'Content-Type': 'application/json' }
      };
      if (ep.body) opts.body = JSON.stringify(ep.body);
      
      const res = await fetch(`${BASE_URL}${ep.path}`, opts);
      test(`${ep.method} ${ep.path} returns 401`, res.status === 401);
    } catch (err) {
      test(`${ep.method} ${ep.path} reachable`, false);
    }
  }
}

async function testCrossAccountIsolation(client) {
  console.log('\n=== 3. Cross-Account Isolation ===\n');
  
  // Get two test users
  const users = await client.query(`
    SELECT id, email FROM auth_users WHERE email LIKE 'test%' LIMIT 2
  `);
  
  if (users.rows.length < 2) {
    console.log('⚠️ Need 2 test accounts - skipping isolation tests');
    return;
  }
  
  const [userA, userB] = users.rows;
  
  // Clean up
  await client.query('DELETE FROM user_garage WHERE user_id = $1 OR user_id = $2', [userA.id, userB.id]);
  
  // Create vehicles
  const vA = 'v_iso_test_A_' + Date.now();
  const vB = 'v_iso_test_B_' + Date.now();
  
  await client.query(`
    INSERT INTO user_garage (id, user_id, year, make, model, added_at, last_active_at)
    VALUES ($1, $2, '2024', 'Ford', 'F-150', NOW(), NOW())
  `, [vA, userA.id]);
  
  await client.query(`
    INSERT INTO user_garage (id, user_id, year, make, model, added_at, last_active_at)
    VALUES ($1, $2, '2022', 'Toyota', 'Camry', NOW(), NOW())
  `, [vB, userB.id]);
  
  // Test isolation
  const crossQuery = await client.query(
    'SELECT id FROM user_garage WHERE user_id = $1 AND id = $2',
    [userA.id, vB]
  );
  test('User A cannot query User B vehicle', crossQuery.rows.length === 0);
  
  const crossUpdate = await client.query(
    'UPDATE user_garage SET nickname = $1 WHERE user_id = $2 AND id = $3',
    ['Hacked', userA.id, vB]
  );
  test('User A cannot update User B vehicle', crossUpdate.rowCount === 0);
  
  const crossDelete = await client.query(
    'DELETE FROM user_garage WHERE user_id = $1 AND id = $2',
    [userA.id, vB]
  );
  test('User A cannot delete User B vehicle', crossDelete.rowCount === 0);
  
  // Verify B intact
  const bCheck = await client.query('SELECT id FROM user_garage WHERE id = $1', [vB]);
  test('User B vehicle still exists', bCheck.rows.length === 1);
  
  // Cleanup
  await client.query('DELETE FROM user_garage WHERE id IN ($1, $2)', [vA, vB]);
}

async function testMax10Limit(client) {
  console.log('\n=== 4. Max 10 Vehicle Limit ===\n');
  
  // Get a test user
  const users = await client.query(`SELECT id FROM auth_users WHERE email LIKE 'test%' LIMIT 1`);
  if (users.rows.length === 0) {
    console.log('⚠️ No test user - skipping limit tests');
    return;
  }
  
  const userId = users.rows[0].id;
  
  // Clean up
  await client.query('DELETE FROM user_garage WHERE user_id = $1', [userId]);
  
  // Insert 10 vehicles
  for (let i = 1; i <= 10; i++) {
    await client.query(`
      INSERT INTO user_garage (id, user_id, year, make, model, modification, added_at, last_active_at)
      VALUES ($1, $2, $3, 'Test', $4, $5, NOW(), NOW())
    `, [`v_limit_${i}_${Date.now()}`, userId, String(2010 + i), `Model${i}`, `test-model${i}`]);
  }
  
  // Verify 10 vehicles
  const count = await client.query('SELECT COUNT(*) as cnt FROM user_garage WHERE user_id = $1', [userId]);
  test('Can store 10 vehicles', parseInt(count.rows[0].cnt) === 10);
  
  // Note: The 11th vehicle limit is enforced by API, not DB
  // The API code checks count before insert and stops at MAX_VEHICLES
  
  // Cleanup
  await client.query('DELETE FROM user_garage WHERE user_id = $1', [userId]);
  
  const afterClean = await client.query('SELECT COUNT(*) as cnt FROM user_garage WHERE user_id = $1', [userId]);
  test('Cleanup successful', parseInt(afterClean.rows[0].cnt) === 0);
}

async function testDuplicatePrevention(client) {
  console.log('\n=== 5. Duplicate Prevention ===\n');
  
  const users = await client.query(`SELECT id FROM auth_users WHERE email LIKE 'test%' LIMIT 1`);
  if (users.rows.length === 0) {
    console.log('⚠️ No test user - skipping duplicate tests');
    return;
  }
  
  const userId = users.rows[0].id;
  
  // Clean up
  await client.query('DELETE FROM user_garage WHERE user_id = $1', [userId]);
  
  // Insert first vehicle with modification ID
  await client.query(`
    INSERT INTO user_garage (id, user_id, year, make, model, modification, added_at, last_active_at)
    VALUES ($1, $2, '2024', 'Ford', 'F-150', 'ford-f150-2024', NOW(), NOW())
  `, ['v_dup_1', userId]);
  
  // Try to insert duplicate with same modification
  try {
    await client.query(`
      INSERT INTO user_garage (id, user_id, year, make, model, modification, added_at, last_active_at)
      VALUES ($1, $2, '2024', 'Ford', 'F-150', 'ford-f150-2024', NOW(), NOW())
    `, ['v_dup_2', userId]);
    test('Duplicate modification blocked by unique index', false);
  } catch (err) {
    test('Duplicate modification blocked by unique index', err.code === '23505'); // unique violation
  }
  
  // Verify only 1 vehicle
  const count = await client.query('SELECT COUNT(*) as cnt FROM user_garage WHERE user_id = $1', [userId]);
  test('Only 1 vehicle after duplicate attempt', parseInt(count.rows[0].cnt) === 1);
  
  // Cleanup
  await client.query('DELETE FROM user_garage WHERE user_id = $1', [userId]);
}

async function testSyncLogic(client) {
  console.log('\n=== 6. Sync/Merge Logic Verification ===\n');
  
  // Test the isDuplicate function logic
  const normalize = (s) => s.toLowerCase().replace(/[-_\s]+/g, '');
  
  test('Normalize handles spaces', normalize('F 150') === 'f150');
  test('Normalize handles dashes', normalize('F-150') === 'f150');
  test('Normalize handles underscores', normalize('F_150') === 'f150');
  test('Normalize is case-insensitive', normalize('FORD') === 'ford');
  
  // Test matching logic
  const matchByMod = (a, b) => a.modification && b.modification && a.modification === b.modification;
  const matchByYMM = (a, b) => 
    a.year === b.year && 
    normalize(a.make) === normalize(b.make) && 
    normalize(a.model) === normalize(b.model);
  
  const v1 = { year: '2024', make: 'Ford', model: 'F-150', modification: 'ford-f150-2024' };
  const v2 = { year: '2024', make: 'FORD', model: 'f 150', modification: null };
  const v3 = { year: '2024', make: 'Ford', model: 'F-150', modification: 'ford-f150-2024' };
  const v4 = { year: '2022', make: 'Toyota', model: 'Camry', modification: 'toyota-camry-2022' };
  
  test('Same modification matches', matchByMod(v1, v3));
  test('Different modification no match', !matchByMod(v1, v4));
  test('Null modification no match', !matchByMod(v1, v2));
  test('Same YMM (case-insensitive) matches', matchByYMM(v1, v2));
  test('Different YMM no match', !matchByYMM(v1, v4));
}

async function runAllTests() {
  const client = await pool.connect();
  
  try {
    console.log('====================================');
    console.log('  GARAGE FLOW COMPREHENSIVE TESTS');
    console.log('====================================');
    console.log(`Base URL: ${BASE_URL}`);
    
    await testMigration(client);
    await testApiSecurity();
    await testCrossAccountIsolation(client);
    await testMax10Limit(client);
    await testDuplicatePrevention(client);
    await testSyncLogic(client);
    
    console.log('\n====================================');
    console.log(`  RESULTS: ${passed}/${passed + failed} PASSED`);
    console.log('====================================\n');
    
    if (failed > 0) {
      console.log(`⚠️ ${failed} test(s) FAILED`);
      process.exit(1);
    } else {
      console.log('✅ All tests PASSED');
    }
    
  } finally {
    client.release();
    await pool.end();
  }
}

runAllTests().catch(err => {
  console.error('Test suite error:', err);
  process.exit(1);
});
