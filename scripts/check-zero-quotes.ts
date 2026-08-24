/**
 * Check for Saved Quotes with $0 pricing
 * 
 * This audits the production database for quotes affected by the
 * pricing bug that caused items to be saved with unitPrice=0.
 */

import { db } from "../src/lib/db";
import { savedQuotes } from "../src/lib/auth-schema";
import { sql, isNull } from "drizzle-orm";

async function main() {
  console.log("Checking for $0 Saved Quotes...\n");
  
  // Get total count
  const totalResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(savedQuotes);
  const totalQuotes = totalResult[0]?.count || 0;
  console.log(`Total saved quotes: ${totalQuotes}`);
  
  // Get non-archived count
  const activeResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(savedQuotes)
    .where(isNull(savedQuotes.archivedAt));
  const activeQuotes = activeResult[0]?.count || 0;
  console.log(`Active (non-archived) quotes: ${activeQuotes}`);
  
  // Get all quotes and check for $0 items
  const quotes = await db
    .select({
      id: savedQuotes.id,
      userId: savedQuotes.userId,
      snapshotJson: savedQuotes.snapshotJson,
      createdAt: savedQuotes.createdAt,
    })
    .from(savedQuotes);
  
  let zeroQuotes = 0;
  const affectedUsers = new Set<string>();
  const zeroQuoteIds: string[] = [];
  
  for (const quote of quotes) {
    const snapshot = typeof quote.snapshotJson === "string" 
      ? JSON.parse(quote.snapshotJson) 
      : quote.snapshotJson;
    
    const items = snapshot?.items || [];
    const hasZeroItem = items.some((item: any) => {
      // Check if purchasable item has $0 price
      if (item.type === "tire" || item.type === "wheel") {
        return item.unitPrice === 0 || item.unitPrice === null || item.unitPrice === undefined;
      }
      // Accessories with required=true can be $0 (bundled)
      if (item.type === "accessory" && !item.required) {
        return item.unitPrice === 0 || item.unitPrice === null || item.unitPrice === undefined;
      }
      return false;
    });
    
    if (hasZeroItem) {
      zeroQuotes++;
      affectedUsers.add(quote.userId);
      zeroQuoteIds.push(quote.id);
    }
  }
  
  console.log(`\n--- $0 Quote Analysis ---`);
  console.log(`Quotes with $0 purchasable items: ${zeroQuotes}`);
  console.log(`Affected users: ${affectedUsers.size}`);
  
  if (zeroQuoteIds.length > 0) {
    console.log(`\nAffected quote IDs:`);
    zeroQuoteIds.forEach(id => console.log(`  - ${id}`));
  }
  
  console.log(`\n--- User IDs ---`);
  affectedUsers.forEach(id => console.log(`  - ${id}`));
  
  process.exit(0);
}

main().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
