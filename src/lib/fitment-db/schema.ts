/**
 * Drizzle schema for vehicle fitment database
 * 
 * TABLE ARCHITECTURE (2026-05-13):
 * ================================
 * 
 * CANONICAL RUNTIME TABLE:
 *   vehicle_fitments - Single source of truth for ALL customer-facing fitment resolution
 * 
 * DEPRECATED (ADMIN ONLY):
 *   vehicle_fitment_configurations - Legacy config-based approach. DO NOT USE IN RUNTIME.
 *                                    Only accessible via /api/admin/* endpoints for data review.
 * 
 * AUDIT/ENRICHMENT SOURCES:
 *   wheel_size_trim_mappings - Used for trim→configuration matching
 *   wheel_size_configurations - Size/wheel configs linked to trim mappings
 * 
 * ⚠️ CONSOLIDATION GUARD:
 * If you're adding a new customer-facing endpoint that needs fitment data,
 * ONLY import and use `vehicleFitments`. Never read from `vehicleFitmentConfigurations`
 * in runtime code paths. Use the canonicalResolver for all fitment identity resolution.
 */

import {
  pgTable,
  serial,
  text,
  integer,
  varchar,
  timestamp,
  json,
  boolean,
  decimal,
  uuid,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// ════════════════════════════════════════════════════════════════════════════════
// CANONICAL RUNTIME TABLE
// This is THE source of truth for all customer-facing fitment resolution.
// ════════════════════════════════════════════════════════════════════════════════

/**
 * vehicle_fitments - CANONICAL fitment table
 * 
 * Used by:
 * - /api/vehicles/trims
 * - /api/vehicles/tire-sizes
 * - /api/vehicles/makes
 * - /api/vehicles/models
 * - /api/wheels/fitment-search
 * - /api/tires/search
 * - canonicalResolver.ts
 * - coverage.ts
 * 
 * NEVER use vehicleFitmentConfigurations for customer-facing resolution.
 */
export const vehicleFitments = pgTable(
  "vehicle_fitments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    year: integer("year").notNull(),
    make: varchar("make", { length: 100 }).notNull(),
    model: varchar("model", { length: 200 }).notNull(),
    rawTrim: text("raw_trim"),
    displayTrim: text("display_trim").notNull(),
    submodel: text("submodel"),
    modificationId: text("modification_id").notNull(),
    boltPattern: varchar("bolt_pattern", { length: 50 }),
    centerBoreMm: decimal("center_bore_mm", { precision: 5, scale: 2 }),
    threadSize: varchar("thread_size", { length: 50 }),
    seatType: varchar("seat_type", { length: 50 }),
    offsetMinMm: integer("offset_min_mm"),
    offsetMaxMm: integer("offset_max_mm"),
    oemWheelSizes: json("oem_wheel_sizes"),
    oemTireSizes: json("oem_tire_sizes"),
    source: varchar("source", { length: 100 }),
    qualityTier: varchar("quality_tier", { length: 20 }),
    certificationStatus: varchar("certification_status", { length: 50 }).default("certified"),
    /**
     * Data quality indicator for admin/audit (no runtime behavior change)
     * - HIGH: Complete OEM specs from verified sources
     * - MEDIUM: Partial data, some fields inferred
     * - LOW: Needs manual review
     */
    confidenceTag: varchar("confidence_tag", { length: 20 }).default("MEDIUM"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
  },
  (table) => ({
    yearMakeModelIdx: index("vehicle_fitments_ymm_idx").on(
      table.year,
      table.make,
      table.model
    ),
    yearMakeIdx: index("vehicle_fitments_ym_idx").on(table.year, table.make),
    makeIdx: index("vehicle_fitments_make_idx").on(table.make),
    modificationIdIdx: index("vehicle_fitments_mod_id_idx").on(table.modificationId),
    boltPatternIdx: index("vehicle_fitments_bolt_pattern_idx").on(table.boltPattern),
    confidenceIdx: index("vehicle_fitments_confidence_idx").on(table.confidenceTag),
  })
);

export type VehicleFitment = typeof vehicleFitments.$inferSelect;
export type NewVehicleFitment = typeof vehicleFitments.$inferInsert;

// ════════════════════════════════════════════════════════════════════════════════
// DEPRECATED TABLE - ADMIN USE ONLY
// DO NOT import this in customer-facing code paths.
// ════════════════════════════════════════════════════════════════════════════════

/**
 * @deprecated DO NOT USE IN RUNTIME CODE
 * 
 * This table is kept for:
 * - Admin data review (/api/admin/fitment/config-enrichment)
 * - Historical reference
 * - Migration tooling
 * 
 * It will be dropped in a future release once all data is migrated to vehicle_fitments.
 * 
 * If you need fitment data for customer-facing code, use:
 * - `vehicleFitments` table directly
 * - `resolveVehicleFitment()` from canonicalResolver.ts
 * - `getTrimsWithCoverage()` / `getModelsWithCoverage()` from coverage.ts
 */
export const vehicleFitmentConfigurations = pgTable(
  "vehicle_fitment_configurations",
  {
    // SCHEMA MATCHES ACTUAL DB (2026-05-13 introspection)
    id: uuid("id").primaryKey().defaultRandom(),
    vehicleFitmentId: uuid("vehicle_fitment_id"),
    year: integer("year").notNull(),
    makeKey: varchar("make_key", { length: 100 }).notNull(),
    modelKey: varchar("model_key", { length: 200 }).notNull(),
    modificationId: varchar("modification_id", { length: 255 }),
    displayTrim: varchar("display_trim", { length: 200 }),
    configurationKey: varchar("configuration_key", { length: 100 }).notNull(),
    configurationLabel: varchar("configuration_label", { length: 200 }),
    wheelDiameter: integer("wheel_diameter").notNull(),
    wheelWidth: decimal("wheel_width", { precision: 4, scale: 1 }),
    wheelOffsetMm: decimal("wheel_offset_mm", { precision: 5, scale: 1 }),
    tireSize: varchar("tire_size", { length: 50 }).notNull(),
    axlePosition: varchar("axle_position", { length: 20 }).notNull(),
    isDefault: boolean("is_default").notNull().default(false),
    isOptional: boolean("is_optional").notNull().default(false),
    source: varchar("source", { length: 100 }).notNull(),
    sourceConfidence: varchar("source_confidence", { length: 50 }).notNull(),
    sourceNotes: text("source_notes"),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => ({
    ymmIdx: index("vfc_ymm_idx").on(
      table.year,
      table.makeKey,
      table.modelKey
    ),
    trimIdx: index("vfc_trim_idx").on(table.displayTrim),
  })
);

export type VehicleFitmentConfiguration = typeof vehicleFitmentConfigurations.$inferSelect;
export type NewVehicleFitmentConfiguration = typeof vehicleFitmentConfigurations.$inferInsert;

// ════════════════════════════════════════════════════════════════════════════════
// TRIM MAPPING TABLES (Phase 2 Resolution)
// Used for Wheel-Size.com trim→configuration matching
// ════════════════════════════════════════════════════════════════════════════════

/**
 * wheel_size_trim_mappings - Links our trims to Wheel-Size.com configurations
 */
export const wheelSizeTrimMappings = pgTable(
  "wheel_size_trim_mappings",
  {
    // SCHEMA MATCHES ACTUAL DB (2026-05-13 introspection)
    id: uuid("id").primaryKey().defaultRandom(),
    year: integer("year").notNull(),
    make: varchar("make", { length: 100 }).notNull(),
    model: varchar("model", { length: 200 }).notNull(),
    ourTrim: varchar("our_trim", { length: 200 }).notNull(),
    ourModificationId: varchar("our_modification_id", { length: 255 }),
    vehicleFitmentId: uuid("vehicle_fitment_id"),
    wsSlug: varchar("ws_slug", { length: 200 }).notNull(),
    wsGeneration: varchar("ws_generation", { length: 200 }),
    wsModificationName: varchar("ws_modification_name", { length: 200 }),
    wsSubmodel: varchar("ws_submodel", { length: 200 }),
    wsTrim: varchar("ws_trim", { length: 200 }),
    wsEngine: text("ws_engine"),
    wsBody: varchar("ws_body", { length: 100 }),
    matchMethod: varchar("match_method", { length: 50 }).notNull(),
    matchConfidence: varchar("match_confidence", { length: 20 }).notNull(),
    matchScore: decimal("match_score", { precision: 5, scale: 2 }),
    configCount: integer("config_count").notNull(),
    hasSingleConfig: boolean("has_single_config").notNull(),
    defaultConfigId: uuid("default_config_id"),
    defaultWheelDiameter: integer("default_wheel_diameter"),
    defaultTireSize: varchar("default_tire_size", { length: 50 }),
    allWheelDiameters: json("all_wheel_diameters").$type<number[]>(),
    allTireSizes: json("all_tire_sizes").$type<string[]>(),
    needsReview: boolean("needs_review").notNull().default(false),
    reviewReason: varchar("review_reason", { length: 200 }),
    reviewPriority: integer("review_priority"),
    reviewedBy: varchar("reviewed_by", { length: 100 }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewNotes: text("review_notes"),
    status: varchar("status", { length: 20 }).notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    ymmTrimIdx: uniqueIndex("wstm_ymm_trim_idx").on(
      table.year,
      table.make,
      table.model,
      table.ourTrim
    ),
    statusIdx: index("wstm_status_idx").on(table.status),
  })
);

export type WheelSizeTrimMapping = typeof wheelSizeTrimMappings.$inferSelect;
export type NewWheelSizeTrimMapping = typeof wheelSizeTrimMappings.$inferInsert;

/**
 * wheel_size_configurations - Wheel/tire configurations linked to trim mappings
 */
export const wheelSizeConfigurations = pgTable(
  "wheel_size_configurations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    mappingId: uuid("mapping_id").notNull().references(() => wheelSizeTrimMappings.id, { onDelete: "cascade" }),
    wheelDiameter: integer("wheel_diameter").notNull(),
    wheelWidth: decimal("wheel_width", { precision: 4, scale: 1 }),
    tireSize: varchar("tire_size", { length: 50 }).notNull(),
    isOem: boolean("is_oem").default(true),
    isFrontAxle: boolean("is_front_axle").default(true),
    isDefault: boolean("is_default").default(false),
    sortOrder: integer("sort_order").default(0),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
  },
  (table) => ({
    mappingIdx: index("wsc_mapping_idx").on(table.mappingId),
    diameterIdx: index("wsc_diameter_idx").on(table.wheelDiameter),
  })
);

export type WheelSizeConfiguration = typeof wheelSizeConfigurations.$inferSelect;
export type NewWheelSizeConfiguration = typeof wheelSizeConfigurations.$inferInsert;

// ════════════════════════════════════════════════════════════════════════════════
// FITMENT OVERRIDE TABLE
// Per-vehicle corrections applied after base resolution
// ════════════════════════════════════════════════════════════════════════════════

export const fitmentOverrides = pgTable(
  "fitment_overrides",
  {
    // SCHEMA MATCHES ACTUAL DB (2026-05-13 introspection)
    id: uuid("id").primaryKey().defaultRandom(),
    scope: varchar("scope", { length: 50 }),
    year: integer("year"),
    make: varchar("make", { length: 100 }),
    model: varchar("model", { length: 200 }),
    modificationId: varchar("modification_id", { length: 255 }),
    displayTrim: varchar("display_trim", { length: 200 }),
    boltPattern: varchar("bolt_pattern", { length: 50 }),
    centerBoreMm: decimal("center_bore_mm", { precision: 5, scale: 2 }),
    threadSize: varchar("thread_size", { length: 50 }),
    seatType: varchar("seat_type", { length: 50 }),
    offsetMinMm: decimal("offset_min_mm", { precision: 5, scale: 1 }),
    offsetMaxMm: decimal("offset_max_mm", { precision: 5, scale: 1 }),
    reason: text("reason"),
    createdBy: varchar("created_by", { length: 100 }),
    active: boolean("active").default(true),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
  },
  (table) => ({
    ymmIdx: index("fo_ymm_idx").on(table.year, table.make, table.model),
    modIdIdx: index("fo_mod_id_idx").on(table.modificationId),
    activeIdx: index("fo_active_idx").on(table.active),
  })
);

export type FitmentOverride = typeof fitmentOverrides.$inferSelect;
export type NewFitmentOverride = typeof fitmentOverrides.$inferInsert;

// ════════════════════════════════════════════════════════════════════════════════
// MODIFICATION ALIASES (maps requested modificationId to canonical modificationId)
// ════════════════════════════════════════════════════════════════════════════════

export const modificationAliases = pgTable(
  "modification_aliases",
  {
    // NOTE: Table may not exist in DB - created for future use
    id: uuid("id").primaryKey().defaultRandom(),
    requestedModificationId: text("requested_modification_id").notNull(),
    canonicalModificationId: text("canonical_modification_id").notNull(),
    vehicleFitmentId: uuid("vehicle_fitment_id"),
    displayTrim: varchar("display_trim", { length: 200 }),
    year: integer("year"),
    make: varchar("make", { length: 100 }),
    model: varchar("model", { length: 200 }),
    source: varchar("source", { length: 100 }),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
  },
  (table) => ({
    requestedIdx: index("ma_requested_idx").on(table.requestedModificationId),
    canonicalIdx: index("ma_canonical_idx").on(table.canonicalModificationId),
  })
);

export type ModificationAlias = typeof modificationAliases.$inferSelect;
export type NewModificationAlias = typeof modificationAliases.$inferInsert;

// ════════════════════════════════════════════════════════════════════════════════
// FITMENT SOURCE RECORDS (tracks where fitment data came from)
// ════════════════════════════════════════════════════════════════════════════════

export const fitmentSourceRecords = pgTable(
  "fitment_source_records",
  {
    // SCHEMA MATCHES ACTUAL DB (2026-05-13 introspection)
    id: uuid("id").primaryKey().defaultRandom(),
    source: varchar("source", { length: 100 }).notNull(),
    sourceId: varchar("source_id", { length: 255 }),
    year: integer("year"),
    make: varchar("make", { length: 100 }),
    model: varchar("model", { length: 200 }),
    rawPayload: json("raw_payload"),
    fetchedAt: timestamp("fetched_at", { mode: "date" }).defaultNow(),
    checksum: varchar("checksum", { length: 64 }),
  },
  (table) => ({
    sourceIdx: index("fsr_source_idx").on(table.source),
  })
);

export type FitmentSourceRecord = typeof fitmentSourceRecords.$inferSelect;
export type NewFitmentSourceRecord = typeof fitmentSourceRecords.$inferInsert;

// ════════════════════════════════════════════════════════════════════════════════
// FITMENT IMPORT JOBS (tracks bulk import job status)
// ════════════════════════════════════════════════════════════════════════════════

export const fitmentImportJobs = pgTable(
  "fitment_import_jobs",
  {
    // SCHEMA MATCHES ACTUAL DB (2026-05-13 introspection)
    id: uuid("id").primaryKey().defaultRandom(),
    source: varchar("source", { length: 100 }).notNull(),
    yearStart: integer("year_start"),
    yearEnd: integer("year_end"),
    makes: json("makes"),
    status: varchar("status", { length: 50 }).notNull().default("pending"),
    totalRecords: integer("total_records").default(0),
    processedRecords: integer("processed_records").default(0),
    importedRecords: integer("imported_records").default(0),
    skippedRecords: integer("skipped_records").default(0),
    errorCount: integer("error_count").default(0),
    startedAt: timestamp("started_at", { mode: "date" }),
    completedAt: timestamp("completed_at", { mode: "date" }),
    lastError: text("last_error"),
    errorLog: json("error_log"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
  },
  (table) => ({
    statusIdx: index("fij_status_idx").on(table.status),
    sourceIdx: index("fij_source_idx").on(table.source),
  })
);

export type FitmentImportJob = typeof fitmentImportJobs.$inferSelect;
export type NewFitmentImportJob = typeof fitmentImportJobs.$inferInsert;

// ════════════════════════════════════════════════════════════════════════════════
// EMAIL CAMPAIGN TABLES (re-exported from schema-email.ts)
// ════════════════════════════════════════════════════════════════════════════════

export {
  emailCampaigns,
  emailCampaignRecipients,
  emailCampaignEvents,
  emailSubscribers,
  abandonedCarts,
  cartAddEvents,
  type EmailCampaign,
  type NewEmailCampaign,
  type EmailCampaignRecipient,
  type NewEmailCampaignRecipient,
  type EmailCampaignEvent,
  type NewEmailCampaignEvent,
  type EmailSubscriber,
  type NewEmailSubscriber,
  type AbandonedCart,
  type NewAbandonedCart,
  type CartAddEvent,
  type NewCartAddEvent,
} from "./schema-email";

// ════════════════════════════════════════════════════════════════════════════════
// IMAGE CACHE TABLES (re-exported from schema-images.ts)
// ════════════════════════════════════════════════════════════════════════════════

export {
  tireImages,
  kmImageMappings,
  type TireImage,
  type NewTireImage,
  type KmImageMapping,
  type NewKmImageMapping,
} from "./schema-images";

// ════════════════════════════════════════════════════════════════════════════════
// CATALOG TABLES (re-exported from schema-catalog.ts)
// ════════════════════════════════════════════════════════════════════════════════

export {
  catalogMakes,
  catalogModels,
  catalogSyncLog,
  manufacturerRebates,
  firstOrderDiscounts,
  competitorPageAnalysis,
  type CatalogMake,
  type NewCatalogMake,
  type CatalogModel,
  type NewCatalogModel,
  type CatalogSyncLog,
  type NewCatalogSyncLog,
  type ManufacturerRebate,
  type NewManufacturerRebate,
  type FirstOrderDiscount,
  type NewFirstOrderDiscount,
  type CompetitorPageAnalysis,
  type NewCompetitorPageAnalysis,
} from "./schema-catalog";

// ════════════════════════════════════════════════════════════════════════════════
// CAMPAIGN DISCOUNTS (re-exported from schema-campaign-discounts.ts)
// ════════════════════════════════════════════════════════════════════════════════

export {
  campaignDiscounts,
  type CampaignDiscount,
  type NewCampaignDiscount,
} from "./schema-campaign-discounts";
