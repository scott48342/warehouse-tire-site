/**
 * Email Campaign Schema
 * 
 * Tables for email marketing automation:
 * - emailCampaigns - Campaign definitions and settings
 * - emailCampaignRecipients - Recipients for each campaign
 * - emailCampaignEvents - Open/click/bounce tracking
 * - emailSubscribers - Subscriber list management
 * 
 * @created 2026-05-13 (migrated from inline definitions)
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
// Email Campaigns
// ============================================================================

export const emailCampaigns = pgTable(
  "email_campaigns",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    
    // Campaign identity
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    campaignType: varchar("campaign_type", { length: 50 }), // marketing, transactional, etc.
    
    // Content
    subject: varchar("subject", { length: 500 }),
    previewText: varchar("preview_text", { length: 255 }),
    fromName: varchar("from_name", { length: 100 }),
    fromEmail: varchar("from_email", { length: 255 }),
    replyTo: varchar("reply_to", { length: 255 }),
    templateId: varchar("template_id", { length: 100 }),
    content: json("content"), // CampaignContent JSON
    contentJson: json("content_json"), // CampaignContent JSON (alias)
    includeFreeShippingBanner: boolean("include_free_shipping_banner").default(false),
    includePriceMatch: boolean("include_price_match").default(false),
    utmCampaign: varchar("utm_campaign", { length: 255 }),
    notes: text("notes"),
    
    // Audience targeting
    audienceRules: json("audience_rules"), // AudienceRules JSON
    audienceRulesJson: json("audience_rules_json"), // AudienceRules JSON (alias for code compatibility)
    audienceCount: integer("audience_count").default(0),
    
    // Scheduling
    status: varchar("status", { length: 50 }).notNull().default("draft"),
    sendMode: varchar("send_mode", { length: 50 }), // one_time, recurring_monthly
    monthlyRuleJson: json("monthly_rule_json"), // Recurring campaign rules
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    
    // Stats
    sentCount: integer("sent_count").default(0),
    deliveredCount: integer("delivered_count").default(0),
    openCount: integer("open_count").default(0),
    clickCount: integer("click_count").default(0),
    bounceCount: integer("bounce_count").default(0),
    unsubscribeCount: integer("unsubscribe_count").default(0),
    spamCount: integer("spam_count").default(0),
    
    // Metadata
    createdBy: varchar("created_by", { length: 255 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    
    // Test data exclusion
    isTest: boolean("is_test").notNull().default(false),
    
    // Site context (national vs local)
    hostname: varchar("hostname", { length: 100 }),
  },
  (table) => ({
    statusIdx: index("email_campaigns_status_idx").on(table.status),
    scheduledIdx: index("email_campaigns_scheduled_idx").on(table.scheduledAt),
    createdIdx: index("email_campaigns_created_idx").on(table.createdAt),
    isTestIdx: index("email_campaigns_is_test_idx").on(table.isTest),
  })
);

export type EmailCampaign = typeof emailCampaigns.$inferSelect;
export type NewEmailCampaign = typeof emailCampaigns.$inferInsert;

// ============================================================================
// Email Campaign Recipients
// ============================================================================

export const emailCampaignRecipients = pgTable(
  "email_campaign_recipients",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    
    // Links
    campaignId: uuid("campaign_id").notNull().references(() => emailCampaigns.id, { onDelete: "cascade" }),
    subscriberId: uuid("subscriber_id").references(() => emailSubscribers.id, { onDelete: "set null" }),
    
    // Recipient info (denormalized for speed)
    email: varchar("email", { length: 255 }).notNull(),
    firstName: varchar("first_name", { length: 100 }),
    lastName: varchar("last_name", { length: 100 }),
    
    // Delivery status
    status: varchar("status", { length: 50 }).notNull().default("pending"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    bouncedAt: timestamp("bounced_at", { withTimezone: true }),
    bounceReason: text("bounce_reason"),
    
    // Engagement
    openedAt: timestamp("opened_at", { withTimezone: true }),
    openCount: integer("open_count").default(0),
    clickedAt: timestamp("clicked_at", { withTimezone: true }),
    clickCount: integer("click_count").default(0),
    unsubscribedAt: timestamp("unsubscribed_at", { withTimezone: true }),
    
    // External message tracking
    messageId: varchar("message_id", { length: 255 }),
    
    // External reference (e.g., Resend message ID)
    externalId: varchar("external_id", { length: 255 }),
    
    // Timestamps
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    campaignIdx: index("email_campaign_recipients_campaign_idx").on(table.campaignId),
    emailIdx: index("email_campaign_recipients_email_idx").on(table.email),
    statusIdx: index("email_campaign_recipients_status_idx").on(table.status),
  })
);

export type EmailCampaignRecipient = typeof emailCampaignRecipients.$inferSelect;
export type NewEmailCampaignRecipient = typeof emailCampaignRecipients.$inferInsert;

// ============================================================================
// Email Campaign Events (Webhook tracking)
// ============================================================================

export const emailCampaignEvents = pgTable(
  "email_campaign_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    
    // Links
    campaignId: uuid("campaign_id").notNull().references(() => emailCampaigns.id, { onDelete: "cascade" }),
    recipientId: uuid("recipient_id").references(() => emailCampaignRecipients.id, { onDelete: "set null" }),
    
    // Event info
    eventType: varchar("event_type", { length: 50 }).notNull(), // sent, delivered, opened, clicked, bounced, etc.
    email: varchar("email", { length: 255 }).notNull(),
    
    // Event details
    metadata: json("metadata"), // Raw webhook payload
    rawData: json("raw_data"), // Raw webhook payload (alias)
    linkUrl: varchar("link_url", { length: 1000 }), // For click events
    userAgent: text("user_agent"),
    ipAddress: varchar("ip_address", { length: 45 }),
    
    // External reference
    externalId: varchar("external_id", { length: 255 }),
    providerEventId: varchar("provider_event_id", { length: 255 }),
    
    // Timestamp
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    campaignIdx: index("email_campaign_events_campaign_idx").on(table.campaignId),
    eventTypeIdx: index("email_campaign_events_type_idx").on(table.eventType),
    occurredIdx: index("email_campaign_events_occurred_idx").on(table.occurredAt),
    providerEventIdx: index("email_campaign_events_provider_event_idx").on(table.providerEventId),
  })
);

export type EmailCampaignEvent = typeof emailCampaignEvents.$inferSelect;
export type NewEmailCampaignEvent = typeof emailCampaignEvents.$inferInsert;

// ============================================================================
// Email Subscribers
// ============================================================================

export const emailSubscribers = pgTable(
  "email_subscribers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    
    // Contact info
    email: varchar("email", { length: 255 }).notNull().unique(),
    firstName: varchar("first_name", { length: 100 }),
    lastName: varchar("last_name", { length: 100 }),
    phone: varchar("phone", { length: 20 }),
    
    // Subscription status
    status: varchar("status", { length: 50 }).notNull().default("active"), // active, unsubscribed, bounced, spam
    source: varchar("source", { length: 100 }), // signup, checkout, import, etc.
    
    // Preferences
    preferences: json("preferences"), // Marketing prefs, categories, etc.
    
    // Engagement tracking
    lastEmailAt: timestamp("last_email_at", { withTimezone: true }),
    lastCampaignSentAt: timestamp("last_campaign_sent_at", { withTimezone: true }),
    lastOpenAt: timestamp("last_open_at", { withTimezone: true }),
    lastClickAt: timestamp("last_click_at", { withTimezone: true }),
    totalEmails: integer("total_emails").default(0),
    totalOpens: integer("total_opens").default(0),
    totalClicks: integer("total_clicks").default(0),
    
    // Vehicle context (from abandoned cart or signup)
    vehicleYear: integer("vehicle_year"),
    vehicleMake: varchar("vehicle_make", { length: 100 }),
    vehicleModel: varchar("vehicle_model", { length: 200 }),
    vehicleTrim: varchar("vehicle_trim", { length: 200 }),
    
    // Unsubscribe tracking
    unsubscribed: boolean("unsubscribed").default(false),
    unsubscribedAt: timestamp("unsubscribed_at", { withTimezone: true }),
    unsubscribeReason: text("unsubscribe_reason"),
    
    // Metadata
    customFields: json("custom_fields"), // Arbitrary extra data
    tags: json("tags"), // Array of tags
    
    // Cart link
    cartId: varchar("cart_id", { length: 100 }),
    
    // Marketing preferences
    marketingConsent: boolean("marketing_consent").default(true),
    
    // Test data exclusion
    isTest: boolean("is_test").notNull().default(false),
    testReason: varchar("test_reason", { length: 100 }),
    
    // Suppression tracking
    suppressionReason: varchar("suppression_reason", { length: 100 }),
    suppressedAt: timestamp("suppressed_at", { withTimezone: true }),
    
    // Site context
    hostname: varchar("hostname", { length: 100 }),
    
    // Timestamps
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    emailIdx: index("email_subscribers_email_idx").on(table.email),
    statusIdx: index("email_subscribers_status_idx").on(table.status),
    hostnameIdx: index("email_subscribers_hostname_idx").on(table.hostname),
    isTestIdx: index("email_subscribers_is_test_idx").on(table.isTest),
  })
);

export type EmailSubscriber = typeof emailSubscribers.$inferSelect;
export type NewEmailSubscriber = typeof emailSubscribers.$inferInsert;

// ============================================================================
// Abandoned Carts
// ============================================================================

export const abandonedCarts = pgTable(
  "abandoned_carts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    
    // Cart identity
    cartId: varchar("cart_id", { length: 100 }).notNull().unique(),
    sessionId: varchar("session_id", { length: 100 }),
    
    // Customer info
    customerEmail: varchar("customer_email", { length: 255 }),
    customerFirstName: varchar("customer_first_name", { length: 100 }),
    customerLastName: varchar("customer_last_name", { length: 100 }),
    customerPhone: varchar("customer_phone", { length: 20 }),
    
    // Cart contents
    items: json("items"), // Cart items JSON
    itemCount: integer("item_count").default(0),
    subtotal: decimal("subtotal", { precision: 10, scale: 2 }),
    estimatedTotal: decimal("estimated_total", { precision: 10, scale: 2 }),
    
    // Vehicle context
    vehicleYear: integer("vehicle_year"),
    vehicleMake: varchar("vehicle_make", { length: 100 }),
    vehicleModel: varchar("vehicle_model", { length: 200 }),
    vehicleTrim: varchar("vehicle_trim", { length: 200 }),
    
    // Status tracking
    status: varchar("status", { length: 50 }).notNull().default("active"), // active, abandoned, recovered, expired
    lastActivityAt: timestamp("last_activity_at", { withTimezone: true }).notNull().defaultNow(),
    abandonedAt: timestamp("abandoned_at", { withTimezone: true }),
    recoveredAt: timestamp("recovered_at", { withTimezone: true }),
    recoveredOrderId: varchar("recovered_order_id", { length: 100 }),
    
    // Email tracking (multi-email sequence)
    emailCount: integer("email_count").default(0),
    emailSentCount: integer("email_sent_count").default(0),
    firstEmailSentAt: timestamp("first_email_sent_at", { withTimezone: true }),
    secondEmailSentAt: timestamp("second_email_sent_at", { withTimezone: true }),
    thirdEmailSentAt: timestamp("third_email_sent_at", { withTimezone: true }),
    lastEmailStatus: varchar("last_email_status", { length: 50 }),
    emailOpenedAt: timestamp("email_opened_at", { withTimezone: true }),
    emailClickedAt: timestamp("email_clicked_at", { withTimezone: true }),
    emailOpenCount: integer("email_open_count").default(0),
    emailClickCount: integer("email_click_count").default(0),
    recoveredAfterEmail: boolean("recovered_after_email").default(false),
    unsubscribed: boolean("unsubscribed").default(false),
    
    // Test data exclusion
    isTest: boolean("is_test").notNull().default(false),
    testReason: varchar("test_reason", { length: 100 }),
    
    // Site context
    hostname: varchar("hostname", { length: 100 }),
    
    // Request context
    source: varchar("source", { length: 100 }),
    userAgent: text("user_agent"),
    ipAddress: varchar("ip_address", { length: 45 }),
    
    // Timestamps
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    cartIdIdx: index("abandoned_carts_cart_id_idx").on(table.cartId),
    statusIdx: index("abandoned_carts_status_idx").on(table.status),
    emailIdx: index("abandoned_carts_email_idx").on(table.customerEmail),
    lastActivityIdx: index("abandoned_carts_last_activity_idx").on(table.lastActivityAt),
    isTestIdx: index("abandoned_carts_is_test_idx").on(table.isTest),
  })
);

export type AbandonedCart = typeof abandonedCarts.$inferSelect;
export type NewAbandonedCart = typeof abandonedCarts.$inferInsert;

// ============================================================================
// Cart Add Events (Analytics tracking)
// ============================================================================

export const cartAddEvents = pgTable(
  "cart_add_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    
    // Session/Cart context
    sessionId: varchar("session_id", { length: 100 }),
    cartId: varchar("cart_id", { length: 100 }),
    
    // Product info
    productType: varchar("product_type", { length: 50 }), // tire, wheel, accessory
    productSku: varchar("product_sku", { length: 100 }),
    sku: varchar("sku", { length: 100 }), // alias
    rearSku: varchar("rear_sku", { length: 100 }), // for staggered setups
    productBrand: varchar("product_brand", { length: 100 }),
    brand: varchar("brand", { length: 100 }), // alias
    productModel: varchar("product_model", { length: 200 }),
    productName: varchar("product_name", { length: 300 }), // alias
    productSize: varchar("product_size", { length: 50 }),
    size: varchar("size", { length: 50 }), // alias
    specs: json("specs"), // Additional product specs
    
    // Pricing
    quantity: integer("quantity").default(1),
    unitPrice: decimal("unit_price", { precision: 10, scale: 2 }),
    totalPrice: decimal("total_price", { precision: 10, scale: 2 }),
    priceAtTime: decimal("price_at_time", { precision: 10, scale: 2 }),
    
    // Purchase tracking
    purchased: boolean("purchased").default(false),
    purchasedAt: timestamp("purchased_at", { withTimezone: true }),
    orderId: varchar("order_id", { length: 100 }),
    
    // Vehicle context
    vehicleYear: integer("vehicle_year"),
    vehicleMake: varchar("vehicle_make", { length: 100 }),
    vehicleModel: varchar("vehicle_model", { length: 200 }),
    vehicleTrim: varchar("vehicle_trim", { length: 200 }),
    
    // Analytics context
    pageUrl: varchar("page_url", { length: 500 }),
    referrer: varchar("referrer", { length: 500 }),
    source: varchar("source", { length: 100 }),
    utmSource: varchar("utm_source", { length: 100 }),
    utmMedium: varchar("utm_medium", { length: 100 }),
    utmCampaign: varchar("utm_campaign", { length: 255 }),
    
    // Request context
    ipAddress: varchar("ip_address", { length: 45 }),
    userAgent: text("user_agent"),
    
    // Test data exclusion
    isTest: boolean("is_test").notNull().default(false),
    testReason: varchar("test_reason", { length: 100 }),
    
    // Site context
    hostname: varchar("hostname", { length: 100 }),
    
    // Timestamp
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    sessionIdx: index("cart_add_events_session_idx").on(table.sessionId),
    productSkuIdx: index("cart_add_events_product_sku_idx").on(table.productSku),
    createdIdx: index("cart_add_events_created_idx").on(table.createdAt),
    isTestIdx: index("cart_add_events_is_test_idx").on(table.isTest),
  })
);

export type CartAddEvent = typeof cartAddEvents.$inferSelect;
export type NewCartAddEvent = typeof cartAddEvents.$inferInsert;
