/**
 * Lead Capture Schema
 * 
 * Tables for unified lead tracking across all properties:
 * - leads - Master lead table (email + vehicle + source)
 * - jake_builds - Jake Garage build/conversation tracking
 * 
 * @created 2026-07-18
 */

import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  integer,
  timestamp,
  json,
  index,
  decimal,
} from "drizzle-orm/pg-core";

// ============================================================================
// Leads Table - Unified lead capture across all properties
// ============================================================================

export const leads = pgTable(
  "leads",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    
    // Contact info
    email: varchar("email", { length: 255 }).notNull(),
    phone: varchar("phone", { length: 20 }),
    firstName: varchar("first_name", { length: 100 }),
    lastName: varchar("last_name", { length: 100 }),
    
    // Vehicle info
    vehicleYear: varchar("vehicle_year", { length: 10 }),
    vehicleMake: varchar("vehicle_make", { length: 100 }),
    vehicleModel: varchar("vehicle_model", { length: 200 }),
    vehicleTrim: varchar("vehicle_trim", { length: 200 }),
    
    // Source tracking
    sourceSite: varchar("source_site", { length: 50 }).notNull(), // national, local, garage
    sourceChannel: varchar("source_channel", { length: 50 }).notNull(), // cart_save, checkout, build_save, jake_package, exit_intent
    sessionId: varchar("session_id", { length: 100 }),
    
    // Cart/Build data
    cartId: varchar("cart_id", { length: 100 }),
    jakeBuildId: uuid("jake_build_id"),
    cartValue: decimal("cart_value", { precision: 10, scale: 2 }),
    
    // Shopping context
    tireSize: varchar("tire_size", { length: 50 }),
    wheelSize: varchar("wheel_size", { length: 50 }),
    liftLevel: varchar("lift_level", { length: 50 }),
    buildProfile: varchar("build_profile", { length: 100 }), // stock, leveled, lifted, etc.
    
    // Cart snapshot (JSON)
    cartSnapshot: json("cart_snapshot"),
    checkoutUrl: text("checkout_url"),
    
    // Consent
    marketingConsent: boolean("marketing_consent").notNull().default(true),
    
    // Status
    status: varchar("status", { length: 50 }).notNull().default("new"), // new, contacted, converted, expired
    convertedOrderId: varchar("converted_order_id", { length: 100 }),
    convertedAt: timestamp("converted_at", { withTimezone: true }),
    
    // Recovery emails
    firstEmailAt: timestamp("first_email_at", { withTimezone: true }),
    secondEmailAt: timestamp("second_email_at", { withTimezone: true }),
    thirdEmailAt: timestamp("third_email_at", { withTimezone: true }),
    emailsSent: integer("emails_sent").notNull().default(0),
    lastEmailOpenedAt: timestamp("last_email_opened_at", { withTimezone: true }),
    lastEmailClickedAt: timestamp("last_email_clicked_at", { withTimezone: true }),
    
    // Tracking
    userAgent: text("user_agent"),
    ipAddress: varchar("ip_address", { length: 45 }),
    referrer: text("referrer"),
    utmSource: varchar("utm_source", { length: 100 }),
    utmMedium: varchar("utm_medium", { length: 100 }),
    utmCampaign: varchar("utm_campaign", { length: 100 }),
    
    // Test data
    isTest: boolean("is_test").notNull().default(false),
    testReason: varchar("test_reason", { length: 100 }),
    
    // Timestamps
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    lastActivityAt: timestamp("last_activity_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    emailIdx: index("leads_email_idx").on(table.email),
    sourceSiteIdx: index("leads_source_site_idx").on(table.sourceSite),
    sourceChannelIdx: index("leads_source_channel_idx").on(table.sourceChannel),
    statusIdx: index("leads_status_idx").on(table.status),
    cartIdIdx: index("leads_cart_id_idx").on(table.cartId),
    isTestIdx: index("leads_is_test_idx").on(table.isTest),
    createdAtIdx: index("leads_created_at_idx").on(table.createdAt),
  })
);

export type Lead = typeof leads.$inferSelect;
export type NewLead = typeof leads.$inferInsert;

// ============================================================================
// Jake Builds - Track Jake Garage conversations and builds
// ============================================================================

export const jakeBuilds = pgTable(
  "jake_builds",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    
    // Session identity
    conversationId: varchar("conversation_id", { length: 100 }).notNull(),
    sessionId: varchar("session_id", { length: 100 }),
    
    // Vehicle info (from conversation)
    vehicleYear: varchar("vehicle_year", { length: 10 }),
    vehicleMake: varchar("vehicle_make", { length: 100 }),
    vehicleModel: varchar("vehicle_model", { length: 200 }),
    vehicleTrim: varchar("vehicle_trim", { length: 200 }),
    
    // Build details
    buildStyle: varchar("build_style", { length: 50 }), // stock, leveled, lifted, performance
    tireSize: varchar("tire_size", { length: 50 }),
    wheelDiameter: integer("wheel_diameter"),
    wheelWidth: decimal("wheel_width", { precision: 4, scale: 1 }),
    liftHeight: varchar("lift_height", { length: 50 }),
    
    // Recommendations shown
    recommendedWheels: json("recommended_wheels"), // Array of wheel SKUs/names
    recommendedTires: json("recommended_tires"), // Array of tire SKUs/names
    recommendedPackageValue: decimal("recommended_package_value", { precision: 10, scale: 2 }),
    
    // Conversation summary
    messageCount: integer("message_count").notNull().default(0),
    conversationSummary: text("conversation_summary"),
    lastUserMessage: text("last_user_message"),
    toolsUsed: json("tools_used"), // Array of tool names
    
    // Lead linkage
    leadId: uuid("lead_id"),
    email: varchar("email", { length: 255 }),
    
    // Status
    status: varchar("status", { length: 50 }).notNull().default("active"), // active, cart_created, abandoned, converted
    cartId: varchar("cart_id", { length: 100 }), // If they added to cart
    orderId: varchar("order_id", { length: 100 }), // If they purchased
    
    // Source site
    sourceSite: varchar("source_site", { length: 50 }).notNull().default("garage"), // national, local (from /garage route)
    
    // Test data
    isTest: boolean("is_test").notNull().default(false),
    
    // Timestamps
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    lastActivityAt: timestamp("last_activity_at", { withTimezone: true }).notNull().defaultNow(),
    abandonedAt: timestamp("abandoned_at", { withTimezone: true }),
  },
  (table) => ({
    conversationIdIdx: index("jake_builds_conversation_id_idx").on(table.conversationId),
    emailIdx: index("jake_builds_email_idx").on(table.email),
    leadIdIdx: index("jake_builds_lead_id_idx").on(table.leadId),
    statusIdx: index("jake_builds_status_idx").on(table.status),
    sourceSiteIdx: index("jake_builds_source_site_idx").on(table.sourceSite),
    isTestIdx: index("jake_builds_is_test_idx").on(table.isTest),
    createdAtIdx: index("jake_builds_created_at_idx").on(table.createdAt),
  })
);

export type JakeBuild = typeof jakeBuilds.$inferSelect;
export type NewJakeBuild = typeof jakeBuilds.$inferInsert;

// ============================================================================
// Lead Source Stats (for analytics)
// ============================================================================

export interface LeadSourceStats {
  sourceSite: string;
  sourceChannel: string;
  totalLeads: number;
  convertedLeads: number;
  conversionRate: number;
  totalValue: number;
  averageValue: number;
}

export interface LeadFunnelStats {
  newLeads: number;
  contactedLeads: number;
  convertedLeads: number;
  expiredLeads: number;
  emailsSent: number;
  emailsOpened: number;
  emailsClicked: number;
  openRate: number;
  clickRate: number;
  conversionRate: number;
}
