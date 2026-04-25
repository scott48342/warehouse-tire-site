/**
 * First Order Discount Schema
 * 
 * Single-use 10% discount codes for first-time visitors.
 * 
 * @created 2026-04-25
 */

import { pgTable, varchar, timestamp, boolean, decimal, uuid, index } from "drizzle-orm/pg-core";

// ============================================================================
// First Order Discounts Table
// ============================================================================

export const firstOrderDiscounts = pgTable(
  "first_order_discounts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    
    // Unique discount code (e.g., "WTD-FIRST-A1B2C3")
    code: varchar("code", { length: 32 }).notNull().unique(),
    
    // Email tied to this discount
    email: varchar("email", { length: 255 }).notNull(),
    
    // Discount percentage (10 = 10%)
    discountPercent: decimal("discount_percent", { precision: 5, scale: 2 }).notNull().default("10.00"),
    
    // Timestamps
    issuedAt: timestamp("issued_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    
    // Redemption tracking
    redeemed: boolean("redeemed").notNull().default(false),
    redeemedAt: timestamp("redeemed_at", { withTimezone: true }),
    redeemedOrderId: varchar("redeemed_order_id", { length: 100 }),
    redeemedAmount: decimal("redeemed_amount", { precision: 10, scale: 2 }),
    
    // Email tracking
    emailSentAt: timestamp("email_sent_at", { withTimezone: true }),
    
    // Metadata
    source: varchar("source", { length: 50 }).default("popup"), // popup, manual, api
    sessionId: varchar("session_id", { length: 100 }),
    ipAddress: varchar("ip_address", { length: 45 }),
    userAgent: varchar("user_agent", { length: 500 }),
  },
  (table) => ({
    emailIdx: index("first_order_discounts_email_idx").on(table.email),
    codeIdx: index("first_order_discounts_code_idx").on(table.code),
    expiresIdx: index("first_order_discounts_expires_idx").on(table.expiresAt),
    redeemedIdx: index("first_order_discounts_redeemed_idx").on(table.redeemed),
  })
);

// ============================================================================
// Types
// ============================================================================

export type FirstOrderDiscount = typeof firstOrderDiscounts.$inferSelect;
export type NewFirstOrderDiscount = typeof firstOrderDiscounts.$inferInsert;
