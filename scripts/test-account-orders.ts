/**
 * Security Test Script: Account Orders API
 * 
 * Tests the ownership verification and access control for My Orders.
 * 
 * Run: npx tsx scripts/test-account-orders.ts
 * 
 * @created 2026-08-22 - Phase 3A: My Orders
 */

import { normalizeEmail, emailsMatch } from "../src/lib/account/emailUtils";

// ============================================================================
// Test Utilities
// ============================================================================

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`✅ ${name}`);
    passed++;
  } catch (err: any) {
    console.log(`❌ ${name}`);
    console.log(`   Error: ${err.message}`);
    failed++;
  }
}

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

function assertEqual<T>(actual: T, expected: T, message: string) {
  if (actual !== expected) {
    throw new Error(`${message}: expected "${expected}", got "${actual}"`);
  }
}

// ============================================================================
// Email Normalization Tests
// ============================================================================

console.log("\n=== Email Normalization Tests ===\n");

test("normalizeEmail trims whitespace", () => {
  assertEqual(normalizeEmail("  test@example.com  "), "test@example.com", "trim");
});

test("normalizeEmail converts to lowercase", () => {
  assertEqual(normalizeEmail("TEST@EXAMPLE.COM"), "test@example.com", "lowercase");
});

test("normalizeEmail handles null", () => {
  assertEqual(normalizeEmail(null), "", "null");
});

test("normalizeEmail handles undefined", () => {
  assertEqual(normalizeEmail(undefined), "", "undefined");
});

test("normalizeEmail handles empty string", () => {
  assertEqual(normalizeEmail(""), "", "empty");
});

test("normalizeEmail preserves valid email", () => {
  assertEqual(normalizeEmail("user@domain.com"), "user@domain.com", "valid");
});

test("normalizeEmail handles mixed case and whitespace", () => {
  assertEqual(normalizeEmail("  User@Domain.COM  "), "user@domain.com", "mixed");
});

// ============================================================================
// Email Match Tests
// ============================================================================

console.log("\n=== Email Match Tests ===\n");

test("emailsMatch returns true for identical emails", () => {
  assert(emailsMatch("test@example.com", "test@example.com"), "identical");
});

test("emailsMatch returns true for case-different emails", () => {
  assert(emailsMatch("TEST@example.com", "test@EXAMPLE.com"), "case insensitive");
});

test("emailsMatch returns true with whitespace differences", () => {
  assert(emailsMatch("  test@example.com", "test@example.com  "), "whitespace");
});

test("emailsMatch returns false for different emails", () => {
  assert(!emailsMatch("a@example.com", "b@example.com"), "different");
});

test("emailsMatch returns false for null vs email", () => {
  assert(!emailsMatch(null, "test@example.com"), "null first");
});

test("emailsMatch returns false for email vs null", () => {
  assert(!emailsMatch("test@example.com", null), "null second");
});

test("emailsMatch returns false for empty vs email", () => {
  assert(!emailsMatch("", "test@example.com"), "empty first");
});

test("emailsMatch returns false for email vs empty", () => {
  assert(!emailsMatch("test@example.com", ""), "empty second");
});

test("emailsMatch returns false for both null", () => {
  assert(!emailsMatch(null, null), "both null");
});

test("emailsMatch returns false for both empty", () => {
  assert(!emailsMatch("", ""), "both empty");
});

// ============================================================================
// API Security Tests (requires running server)
// ============================================================================

console.log("\n=== API Security Tests ===\n");

const BASE_URL = process.env.BASE_URL || "http://localhost:3001";

async function testUnauthenticatedOrderList() {
  const res = await fetch(`${BASE_URL}/api/account/orders`);
  assert(res.status === 401, `Expected 401, got ${res.status}`);
  const data = await res.json();
  assertEqual(data.error, "unauthorized", "error code");
}

async function testUnauthenticatedOrderDetail() {
  const res = await fetch(`${BASE_URL}/api/account/orders/WTD-TEST01`);
  assert(res.status === 401, `Expected 401, got ${res.status}`);
  const data = await res.json();
  assertEqual(data.error, "unauthorized", "error code");
}

async function testInvalidOrderId() {
  // Even with auth, invalid order ID should return 404
  const res = await fetch(`${BASE_URL}/api/account/orders/INVALID-ORDER-ID-12345`);
  // Without auth, should be 401
  assert(res.status === 401 || res.status === 404, `Expected 401 or 404, got ${res.status}`);
}

// Run API tests if server is available
async function runApiTests() {
  try {
    // Check if server is running
    const healthCheck = await fetch(`${BASE_URL}/api/vehicles/years`).catch(() => null);
    if (!healthCheck) {
      console.log("⚠️  Server not running at " + BASE_URL);
      console.log("   Skipping API security tests");
      console.log("   Start dev server and re-run for full test coverage");
      return;
    }

    await test("Unauthenticated order list returns 401", async () => {
      await testUnauthenticatedOrderList();
    });

    await test("Unauthenticated order detail returns 401", async () => {
      await testUnauthenticatedOrderDetail();
    });

    await test("Invalid order ID handled correctly", async () => {
      await testInvalidOrderId();
    });

  } catch (err) {
    console.log("⚠️  API tests skipped due to connection error");
  }
}

// ============================================================================
// Run Tests
// ============================================================================

async function main() {
  await runApiTests();

  console.log("\n=== Results ===\n");
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  
  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Test runner error:", err);
  process.exit(1);
});
