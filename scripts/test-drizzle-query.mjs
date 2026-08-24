/**
 * Test the exact Drizzle query used by the API
 */

import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { pgTable, text, timestamp, index } from 'drizzle-orm/pg-core';
import { eq, desc, isNull, and } from 'drizzle-orm';
import { config } from 'dotenv';

config({ path: '.env.local' });

const { Pool } = pg;

// Exactly match the auth-schema definition
const authUsers = pgTable("auth_users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  emailVerified: timestamp("email_verified", { withTimezone: true }),
  name: text("name"),
  image: text("image"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

const savedQuotes = pgTable(
  "saved_quotes",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    name: text("name"),
    vehicleYear: text("vehicle_year"),
    vehicleMake: text("vehicle_make"),
    vehicleModel: text("vehicle_model"),
    vehicleTrim: text("vehicle_trim"),
    vehicleModification: text("vehicle_modification"),
    snapshotJson: text("snapshot_json").notNull(), // Schema says text, DB is jsonb
    savedAt: timestamp("saved_at", { withTimezone: true }).notNull().defaultNow(),
    lastViewedAt: timestamp("last_viewed_at", { withTimezone: true }),
    convertedOrderId: text("converted_order_id"),
    convertedAt: timestamp("converted_at", { withTimezone: true }),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    idempotencyKey: text("idempotency_key"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  }
);

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

const db = drizzle(pool, { schema: { savedQuotes, authUsers } });

async function main() {
  try {
    const userId = 'dbfb5182-485b-4a4f-a29b-5759da2519a9'; // test user
    
    console.log('Testing listSavedQuotes query...');
    console.log('User ID:', userId);
    console.log('');

    // Exactly replicate the listSavedQuotes function
    const whereClause = and(eq(savedQuotes.userId, userId), isNull(savedQuotes.archivedAt));
    
    const rows = await db
      .select()
      .from(savedQuotes)
      .where(whereClause)
      .orderBy(desc(savedQuotes.savedAt));

    console.log('Query succeeded!');
    console.log('Rows returned:', rows.length);
    console.log('');

    rows.forEach((row, i) => {
      console.log(`Row ${i + 1}:`);
      console.log(`  id: ${row.id}`);
      console.log(`  name: ${row.name}`);
      console.log(`  snapshotJson type: ${typeof row.snapshotJson}`);
      console.log(`  snapshotJson preview: ${String(row.snapshotJson).substring(0, 100)}...`);
      
      // Try to parse if it's a string
      if (typeof row.snapshotJson === 'string') {
        try {
          const parsed = JSON.parse(row.snapshotJson);
          console.log(`  ✅ Parses as JSON: ${parsed.items?.length || 0} items`);
        } catch (e) {
          console.log(`  ❌ Parse error: ${e.message}`);
        }
      } else if (typeof row.snapshotJson === 'object') {
        console.log(`  ✅ Already an object: ${row.snapshotJson?.items?.length || 0} items`);
      }
    });

  } catch (error) {
    console.error('Query FAILED:', error);
  } finally {
    await pool.end();
  }
}

main();
