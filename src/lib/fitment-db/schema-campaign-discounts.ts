/**
 * Campaign Discounts Schema
 * 
 * Unique discount codes generated per campaign recipient.
 * 
 * @created 2026-04-25
 */

import { pgTable, varchar, timestamp, boolean, decimal, uuid, index } from "drizzle-orm/pg-core";
import { emailCampaigns } from "./schema";
import { emailCampaignRecipients } from "./schema";

// ============================================================================
// Campaign Discounts Table
// ============================================================================

export const campaignDiscounts = pgTable(
  "campaign_discounts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    
    // Links
    campaignId: uuid("campaign_id").notNull().references(() => emailCampaigns.id, { onDelete: "cascade" }),
    recipientId: uuid("recipient_id").references(() => emailCampaignRecipients.id, { onDelete: "set null" }),
    
    // Code details
    code: varchar("code", { length: 32 }).notNull().unique(),
    email: varchar("email", { length: 255 }).notNull(),
    
    // Discount config
    discountPercent: decimal("discount_percent", { precision: 5, scale: 2 }).notNull().default("10.00"),
    
    // Timestamps
    issuedAt: timestamp("issued_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    
    // Redemption
    redeemed: boolean("redeemed").notNull().default(false),
    redeemedAt: timestamp("redeemed_at", { withTimezone: true }),
    redeemedOrderId: varchar("redeemed_order_id", { length: 100 }),
    redeemedAmount: decimal("redeemed_amount", { precision: 10, scale: 2 }),
    
    // Click tracking
    clicked: boolean("clicked").notNull().default(false),
    clickedAt: timestamp("clicked_at", { withTimezone: true }),
  },
  (table) => ({
    campaignIdx: index("campaign_discounts_campaign_idx").on(table.campaignId),
    emailIdx: index("campaign_discounts_email_idx").on(table.email),
    codeIdx: index("campaign_discounts_code_idx").on(table.code),
    expiresIdx: index("campaign_discounts_expires_idx").on(table.expiresAt),
  })
);

// ============================================================================
// Types
// ============================================================================

export type CampaignDiscount = typeof campaignDiscounts.$inferSelect;
export type NewCampaignDiscount = typeof campaignDiscounts.$inferInsert;
