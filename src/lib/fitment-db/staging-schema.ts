/**
 * Fitment Staging Schema
 * 
 * Holds newly discovered fitment data in quarantine until validated
 * and promoted to production. Prevents unvalidated data from entering
 * live fitment tables.
 * 
 * Tables:
 * - fitment_staging: Raw discovered records awaiting validation
 * - fitment_staging_audit: Validation results per record
 * - fitment_change_log: History of promotions/rejections
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
  pgEnum,
} from "drizzle-orm/pg-core";

// ═══════════════════════════════════════════════════════════════════════════
// ENUMS
// ═══════════════════════════════════════════════════════════════════════════

export const stagingStatusEnum = pgEnum("staging_status", [
  "pending",      // Awaiting validation
  "validated",    // Passed validation, ready for promotion
  "flagged",      // Failed validation, needs review
  "promoted",     // Successfully moved to production
  "rejected",     // Manually rejected after review
  "superseded",   // Replaced by newer discovery
]);

export const changeActionEnum = pgEnum("change_action", [
  "discovered",   // New record found
  "validated",    // Passed validation
  "flagged",      // Failed validation
  "promoted",     // Moved to production
  "rejected",     // Rejected after review
  "updated",      // Production record updated
]);

// ═══════════════════════════════════════════════════════════════════════════
// fitment_staging - Quarantine for new fitment data
// ═══════════════════════════════════════════════════════════════════════════

export const fitmentStaging = pgTable(
  "fitment_staging",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    
    // Vehicle identity
    year: integer("year").notNull(),
    make: varchar("make", { length: 100 }).notNull(),
    model: varchar("model", { length: 100 }).notNull(),
    rawTrim: varchar("raw_trim", { length: 255 }),
    displayTrim: varchar("display_trim", { length: 255 }),
    submodel: varchar("submodel", { length: 255 }),
    modificationId: varchar("modification_id", { length: 255 }),
    
    // Source tracking
    source: varchar("source", { length: 50 }).notNull(),
    sourceRecordId: varchar("source_record_id", { length: 255 }),
    sourceChecksum: varchar("source_checksum", { length: 64 }),
    
    // Wheel specifications
    boltPattern: varchar("bolt_pattern", { length: 20 }),
    centerBoreMm: decimal("center_bore_mm", { precision: 5, scale: 1 }),
    threadSize: varchar("thread_size", { length: 20 }),
    seatType: varchar("seat_type", { length: 20 }),
    offsetMinMm: decimal("offset_min_mm", { precision: 5, scale: 2 }),
    offsetMaxMm: decimal("offset_max_mm", { precision: 5, scale: 2 }),
    oemWheelSizes: jsonb("oem_wheel_sizes").default([]),
    
    // Tire specifications
    oemTireSizes: jsonb("oem_tire_sizes").default([]),
    
    // Full raw payload for debugging
    rawPayload: jsonb("raw_payload"),
    
    // Pipeline status
    status: stagingStatusEnum("status").notNull().default("pending"),
    confidence: varchar("confidence", { length: 20 }).default("unknown"),
    
    // Validation results (populated by validation pipeline)
    validationPassed: boolean("validation_passed"),
    validationFlags: jsonb("validation_flags").default([]),
    validationNotes: text("validation_notes"),
    
    // Reference to existing production record if this is an update
    existingFitmentId: uuid("existing_fitment_id"),
    isUpdate: boolean("is_update").default(false),
    
    // Timestamps
    discoveredAt: timestamp("discovered_at").notNull().defaultNow(),
    validatedAt: timestamp("validated_at"),
    promotedAt: timestamp("promoted_at"),
    reviewedBy: varchar("reviewed_by", { length: 100 }),
    reviewedAt: timestamp("reviewed_at"),
  },
  (table) => ({
    // Unique: one staged record per source + source_id
    sourceUniqueIdx: uniqueIndex("fitment_staging_source_unique_idx").on(
      table.source,
      table.sourceRecordId
    ),
    // Fast lookup by status
    statusIdx: index("fitment_staging_status_idx").on(table.status),
    // Fast lookup by year
    yearIdx: index("fitment_staging_year_idx").on(table.year),
    // Fast lookup by vehicle
    vehicleIdx: index("fitment_staging_vehicle_idx").on(
      table.year,
      table.make,
      table.model
    ),
  })
);

// ═══════════════════════════════════════════════════════════════════════════
// fitment_staging_audit - Detailed validation results
// ═══════════════════════════════════════════════════════════════════════════

export const fitmentStagingAudit = pgTable(
  "fitment_staging_audit",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    stagingId: uuid("staging_id").notNull().references(() => fitmentStaging.id),
    
    // Validation run info
    runId: uuid("run_id").notNull(), // Groups all audits from same run
    runTimestamp: timestamp("run_timestamp").notNull().defaultNow(),
    
    // Check results
    checkName: varchar("check_name", { length: 100 }).notNull(),
    checkPassed: boolean("check_passed").notNull(),
    checkSeverity: varchar("check_severity", { length: 20 }).notNull(), // error, warning, info
    checkMessage: text("check_message"),
    checkDetails: jsonb("check_details"),
  },
  (table) => ({
    stagingIdIdx: index("fitment_staging_audit_staging_idx").on(table.stagingId),
    runIdIdx: index("fitment_staging_audit_run_idx").on(table.runId),
  })
);

// ═══════════════════════════════════════════════════════════════════════════
// fitment_change_log - History of all pipeline actions
// ═══════════════════════════════════════════════════════════════════════════

export const fitmentChangeLog = pgTable(
  "fitment_change_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    
    // What changed
    stagingId: uuid("staging_id").references(() => fitmentStaging.id),
    productionFitmentId: uuid("production_fitment_id"),
    
    // Action taken
    action: changeActionEnum("action").notNull(),
    
    // Context
    year: integer("year"),
    make: varchar("make", { length: 100 }),
    model: varchar("model", { length: 100 }),
    trim: varchar("trim", { length: 255 }),
    
    // Details
    previousData: jsonb("previous_data"),
    newData: jsonb("new_data"),
    reason: text("reason"),
    
    // Who/when
    actor: varchar("actor", { length: 100 }).default("pipeline"),
    timestamp: timestamp("timestamp").notNull().defaultNow(),
  },
  (table) => ({
    stagingIdIdx: index("fitment_change_log_staging_idx").on(table.stagingId),
    actionIdx: index("fitment_change_log_action_idx").on(table.action),
    timestampIdx: index("fitment_change_log_timestamp_idx").on(table.timestamp),
  })
);

// ═══════════════════════════════════════════════════════════════════════════
// fitment_pipeline_runs - Track pipeline execution history
// ═══════════════════════════════════════════════════════════════════════════

export const fitmentPipelineRuns = pgTable(
  "fitment_pipeline_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    
    // Run info
    runType: varchar("run_type", { length: 50 }).notNull(), // discovery, validation, promotion
    targetYear: integer("target_year"),
    
    // Timing
    startedAt: timestamp("started_at").notNull().defaultNow(),
    completedAt: timestamp("completed_at"),
    durationMs: integer("duration_ms"),
    
    // Results summary
    recordsDiscovered: integer("records_discovered").default(0),
    recordsValidated: integer("records_validated").default(0),
    recordsFlagged: integer("records_flagged").default(0),
    recordsPromoted: integer("records_promoted").default(0),
    recordsRejected: integer("records_rejected").default(0),
    recordsSkipped: integer("records_skipped").default(0),
    
    // Status
    status: varchar("status", { length: 20 }).notNull().default("running"),
    errorMessage: text("error_message"),
    
    // Full summary (JSON)
    summary: jsonb("summary"),
  },
  (table) => ({
    runTypeIdx: index("fitment_pipeline_runs_type_idx").on(table.runType),
    startedAtIdx: index("fitment_pipeline_runs_started_idx").on(table.startedAt),
  })
);

// ═══════════════════════════════════════════════════════════════════════════
// Type exports
// ═══════════════════════════════════════════════════════════════════════════

export type FitmentStaging = typeof fitmentStaging.$inferSelect;
export type NewFitmentStaging = typeof fitmentStaging.$inferInsert;
export type FitmentStagingAudit = typeof fitmentStagingAudit.$inferSelect;
export type FitmentChangeLog = typeof fitmentChangeLog.$inferSelect;
export type FitmentPipelineRun = typeof fitmentPipelineRuns.$inferSelect;
