/**
 * Analytics Database Schema
 * Lightweight session + pageview tracking
 */

import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  integer,
  timestamp,
  index,
} from "drizzle-orm/pg-core";

export const analyticsSessions = pgTable(
  "analytics_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: varchar("session_id", { length: 64 }).notNull().unique(),
    firstSeenAt: timestamp("first_seen_at").notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at").notNull().defaultNow(),
    landingPage: varchar("landing_page", { length: 500 }).notNull(),
    referrer: varchar("referrer", { length: 500 }),
    utmSource: varchar("utm_source", { length: 100 }),
    utmMedium: varchar("utm_medium", { length: 100 }),
    utmCampaign: varchar("utm_campaign", { length: 255 }),
    utmTerm: varchar("utm_term", { length: 255 }),
    utmContent: varchar("utm_content", { length: 255 }),
    deviceType: varchar("device_type", { length: 20 }),
    userAgent: text("user_agent"),
    isBot: boolean("is_bot").default(false),
    country: varchar("country", { length: 2 }),
    pageViewCount: integer("page_view_count").default(1),
    // Test data exclusion (added 2026-04-05)
    isTest: boolean("is_test").notNull().default(false),
    testReason: varchar("test_reason", { length: 100 }),
    // Site/hostname tracking (added 2026-04-18)
    hostname: varchar("hostname", { length: 100 }),
    // Live tracking (added 2026-04-18)
    currentPage: varchar("current_page", { length: 500 }),
    city: varchar("city", { length: 100 }),
    region: varchar("region", { length: 100 }),
  },
  (table) => ({
    sessionIdx: index("analytics_sessions_session_id_idx").on(table.sessionId),
    firstSeenIdx: index("analytics_sessions_first_seen_idx").on(table.firstSeenAt),
    isTestIdx: index("analytics_sessions_is_test_idx").on(table.isTest),
    hostnameIdx: index("analytics_sessions_hostname_idx").on(table.hostname),
  })
);

export const analyticsPageviews = pgTable(
  "analytics_pageviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: varchar("session_id", { length: 64 }).notNull(),
    path: varchar("path", { length: 500 }).notNull(),
    timestamp: timestamp("timestamp").notNull().defaultNow(),
    // Site/hostname tracking (added 2026-04-18)
    hostname: varchar("hostname", { length: 100 }),
  },
  (table) => ({
    sessionIdx: index("analytics_pageviews_session_idx").on(table.sessionId),
    pathIdx: index("analytics_pageviews_path_idx").on(table.path),
    timestampIdx: index("analytics_pageviews_timestamp_idx").on(table.timestamp),
    hostnameIdx: index("analytics_pageviews_hostname_idx").on(table.hostname),
  })
);

// ═══════════════════════════════════════════════════════════════════════════════
// JAKE ANALYTICS EVENTS (added 2026-05-14)
// ═══════════════════════════════════════════════════════════════════════════════

export const jakeAnalyticsEvents = pgTable(
  "jake_analytics_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventName: varchar("event_name", { length: 50 }).notNull(),
    sessionId: varchar("session_id", { length: 64 }),
    requestId: varchar("request_id", { length: 64 }),
    source: varchar("source", { length: 50 }), // homepage, header, direct
    // Vehicle info
    vehicleYear: varchar("vehicle_year", { length: 10 }),
    vehicleMake: varchar("vehicle_make", { length: 50 }),
    vehicleModel: varchar("vehicle_model", { length: 50 }),
    vehicleTrim: varchar("vehicle_trim", { length: 100 }),
    // Prompt/intent
    prompt: text("prompt"),
    intent: varchar("intent", { length: 100 }), // cheap_tires, all_terrain, etc.
    // Product info
    productSku: varchar("product_sku", { length: 50 }),
    productType: varchar("product_type", { length: 20 }), // tire, wheel, package
    productBrand: varchar("product_brand", { length: 50 }),
    productModel: varchar("product_model", { length: 100 }),
    // Cart/order info
    cartId: varchar("cart_id", { length: 64 }),
    cartUrl: text("cart_url"),
    cartValue: integer("cart_value"), // cents
    orderId: varchar("order_id", { length: 50 }),
    orderValue: integer("order_value"), // cents
    // Error tracking
    errorType: varchar("error_type", { length: 50 }),
    errorMessage: text("error_message"),
    // Metadata
    metadata: text("metadata"), // JSON for flexible data
    userAgent: text("user_agent"),
    hostname: varchar("hostname", { length: 100 }),
    url: varchar("url", { length: 500 }),
    // Test exclusion
    isTest: boolean("is_test").notNull().default(false),
    // Timestamps
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    eventNameIdx: index("jake_events_event_name_idx").on(table.eventName),
    sessionIdx: index("jake_events_session_idx").on(table.sessionId),
    createdAtIdx: index("jake_events_created_at_idx").on(table.createdAt),
    productSkuIdx: index("jake_events_product_sku_idx").on(table.productSku),
    isTestIdx: index("jake_events_is_test_idx").on(table.isTest),
    hostnameIdx: index("jake_events_hostname_idx").on(table.hostname),
  })
);

// ═══════════════════════════════════════════════════════════════════════════════
// JAKE CONVERSATION MESSAGES (added 2026-05-15)
// Full message history for conversation replay
// ═══════════════════════════════════════════════════════════════════════════════

export const jakeConversationMessages = pgTable(
  "jake_conversation_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: varchar("session_id", { length: 64 }).notNull(),
    role: varchar("role", { length: 20 }).notNull(), // user, assistant
    content: text("content").notNull(),
    // Metadata
    hostname: varchar("hostname", { length: 100 }),
    isTest: boolean("is_test").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    sessionIdx: index("jake_messages_session_idx").on(table.sessionId),
    createdAtIdx: index("jake_messages_created_at_idx").on(table.createdAt),
    isTestIdx: index("jake_messages_is_test_idx").on(table.isTest),
  })
);

export type AnalyticsSession = typeof analyticsSessions.$inferSelect;
export type AnalyticsPageview = typeof analyticsPageviews.$inferSelect;
export type JakeAnalyticsEvent = typeof jakeAnalyticsEvents.$inferSelect;
export type JakeConversationMessage = typeof jakeConversationMessages.$inferSelect;
