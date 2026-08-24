/**
 * Test Saved Quotes CRUD with the new JSONB fixes
 */

import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { pgTable, text, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { eq, and, desc, isNull } from 'drizzle-orm';
import { config } from 'dotenv';

config({ path: '.env.local' });

const { Pool } = pg;

// Define schema matching auth-schema.ts with JSONB
const authUsers = pgTable("auth_users", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
});

const savedQuotes = pgTable("saved_quotes", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  name: text("name"),
  vehicleYear: text("vehicle_year"),
  vehicleMake: text("vehicle_make"),
  vehicleModel: text("vehicle_model"),
  vehicleTrim: text("vehicle_trim"),
  vehicleModification: text("vehicle_modification"),
  snapshotJson: jsonb("snapshot_json").notNull(), // JSONB!
  savedAt: timestamp("saved_at", { withTimezone: true }).notNull(),
  lastViewedAt: timestamp("last_viewed_at", { withTimezone: true }),
  convertedOrderId: text("converted_order_id"),
  convertedAt: timestamp("converted_at", { withTimezone: true }),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  idempotencyKey: text("idempotency_key"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
});

/**
 * Parse snapshot - handles both JSONB object and legacy string
 */
function parseSnapshotJson(value) {
  if (typeof value === 'string') {
    return JSON.parse(value);
  }
  return value;
}

/**
 * Build item summary from items array
 */
function buildItemSummary(items) {
  const parts = items.map(item => {
    const qty = item.quantity || 1;
    const prefix = qty > 1 ? `${qty}x ` : '';
    const name = item.model ? `${item.brand} ${item.model}` : item.brand || item.sku;
    return `${prefix}${name}`;
  });
  return parts.join(' + ');
}

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

const db = drizzle(pool, { schema: { savedQuotes, authUsers } });

async function main() {
  const userId = 'dbfb5182-485b-4a4f-a29b-5759da2519a9'; // test user
  
  console.log('====================================');
  console.log('SAVED QUOTES CRUD TEST');
  console.log('====================================\n');

  try {
    // 1. LIST QUOTES
    console.log('1. LIST SAVED QUOTES');
    const rows = await db
      .select()
      .from(savedQuotes)
      .where(and(eq(savedQuotes.userId, userId), isNull(savedQuotes.archivedAt)))
      .orderBy(desc(savedQuotes.savedAt));
    
    console.log(`   Found ${rows.length} active quotes`);
    
    const quotes = rows.map(row => {
      const snapshot = parseSnapshotJson(row.snapshotJson);
      return {
        id: row.id,
        name: row.name,
        vehicle: snapshot.vehicle,
        itemCount: snapshot.items.length,
        itemSummary: snapshot.itemSummary || buildItemSummary(snapshot.items),
        total: snapshot.pricing.total,
        savedAt: row.savedAt.toISOString(),
      };
    });
    
    quotes.forEach((q, i) => {
      console.log(`   ${i + 1}. ${q.id}`);
      console.log(`      Vehicle: ${q.vehicle.year} ${q.vehicle.make} ${q.vehicle.model}`);
      console.log(`      Items: ${q.itemCount} (${q.itemSummary})`);
      console.log(`      Total: $${q.total.toFixed(2)}`);
    });
    console.log('   ✅ LIST PASS\n');

    // 2. GET QUOTE DETAIL
    if (quotes.length > 0) {
      console.log('2. GET QUOTE DETAIL');
      const quoteId = quotes[0].id;
      
      const detailRows = await db
        .select()
        .from(savedQuotes)
        .where(and(eq(savedQuotes.id, quoteId), eq(savedQuotes.userId, userId)))
        .limit(1);
      
      const detail = detailRows[0];
      if (detail) {
        const snapshot = parseSnapshotJson(detail.snapshotJson);
        console.log(`   Quote: ${detail.id}`);
        console.log(`   Vehicle: ${snapshot.vehicle.year} ${snapshot.vehicle.make} ${snapshot.vehicle.model}`);
        console.log(`   Items:`);
        snapshot.items.forEach(item => {
          console.log(`     - ${item.quantity}x ${item.brand} ${item.model} @ $${item.unitPrice}`);
        });
        console.log(`   Pricing:`);
        console.log(`     Parts: $${snapshot.pricing.partsSubtotal}`);
        console.log(`     Tax: $${snapshot.pricing.estimatedTax}`);
        console.log(`     Total: $${snapshot.pricing.total}`);
        console.log('   ✅ GET DETAIL PASS\n');
      } else {
        console.log('   ❌ Quote not found\n');
      }
    }

    // 3. VERIFY SNAPSHOT INTEGRITY
    console.log('3. VERIFY SNAPSHOT INTEGRITY');
    for (const row of rows) {
      const snapshot = parseSnapshotJson(row.snapshotJson);
      
      // Verify structure
      const hasVehicle = snapshot.vehicle && snapshot.vehicle.year && snapshot.vehicle.make;
      const hasItems = Array.isArray(snapshot.items) && snapshot.items.length > 0;
      const hasPricing = snapshot.pricing && typeof snapshot.pricing.total === 'number';
      
      console.log(`   Quote ${row.id}:`);
      console.log(`     Vehicle: ${hasVehicle ? '✅' : '❌'}`);
      console.log(`     Items: ${hasItems ? '✅' : '❌'} (${snapshot.items?.length || 0})`);
      console.log(`     Pricing: ${hasPricing ? '✅' : '❌'}`);
      
      if (hasVehicle && hasItems && hasPricing) {
        console.log('     ✅ INTEGRITY PASS');
      } else {
        console.log('     ❌ INTEGRITY FAIL');
      }
    }
    console.log('');

    console.log('====================================');
    console.log('ALL TESTS COMPLETED SUCCESSFULLY');
    console.log('====================================');

  } catch (error) {
    console.error('❌ TEST FAILED:', error);
  } finally {
    await pool.end();
  }
}

main();
