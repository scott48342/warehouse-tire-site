/**
 * Test the exact garage query
 */

import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { eq, desc } from 'drizzle-orm';
import { config } from 'dotenv';

config({ path: '.env.local' });

const { Pool } = pg;

const authUsers = pgTable("auth_users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
});

const userGarage = pgTable("user_garage", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => authUsers.id, { onDelete: "cascade" }),
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

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

const db = drizzle(pool, { schema: { userGarage, authUsers } });

async function main() {
  try {
    const userId = 'dbfb5182-485b-4a4f-a29b-5759da2519a9'; // test user
    
    console.log('Testing garage query...');
    console.log('User ID:', userId);
    console.log('');

    const vehicles = await db
      .select()
      .from(userGarage)
      .where(eq(userGarage.userId, userId))
      .orderBy(desc(userGarage.lastActiveAt));

    console.log('Query succeeded!');
    console.log('Vehicles:', vehicles.length);
    vehicles.forEach((v, i) => {
      console.log(`  ${i + 1}. ${v.year} ${v.make} ${v.model}`);
    });

    // Also test for Scott's account
    console.log('');
    console.log('Testing for scott@warehousetire.net...');
    const scottVehicles = await db
      .select()
      .from(userGarage)
      .where(eq(userGarage.userId, '7243afa1-a2c9-4c7a-8bd5-1fc6f3a5a4dd'))
      .orderBy(desc(userGarage.lastActiveAt));
    
    console.log('Vehicles:', scottVehicles.length);
    scottVehicles.forEach((v, i) => {
      console.log(`  ${i + 1}. ${v.year} ${v.make} ${v.model}`);
    });

  } catch (error) {
    console.error('Query FAILED:', error);
  } finally {
    await pool.end();
  }
}

main();
