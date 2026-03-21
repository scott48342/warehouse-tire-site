/**
 * Fitment Database Schema (Drizzle ORM)
 * 
 * Tables:
 * - fitment_source_records: Raw API responses for debugging
 * - vehicle_fitments: Normalized fitment data for runtime
 * - fitment_overrides: Manual corrections
 * - fitment_import_jobs: Batch import tracking
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
// Type exports for Drizzle
// ============================================================================

export type FitmentSourceRecord = typeof fitmentSourceRecords.$inferSelect;
export type NewFitmentSourceRecord = typeof fitmentSourceRecords.$inferInsert;

export type VehicleFitment = typeof vehicleFitments.$inferSelect;
export type NewVehicleFitment = typeof vehicleFitments.$inferInsert;

export type FitmentOverride = typeof fitmentOverrides.$inferSelect;
export type NewFitmentOverride = typeof fitmentOverrides.$inferInsert;

export type FitmentImportJob = typeof fitmentImportJobs.$inferSelect;
export type NewFitmentImportJob = typeof fitmentImportJobs.$inferInsert;
