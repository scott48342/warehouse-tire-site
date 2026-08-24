/**
 * Concurrency Tests for Saved Quotes
 * 
 * Tests:
 * 1. Same idempotency key, concurrent requests → exactly one row
 * 2. Different keys at 19 active → one succeeds, one gets limit_reached
 * 3. Existing key when at limit → returns existing quote
 * 
 * @created 2026-08-24
 */

import pg from "pg";
import { nanoid } from "nanoid";

const pool = new pg.Pool({ 
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

// Test user
let testUserId;

// Simulated createSavedQuote with advisory lock (matches service implementation)
async function createSavedQuoteDB(userId, idempotencyKey, name) {
  const client = await pool.connect();
  
  try {
    // Check for existing idempotent quote first
    if (idempotencyKey) {
      const { rows: existing } = await client.query(`
        SELECT id FROM saved_quotes 
        WHERE user_id = $1 AND idempotency_key = $2
      `, [userId, idempotencyKey]);
      
      if (existing.length > 0) {
        return { ok: true, id: existing[0].id, isIdempotent: true };
      }
    }
    
    // Generate hash for advisory lock
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      hash = ((hash << 5) - hash + userId.charCodeAt(i)) | 0;
    }
    const lockKey = Math.abs(hash);
    
    await client.query("BEGIN");
    
    // Acquire per-user advisory lock
    await client.query(`SELECT pg_advisory_xact_lock($1)`, [lockKey]);
    
    // Check active quote count
    const { rows: countRows } = await client.query(`
      SELECT COUNT(*)::int as count FROM saved_quotes 
      WHERE user_id = $1 AND archived_at IS NULL
    `, [userId]);
    
    const count = countRows[0].count;
    
    if (count >= 20) {
      await client.query("ROLLBACK");
      return { ok: false, error: "Maximum 20 saved quotes allowed", code: "limit_reached" };
    }
    
    // Insert
    const id = `sq_${nanoid(21)}`;
    const snapshot = JSON.stringify({
      vehicle: { year: "2024", make: "Test", model: "Car" },
      items: [{ type: "tire", sku: "X", brand: "X", model: "X", quantity: 1, unitPrice: 100 }],
      pricing: { partsSubtotal: 100, servicesSubtotal: 0, estimatedTax: 6, taxRate: 0.06, total: 106 },
      savedFrom: "cart",
      savedAt: new Date().toISOString(),
      itemSummary: "1x Test"
    });
    
    try {
      await client.query(`
        INSERT INTO saved_quotes (id, user_id, name, snapshot_json, idempotency_key)
        VALUES ($1, $2, $3, $4, $5)
      `, [id, userId, name, snapshot, idempotencyKey]);
      
      await client.query("COMMIT");
      return { ok: true, id };
    } catch (err) {
      if (err.code === "23505" && idempotencyKey) {
        // Unique violation - another request inserted first
        await client.query("ROLLBACK");
        
        // Fetch the existing quote
        const { rows } = await client.query(`
          SELECT id FROM saved_quotes 
          WHERE user_id = $1 AND idempotency_key = $2
        `, [userId, idempotencyKey]);
        
        if (rows.length > 0) {
          return { ok: true, id: rows[0].id, isIdempotent: true };
        }
      }
      await client.query("ROLLBACK");
      throw err;
    }
  } finally {
    client.release();
  }
}

async function cleanup() {
  // Delete test quotes
  await pool.query(`DELETE FROM saved_quotes WHERE user_id = $1`, [testUserId]);
}

async function setup() {
  console.log("=== CONCURRENCY TESTS ===\n");
  
  // Get or create test user
  const { rows: users } = await pool.query(`
    SELECT id FROM auth_users WHERE email_verified = true LIMIT 1
  `);
  
  if (users.length === 0) {
    throw new Error("No verified users found");
  }
  
  testUserId = users[0].id;
  console.log("Test user:", testUserId);
  
  // Clean up any existing test quotes
  await cleanup();
}

async function testIdempotencyConcurrent() {
  console.log("\n1. CONCURRENT REQUESTS WITH SAME IDEMPOTENCY KEY...");
  
  const key = `test_${nanoid(10)}`;
  
  // Launch 5 concurrent requests with same key
  const results = await Promise.all([
    createSavedQuoteDB(testUserId, key, "Quote 1"),
    createSavedQuoteDB(testUserId, key, "Quote 2"),
    createSavedQuoteDB(testUserId, key, "Quote 3"),
    createSavedQuoteDB(testUserId, key, "Quote 4"),
    createSavedQuoteDB(testUserId, key, "Quote 5"),
  ]);
  
  // All should succeed
  const allOk = results.every(r => r.ok);
  
  // All should return same ID
  const ids = results.map(r => r.id);
  const uniqueIds = [...new Set(ids)];
  
  // Count idempotent returns
  const idempotentCount = results.filter(r => r.isIdempotent).length;
  
  // Check database has exactly one row
  const { rows } = await pool.query(`
    SELECT COUNT(*)::int as count FROM saved_quotes 
    WHERE user_id = $1 AND idempotency_key = $2
  `, [testUserId, key]);
  
  const rowCount = rows[0].count;
  
  console.log("  Results:", results.length, "requests completed");
  console.log("  All OK:", allOk);
  console.log("  Unique IDs:", uniqueIds.length, "(should be 1)");
  console.log("  Idempotent returns:", idempotentCount, "(should be 4)");
  console.log("  Database rows:", rowCount, "(should be 1)");
  
  const passed = allOk && uniqueIds.length === 1 && rowCount === 1;
  console.log("  " + (passed ? "✓ PASSED" : "✗ FAILED"));
  
  return passed;
}

async function testLimitConcurrent() {
  console.log("\n2. CONCURRENT REQUESTS AT LIMIT (19 → 20/21)...");
  
  // First clean up
  await cleanup();
  
  // Create 19 quotes
  console.log("  Creating 19 quotes...");
  for (let i = 0; i < 19; i++) {
    await createSavedQuoteDB(testUserId, `setup_${i}`, `Setup Quote ${i}`);
  }
  
  // Verify 19
  const { rows: before } = await pool.query(`
    SELECT COUNT(*)::int as count FROM saved_quotes 
    WHERE user_id = $1 AND archived_at IS NULL
  `, [testUserId]);
  console.log("  Quotes before concurrent test:", before[0].count);
  
  // Launch 2 concurrent requests with different keys
  const keyA = `race_a_${nanoid(10)}`;
  const keyB = `race_b_${nanoid(10)}`;
  
  const [resultA, resultB] = await Promise.all([
    createSavedQuoteDB(testUserId, keyA, "Race Quote A"),
    createSavedQuoteDB(testUserId, keyB, "Race Quote B"),
  ]);
  
  console.log("  Result A:", resultA.ok ? "OK" : resultA.code);
  console.log("  Result B:", resultB.ok ? "OK" : resultB.code);
  
  // Check final count
  const { rows: after } = await pool.query(`
    SELECT COUNT(*)::int as count FROM saved_quotes 
    WHERE user_id = $1 AND archived_at IS NULL
  `, [testUserId]);
  
  const finalCount = after[0].count;
  console.log("  Final count:", finalCount, "(should be exactly 20)");
  
  // Exactly one should succeed, one should fail
  const oneOk = (resultA.ok && !resultB.ok) || (!resultA.ok && resultB.ok);
  const limitReached = [resultA, resultB].filter(r => r.code === "limit_reached").length === 1;
  
  const passed = finalCount === 20 && oneOk && limitReached;
  console.log("  One succeeded, one limit_reached:", oneOk && limitReached);
  console.log("  " + (passed ? "✓ PASSED" : "✗ FAILED"));
  
  return passed;
}

async function testIdempotentAtLimit() {
  console.log("\n3. RETRY WITH EXISTING KEY WHEN AT LIMIT...");
  
  // We should already be at 20 from test 2
  const { rows: countBefore } = await pool.query(`
    SELECT COUNT(*)::int as count FROM saved_quotes 
    WHERE user_id = $1 AND archived_at IS NULL
  `, [testUserId]);
  console.log("  Current count:", countBefore[0].count);
  
  // Find a quote with an idempotency key (one of the setup_* ones)
  const { rows: existing } = await pool.query(`
    SELECT id, idempotency_key FROM saved_quotes 
    WHERE user_id = $1 AND idempotency_key LIKE 'setup_%'
    LIMIT 1
  `, [testUserId]);
  
  if (existing.length === 0) {
    console.log("  No existing quote with key found");
    return false;
  }
  
  const existingId = existing[0].id;
  const existingKey = existing[0].idempotency_key;
  console.log("  Retrying with key:", existingKey);
  
  // Retry with the same key
  const result = await createSavedQuoteDB(testUserId, existingKey, "Retry Quote");
  
  console.log("  Result:", result.ok ? "OK" : result.code);
  console.log("  Returned ID:", result.id);
  console.log("  Expected ID:", existingId);
  console.log("  Is idempotent:", result.isIdempotent);
  
  const passed = result.ok && result.id === existingId && result.isIdempotent;
  console.log("  " + (passed ? "✓ PASSED" : "✗ FAILED"));
  
  return passed;
}

async function main() {
  try {
    await setup();
    
    const test1 = await testIdempotencyConcurrent();
    const test2 = await testLimitConcurrent();
    const test3 = await testIdempotentAtLimit();
    
    await cleanup();
    
    console.log("\n=== SUMMARY ===");
    console.log("1. Concurrent same key:", test1 ? "✓" : "✗");
    console.log("2. Concurrent at limit:", test2 ? "✓" : "✗");
    console.log("3. Retry existing at limit:", test3 ? "✓" : "✗");
    
    const allPassed = test1 && test2 && test3;
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
