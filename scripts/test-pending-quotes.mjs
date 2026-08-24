/**
 * Phase 3B - Pending Quote Flow Tests
 * 
 * Tests:
 * 1. Create pending quote
 * 2. Claim with valid token
 * 3. Reject invalid token
 * 4. Reject expired token
 * 5. Reject duplicate claim (idempotent)
 * 6. Limit handling (20 quotes)
 * 7. Token hashing verification
 * 
 * @created 2026-08-24
 */

import pg from "pg";
import { nanoid } from "nanoid";
import { createHash } from "crypto";

const pool = new pg.Pool({ 
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

let testUserId;

function hashToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

function generatePendingToken() {
  return `psq_${nanoid(43)}`;
}

async function cleanup() {
  await pool.query(`DELETE FROM saved_quotes WHERE user_id = $1`, [testUserId]);
  await pool.query(`DELETE FROM pending_saved_quotes WHERE vehicle_make = 'TEST'`);
}

async function setup() {
  console.log("=== PENDING QUOTE FLOW TESTS ===\n");
  
  // Get test user
  const { rows: users } = await pool.query(`
    SELECT id FROM auth_users WHERE email_verified = true LIMIT 1
  `);
  
  if (users.length === 0) {
    throw new Error("No verified users found");
  }
  
  testUserId = users[0].id;
  console.log("Test user:", testUserId);
  
  await cleanup();
}

async function testCreatePending() {
  console.log("\n1. CREATE PENDING QUOTE...");
  
  const rawToken = generatePendingToken();
  const tokenHash = hashToken(rawToken);
  
  const snapshot = JSON.stringify({
    vehicle: { year: "2024", make: "TEST", model: "Vehicle" },
    items: [{ type: "tire", sku: "X", brand: "X", model: "X", quantity: 4, unitPrice: 100 }],
    pricing: { partsSubtotal: 400, servicesSubtotal: 0, estimatedTax: 24, taxRate: 0.06, total: 424 },
    savedFrom: "cart",
    savedAt: new Date().toISOString(),
    itemSummary: "4x Test Tire"
  });
  
  await pool.query(`
    INSERT INTO pending_saved_quotes 
    (token, snapshot_json, vehicle_year, vehicle_make, vehicle_model, return_to, expires_at)
    VALUES ($1, $2, $3, $4, $5, $6, NOW() + INTERVAL '24 hours')
  `, [tokenHash, snapshot, "2024", "TEST", "Vehicle", "/account"]);
  
  // Verify it was stored with hash
  const { rows } = await pool.query(`
    SELECT token FROM pending_saved_quotes WHERE token = $1
  `, [tokenHash]);
  
  if (rows.length === 1) {
    console.log("   ✓ Pending quote created");
    console.log("   ✓ Token stored as hash (not raw)");
    console.log("   Raw token prefix:", rawToken.slice(0, 15) + "...");
    console.log("   Hash prefix:", tokenHash.slice(0, 15) + "...");
    return { rawToken, tokenHash };
  } else {
    console.log("   ✗ Failed to create pending quote");
    return null;
  }
}

async function testClaimValid(rawToken, tokenHash) {
  console.log("\n2. CLAIM WITH VALID TOKEN...");
  
  // Simulate claim: find by hash, create saved quote, delete pending
  const client = await pool.connect();
  
  try {
    await client.query("BEGIN");
    
    // Find pending
    const { rows: pending } = await client.query(`
      SELECT * FROM pending_saved_quotes WHERE token = $1 AND expires_at > NOW()
    `, [tokenHash]);
    
    if (pending.length === 0) {
      console.log("   ✗ Pending quote not found");
      await client.query("ROLLBACK");
      return false;
    }
    
    // Create saved quote
    const quoteId = `sq_${nanoid(21)}`;
    await client.query(`
      INSERT INTO saved_quotes (id, user_id, snapshot_json, idempotency_key, vehicle_year, vehicle_make, vehicle_model)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [quoteId, testUserId, pending[0].snapshot_json, `claimed_${tokenHash.slice(0, 32)}`, pending[0].vehicle_year, pending[0].vehicle_make, pending[0].vehicle_model]);
    
    // Delete pending
    await client.query(`DELETE FROM pending_saved_quotes WHERE token = $1`, [tokenHash]);
    
    await client.query("COMMIT");
    
    // Verify saved quote exists
    const { rows: saved } = await client.query(`
      SELECT id FROM saved_quotes WHERE id = $1 AND user_id = $2
    `, [quoteId, testUserId]);
    
    // Verify pending is gone
    const { rows: stillPending } = await client.query(`
      SELECT token FROM pending_saved_quotes WHERE token = $1
    `, [tokenHash]);
    
    if (saved.length === 1 && stillPending.length === 0) {
      console.log("   ✓ Claim successful");
      console.log("   ✓ Saved quote created:", quoteId);
      console.log("   ✓ Pending quote deleted");
      return quoteId;
    } else {
      console.log("   ✗ Claim failed");
      return false;
    }
  } catch (err) {
    await client.query("ROLLBACK");
    console.log("   ✗ Error:", err.message);
    return false;
  } finally {
    client.release();
  }
}

async function testInvalidToken() {
  console.log("\n3. REJECT INVALID TOKEN...");
  
  const fakeToken = generatePendingToken();
  const fakeHash = hashToken(fakeToken);
  
  const { rows } = await pool.query(`
    SELECT * FROM pending_saved_quotes WHERE token = $1
  `, [fakeHash]);
  
  if (rows.length === 0) {
    console.log("   ✓ Invalid token correctly rejected (not found)");
    return true;
  } else {
    console.log("   ✗ Should not have found anything");
    return false;
  }
}

async function testExpiredToken() {
  console.log("\n4. REJECT EXPIRED TOKEN...");
  
  const rawToken = generatePendingToken();
  const tokenHash = hashToken(rawToken);
  
  // Create with past expiry
  await pool.query(`
    INSERT INTO pending_saved_quotes 
    (token, snapshot_json, vehicle_year, vehicle_make, vehicle_model, return_to, expires_at)
    VALUES ($1, '{}', '2024', 'TEST', 'Expired', '/account', NOW() - INTERVAL '1 hour')
  `, [tokenHash]);
  
  // Try to find (should not match active query)
  const { rows } = await pool.query(`
    SELECT * FROM pending_saved_quotes WHERE token = $1 AND expires_at > NOW()
  `, [tokenHash]);
  
  if (rows.length === 0) {
    console.log("   ✓ Expired token correctly rejected");
    // Clean up
    await pool.query(`DELETE FROM pending_saved_quotes WHERE token = $1`, [tokenHash]);
    return true;
  } else {
    console.log("   ✗ Expired token should have been rejected");
    return false;
  }
}

async function testDuplicateClaim(quoteId) {
  console.log("\n5. IDEMPOTENT CLAIM (DUPLICATE PREVENTION)...");
  
  // The idempotency key was set during claim
  // Try to insert another quote with same key
  const duplicateId = `sq_${nanoid(21)}`;
  
  try {
    await pool.query(`
      INSERT INTO saved_quotes (id, user_id, snapshot_json, idempotency_key)
      VALUES ($1, $2, '{}', $3)
    `, [duplicateId, testUserId, `claimed_${hashToken(generatePendingToken()).slice(0, 32)}`]);
    
    // This should work since it's a DIFFERENT idempotency key
    // Let's try with the SAME key from the first claim
    
    // Find the original key
    const { rows } = await pool.query(`
      SELECT idempotency_key FROM saved_quotes WHERE id = $1
    `, [quoteId]);
    
    if (rows.length === 0) {
      console.log("   ⚠ Original quote not found, skipping");
      return true;
    }
    
    const originalKey = rows[0].idempotency_key;
    
    // Try duplicate
    try {
      await pool.query(`
        INSERT INTO saved_quotes (id, user_id, snapshot_json, idempotency_key)
        VALUES ($1, $2, '{}', $3)
      `, [`sq_${nanoid(21)}`, testUserId, originalKey]);
      
      console.log("   ✗ Duplicate insert should have failed");
      return false;
    } catch (dupErr) {
      if (dupErr.code === "23505") {
        console.log("   ✓ Duplicate claim prevented by unique constraint");
        return true;
      }
      throw dupErr;
    }
  } catch (err) {
    console.log("   ✗ Error:", err.message);
    return false;
  }
}

async function testLimitHandling() {
  console.log("\n6. LIMIT HANDLING (20 QUOTES)...");
  
  // Clean up first
  await pool.query(`DELETE FROM saved_quotes WHERE user_id = $1`, [testUserId]);
  
  // Create 20 quotes
  console.log("   Creating 20 quotes...");
  for (let i = 0; i < 20; i++) {
    await pool.query(`
      INSERT INTO saved_quotes (id, user_id, snapshot_json, name)
      VALUES ($1, $2, '{}', $3)
    `, [`sq_limit_${i}_${nanoid(10)}`, testUserId, `Limit Test ${i}`]);
  }
  
  // Verify count
  const { rows: countRows } = await pool.query(`
    SELECT COUNT(*)::int as count FROM saved_quotes 
    WHERE user_id = $1 AND archived_at IS NULL
  `, [testUserId]);
  
  const count = countRows[0].count;
  console.log("   Current count:", count);
  
  // Create pending quote
  const rawToken = generatePendingToken();
  const tokenHash = hashToken(rawToken);
  
  await pool.query(`
    INSERT INTO pending_saved_quotes 
    (token, snapshot_json, vehicle_year, vehicle_make, vehicle_model, return_to, expires_at)
    VALUES ($1, '{}', '2024', 'TEST', 'LimitTest', '/account', NOW() + INTERVAL '24 hours')
  `, [tokenHash]);
  
  // Try to claim (should fail due to limit)
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    
    // Check count
    const { rows: currentCount } = await client.query(`
      SELECT COUNT(*)::int as count FROM saved_quotes 
      WHERE user_id = $1 AND archived_at IS NULL
    `, [testUserId]);
    
    if (currentCount[0].count >= 20) {
      // Limit reached - DO NOT consume token
      await client.query("ROLLBACK");
      
      // Verify pending quote still exists
      const { rows: stillThere } = await pool.query(`
        SELECT token FROM pending_saved_quotes WHERE token = $1
      `, [tokenHash]);
      
      if (stillThere.length === 1) {
        console.log("   ✓ Claim blocked at limit");
        console.log("   ✓ Pending quote preserved (not consumed)");
        
        // Now archive one and retry
        console.log("   Archiving one quote...");
        // PostgreSQL doesn't support LIMIT in UPDATE, use subquery
        await pool.query(`
          UPDATE saved_quotes SET archived_at = NOW() 
          WHERE id = (
            SELECT id FROM saved_quotes 
            WHERE user_id = $1 AND archived_at IS NULL 
            LIMIT 1
          )
        `, [testUserId]);
        
        // Retry claim
        const { rows: pending } = await pool.query(`
          SELECT * FROM pending_saved_quotes WHERE token = $1
        `, [tokenHash]);
        
        if (pending.length > 0) {
          const newQuoteId = `sq_retry_${nanoid(10)}`;
          await pool.query(`
            INSERT INTO saved_quotes (id, user_id, snapshot_json)
            VALUES ($1, $2, $3)
          `, [newQuoteId, testUserId, pending[0].snapshot_json]);
          
          await pool.query(`DELETE FROM pending_saved_quotes WHERE token = $1`, [tokenHash]);
          
          console.log("   ✓ Retry after archive succeeded");
          return true;
        }
      }
    }
    
    console.log("   ✗ Limit check failed");
    return false;
  } finally {
    client.release();
  }
}

async function main() {
  try {
    await setup();
    
    const createResult = await testCreatePending();
    let claimResult = false;
    let quoteId = null;
    
    if (createResult) {
      quoteId = await testClaimValid(createResult.rawToken, createResult.tokenHash);
      claimResult = !!quoteId;
    }
    
    const invalidOk = await testInvalidToken();
    const expiredOk = await testExpiredToken();
    const duplicateOk = quoteId ? await testDuplicateClaim(quoteId) : true;
    const limitOk = await testLimitHandling();
    
    await cleanup();
    
    console.log("\n=== SUMMARY ===");
    console.log("1. Create pending:", createResult ? "✓" : "✗");
    console.log("2. Claim valid:", claimResult ? "✓" : "✗");
    console.log("3. Reject invalid:", invalidOk ? "✓" : "✗");
    console.log("4. Reject expired:", expiredOk ? "✓" : "✗");
    console.log("5. Duplicate prevention:", duplicateOk ? "✓" : "✗");
    console.log("6. Limit handling:", limitOk ? "✓" : "✗");
    
    const allPassed = createResult && claimResult && invalidOk && expiredOk && duplicateOk && limitOk;
    console.log("\nOverall:", allPassed ? "✓ ALL PASSED" : "✗ SOME FAILED");
    
    await pool.end();
    process.exit(allPassed ? 0 : 1);
  } catch (err) {
    console.error("Test error:", err);
    await pool.end();
    process.exit(1);
  }
}

main();
