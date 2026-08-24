/**
 * Test garage sync API against production database
 */

import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq, desc } from 'drizzle-orm';
import { config } from 'dotenv';

config({ path: '.env.local' });

const { Pool } = pg;

// Minimal schema for testing
import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';

const userGarage = pgTable("user_garage", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  year: text("year").notNull(),
  make: text("make").notNull(),
  model: text("model").notNull(),
  trim: text("trim"),
  modification: text("modification"),
  wheelDia: text("wheel_dia"),
  nickname: text("nickname"),
  addedAt: timestamp("added_at", { withTimezone: true }).notNull(),
  lastActiveAt: timestamp("last_active_at", { withTimezone: true }).notNull(),
});

const savedQuotes = pgTable("saved_quotes", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  name: text("name"),
  snapshotJson: text("snapshot_json").notNull(),
  savedAt: timestamp("saved_at", { withTimezone: true }).notNull(),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
});

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

const db = drizzle(pool);

async function main() {
  try {
    // Test user_garage query
    console.log('=== Testing user_garage query ===');
    const garageVehicles = await db
      .select()
      .from(userGarage)
      .orderBy(desc(userGarage.lastActiveAt))
      .limit(5);
    
    console.log(`Found ${garageVehicles.length} garage vehicles`);
    garageVehicles.forEach(v => {
      console.log(`- ${v.year} ${v.make} ${v.model} (user: ${v.userId.substring(0, 8)}...)`);
    });
    console.log('');

    // Test saved_quotes query
    console.log('=== Testing saved_quotes query ===');
    const quotes = await db
      .select()
      .from(savedQuotes)
      .orderBy(desc(savedQuotes.savedAt))
      .limit(5);
    
    console.log(`Found ${quotes.length} saved quotes`);
    quotes.forEach(q => {
      console.log(`- ${q.id} (user: ${q.userId.substring(0, 8)}...) saved: ${q.savedAt}`);
      console.log(`  name: ${q.name || '(none)'}`);
      console.log(`  archived: ${q.archivedAt || 'no'}`);
    });
    console.log('');

    // Get test user ID
    const testUserResult = await pool.query(`
      SELECT id, email FROM auth_users WHERE email = 'test-isolation@warehousetire.net'
    `);
    
    if (testUserResult.rows.length > 0) {
      const testUserId = testUserResult.rows[0].id;
      console.log(`=== Test user: ${testUserId} ===`);
      
      // Check garage for this user
      const userVehicles = await db
        .select()
        .from(userGarage)
        .where(eq(userGarage.userId, testUserId));
      
      console.log(`Garage vehicles for test user: ${userVehicles.length}`);
      userVehicles.forEach(v => {
        console.log(`- ${v.year} ${v.make} ${v.model}`);
      });

      // Check quotes for this user
      const userQuotes = await db
        .select()
        .from(savedQuotes)
        .where(eq(savedQuotes.userId, testUserId));
      
      console.log(`Saved quotes for test user: ${userQuotes.length}`);
      userQuotes.forEach(q => {
        console.log(`- ${q.id}: ${q.name || '(unnamed)'}`);
      });
    }

    console.log('');
    console.log('✅ Database queries working correctly');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
  }
}

main();
