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
} from "drizzle-orm/pg-core";

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
