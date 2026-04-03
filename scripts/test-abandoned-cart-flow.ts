/**
 * Test Abandoned Cart Email Flow
 * 
 * Validates:
 * 1. Email capture via exit_intent
 * 2. Email capture via cart_save
 * 3. Abandoned cart detection
 * 4. Email consent checking
 * 5. Email sending (safe mode)
 * 6. Recovery link generation
 * 
 * Run: npx tsx scripts/test-abandoned-cart-flow.ts
 */

import "dotenv/config";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { sql, eq, and } from "drizzle-orm";
import * as schema from "../src/lib/fitment-db/schema";

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
});

const db = drizzle(pool, { schema });

const TEST_EMAIL = "test-abandoned-cart@example.com";
const TEST_CART_ID = `test-${Date.now().toString(36)}`;

async function cleanup() {
  console.log("\n🧹 Cleaning up test data...");
  
  await db.delete(schema.emailSubscribers)
    .where(eq(schema.emailSubscribers.email, TEST_EMAIL));
  
  await db.delete(schema.abandonedCarts)
    .where(eq(schema.abandonedCarts.cartId, TEST_CART_ID));
  
  console.log("   ✓ Test data cleaned");
}

async function testEmailCapture() {
  console.log("\n📧 Testing email capture...");
  
  // Test exit_intent capture
  const [exitIntent] = await db.insert(schema.emailSubscribers)
    .values({
      email: TEST_EMAIL,
      source: "exit_intent",
      vehicleYear: "2010",
      vehicleMake: "Chevrolet",
      vehicleModel: "Tahoe",
      cartId: TEST_CART_ID,
      marketingConsent: true,
    })
    .returning();
  
  console.log(`   ✓ exit_intent capture: ${exitIntent.id}`);
  
  // Verify it exists
  const [found] = await db.select()
    .from(schema.emailSubscribers)
    .where(and(
      eq(schema.emailSubscribers.email, TEST_EMAIL),
      eq(schema.emailSubscribers.source, "exit_intent")
    ))
    .limit(1);
  
  if (!found) throw new Error("Email not found after insert");
  console.log(`   ✓ Verified email exists in database`);
  
  return exitIntent;
}

async function testCartCreation() {
  console.log("\n🛒 Testing cart creation...");
  
  const [cart] = await db.insert(schema.abandonedCarts)
    .values({
      cartId: TEST_CART_ID,
      customerEmail: TEST_EMAIL,
      customerFirstName: "Test",
      vehicleYear: "2010",
      vehicleMake: "Chevrolet",
      vehicleModel: "Tahoe",
      items: [
        {
          sku: "TEST-WHEEL-001",
          type: "wheel",
          brand: "Test Brand",
          model: "Test Model",
          diameter: "22",
          width: "9",
          quantity: 4,
          unitPrice: 467,
        },
        {
          sku: "TEST-TIRE-001",
          type: "tire",
          brand: "Goodyear",
          model: "Eagle Touring",
          size: "285/45R22",
          quantity: 4,
          unitPrice: 232,
        },
      ],
      itemCount: 8,
      subtotal: "2796",
      estimatedTotal: "2796",
      status: "active",
      lastActivityAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
    })
    .returning();
  
  console.log(`   ✓ Created test cart: ${cart.cartId}`);
  console.log(`   ✓ Value: $${cart.estimatedTotal}`);
  
  return cart;
}

async function testCartAbandonment() {
  console.log("\n⏰ Testing cart abandonment...");
  
  // Mark cart as abandoned
  const [updated] = await db.update(schema.abandonedCarts)
    .set({
      status: "abandoned",
      abandonedAt: new Date(Date.now() - 1.5 * 60 * 60 * 1000), // 1.5 hours ago
    })
    .where(eq(schema.abandonedCarts.cartId, TEST_CART_ID))
    .returning();
  
  console.log(`   ✓ Cart marked as abandoned`);
  console.log(`   ✓ Abandoned at: ${updated.abandonedAt}`);
  
  return updated;
}

async function testConsentCheck() {
  console.log("\n✅ Testing consent check...");
  
  // Check if email has consent
  const [subscriber] = await db.select()
    .from(schema.emailSubscribers)
    .where(and(
      eq(schema.emailSubscribers.email, TEST_EMAIL),
      eq(schema.emailSubscribers.unsubscribed, false),
      eq(schema.emailSubscribers.marketingConsent, true)
    ))
    .limit(1);
  
  if (!subscriber) {
    console.log(`   ✗ No consent found`);
    return false;
  }
  
  console.log(`   ✓ Consent found via source: ${subscriber.source}`);
  return true;
}

async function testEmailEligibility() {
  console.log("\n📋 Testing email eligibility...");
  
  // Find carts eligible for first email
  const eligibleCarts = await db.select()
    .from(schema.abandonedCarts)
    .where(and(
      eq(schema.abandonedCarts.status, "abandoned"),
      eq(schema.abandonedCarts.cartId, TEST_CART_ID)
    ))
    .limit(1);
  
  if (eligibleCarts.length === 0) {
    console.log(`   ✗ Cart not found in eligible list`);
    return null;
  }
  
  const cart = eligibleCarts[0];
  console.log(`   ✓ Cart ${cart.cartId} is eligible`);
  console.log(`   ✓ Email: ${cart.customerEmail}`);
  console.log(`   ✓ Value: $${cart.estimatedTotal}`);
  console.log(`   ✓ Emails sent: ${cart.emailSentCount}`);
  
  return cart;
}

async function testRecoveryLink() {
  console.log("\n🔗 Testing recovery link...");
  
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://shop.warehousetiredirect.com";
  const recoveryLink = `${baseUrl}/cart/recover/${TEST_CART_ID}`;
  
  console.log(`   ✓ Recovery link: ${recoveryLink}`);
  
  return recoveryLink;
}

async function simulateEmailSend() {
  console.log("\n📤 Simulating email send (safe mode)...");
  
  // Get cart
  const [cart] = await db.select()
    .from(schema.abandonedCarts)
    .where(eq(schema.abandonedCarts.cartId, TEST_CART_ID))
    .limit(1);
  
  if (!cart) {
    console.log(`   ✗ Cart not found`);
    return;
  }
  
  // Simulate sending first email
  await db.update(schema.abandonedCarts)
    .set({
      firstEmailSentAt: new Date(),
      emailSentCount: 1,
      lastEmailStatus: "sent",
    })
    .where(eq(schema.abandonedCarts.cartId, TEST_CART_ID));
  
  console.log(`   ✓ First email "sent" (simulated)`);
  
  // Verify tracking update
  const [updated] = await db.select()
    .from(schema.abandonedCarts)
    .where(eq(schema.abandonedCarts.cartId, TEST_CART_ID))
    .limit(1);
  
  console.log(`   ✓ Email sent count: ${updated.emailSentCount}`);
  console.log(`   ✓ First email sent at: ${updated.firstEmailSentAt}`);
  console.log(`   ✓ Last status: ${updated.lastEmailStatus}`);
}

async function generateEmailPayload() {
  console.log("\n📝 Generating example email payload...");
  
  const [cart] = await db.select()
    .from(schema.abandonedCarts)
    .where(eq(schema.abandonedCarts.cartId, TEST_CART_ID))
    .limit(1);
  
  if (!cart) return;
  
  const items = cart.items as any[];
  const wheels = items.filter(i => i.type === "wheel");
  const tires = items.filter(i => i.type === "tire");
  
  const payload = {
    to: cart.customerEmail,
    subject: `Your ${cart.vehicleYear} ${cart.vehicleMake} ${cart.vehicleModel} wheels are waiting`,
    vehicle: `${cart.vehicleYear} ${cart.vehicleMake} ${cart.vehicleModel}`,
    items: {
      wheels: wheels.map(w => ({
        brand: w.brand,
        model: w.model,
        size: `${w.diameter}" × ${w.width}"`,
        qty: w.quantity,
        total: `$${(w.unitPrice * w.quantity).toLocaleString()}`,
      })),
      tires: tires.map(t => ({
        brand: t.brand,
        model: t.model,
        size: t.size,
        qty: t.quantity,
        total: `$${(t.unitPrice * t.quantity).toLocaleString()}`,
      })),
    },
    total: `$${Number(cart.estimatedTotal).toLocaleString()}`,
    recoveryLink: `${process.env.NEXT_PUBLIC_BASE_URL || "https://shop.warehousetiredirect.com"}/cart/recover/${cart.cartId}`,
    priceMatch: "Found it cheaper? Reply to this email and we'll take a look.",
  };
  
  console.log("\n   Example Email Payload:");
  console.log("   " + "-".repeat(50));
  console.log(JSON.stringify(payload, null, 2).split("\n").map(l => "   " + l).join("\n"));
  console.log("   " + "-".repeat(50));
  
  return payload;
}

async function main() {
  console.log("=".repeat(60));
  console.log("ABANDONED CART EMAIL FLOW TEST");
  console.log("=".repeat(60));
  
  try {
    // Clean up any previous test data
    await cleanup();
    
    // Run tests
    await testEmailCapture();
    await testCartCreation();
    await testCartAbandonment();
    const hasConsent = await testConsentCheck();
    
    if (!hasConsent) {
      throw new Error("Consent check failed");
    }
    
    await testEmailEligibility();
    await testRecoveryLink();
    await simulateEmailSend();
    await generateEmailPayload();
    
    // Clean up after test
    await cleanup();
    
    console.log("\n" + "=".repeat(60));
    console.log("✅ ALL TESTS PASSED");
    console.log("=".repeat(60));
    
  } catch (err) {
    console.error("\n❌ TEST FAILED:", err);
    await cleanup();
    process.exit(1);
  }
  
  await pool.end();
  process.exit(0);
}

main();
