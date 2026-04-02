/**
 * Fitment API Schema
 * 
 * Tables for API access management:
 * - api_access_requests: Pending access requests
 * - api_keys: Active API keys with usage tracking
 * - api_usage_logs: Request logs for analytics
 */

import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  boolean,
  integer,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// ============================================================================
// api_access_requests - Pending API access requests
// ============================================================================

export const apiAccessRequests = pgTable(
  "api_access_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    
    // Applicant info
    name: varchar("name", { length: 255 }).notNull(),
    email: varchar("email", { length: 255 }).notNull(),
    company: varchar("company", { length: 255 }).notNull(),
    website: varchar("website", { length: 500 }),
    
    // Use case
    useCase: varchar("use_case", { length: 50 }).notNull(), // ecommerce, marketplace, dealership, developer, other
    useCaseDetails: text("use_case_details"),
    expectedUsage: varchar("expected_usage", { length: 50 }), // < 10k, 10k-50k, 50k-100k, 100k+
    
    // Status: pending, approved, rejected
    status: varchar("status", { length: 20 }).notNull().default("pending"),
    
    // Review
    reviewedBy: varchar("reviewed_by", { length: 100 }),
    reviewedAt: timestamp("reviewed_at"),
    reviewNotes: text("review_notes"),
    
    // Associated API key (set on approval)
    apiKeyId: uuid("api_key_id"),
    
    // Email tracking
    confirmationEmailSentAt: timestamp("confirmation_email_sent_at"),
    approvalEmailSentAt: timestamp("approval_email_sent_at"),
    followUpEmailSentAt: timestamp("follow_up_email_sent_at"),
    
    // Timestamps
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    emailIdx: index("api_access_requests_email_idx").on(table.email),
    statusIdx: index("api_access_requests_status_idx").on(table.status),
    createdAtIdx: index("api_access_requests_created_at_idx").on(table.createdAt),
  })
);

// ============================================================================
// api_keys - Active API keys
// ============================================================================

export const apiKeys = pgTable(
  "api_keys",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    
    // Key identity (store hash, not plain key)
    keyHash: varchar("key_hash", { length: 64 }).notNull(), // SHA256 hash
    keyPrefix: varchar("key_prefix", { length: 12 }).notNull(), // First 8 chars for identification
    
    // Owner info
    name: varchar("name", { length: 255 }).notNull(),
    email: varchar("email", { length: 255 }).notNull(),
    company: varchar("company", { length: 255 }),
    
    // Plan/tier
    plan: varchar("plan", { length: 50 }).notNull().default("starter"), // starter, growth, pro, enterprise
    
    // Rate limits
    monthlyLimit: integer("monthly_limit").notNull().default(10000),
    dailyLimit: integer("daily_limit"),
    
    // Usage tracking
    requestCount: integer("request_count").notNull().default(0),
    lastRequestAt: timestamp("last_request_at"),
    monthlyRequestCount: integer("monthly_request_count").notNull().default(0),
    monthlyResetAt: timestamp("monthly_reset_at"),
    
    // First call tracking (for follow-up email)
    firstCallAt: timestamp("first_call_at"),
    firstCallEndpoint: varchar("first_call_endpoint", { length: 255 }),
    
    // Status
    active: boolean("active").notNull().default(true),
    suspendedAt: timestamp("suspended_at"),
    suspendReason: text("suspend_reason"),
    
    // Timestamps
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    expiresAt: timestamp("expires_at"),
  },
  (table) => ({
    keyHashIdx: uniqueIndex("api_keys_key_hash_idx").on(table.keyHash),
    keyPrefixIdx: index("api_keys_key_prefix_idx").on(table.keyPrefix),
    emailIdx: index("api_keys_email_idx").on(table.email),
    activeIdx: index("api_keys_active_idx").on(table.active),
  })
);

// ============================================================================
// api_usage_logs - Request logs for analytics (optional, for future billing)
// ============================================================================

export const apiUsageLogs = pgTable(
  "api_usage_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    
    apiKeyId: uuid("api_key_id").notNull().references(() => apiKeys.id),
    
    // Request info
    endpoint: varchar("endpoint", { length: 255 }).notNull(),
    method: varchar("method", { length: 10 }).notNull(),
    statusCode: integer("status_code"),
    responseTimeMs: integer("response_time_ms"),
    
    // Request params (for debugging)
    queryParams: text("query_params"),
    
    // Client info
    ipAddress: varchar("ip_address", { length: 45 }),
    userAgent: text("user_agent"),
    
    // Timestamp
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    apiKeyIdIdx: index("api_usage_logs_api_key_id_idx").on(table.apiKeyId),
    createdAtIdx: index("api_usage_logs_created_at_idx").on(table.createdAt),
    endpointIdx: index("api_usage_logs_endpoint_idx").on(table.endpoint),
  })
);

// ============================================================================
// Type exports
// ============================================================================

export type ApiAccessRequest = typeof apiAccessRequests.$inferSelect;
export type NewApiAccessRequest = typeof apiAccessRequests.$inferInsert;

export type ApiKey = typeof apiKeys.$inferSelect;
export type NewApiKey = typeof apiKeys.$inferInsert;

export type ApiUsageLog = typeof apiUsageLogs.$inferSelect;
export type NewApiUsageLog = typeof apiUsageLogs.$inferInsert;
