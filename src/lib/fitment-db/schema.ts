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
    id: uuid("id").primaryKey().defaultRandom(),
    year: integer("year").notNull(),
    makeKey: varchar("make_key", { length: 100 }).notNull(),
    makeDisplay: varchar("make_display", { length: 100 }).notNull(),
    modelKey: varchar("model_key", { length: 200 }).notNull(),
    modelDisplay: varchar("model_display", { length: 200 }).notNull(),
    displayTrim: text("display_trim").notNull(),
    generation: varchar("generation", { length: 100 }),
    boltPattern: varchar("bolt_pattern", { length: 50 }),
    centerBoreMm: decimal("center_bore_mm", { precision: 5, scale: 2 }),
    threadSize: varchar("thread_size", { length: 50 }),
    seatType: varchar("seat_type", { length: 50 }),
    offsetMinMm: integer("offset_min_mm"),
    offsetMaxMm: integer("offset_max_mm"),
    wheelDiameter: integer("wheel_diameter").notNull(),
    wheelWidth: decimal("wheel_width", { precision: 4, scale: 1 }),
    tireSize: varchar("tire_size", { length: 50 }).notNull(),
    isOem: boolean("is_oem").default(true),
    isFrontAxle: boolean("is_front_axle").default(true),
    source: varchar("source", { length: 100 }),
    notes: text("notes"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
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
    id: uuid("id").primaryKey().defaultRandom(),
    year: integer("year").notNull(),
    makeKey: varchar("make_key", { length: 100 }).notNull(),
    modelKey: varchar("model_key", { length: 200 }).notNull(),
    ourDisplayTrim: text("our_display_trim").notNull(),
    ourModificationId: text("our_modification_id"),
    vehicleFitmentId: uuid("vehicle_fitment_id"),
    wheelSizeGeneration: varchar("wheel_size_generation", { length: 200 }),
    wheelSizeTrimName: text("wheel_size_trim_name"),
    wheelSizeModificationId: text("wheel_size_modification_id"),
    matchMethod: varchar("match_method", { length: 50 }),
    matchConfidence: varchar("match_confidence", { length: 20 }),
    status: varchar("status", { length: 20 }).default("pending"),
    reviewNotes: text("review_notes"),
    reviewedBy: varchar("reviewed_by", { length: 100 }),
    reviewedAt: timestamp("reviewed_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
  },
  (table) => ({
    ymmTrimIdx: uniqueIndex("wstm_ymm_trim_idx").on(
      table.year,
      table.makeKey,
      table.modelKey,
      table.ourDisplayTrim
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
    id: uuid("id").primaryKey().defaultRandom(),
    year: integer("year"),
    make: varchar("make", { length: 100 }),
    model: varchar("model", { length: 200 }),
    trim: text("trim"),
    modificationId: text("modification_id"),
    field: varchar("field", { length: 50 }).notNull(),
    value: json("value").notNull(),
    reason: text("reason"),
    source: varchar("source", { length: 100 }),
    expiresAt: timestamp("expires_at", { mode: "date" }),
    isActive: boolean("is_active").default(true),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
  },
  (table) => ({
    ymmIdx: index("fo_ymm_idx").on(table.year, table.make, table.model),
    modIdIdx: index("fo_mod_id_idx").on(table.modificationId),
    activeIdx: index("fo_active_idx").on(table.isActive),
  })
);

export type FitmentOverride = typeof fitmentOverrides.$inferSelect;
export type NewFitmentOverride = typeof fitmentOverrides.$inferInsert;
