/**
 * Visualizer Database Schema (Drizzle ORM)
 * 
 * Supports draft-first workflow for AI-generated vehicle assets
 */

import {
  pgTable,
  uuid,
  varchar,
  integer,
  text,
  boolean,
  jsonb,
  timestamp,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const visualizerConfigs = pgTable(
  "visualizer_configs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: varchar("slug", { length: 255 }).notNull().unique(),

    // Vehicle info
    year: integer("year"),
    make: varchar("make", { length: 100 }),
    model: varchar("model", { length: 100 }),
    category: varchar("category", { length: 50 }), // muscle, truck, suv, sedan, sports
    vehicle: varchar("vehicle", { length: 255 }).notNull(), // Display name

    // Asset
    image: varchar("image", { length: 500 }).notNull(),

    // Wheel positions
    frontWheel: jsonb("front_wheel").notNull(),
    rearWheel: jsonb("rear_wheel").notNull(),

    // Generation metadata
    source: varchar("source", { length: 50 }).default("manual"), // manual, ai_generated
    generationPrompt: text("generation_prompt"),
    version: integer("version").default(1),

    // Status workflow
    status: varchar("status", { length: 20 }).default("draft"), // draft, approved, rejected
    isActive: boolean("is_active").default(false),

    // Review
    reviewNotes: text("review_notes"),
    reviewedBy: varchar("reviewed_by", { length: 100 }),

    // Timestamps
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    approvedAt: timestamp("approved_at"),
  },
  (table) => ({
    slugIdx: uniqueIndex("visualizer_configs_slug_idx").on(table.slug),
  })
);

export type VisualizerConfig = typeof visualizerConfigs.$inferSelect;
export type NewVisualizerConfig = typeof visualizerConfigs.$inferInsert;
export type WheelPosition = { top: number; left: number; size: number };

/**
 * Wheel Style Assets - tracks which wheel models are visualizer-ready
 * 
 * One row per wheel STYLE (model), not per SKU.
 * A style like "Fuel Maverick D538" has many SKUs but shares one image orientation.
 */
export const wheelStyleAssets = pgTable(
  "wheel_style_assets",
  {
    // Primary key is the style key from techfeed
    styleKey: varchar("style_key", { length: 100 }).primaryKey(),
    
    // Wheel identification
    brandCode: varchar("brand_code", { length: 20 }),
    brand: varchar("brand", { length: 100 }),
    model: varchar("model", { length: 255 }),
    
    // Image info
    imageUrl: varchar("image_url", { length: 500 }),
    normalizedImageUrl: varchar("normalized_image_url", { length: 500 }), // If we manually create one
    
    // Classification
    isFrontFacing: boolean("is_front_facing"),
    classificationConfidence: integer("classification_confidence"), // 0-100
    
    // Status for visualizer use
    visualizerStatus: varchar("visualizer_status", { length: 30 }).default("pending"),
    // pending, usable, needs_normalization, rejected
    
    // Metadata
    classifiedAt: timestamp("classified_at"),
    classifiedBy: varchar("classified_by", { length: 50 }), // ai, manual
    notes: text("notes"),
    
    // Timestamps
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    frontFacingIdx: index("wheel_style_assets_front_facing_idx").on(table.isFrontFacing),
    statusIdx: index("wheel_style_assets_status_idx").on(table.visualizerStatus),
  })
);

export type WheelStyleAsset = typeof wheelStyleAssets.$inferSelect;
export type NewWheelStyleAsset = typeof wheelStyleAssets.$inferInsert;
