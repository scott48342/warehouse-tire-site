/**
 * Classic Fitment Schema
 * 
 * COMPLETELY SEPARATE from vehicle_fitments.
 * Platform-based fitment for classic/muscle cars.
 * 
 * Design principles:
 * - No FK to vehicle_fitments
 * - Surgical rollback via batch_tag + is_active
 * - Confidence tiers with verification messaging
 * - Recommended ranges, not exact OEM specs
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
// classic_fitments - Platform-based fitment for vintage vehicles
// ============================================================================

export const classicFitments = pgTable(
  "classic_fitments",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // ─────────────────────────────────────────────────────────────────────────
    // Platform Identity (primary grouping)
    // ─────────────────────────────────────────────────────────────────────────
    platformCode: varchar("platform_code", { length: 50 }).notNull(),
    platformName: varchar("platform_name", { length: 100 }).notNull(),
    generationName: varchar("generation_name", { length: 100 }),

    // ─────────────────────────────────────────────────────────────────────────
    // Vehicle Coverage
    // ─────────────────────────────────────────────────────────────────────────
    make: varchar("make", { length: 100 }).notNull(),
    model: varchar("model", { length: 100 }).notNull(),
    yearStart: integer("year_start").notNull(),
    yearEnd: integer("year_end").notNull(),

    // ─────────────────────────────────────────────────────────────────────────
    // Fitment Classification
    // ─────────────────────────────────────────────────────────────────────────
    fitmentLevel: varchar("fitment_level", { length: 50 })
      .notNull()
      .default("classic-platform"),
    fitmentSource: varchar("fitment_source", { length: 100 }).notNull(),
    
    // NEW: Fitment style for UX differentiation
    fitmentStyle: varchar("fitment_style", { length: 50 })
      .notNull()
      .default("stock_baseline"),
    // Values: 'stock_baseline' | 'restomod_common' | 'big_brake_sensitive'

    // ─────────────────────────────────────────────────────────────────────────
    // Confidence & Verification
    // ─────────────────────────────────────────────────────────────────────────
    confidence: varchar("confidence", { length: 20 }).notNull(),
    // Values: 'high' | 'medium' | 'low'
    
    verificationNote: text("verification_note"),
    requiresClearanceCheck: boolean("requires_clearance_check").default(true),
    
    // Common modifications that affect fitment (for UX messaging)
    commonModifications: jsonb("common_modifications").$type<string[]>().default([]),

    // ─────────────────────────────────────────────────────────────────────────
    // Baseline Fitment Specs (stock reference)
    // ─────────────────────────────────────────────────────────────────────────
    commonBoltPattern: varchar("common_bolt_pattern", { length: 20 }).notNull(),
    commonCenterBore: decimal("common_center_bore", { precision: 5, scale: 1 }),
    commonThreadSize: varchar("common_thread_size", { length: 20 }),
    commonSeatType: varchar("common_seat_type", { length: 20 }),

    // ─────────────────────────────────────────────────────────────────────────
    // Recommended Wheel Ranges (not exact OEM)
    // ─────────────────────────────────────────────────────────────────────────
    recWheelDiameterMin: integer("rec_wheel_diameter_min"),
    recWheelDiameterMax: integer("rec_wheel_diameter_max"),
    recWheelWidthMin: decimal("rec_wheel_width_min", { precision: 4, scale: 1 }),
    recWheelWidthMax: decimal("rec_wheel_width_max", { precision: 4, scale: 1 }),
    recOffsetMinMm: integer("rec_offset_min_mm"),
    recOffsetMaxMm: integer("rec_offset_max_mm"),

    // ─────────────────────────────────────────────────────────────────────────
    // Stock Baseline Reference (for comparison/display)
    // ─────────────────────────────────────────────────────────────────────────
    stockWheelDiameter: integer("stock_wheel_diameter"),
    stockWheelWidth: decimal("stock_wheel_width", { precision: 4, scale: 1 }),
    stockTireSize: varchar("stock_tire_size", { length: 50 }),

    // ─────────────────────────────────────────────────────────────────────────
    // Modification Risk Assessment
    // ─────────────────────────────────────────────────────────────────────────
    modificationRisk: varchar("modification_risk", { length: 20 }).default("medium"),
    // Values: 'low' | 'medium' | 'high'

    // ─────────────────────────────────────────────────────────────────────────
    // Surgical Rollback Fields
    // ─────────────────────────────────────────────────────────────────────────
    batchTag: varchar("batch_tag", { length: 100 }).notNull(),
    version: integer("version").notNull().default(1),
    isActive: boolean("is_active").notNull().default(true),

    // ─────────────────────────────────────────────────────────────────────────
    // Metadata
    // ─────────────────────────────────────────────────────────────────────────
    notes: text("notes"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    // Primary lookup: platform + make + model
    platformMakeModelIdx: uniqueIndex("classic_fitments_platform_make_model_idx").on(
      table.platformCode,
      table.make,
      table.model
    ),
    // Fast lookup by platform
    platformIdx: index("classic_fitments_platform_idx").on(table.platformCode),
    // Lookup by make/model
    makeModelIdx: index("classic_fitments_make_model_idx").on(table.make, table.model),
    // Year range queries
    yearRangeIdx: index("classic_fitments_year_range_idx").on(
      table.yearStart,
      table.yearEnd
    ),
    // Batch rollback queries
    batchIdx: index("classic_fitments_batch_idx").on(table.batchTag),
    // Active records only
    activeIdx: index("classic_fitments_active_idx").on(table.isActive),
  })
);

// ============================================================================
// Type Exports
// ============================================================================

export type ClassicFitment = typeof classicFitments.$inferSelect;
export type NewClassicFitment = typeof classicFitments.$inferInsert;

// ============================================================================
// Fitment Style Values
// ============================================================================

export const FITMENT_STYLES = {
  STOCK_BASELINE: "stock_baseline",
  RESTOMOD_COMMON: "restomod_common",
  BIG_BRAKE_SENSITIVE: "big_brake_sensitive",
} as const;

export type FitmentStyle = (typeof FITMENT_STYLES)[keyof typeof FITMENT_STYLES];

// ============================================================================
// Confidence Levels
// ============================================================================

export const CONFIDENCE_LEVELS = {
  HIGH: "high",
  MEDIUM: "medium",
  LOW: "low",
} as const;

export type ConfidenceLevel = (typeof CONFIDENCE_LEVELS)[keyof typeof CONFIDENCE_LEVELS];

// ============================================================================
// Modification Risk Levels
// ============================================================================

export const MODIFICATION_RISK = {
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
} as const;

export type ModificationRisk = (typeof MODIFICATION_RISK)[keyof typeof MODIFICATION_RISK];
