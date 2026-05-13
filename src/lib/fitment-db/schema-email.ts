/**
 * Email Campaign & Cart Analytics Schema
 * 
 * Tables for email marketing automation and cart tracking:
 * - emailCampaigns - Campaign definitions and settings
 * - emailCampaignRecipients - Recipients for each campaign
 * - emailCampaignEvents - Open/click/bounce tracking
 * - emailSubscribers - Subscriber list management
 * - abandonedCarts - Abandoned cart tracking
 * - cartAddEvents - Add-to-cart analytics
 * 
 * @created 2026-05-13 (migrated from inline definitions)
 * @updated 2026-05-13 (fixed to match actual DB - vehicleYear is varchar!)
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
// Email Campaigns (matches DB: 39 columns)
// ============================================================================

export const emailCampaigns = pgTable(
  "email_campaigns",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    
    // Campaign identity
    name: varchar("name", { length: 255 }).notNull(),
    campaignType: varchar("campaign_type", { length: 50 }).notNull(),
    status: varchar("status", { length: 50 }).notNull().default("draft"),
    
    // Content
    subject: varchar("subject", { length: 500 }).notNull(),
    previewText: varchar("preview_text", { length: 255 }),
    fromName: varchar("from_name", { length: 100 }),
    replyTo: varchar("reply_to", { length: 255 }),
    templateKey: varchar("template_key", { length: 100 }),
    contentJson: json("content_json"),
    audienceRulesJson: json("audience_rules_json").notNull(),
    
    // Scheduling
    scheduledFor: timestamp("scheduled_for", { withTimezone: true }),
    sendMode: varchar("send_mode", { length: 50 }).notNull(),
    monthlyRuleJson: json("monthly_rule_json"),
    
    // Options
    includeFreeShippingBanner: boolean("include_free_shipping_banner").notNull().default(false),
    includePriceMatch: boolean("include_price_match").notNull().default(false),
    utmCampaign: varchar("utm_campaign", { length: 255 }),
    
    // Stats
    totalRecipients: integer("total_recipients").notNull().default(0),
    sentCount: integer("sent_count").notNull().default(0),
    deliveredCount: integer("delivered_count").notNull().default(0),
    openCount: integer("open_count").notNull().default(0),
    clickCount: integer("click_count").notNull().default(0),
    bounceCount: integer("bounce_count").notNull().default(0),
    complaintCount: integer("complaint_count").notNull().default(0),
    unsubscribeCount: integer("unsubscribe_count").notNull().default(0),
    
    // Test flag
    isTest: boolean("is_test").notNull().default(false),
    
    // Timestamps
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    
    // Metadata
    createdBy: varchar("created_by", { length: 255 }),
    notes: text("notes"),
    
    // Discount tracking
    discountEnabled: boolean("discount_enabled").notNull().default(false),
    discountPercent: decimal("discount_percent", { precision: 5, scale: 2 }),
    discountExpiryHours: integer("discount_expiry_hours"),
    discountSingleUse: boolean("discount_single_use").notNull().default(false),
    discountIssuedCount: integer("discount_issued_count").notNull().default(0),
    discountRedeemedCount: integer("discount_redeemed_count").notNull().default(0),
    discountRevenue: decimal("discount_revenue", { precision: 10, scale: 2 }).notNull().default("0"),
  },
  (table) => ({
    statusIdx: index("email_campaigns_status_idx").on(table.status),
    isTestIdx: index("email_campaigns_is_test_idx").on(table.isTest),
  })
);

export type EmailCampaign = typeof emailCampaigns.$inferSelect;
export type NewEmailCampaign = typeof emailCampaigns.$inferInsert;

// ============================================================================
// Email Campaign Recipients (matches DB: 15 columns)
// ============================================================================

export const emailCampaignRecipients = pgTable(
  "email_campaign_recipients",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    campaignId: uuid("campaign_id").notNull().references(() => emailCampaigns.id),
    subscriberId: uuid("subscriber_id"),
    email: varchar("email", { length: 255 }).notNull(),
    status: varchar("status", { length: 50 }).notNull().default("pending"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    openedAt: timestamp("opened_at", { withTimezone: true }),
    clickedAt: timestamp("clicked_at", { withTimezone: true }),
    bouncedAt: timestamp("bounced_at", { withTimezone: true }),
    complainedAt: timestamp("complained_at", { withTimezone: true }),
    unsubscribedAt: timestamp("unsubscribed_at", { withTimezone: true }),
    messageId: varchar("message_id", { length: 255 }),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    campaignIdx: index("email_campaign_recipients_campaign_idx").on(table.campaignId),
    emailIdx: index("email_campaign_recipients_email_idx").on(table.email),
  })
);

export type EmailCampaignRecipient = typeof emailCampaignRecipients.$inferSelect;
export type NewEmailCampaignRecipient = typeof emailCampaignRecipients.$inferInsert;

// ============================================================================
// Email Campaign Events (matches DB: 11 columns)
// ============================================================================

export const emailCampaignEvents = pgTable(
  "email_campaign_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    campaignId: uuid("campaign_id").notNull().references(() => emailCampaigns.id),
    recipientId: uuid("recipient_id"),
    eventType: varchar("event_type", { length: 50 }).notNull(),
    email: varchar("email", { length: 255 }),
    linkUrl: text("link_url"),
    userAgent: text("user_agent"),
    ipAddress: varchar("ip_address", { length: 45 }),
    providerEventId: varchar("provider_event_id", { length: 255 }),
    rawData: json("raw_data"),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    campaignIdx: index("email_campaign_events_campaign_idx").on(table.campaignId),
    eventTypeIdx: index("email_campaign_events_type_idx").on(table.eventType),
  })
);

export type EmailCampaignEvent = typeof emailCampaignEvents.$inferSelect;
export type NewEmailCampaignEvent = typeof emailCampaignEvents.$inferInsert;

// ============================================================================
// Email Subscribers (matches DB: 24 columns)
// NOTE: vehicle_year is VARCHAR in DB, not integer!
// ============================================================================

export const emailSubscribers = pgTable(
  "email_subscribers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: varchar("email", { length: 255 }).notNull().unique(),
    source: varchar("source", { length: 100 }).notNull(),
    vehicleYear: varchar("vehicle_year", { length: 10 }), // VARCHAR in DB!
    vehicleMake: varchar("vehicle_make", { length: 100 }),
    vehicleModel: varchar("vehicle_model", { length: 200 }),
    vehicleTrim: varchar("vehicle_trim", { length: 200 }),
    cartId: varchar("cart_id", { length: 100 }),
    marketingConsent: boolean("marketing_consent").notNull().default(true),
    unsubscribed: boolean("unsubscribed").notNull().default(false),
    unsubscribedAt: timestamp("unsubscribed_at", { withTimezone: false }),
    createdAt: timestamp("created_at", { withTimezone: false }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: false }).notNull().defaultNow(),
    ipAddress: varchar("ip_address", { length: 45 }),
    userAgent: text("user_agent"),
    isTest: boolean("is_test").notNull().default(false),
    testReason: varchar("test_reason", { length: 100 }),
    unsubscribeToken: varchar("unsubscribe_token", { length: 255 }),
    suppressionReason: varchar("suppression_reason", { length: 100 }),
    suppressedAt: timestamp("suppressed_at", { withTimezone: true }),
    lastActiveAt: timestamp("last_active_at", { withTimezone: true }),
    lastCartAt: timestamp("last_cart_at", { withTimezone: true }),
    lastOrderAt: timestamp("last_order_at", { withTimezone: true }),
    lastCampaignSentAt: timestamp("last_campaign_sent_at", { withTimezone: true }),
  },
  (table) => ({
    emailIdx: index("email_subscribers_email_idx").on(table.email),
    isTestIdx: index("email_subscribers_is_test_idx").on(table.isTest),
  })
);

export type EmailSubscriber = typeof emailSubscribers.$inferSelect;
export type NewEmailSubscriber = typeof emailSubscribers.$inferInsert;

// ============================================================================
// Abandoned Carts (matches DB: 39 columns)
// NOTE: vehicle_year is VARCHAR in DB, not integer!
// ============================================================================

export const abandonedCarts = pgTable(
  "abandoned_carts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    cartId: varchar("cart_id", { length: 100 }).notNull().unique(),
    sessionId: varchar("session_id", { length: 100 }),
    customerFirstName: varchar("customer_first_name", { length: 100 }),
    customerLastName: varchar("customer_last_name", { length: 100 }),
    customerEmail: varchar("customer_email", { length: 255 }),
    customerPhone: varchar("customer_phone", { length: 20 }),
    vehicleYear: varchar("vehicle_year", { length: 10 }), // VARCHAR in DB!
    vehicleMake: varchar("vehicle_make", { length: 100 }),
    vehicleModel: varchar("vehicle_model", { length: 200 }),
    vehicleTrim: varchar("vehicle_trim", { length: 200 }),
    items: json("items").notNull(),
    itemCount: integer("item_count").notNull().default(0),
    subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull(),
    estimatedTotal: decimal("estimated_total", { precision: 10, scale: 2 }).notNull(),
    status: varchar("status", { length: 50 }).notNull().default("active"),
    recoveredOrderId: varchar("recovered_order_id", { length: 100 }),
    recoveredAt: timestamp("recovered_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    lastActivityAt: timestamp("last_activity_at", { withTimezone: true }).notNull().defaultNow(),
    abandonedAt: timestamp("abandoned_at", { withTimezone: true }),
    source: varchar("source", { length: 100 }),
    userAgent: text("user_agent"),
    ipAddress: varchar("ip_address", { length: 45 }),
    firstEmailSentAt: timestamp("first_email_sent_at", { withTimezone: true }),
    secondEmailSentAt: timestamp("second_email_sent_at", { withTimezone: true }),
    emailSentCount: integer("email_sent_count").notNull().default(0),
    recoveredAfterEmail: boolean("recovered_after_email"),
    unsubscribed: boolean("unsubscribed"),
    thirdEmailSentAt: timestamp("third_email_sent_at", { withTimezone: false }),
    lastEmailStatus: varchar("last_email_status", { length: 50 }),
    isTest: boolean("is_test").notNull().default(false),
    testReason: varchar("test_reason", { length: 100 }),
    emailOpenedAt: timestamp("email_opened_at", { withTimezone: false }),
    emailClickedAt: timestamp("email_clicked_at", { withTimezone: false }),
    emailOpenCount: integer("email_open_count").notNull().default(0),
    emailClickCount: integer("email_click_count").notNull().default(0),
    hostname: varchar("hostname", { length: 100 }),
  },
  (table) => ({
    cartIdIdx: index("abandoned_carts_cart_id_idx").on(table.cartId),
    statusIdx: index("abandoned_carts_status_idx").on(table.status),
    isTestIdx: index("abandoned_carts_is_test_idx").on(table.isTest),
  })
);

export type AbandonedCart = typeof abandonedCarts.$inferSelect;
export type NewAbandonedCart = typeof abandonedCarts.$inferInsert;

// ============================================================================
// Cart Add Events (matches DB: 26 columns)
// NOTE: vehicle_year is VARCHAR in DB, not integer!
// NOTE: sku, brand, product_name, product_type, cart_id are NOT NULL
// ============================================================================

export const cartAddEvents = pgTable(
  "cart_add_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    productType: varchar("product_type", { length: 50 }).notNull(),
    sku: varchar("sku", { length: 100 }).notNull(),
    rearSku: varchar("rear_sku", { length: 100 }),
    productName: varchar("product_name", { length: 300 }).notNull(),
    brand: varchar("brand", { length: 100 }).notNull(),
    priceAtTime: decimal("price_at_time", { precision: 10, scale: 2 }).notNull(),
    quantity: integer("quantity").notNull().default(1),
    size: varchar("size", { length: 50 }),
    specs: json("specs"),
    cartId: varchar("cart_id", { length: 100 }).notNull(),
    sessionId: varchar("session_id", { length: 100 }),
    vehicleYear: varchar("vehicle_year", { length: 10 }), // VARCHAR in DB!
    vehicleMake: varchar("vehicle_make", { length: 100 }),
    vehicleModel: varchar("vehicle_model", { length: 200 }),
    vehicleTrim: varchar("vehicle_trim", { length: 200 }),
    source: varchar("source", { length: 100 }),
    referrer: text("referrer"),
    purchased: boolean("purchased").notNull().default(false),
    orderId: varchar("order_id", { length: 100 }),
    purchasedAt: timestamp("purchased_at", { withTimezone: true }),
    isTest: boolean("is_test").notNull().default(false),
    testReason: varchar("test_reason", { length: 100 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    ipAddress: varchar("ip_address", { length: 45 }),
    userAgent: text("user_agent"),
  },
  (table) => ({
    skuIdx: index("cart_add_events_sku_idx").on(table.sku),
    cartIdIdx: index("cart_add_events_cart_id_idx").on(table.cartId),
    isTestIdx: index("cart_add_events_is_test_idx").on(table.isTest),
  })
);

export type CartAddEvent = typeof cartAddEvents.$inferSelect;
export type NewCartAddEvent = typeof cartAddEvents.$inferInsert;
