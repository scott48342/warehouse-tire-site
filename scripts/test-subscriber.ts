/**
 * Test email subscriber service
 */

import "dotenv/config";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { subscribe, getStats, getByEmail } from "../src/lib/email/subscriberService";

async function main() {
  console.log("Testing email subscriber service...\n");

  // Test subscribe
  console.log("1. Testing subscribe...");
  const sub = await subscribe({
    email: "test@example.com",
    source: "exit_intent",
    vehicle: {
      year: "2010",
      make: "Chevrolet",
      model: "Tahoe",
    },
    cartId: "test-cart-123",
  });
  console.log("   Created:", sub.id, sub.email, sub.source);

  // Test stats
  console.log("\n2. Testing stats...");
  const stats = await getStats();
  console.log("   Total:", stats.total);
  console.log("   By source:", stats.bySource);

  // Test lookup
  console.log("\n3. Testing lookup...");
  const records = await getByEmail("test@example.com");
  console.log("   Found:", records.length, "records");

  console.log("\n✅ All tests passed!");
  process.exit(0);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
