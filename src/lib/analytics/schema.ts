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
    isTest: boolean("is_test").default(false),
    testReason: varchar("test_reason", { length: 100 }),
  },
  (table) => ({
    sessionIdx: index("analytics_sessions_session_id_idx").on(table.sessionId),
    firstSeenIdx: index("analytics_sessions_first_seen_idx").on(table.firstSeenAt),
    isTestIdx: index("analytics_sessions_is_test_idx").on(table.isTest),
  })
);

export const analyticsPageviews = pgTable(
  "analytics_pageviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: varchar("session_id", { length: 64 }).notNull(),
    path: varchar("path", { length: 500 }).notNull(),
    timestamp: timestamp("timestamp").notNull().defaultNow(),
  },
  (table) => ({
    sessionIdx: index("analytics_pageviews_session_idx").on(table.sessionId),
    pathIdx: index("analytics_pageviews_path_idx").on(table.path),
    timestampIdx: index("analytics_pageviews_timestamp_idx").on(table.timestamp),
  })
);

export type AnalyticsSession = typeof analyticsSessions.$inferSelect;
export type AnalyticsPageview = typeof analyticsPageviews.$inferSelect;
