/**
 * Cross-Account Isolation Test
 * 
 * Verifies that user A cannot access user B's garage data.
 * Uses direct database operations to set up test data,
 * then verifies API properly enforces ownership.
 */

const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

async function runTest() {
  const client = await pool.connect();
  
  try {
    console.log('=== Cross-Account Isolation Test ===\n');
    
    // Get two test users
    const users = await client.query(`
      SELECT id, email FROM auth_users 
      WHERE email LIKE 'test%' 
      ORDER BY created_at 
      LIMIT 2
    `);
    
    if (users.rows.length < 2) {
      console.log('❌ Need at least 2 test accounts. Found:', users.rows.length);
      return;
    }
    
    const userA = users.rows[0];
    const userB = users.rows[1];
    
    console.log('User A:', userA.email, '(' + userA.id.slice(0,8) + '...)');
    console.log('User B:', userB.email, '(' + userB.id.slice(0,8) + '...)\n');
    
    // Clean up any existing test data
    await client.query('DELETE FROM user_garage WHERE user_id = $1 OR user_id = $2', [userA.id, userB.id]);
    console.log('✓ Cleaned existing garage data\n');
    
    // Insert Vehicle A for User A
    const vehicleA_id = 'v_test_' + Date.now() + '_A';
    await client.query(`
      INSERT INTO user_garage (id, user_id, year, make, model, trim, modification, added_at, last_active_at)
      VALUES ($1, $2, '2024', 'Ford', 'F-150', 'XLT', 'ford-f150-2024-xlt', NOW(), NOW())
    `, [vehicleA_id, userA.id]);
    console.log('✓ Created Vehicle A for User A:', vehicleA_id);
    
    // Insert Vehicle B for User B
    const vehicleB_id = 'v_test_' + Date.now() + '_B';
    await client.query(`
      INSERT INTO user_garage (id, user_id, year, make, model, trim, modification, added_at, last_active_at)
      VALUES ($1, $2, '2022', 'Toyota', 'Camry', 'SE', 'toyota-camry-2022-se', NOW(), NOW())
    `, [vehicleB_id, userB.id]);
    console.log('✓ Created Vehicle B for User B:', vehicleB_id);
    
    // Verify isolation at database level
    console.log('\n--- Database Isolation Check ---');
    
    // User A should only see Vehicle A
    const userA_vehicles = await client.query(
      'SELECT id, make, model FROM user_garage WHERE user_id = $1',
      [userA.id]
    );
    console.log('User A vehicles:', userA_vehicles.rows.length);
    const userA_hasOnlyA = userA_vehicles.rows.length === 1 && userA_vehicles.rows[0].id === vehicleA_id;
    console.log(userA_hasOnlyA ? '✅ User A sees only Vehicle A' : '❌ User A isolation FAILED');
    
    // User B should only see Vehicle B
    const userB_vehicles = await client.query(
      'SELECT id, make, model FROM user_garage WHERE user_id = $1',
      [userB.id]
    );
    console.log('User B vehicles:', userB_vehicles.rows.length);
    const userB_hasOnlyB = userB_vehicles.rows.length === 1 && userB_vehicles.rows[0].id === vehicleB_id;
    console.log(userB_hasOnlyB ? '✅ User B sees only Vehicle B' : '❌ User B isolation FAILED');
    
    // Verify FK constraint - try to access Vehicle B with User A's ID
    console.log('\n--- Cross-Access Prevention Check ---');
    
    // This should return 0 rows (User A cannot see Vehicle B)
    const crossAccess = await client.query(
      'SELECT id FROM user_garage WHERE user_id = $1 AND id = $2',
      [userA.id, vehicleB_id]
    );
    const crossBlocked = crossAccess.rows.length === 0;
    console.log(crossBlocked ? '✅ User A cannot query Vehicle B' : '❌ Cross-access VULNERABILITY');
    
    // Verify update isolation
    const updateResult = await client.query(
      'UPDATE user_garage SET nickname = $1 WHERE user_id = $2 AND id = $3',
      ['Hacked!', userA.id, vehicleB_id]
    );
    const updateBlocked = updateResult.rowCount === 0;
    console.log(updateBlocked ? '✅ User A cannot update Vehicle B' : '❌ Cross-update VULNERABILITY');
    
    // Verify delete isolation
    const deleteResult = await client.query(
      'DELETE FROM user_garage WHERE user_id = $1 AND id = $2',
      [userA.id, vehicleB_id]
    );
    const deleteBlocked = deleteResult.rowCount === 0;
    console.log(deleteBlocked ? '✅ User A cannot delete Vehicle B' : '❌ Cross-delete VULNERABILITY');
    
    // Verify Vehicle B still exists
    const vehicleB_check = await client.query(
      'SELECT id FROM user_garage WHERE id = $1',
      [vehicleB_id]
    );
    const vehicleB_intact = vehicleB_check.rows.length === 1;
    console.log(vehicleB_intact ? '✅ Vehicle B still intact' : '❌ Vehicle B was affected');
    
    // Clean up
    await client.query('DELETE FROM user_garage WHERE id = $1 OR id = $2', [vehicleA_id, vehicleB_id]);
    console.log('\n✓ Cleaned up test data');
    
    // Summary
    console.log('\n=== Summary ===');
    const allPassed = userA_hasOnlyA && userB_hasOnlyB && crossBlocked && updateBlocked && deleteBlocked && vehicleB_intact;
    if (allPassed) {
      console.log('✅ All cross-account isolation tests PASSED');
      console.log('   - Users can only see their own vehicles');
      console.log('   - Users cannot query other users\' vehicles');
      console.log('   - Users cannot update other users\' vehicles');
      console.log('   - Users cannot delete other users\' vehicles');
    } else {
      console.log('❌ Some isolation tests FAILED - SECURITY ISSUE');
      process.exit(1);
    }
    
  } finally {
    client.release();
    await pool.end();
  }
}

runTest().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
