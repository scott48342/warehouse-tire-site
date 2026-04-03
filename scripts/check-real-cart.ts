/**
 * Check the real abandoned cart and its email eligibility
 */

import "dotenv/config";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { eq, and, or } from "drizzle-orm";
import * as schema from "../src/lib/fitment-db/schema";

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
});

const db = drizzle(pool, { schema });

const REAL_CART_ID = "mn8azcwu-ex4qae4z";

async function main() {
  console.log("=".repeat(60));
  console.log("CHECKING REAL ABANDONED CART");
  console.log("=".repeat(60));

  // Get the cart
  const [cart] = await db.select()
    .from(schema.abandonedCarts)
    .where(eq(schema.abandonedCarts.cartId, REAL_CART_ID))
    .limit(1);

  if (!cart) {
    console.log("❌ Cart not found");
    process.exit(1);
  }

  console.log("\n📋 Cart Details:");
  console.log(`   Cart ID: ${cart.cartId}`);
  console.log(`   Status: ${cart.status}`);
  console.log(`   Email: ${cart.customerEmail || "NOT CAPTURED"}`);
  console.log(`   Value: $${cart.estimatedTotal}`);
  console.log(`   Items: ${cart.itemCount}`);
  console.log(`   Vehicle: ${cart.vehicleYear} ${cart.vehicleMake} ${cart.vehicleModel}`);
  console.log(`   Abandoned: ${cart.abandonedAt}`);

  console.log("\n📧 Email Tracking:");
  console.log(`   First email: ${cart.firstEmailSentAt || "Not sent"}`);
  console.log(`   Second email: ${cart.secondEmailSentAt || "Not sent"}`);
  console.log(`   Third email: ${cart.thirdEmailSentAt || "Not sent"}`);
  console.log(`   Emails sent: ${cart.emailSentCount}`);
  console.log(`   Last status: ${cart.lastEmailStatus || "N/A"}`);
  console.log(`   Unsubscribed: ${cart.unsubscribed}`);

  // Check if email is in subscribers table
  if (cart.customerEmail) {
    const subscribers = await db.select()
      .from(schema.emailSubscribers)
      .where(eq(schema.emailSubscribers.email, cart.customerEmail.toLowerCase()));
    
    console.log("\n👤 Subscriber Records:");
    if (subscribers.length === 0) {
      console.log("   None found - email captured from checkout or direct");
    } else {
      for (const sub of subscribers) {
        console.log(`   - Source: ${sub.source}, Consent: ${sub.marketingConsent}, Unsub: ${sub.unsubscribed}`);
      }
    }
  }

  // Eligibility check
  console.log("\n✅ Eligibility:");
  const issues: string[] = [];
  
  if (!cart.customerEmail) issues.push("No email captured");
  if (cart.status !== "abandoned") issues.push(`Status is ${cart.status}, not abandoned`);
  if (cart.unsubscribed) issues.push("Unsubscribed");
  if (Number(cart.estimatedTotal) < 50) issues.push("Cart value below $50 threshold");
  
  if (issues.length === 0) {
    console.log("   ✓ Cart is eligible for recovery emails");
    
    if (!cart.firstEmailSentAt) {
      console.log("   → Ready for: FIRST email");
    } else if (!cart.secondEmailSentAt) {
      console.log("   → Ready for: SECOND email");
    } else if (!cart.thirdEmailSentAt) {
      console.log("   → Ready for: THIRD email");
    } else {
      console.log("   → All 3 emails already sent");
    }
  } else {
    console.log("   ✗ Not eligible:");
    for (const issue of issues) {
      console.log(`     - ${issue}`);
    }
  }

  // Recovery link
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://shop.warehousetiredirect.com";
  console.log(`\n🔗 Recovery Link:`);
  console.log(`   ${baseUrl}/cart/recover/${cart.cartId}`);

  await pool.end();
  process.exit(0);
}

main().catch(console.error);
