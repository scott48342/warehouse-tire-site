import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { abandonedCarts } from "../src/lib/fitment-db/schema";
import { desc, or, eq } from "drizzle-orm";

// Load env from .env.local
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
});

const db = drizzle(pool);

async function main() {
  const carts = await db
    .select()
    .from(abandonedCarts)
    .where(or(eq(abandonedCarts.status, "abandoned"), eq(abandonedCarts.status, "active")))
    .orderBy(desc(abandonedCarts.lastActivityAt))
    .limit(10);

  for (const cart of carts) {
    console.log("\n========================================");
    console.log(`Cart ID: ${cart.cartId}`);
    console.log(`Status: ${cart.status}`);
    console.log(`Customer: ${cart.customerFirstName || ""} ${cart.customerLastName || ""}`);
    console.log(`Email: ${cart.customerEmail || "N/A"}`);
    console.log(`Phone: ${cart.customerPhone || "N/A"}`);
    console.log(`Vehicle: ${cart.vehicleYear} ${cart.vehicleMake} ${cart.vehicleModel} ${cart.vehicleTrim || ""}`);
    console.log(`Items: ${cart.itemCount}`);
    console.log(`Value: $${cart.estimatedTotal}`);
    console.log(`Created: ${cart.createdAt}`);
    console.log(`Last Activity: ${cart.lastActivityAt}`);
    console.log(`Abandoned At: ${cart.abandonedAt || "N/A"}`);
    console.log("\nCart Items:");
    console.log(JSON.stringify(cart.items, null, 2));
  }

  await pool.end();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
