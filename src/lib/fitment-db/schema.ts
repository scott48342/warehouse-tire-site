/**
 * Fitment Database Schema (Drizzle ORM)
 * 
 * Tables:
 * - fitment_source_records: Raw API responses for debugging
 * - vehicle_fitments: Normalized fitment data for runtime
 * - fitment_overrides: Manual corrections
 * - fitment_import_jobs: Batch import tracking
 * - modification_aliases: Maps requested modificationIds to canonical ones
 */

import {
  pgTable,
  uuid,
  varchar,
  integer,
  decimal,
  text,
  timestamp,
  boolean,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// ============================================================================
// fitment_source_records - Raw API responses stored unchanged
// ============================================================================

export const fitmentSourceRecords = pgTable(
  "fitment_source_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    source: varchar("source", { length: 50 }).notNull(), // wheelsize, wheelpros, etc.
    sourceId: varchar("source_id", { length: 255 }).notNull(), // External ID
    year: integer("year").notNull(),
    make: varchar("make", { length: 100 }).notNull(),
    model: varchar("model", { length: 100 }).notNull(),
    rawPayload: jsonb("raw_payload").notNull(), // Full API response
    fetchedAt: timestamp("fetched_at").notNull().defaultNow(),
    checksum: varchar("checksum", { length: 64 }).notNull(), // SHA256
  },
  (table) => ({
    // Unique constraint: one record per source + source_id
    sourceIdIdx: uniqueIndex("fitment_source_records_source_source_id_idx").on(
      table.source,
      table.sourceId
    ),
    // Lookup by vehicle
    vehicleIdx: index("fitment_source_records_vehicle_idx").on(
      table.year,
      table.make,
      table.model
    ),
  })
);

// ============================================================================
// vehicle_fitments - Normalized fitment data for runtime use
// ============================================================================

export const vehicleFitments = pgTable(
  "vehicle_fitments",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // Canonical identity
    year: integer("year").notNull(),
    make: varchar("make", { length: 100 }).notNull(),
    model: varchar("model", { length: 100 }).notNull(),
    modificationId: varchar("modification_id", { length: 255 }).notNull(),

    // Trim/submodel display
    rawTrim: varchar("raw_trim", { length: 255 }), // Original from source
    displayTrim: varchar("display_trim", { length: 255 }).notNull(), // Customer-facing
    submodel: varchar("submodel", { length: 255 }),

    // Wheel specifications
    boltPattern: varchar("bolt_pattern", { length: 20 }), // e.g., "5x120"
    centerBoreMm: decimal("center_bore_mm", { precision: 5, scale: 1 }),
    threadSize: varchar("thread_size", { length: 20 }), // e.g., "M14x1.5"
    seatType: varchar("seat_type", { length: 20 }), // conical, ball, flat

    // Offset range (decimal to support API values like 44.45)
    offsetMinMm: decimal("offset_min_mm", { precision: 5, scale: 2 }),
    offsetMaxMm: decimal("offset_max_mm", { precision: 5, scale: 2 }),

    // OEM sizes (JSON arrays)
    oemWheelSizes: jsonb("oem_wheel_sizes").notNull().default([]),
    oemTireSizes: jsonb("oem_tire_sizes").notNull().default([]),

    // Source tracking
    source: varchar("source", { length: 50 }).notNull(),
    sourceRecordId: uuid("source_record_id").references(
      () => fitmentSourceRecords.id
    ),

    // Timestamps
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    lastVerifiedAt: timestamp("last_verified_at"),
  },
  (table) => ({
    // Primary lookup: year + make + model + modification
    canonicalIdx: uniqueIndex("vehicle_fitments_canonical_idx").on(
      table.year,
      table.make,
      table.model,
      table.modificationId
    ),
    // Fast lookups by vehicle
    yearMakeModelIdx: index("vehicle_fitments_ymm_idx").on(
      table.year,
      table.make,
      table.model
    ),
    // Lookup by make/model (for browsing)
    makeModelIdx: index("vehicle_fitments_make_model_idx").on(
      table.make,
      table.model
    ),
  })
);

// ============================================================================
// fitment_overrides - Manual corrections to source data
// ============================================================================

export const fitmentOverrides = pgTable(
  "fitment_overrides",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // Scope determines how specific this override is
    scope: varchar("scope", { length: 20 }).notNull(), // global, year, make, model, modification

    // Match criteria (null = wildcard)
    year: integer("year"),
    make: varchar("make", { length: 100 }),
    model: varchar("model", { length: 100 }),
    modificationId: varchar("modification_id", { length: 255 }),

    // Override values (null = don't override)
    displayTrim: varchar("display_trim", { length: 255 }),
    boltPattern: varchar("bolt_pattern", { length: 20 }),
    centerBoreMm: decimal("center_bore_mm", { precision: 5, scale: 1 }),
    threadSize: varchar("thread_size", { length: 20 }),
    seatType: varchar("seat_type", { length: 20 }),
    offsetMinMm: decimal("offset_min_mm", { precision: 5, scale: 2 }),
    offsetMaxMm: decimal("offset_max_mm", { precision: 5, scale: 2 }),
    
    // Extended override fields (JSON arrays)
    oemWheelSizes: jsonb("oem_wheel_sizes"), // [{diameter, width, offset, axle, isStock}]
    oemTireSizes: jsonb("oem_tire_sizes"),   // ["275/55R20", ...]
    
    // Force quality level (bypasses validation)
    forceQuality: varchar("force_quality", { length: 20 }), // 'valid' | 'partial'
    
    // Additional notes
    notes: text("notes"),

    // Metadata
    reason: text("reason").notNull(),
    createdBy: varchar("created_by", { length: 100 }).notNull(),
    active: boolean("active").notNull().default(true),

    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    // Find overrides for a specific vehicle
    scopeIdx: index("fitment_overrides_scope_idx").on(
      table.scope,
      table.year,
      table.make,
      table.model
    ),
    activeIdx: index("fitment_overrides_active_idx").on(table.active),
  })
);

// ============================================================================
// fitment_import_jobs - Track batch imports
// ============================================================================

export const fitmentImportJobs = pgTable(
  "fitment_import_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    source: varchar("source", { length: 50 }).notNull(),

    // Scope
    yearStart: integer("year_start"),
    yearEnd: integer("year_end"),
    makes: jsonb("makes"), // string[] or null for all

    // Status
    status: varchar("status", { length: 20 }).notNull().default("pending"),
    totalRecords: integer("total_records").notNull().default(0),
    processedRecords: integer("processed_records").notNull().default(0),
    importedRecords: integer("imported_records").notNull().default(0),
    skippedRecords: integer("skipped_records").notNull().default(0),
    errorCount: integer("error_count").notNull().default(0),

    // Timing
    startedAt: timestamp("started_at"),
    completedAt: timestamp("completed_at"),

    // Errors
    lastError: text("last_error"),
    errorLog: jsonb("error_log"),

    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    statusIdx: index("fitment_import_jobs_status_idx").on(table.status),
    sourceIdx: index("fitment_import_jobs_source_idx").on(table.source),
  })
);

// ============================================================================
// modification_aliases - Maps requested modificationIds to canonical ones
// ============================================================================

/**
 * When a user selects a trim from the trims API, they get a modificationId.
 * When the profile system imports from Wheel-Size API, it might store with
 * a different modificationId (the actual API slug).
 * 
 * This table maps:
 * - requestedModificationId (what the trims API returned / user selected)
 * - canonicalModificationId (what's stored in vehicle_fitments)
 * 
 * This allows profile lookup by the requested ID to find the canonical record.
 */
export const modificationAliases = pgTable(
  "modification_aliases",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    
    // Vehicle identity
    year: integer("year").notNull(),
    make: varchar("make", { length: 100 }).notNull(),
    model: varchar("model", { length: 100 }).notNull(),
    
    // The modificationId that was requested (from trims API / user selection)
    requestedModificationId: varchar("requested_modification_id", { length: 255 }).notNull(),
    
    // The canonical modificationId stored in vehicle_fitments
    canonicalModificationId: varchar("canonical_modification_id", { length: 255 }).notNull(),
    
    // Display info for debugging
    displayTrim: varchar("display_trim", { length: 255 }),
    
    // Reference to the vehicle_fitments record
    vehicleFitmentId: uuid("vehicle_fitment_id").references(() => vehicleFitments.id),
    
    // Timestamps
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    // Primary lookup: year + make + model + requested modificationId
    requestedIdx: uniqueIndex("modification_aliases_requested_idx").on(
      table.year,
      table.make,
      table.model,
      table.requestedModificationId
    ),
    // Lookup by canonical ID
    canonicalIdx: index("modification_aliases_canonical_idx").on(
      table.year,
      table.make,
      table.model,
      table.canonicalModificationId
    ),
  })
);

// ============================================================================
// km_image_mappings - Cache for K&M tire image URL mappings
// ============================================================================

export const kmImageMappings = pgTable(
  "km_image_mappings",
  {
    partNumber: varchar("part_number", { length: 50 }).primaryKey(),
    prodline: varchar("prodline", { length: 20 }),
    folderId: varchar("folder_id", { length: 20 }),
    imageUrl: text("image_url"),
    fetchedAt: timestamp("fetched_at").notNull().defaultNow(),
  },
  (table) => ({
    prodlineIdx: index("km_image_mappings_prodline_idx").on(table.prodline),
  })
);

// ============================================================================
// tire_images - TireLibrary image cache (uploaded to Vercel Blob)
// ============================================================================

export const tireImages = pgTable(
  "tire_images",
  {
    // TireLibrary pattern ID (from TireWire API)
    patternId: integer("pattern_id").primaryKey(),
    
    // Brand/model info for reference
    brand: varchar("brand", { length: 100 }),
    pattern: varchar("pattern", { length: 200 }), // model name
    
    // Original TireLibrary URL
    sourceUrl: text("source_url").notNull(),
    
    // Our cached URL (Vercel Blob)
    blobUrl: text("blob_url"),
    
    // Status: pending, uploaded, failed, not_found
    status: varchar("status", { length: 20 }).notNull().default("pending"),
    
    // Error info if failed
    errorMessage: text("error_message"),
    
    // File metadata
    contentType: varchar("content_type", { length: 50 }),
    fileSize: integer("file_size"),
    
    // Timestamps
    createdAt: timestamp("created_at").notNull().defaultNow(),
    uploadedAt: timestamp("uploaded_at"),
  },
  (table) => ({
    statusIdx: index("tire_images_status_idx").on(table.status),
    brandIdx: index("tire_images_brand_idx").on(table.brand),
  })
);

// ============================================================================
// catalog_makes - Vehicle makes (internal data)
// ============================================================================

export const catalogMakes = pgTable(
  "catalog_makes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: varchar("slug", { length: 100 }).notNull().unique(),
    name: varchar("name", { length: 100 }).notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    slugIdx: index("catalog_makes_slug_idx").on(table.slug),
  })
);

// ============================================================================
// catalog_models - Models with their valid years
// ============================================================================

export const catalogModels = pgTable(
  "catalog_models",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    makeSlug: varchar("make_slug", { length: 100 }).notNull(),
    slug: varchar("slug", { length: 100 }).notNull(),
    name: varchar("name", { length: 100 }).notNull(),
    years: integer("years").array().notNull().default([]),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    makeSlugIdx: index("catalog_models_make_slug_idx").on(table.makeSlug),
    uniqueMakeModel: uniqueIndex("catalog_models_make_model_idx").on(table.makeSlug, table.slug),
  })
);

// ============================================================================
// catalog_sync_log - Track when catalog data was last synced
// ============================================================================

export const catalogSyncLog = pgTable(
  "catalog_sync_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entityType: varchar("entity_type", { length: 50 }).notNull(),
    entityKey: varchar("entity_key", { length: 255 }),
    syncedAt: timestamp("synced_at").notNull().defaultNow(),
    recordCount: integer("record_count").notNull().default(0),
  },
  (table) => ({
    entityIdx: uniqueIndex("catalog_sync_log_entity_idx").on(table.entityType, table.entityKey),
  })
);

// ============================================================================
// abandoned_carts - Track carts for recovery and metrics
// ============================================================================

export const abandonedCarts = pgTable(
  "abandoned_carts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    
    // Cart identifier (generated client-side for recovery links)
    cartId: varchar("cart_id", { length: 64 }).notNull(),
    
    // Session/user tracking
    sessionId: varchar("session_id", { length: 255 }),
    
    // Customer info (captured during checkout)
    customerFirstName: varchar("customer_first_name", { length: 100 }),
    customerLastName: varchar("customer_last_name", { length: 100 }),
    customerEmail: varchar("customer_email", { length: 255 }),
    customerPhone: varchar("customer_phone", { length: 50 }),
    
    // Vehicle info (from cart items)
    vehicleYear: varchar("vehicle_year", { length: 10 }),
    vehicleMake: varchar("vehicle_make", { length: 100 }),
    vehicleModel: varchar("vehicle_model", { length: 100 }),
    vehicleTrim: varchar("vehicle_trim", { length: 255 }),
    
    // Cart contents
    items: jsonb("items").notNull(), // Snapshot of cart items
    itemCount: integer("item_count").notNull().default(0),
    
    // Pricing
    subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull().default("0"),
    estimatedTotal: decimal("estimated_total", { precision: 10, scale: 2 }).notNull().default("0"),
    
    // Status: active, abandoned, recovered, expired
    status: varchar("status", { length: 20 }).notNull().default("active"),
    
    // Recovery tracking
    recoveredOrderId: varchar("recovered_order_id", { length: 255 }),
    recoveredAt: timestamp("recovered_at"),
    
    // Timestamps
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    lastActivityAt: timestamp("last_activity_at").notNull().defaultNow(),
    
    // Abandonment detection
    abandonedAt: timestamp("abandoned_at"),
    
    // Source info
    source: varchar("source", { length: 50 }), // web, mobile, etc.
    userAgent: text("user_agent"),
    ipAddress: varchar("ip_address", { length: 45 }),
    
    // Email tracking
    firstEmailSentAt: timestamp("first_email_sent_at"),
    secondEmailSentAt: timestamp("second_email_sent_at"),
    thirdEmailSentAt: timestamp("third_email_sent_at"),
    emailSentCount: integer("email_sent_count").notNull().default(0),
    lastEmailStatus: varchar("last_email_status", { length: 50 }), // sent, failed, bounced
    recoveredAfterEmail: boolean("recovered_after_email").default(false),
    unsubscribed: boolean("unsubscribed").default(false),
    
    // Test data exclusion
    isTest: boolean("is_test").notNull().default(false),
    testReason: varchar("test_reason", { length: 100 }), // internal_email, test_mode, admin_marked, stripe_test, internal_ip
  },
  (table) => ({
    // Unique cart id
    cartIdIdx: uniqueIndex("abandoned_carts_cart_id_idx").on(table.cartId),
    // Status filtering
    statusIdx: index("abandoned_carts_status_idx").on(table.status),
    // Customer lookup
    emailIdx: index("abandoned_carts_email_idx").on(table.customerEmail),
    // Time-based queries
    lastActivityIdx: index("abandoned_carts_last_activity_idx").on(table.lastActivityAt),
    createdAtIdx: index("abandoned_carts_created_at_idx").on(table.createdAt),
    // Test data filtering
    isTestIdx: index("abandoned_carts_is_test_idx").on(table.isTest),
  })
);

// ============================================================================
// email_subscribers - Marketing email capture
// ============================================================================

export const emailSubscribers = pgTable(
  "email_subscribers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    
    // Core email
    email: varchar("email", { length: 255 }).notNull(),
    
    // Source tracking
    source: varchar("source", { length: 50 }).notNull(), // exit_intent, cart_save, checkout, newsletter, quote
    
    // Optional vehicle association
    vehicleYear: varchar("vehicle_year", { length: 10 }),
    vehicleMake: varchar("vehicle_make", { length: 100 }),
    vehicleModel: varchar("vehicle_model", { length: 100 }),
    vehicleTrim: varchar("vehicle_trim", { length: 255 }),
    
    // Link to cart (if applicable)
    cartId: varchar("cart_id", { length: 64 }),
    
    // Consent & preferences
    marketingConsent: boolean("marketing_consent").notNull().default(true),
    unsubscribed: boolean("unsubscribed").notNull().default(false),
    unsubscribedAt: timestamp("unsubscribed_at"),
    
    // Unsubscribe token for one-click unsubscribe
    unsubscribeToken: varchar("unsubscribe_token", { length: 64 }),
    
    // Suppression (hard bounce, complaint, spam report)
    suppressionReason: varchar("suppression_reason", { length: 50 }),
    suppressedAt: timestamp("suppressed_at"),
    
    // Activity tracking for segmentation
    lastActiveAt: timestamp("last_active_at"),
    lastCartAt: timestamp("last_cart_at"),
    lastOrderAt: timestamp("last_order_at"),
    lastCampaignSentAt: timestamp("last_campaign_sent_at"),
    
    // Timestamps
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    
    // Metadata
    ipAddress: varchar("ip_address", { length: 45 }),
    userAgent: text("user_agent"),
    
    // Test data exclusion
    isTest: boolean("is_test").notNull().default(false),
    testReason: varchar("test_reason", { length: 100 }), // internal_email, test_mode, admin_marked
  },
  (table) => ({
    // Unique email per source (allow same email from different sources)
    emailSourceIdx: uniqueIndex("email_subscribers_email_source_idx").on(table.email, table.source),
    // Fast email lookup
    emailIdx: index("email_subscribers_email_idx").on(table.email),
    // Source filtering
    sourceIdx: index("email_subscribers_source_idx").on(table.source),
    // Vehicle queries
    vehicleIdx: index("email_subscribers_vehicle_idx").on(table.vehicleYear, table.vehicleMake, table.vehicleModel),
    // Cart linking
    cartIdIdx: index("email_subscribers_cart_id_idx").on(table.cartId),
  })
);

// ============================================================================
// email_campaigns - Marketing campaign definitions
// ============================================================================

export const emailCampaigns = pgTable(
  "email_campaigns",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    
    // Basic info
    name: varchar("name", { length: 255 }).notNull(),
    campaignType: varchar("campaign_type", { length: 50 }).notNull(), // tire_promo, wheel_promo, package_promo, newsletter, announcement
    
    // Status: draft, scheduled, sending, paused, sent, cancelled
    status: varchar("status", { length: 20 }).notNull().default("draft"),
    
    // Email content
    subject: varchar("subject", { length: 255 }).notNull(),
    previewText: varchar("preview_text", { length: 255 }),
    fromName: varchar("from_name", { length: 100 }),
    replyTo: varchar("reply_to", { length: 255 }),
    
    // Template system
    templateKey: varchar("template_key", { length: 100 }),
    contentJson: jsonb("content_json"), // Block-based content structure
    
    // Audience targeting
    audienceRulesJson: jsonb("audience_rules_json").notNull().default({}),
    
    // Scheduling
    scheduledFor: timestamp("scheduled_for"),
    sendMode: varchar("send_mode", { length: 20 }).notNull().default("once"), // once, recurring_monthly
    monthlyRuleJson: jsonb("monthly_rule_json"), // For recurring campaigns
    
    // Content flags
    includeFreeShippingBanner: boolean("include_free_shipping_banner").notNull().default(true),
    includePriceMatch: boolean("include_price_match").notNull().default(true),
    
    // Tracking
    utmCampaign: varchar("utm_campaign", { length: 100 }),
    
    // Stats (denormalized)
    totalRecipients: integer("total_recipients").notNull().default(0),
    sentCount: integer("sent_count").notNull().default(0),
    deliveredCount: integer("delivered_count").notNull().default(0),
    openCount: integer("open_count").notNull().default(0),
    clickCount: integer("click_count").notNull().default(0),
    bounceCount: integer("bounce_count").notNull().default(0),
    complaintCount: integer("complaint_count").notNull().default(0),
    unsubscribeCount: integer("unsubscribe_count").notNull().default(0),
    
    // Test data exclusion
    isTest: boolean("is_test").notNull().default(false),
    
    // Timestamps
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    startedAt: timestamp("started_at"),
    completedAt: timestamp("completed_at"),
    
    // Metadata
    createdBy: varchar("created_by", { length: 100 }),
    notes: text("notes"),
  },
  (table) => ({
    statusIdx: index("email_campaigns_status_idx").on(table.status),
    typeIdx: index("email_campaigns_type_idx").on(table.campaignType),
    scheduledIdx: index("email_campaigns_scheduled_idx").on(table.scheduledFor),
  })
);

// ============================================================================
// email_campaign_recipients - Snapshot of recipients at send time
// ============================================================================

export const emailCampaignRecipients = pgTable(
  "email_campaign_recipients",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    
    // Foreign keys
    campaignId: uuid("campaign_id").notNull().references(() => emailCampaigns.id, { onDelete: "cascade" }),
    subscriberId: uuid("subscriber_id").references(() => emailSubscribers.id, { onDelete: "set null" }),
    
    // Denormalized email
    email: varchar("email", { length: 255 }).notNull(),
    
    // Status: pending, sent, delivered, bounced, complained, failed
    status: varchar("status", { length: 20 }).notNull().default("pending"),
    
    // Engagement tracking
    sentAt: timestamp("sent_at"),
    deliveredAt: timestamp("delivered_at"),
    openedAt: timestamp("opened_at"),
    clickedAt: timestamp("clicked_at"),
    bouncedAt: timestamp("bounced_at"),
    complainedAt: timestamp("complained_at"),
    unsubscribedAt: timestamp("unsubscribed_at"),
    
    // Email provider reference
    messageId: varchar("message_id", { length: 255 }),
    
    // Error info
    errorMessage: text("error_message"),
    
    // Timestamps
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    campaignIdx: index("email_campaign_recipients_campaign_idx").on(table.campaignId),
    statusIdx: index("email_campaign_recipients_status_idx").on(table.campaignId, table.status),
    emailIdx: index("email_campaign_recipients_email_idx").on(table.email),
    uniqueRecipient: uniqueIndex("email_campaign_recipients_unique").on(table.campaignId, table.email),
  })
);

// ============================================================================
// email_campaign_events - Detailed event log
// ============================================================================

export const emailCampaignEvents = pgTable(
  "email_campaign_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    
    // Foreign keys
    campaignId: uuid("campaign_id").notNull().references(() => emailCampaigns.id, { onDelete: "cascade" }),
    recipientId: uuid("recipient_id").references(() => emailCampaignRecipients.id, { onDelete: "set null" }),
    
    // Event type
    eventType: varchar("event_type", { length: 30 }).notNull(), // sent, delivered, opened, clicked, bounced, complained, unsubscribed
    
    // Event details
    email: varchar("email", { length: 255 }),
    linkUrl: text("link_url"), // For click events
    userAgent: text("user_agent"),
    ipAddress: varchar("ip_address", { length: 45 }),
    
    // Provider data
    providerEventId: varchar("provider_event_id", { length: 255 }),
    rawData: jsonb("raw_data"),
    
    // Timestamp
    occurredAt: timestamp("occurred_at").notNull().defaultNow(),
  },
  (table) => ({
    campaignIdx: index("email_campaign_events_campaign_idx").on(table.campaignId),
    typeIdx: index("email_campaign_events_type_idx").on(table.campaignId, table.eventType),
    timeIdx: index("email_campaign_events_time_idx").on(table.occurredAt),
  })
);

// ============================================================================
// Type exports for Drizzle
// ============================================================================

export type EmailSubscriber = typeof emailSubscribers.$inferSelect;
export type NewEmailSubscriber = typeof emailSubscribers.$inferInsert;

export type AbandonedCart = typeof abandonedCarts.$inferSelect;
export type NewAbandonedCart = typeof abandonedCarts.$inferInsert;

export type CatalogMake = typeof catalogMakes.$inferSelect;
export type NewCatalogMake = typeof catalogMakes.$inferInsert;

export type CatalogModel = typeof catalogModels.$inferSelect;
export type NewCatalogModel = typeof catalogModels.$inferInsert;

export type CatalogSyncLog = typeof catalogSyncLog.$inferSelect;
export type NewCatalogSyncLog = typeof catalogSyncLog.$inferInsert;

export type KmImageMapping = typeof kmImageMappings.$inferSelect;
export type NewKmImageMapping = typeof kmImageMappings.$inferInsert;

export type TireImage = typeof tireImages.$inferSelect;
export type NewTireImage = typeof tireImages.$inferInsert;

export type FitmentSourceRecord = typeof fitmentSourceRecords.$inferSelect;
export type NewFitmentSourceRecord = typeof fitmentSourceRecords.$inferInsert;

export type VehicleFitment = typeof vehicleFitments.$inferSelect;
export type NewVehicleFitment = typeof vehicleFitments.$inferInsert;

export type FitmentOverride = typeof fitmentOverrides.$inferSelect;
export type NewFitmentOverride = typeof fitmentOverrides.$inferInsert;

export type FitmentImportJob = typeof fitmentImportJobs.$inferSelect;
export type NewFitmentImportJob = typeof fitmentImportJobs.$inferInsert;

export type ModificationAlias = typeof modificationAliases.$inferSelect;
export type NewModificationAlias = typeof modificationAliases.$inferInsert;

export type EmailCampaign = typeof emailCampaigns.$inferSelect;
export type NewEmailCampaign = typeof emailCampaigns.$inferInsert;

export type EmailCampaignRecipient = typeof emailCampaignRecipients.$inferSelect;
export type NewEmailCampaignRecipient = typeof emailCampaignRecipients.$inferInsert;

export type EmailCampaignEvent = typeof emailCampaignEvents.$inferSelect;
export type NewEmailCampaignEvent = typeof emailCampaignEvents.$inferInsert;
