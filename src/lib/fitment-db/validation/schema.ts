/**
 * Validation Database Schema
 * 
 * Tables for storing production fitment validation results
 */

import {
  pgTable,
  uuid,
  varchar,
  integer,
  text,
  timestamp,
  boolean,
  jsonb,
  index,
} from "drizzle-orm/pg-core";

// ============================================================================
// validation_runs - A batch validation run (e.g., "test all Dodge")
// ============================================================================

export const validationRuns = pgTable(
  "validation_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    
    // Run metadata
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    
    // Filter criteria used for this run
    filterYear: integer("filter_year"),
    filterMake: varchar("filter_make", { length: 100 }),
    filterModel: varchar("filter_model", { length: 100 }),
    filterBoltPattern: varchar("filter_bolt_pattern", { length: 20 }),
    
    // Status
    status: varchar("status", { length: 20 }).notNull().default("pending"),
    // pending | running | completed | failed
    
    // Aggregate stats
    totalVehicles: integer("total_vehicles").default(0),
    passCount: integer("pass_count").default(0),
    failCount: integer("fail_count").default(0),
    partialCount: integer("partial_count").default(0),
    
    // Staggered stats
    staggeredApplicableCount: integer("staggered_applicable_count").default(0),
    staggeredPassCount: integer("staggered_pass_count").default(0),
    staggeredFailCount: integer("staggered_fail_count").default(0),
    
    // Timing
    startedAt: timestamp("started_at"),
    completedAt: timestamp("completed_at"),
    durationMs: integer("duration_ms"),
    
    // Error info if run failed
    errorMessage: text("error_message"),
    
    // Run configuration
    includeLifted: boolean("include_lifted").default(true),
    concurrency: integer("concurrency").default(1),
    
    createdAt: timestamp("created_at").notNull().defaultNow(),
    createdBy: varchar("created_by", { length: 100 }),
  },
  (table) => ({
    statusIdx: index("validation_runs_status_idx").on(table.status),
    createdAtIdx: index("validation_runs_created_at_idx").on(table.createdAt),
  })
);

// ============================================================================
// validation_results - Individual vehicle validation results
// ============================================================================

export const validationResults = pgTable(
  "validation_results",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    runId: uuid("run_id").notNull().references(() => validationRuns.id, { onDelete: "cascade" }),
    
    // Vehicle identity
    year: integer("year").notNull(),
    make: varchar("make", { length: 100 }).notNull(),
    model: varchar("model", { length: 100 }).notNull(),
    trim: varchar("trim", { length: 255 }),
    modificationId: varchar("modification_id", { length: 255 }),
    
    // Overall result
    status: varchar("status", { length: 20 }).notNull(), // pass | fail | partial
    
    // Standard flow results
    standardTireSizeCount: integer("standard_tire_size_count").default(0),
    standardWheelCount: integer("standard_wheel_count").default(0),
    standardTireCount: integer("standard_tire_count").default(0),
    standardPackageCount: integer("standard_package_count").default(0),
    standardBoltPattern: varchar("standard_bolt_pattern", { length: 20 }),
    standardSource: varchar("standard_source", { length: 50 }),
    
    // Lifted flow results
    liftedEnabled: boolean("lifted_enabled").default(false),
    liftedPresetId: varchar("lifted_preset_id", { length: 20 }),
    liftedTireSizeCount: integer("lifted_tire_size_count").default(0),
    liftedWheelCount: integer("lifted_wheel_count").default(0),
    liftedTireCount: integer("lifted_tire_count").default(0),
    liftedPackageCount: integer("lifted_package_count").default(0),
    
    // Staggered flow results
    staggeredApplicable: boolean("staggered_applicable").default(false),
    staggeredStatus: varchar("staggered_status", { length: 20 }), // pass | fail | skipped
    staggeredFrontTireCount: integer("staggered_front_tire_count").default(0),
    staggeredRearTireCount: integer("staggered_rear_tire_count").default(0),
    staggeredWheelCount: integer("staggered_wheel_count").default(0),
    staggeredPackageCount: integer("staggered_package_count").default(0),
    staggeredFrontSize: varchar("staggered_front_size", { length: 50 }),
    staggeredRearSize: varchar("staggered_rear_size", { length: 50 }),
    
    // Failure details
    failureType: varchar("failure_type", { length: 50 }),
    // no_tire_sizes | no_wheels | no_tires | no_packages | api_error | 
    // no_bolt_pattern | lifted_no_profile | lifted_no_wheels | etc.
    failureReason: text("failure_reason"),
    
    // Full diagnostic data
    diagnostics: jsonb("diagnostics").default({}),
    // {
    //   tireSizesResponse: {...},
    //   wheelsResponse: {...},
    //   tiresResponse: {...},
    //   packagesResponse: {...},
    //   liftedContext: {...},
    //   errors: [...],
    //   timings: {...}
    // }
    
    // Timing
    durationMs: integer("duration_ms"),
    testedAt: timestamp("tested_at").notNull().defaultNow(),
  },
  (table) => ({
    runIdIdx: index("validation_results_run_id_idx").on(table.runId),
    statusIdx: index("validation_results_status_idx").on(table.status),
    vehicleIdx: index("validation_results_vehicle_idx").on(
      table.year,
      table.make,
      table.model
    ),
    failureTypeIdx: index("validation_results_failure_type_idx").on(table.failureType),
  })
);

// TypeScript types
export type ValidationRun = typeof validationRuns.$inferSelect;
export type NewValidationRun = typeof validationRuns.$inferInsert;
export type ValidationResult = typeof validationResults.$inferSelect;
export type NewValidationResult = typeof validationResults.$inferInsert;
