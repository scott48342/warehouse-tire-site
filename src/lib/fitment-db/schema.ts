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
 *   wheel_size_trim_mappings - Used for trimâ†’configuration matching
 *   wheel_size_configurations - Size/wheel configs linked to trim mappings
 * 
 * âš ï¸ CONSOLIDATION GUARD:
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
import { isNull, sql, type SQL } from "drizzle-orm";

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// CANONICAL RUNTIME TABLE
// This is THE source of truth for all customer-facing fitment resolution.
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

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
    /** Set when a row is pulled from service (bad/phantom data). Public API + resolvers must filter `IS NULL`. */
    quarantinedAt: timestamp("quarantined_at", { mode: "date" }),
    /**
     * Per-field verification (audit Pass 2/3). Tire sizes and wheel/bolt/offset are verified by
     * different sources at different times. `*_source` is INTERNAL provenance â€” never expose publicly.
     */
    tireSizesVerifiedAt: timestamp("tire_sizes_verified_at", { mode: "date", withTimezone: true }),
    tireSizesSource: varchar("tire_sizes_source", { length: 40 }),
    tireSizesConfidence: varchar("tire_sizes_confidence", { length: 10 }),
    tireSizesPrev: json("tire_sizes_prev"),
    tireSizesNeedsTrimSplit: boolean("tire_sizes_needs_trim_split").default(false),
    wheelSpecsVerifiedAt: timestamp("wheel_specs_verified_at", { mode: "date", withTimezone: true }),
    wheelSpecsSource: varchar("wheel_specs_source", { length: 40 }),
    wheelSpecsConfidence: varchar("wheel_specs_confidence", { length: 10 }),
    /**
     * Service specs from OE placard / Tire Guide prints (migration 0049). Customer-facing:
     * torque on the wheel PDP, recommended cold pressure on the tire PDP.
     */
    lugTorqueFtlb: integer("lug_torque_ftlb"),
    tirePressureFrontPsi: integer("tire_pressure_front_psi"),
    tirePressureRearPsi: integer("tire_pressure_rear_psi"),
    oemLoadIndex: integer("oem_load_index"),
    /** OE tire speed symbol for the primary size (e.g. "H", "V", "(Y)"). Migration 0050. ALWAYS US AutoForce-sourced, including on tireguide-pro rows (filled 2026-09-17 only where USAF LI agreed exactly). */
    oemSpeedRating: varchar("oem_speed_rating", { length: 4 }),
    /** Provenance for oem_load_index / oem_speed_rating: 'tireguide-pro' | 'usaf' | 'usaf-max' (conflict resolved to the higher LI). INTERNAL - never expose. */
    loadIndexSource: varchar("load_index_source", { length: 40 }),
    loadIndexVerifiedAt: timestamp("load_index_verified_at", { mode: "date", withTimezone: true }),
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

/**
 * Runtime read guard: exclude soft-deleted (quarantined) vehicle_fitments rows.
 *
 * Every customer-facing / resolver read of `vehicleFitments` MUST include this in its WHERE.
 * Admin audit, import, and repair tooling intentionally sees all rows and should NOT use it.
 *
 * Drizzle usage:  `.where(and(eq(...), notQuarantined()))`
 * Raw SQL usage:  `WHERE ... AND ${NOT_QUARANTINED_SQL}` (string) or `${notQuarantinedSql()}` (sql tag)
 */
export function notQuarantined(): SQL {
  return isNull(vehicleFitments.quarantinedAt);
}

/** Raw-SQL fragment for hand-written queries against `vehicle_fitments` (optionally table-aliased). */
export function notQuarantinedSqlText(alias?: string): string {
  return alias ? `${alias}.quarantined_at IS NULL` : `quarantined_at IS NULL`;
}

/** Same fragment for drizzle `sql` template queries. */
export function notQuarantinedSql(): SQL {
  return sql`quarantined_at IS NULL`;
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// DEPRECATED TABLE - ADMIN USE ONLY
// DO NOT import this in customer-facing code paths.
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

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

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// TRIM MAPPING TABLES (Phase 2 Resolution)
// Used for Wheel-Size.com trimâ†’configuration matching
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

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

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// FITMENT OVERRIDE TABLE
// Per-vehicle corrections applied after base resolution
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

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

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// MODIFICATION ALIASES (maps requested modificationId to canonical modificationId)
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

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

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// FITMENT SOURCE RECORDS (tracks where fitment data came from)
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

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

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// FITMENT IMPORT JOBS (tracks bulk import job status)
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

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

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// RESEARCHED FITMENT CACHE (caches AI-researched fitment data)
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

export const researchedFitmentCache = pgTable(
  "researched_fitment_cache",
  {
    id: serial("id").primaryKey(),
    
    // Vehicle key: year|make|model|trim (normalized lowercase)
    vehicleKey: varchar("vehicle_key", { length: 255 }).notNull().unique(),
    
    // Parsed components for querying
    year: integer("year").notNull(),
    make: varchar("make", { length: 100 }).notNull(),
    model: varchar("model", { length: 100 }).notNull(),
    trim: varchar("trim", { length: 100 }),
    
    // The researched fitment data (JSON)
    fitment: json("fitment").notNull(),
    
    // Research metadata
    confidence: varchar("confidence", { length: 20 }).notNull(), // high, medium, low
    sourcesUsed: json("sources_used").notNull(), // string[]
    
    // Timestamps
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
    lastUsedAt: timestamp("last_used_at", { mode: "date" }).notNull().defaultNow(),
    
    // Usage tracking
    useCount: integer("use_count").notNull().default(1),
    
    // Status: active, stale, promoted, rejected
    status: varchar("status", { length: 20 }).notNull().default("active"),
    staleAt: timestamp("stale_at", { mode: "date" }), // When this cache entry becomes stale
    
    // Admin workflow
    promotedAt: timestamp("promoted_at", { mode: "date" }),
    promotedBy: varchar("promoted_by", { length: 100 }),
    rejectedAt: timestamp("rejected_at", { mode: "date" }),
    rejectedBy: varchar("rejected_by", { length: 100 }),
    rejectionReason: text("rejection_reason"),
  },
  (table) => ({
    vehicleKeyIdx: index("rfc_vehicle_key_idx").on(table.vehicleKey),
    statusIdx: index("rfc_status_idx").on(table.status),
    yearMakeModelIdx: index("rfc_ymm_idx").on(table.year, table.make, table.model),
    useCountIdx: index("rfc_use_count_idx").on(table.useCount),
    staleAtIdx: index("rfc_stale_at_idx").on(table.staleAt),
  })
);

export type ResearchedFitmentCacheRecord = typeof researchedFitmentCache.$inferSelect;
export type NewResearchedFitmentCacheRecord = typeof researchedFitmentCache.$inferInsert;

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// EMAIL CAMPAIGN TABLES (re-exported from schema-email.ts)
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

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
  cartRecoveryConsents,
  type CartRecoveryConsent,
  type NewCartRecoveryConsent,
  checkoutDiagnostics,
  type CheckoutDiagnostic,
  type NewCheckoutDiagnostic,
} from "./schema-email";

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// IMAGE CACHE TABLES (re-exported from schema-images.ts)
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

export {
  tireImages,
  kmImageMappings,
  type TireImage,
  type NewTireImage,
  type KmImageMapping,
  type NewKmImageMapping,
} from "./schema-images";

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// CATALOG TABLES (re-exported from schema-catalog.ts)
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

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

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// CAMPAIGN DISCOUNTS (re-exported from schema-campaign-discounts.ts)
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

export {
  campaignDiscounts,
  type CampaignDiscount,
  type NewCampaignDiscount,
} from "./schema-campaign-discounts";

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// LEAD CAPTURE TABLES (re-exported from schema-leads.ts)
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

export {
  leads,
  jakeBuilds,
  type Lead,
  type NewLead,
  type JakeBuild,
  type NewJakeBuild,
  type LeadSourceStats,
  type LeadFunnelStats,
} from "./schema-leads";

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// BUILD GALLERY TABLES (re-exported from schema-gallery.ts)
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

export {
  galleryBuilds,
  BUILD_STYLES,
  generateBuildSlug,
  buildToJakeContext,
  type GalleryBuild,
  type NewGalleryBuild,
  type BuildStyle,
  type JakeBuildContext,
} from "./schema-gallery";

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// EMPLOYMENT APPLICATIONS (re-exported from schema-employment.ts)
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

export {
  employmentApplications,
  type EmploymentApplication,
  type NewEmploymentApplication,
} from "./schema-employment";

