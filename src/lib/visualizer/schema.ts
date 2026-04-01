/**
 * Visualizer Database Schema (Drizzle ORM)
 */

import {
  pgTable,
  uuid,
  varchar,
  integer,
  jsonb,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const visualizerConfigs = pgTable(
  "visualizer_configs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: varchar("slug", { length: 255 }).notNull().unique(),
    vehicle: varchar("vehicle", { length: 255 }).notNull(),
    image: varchar("image", { length: 500 }).notNull(),
    frontWheel: jsonb("front_wheel").notNull(),
    rearWheel: jsonb("rear_wheel").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    slugIdx: uniqueIndex("visualizer_configs_slug_idx").on(table.slug),
  })
);

export type VisualizerConfig = typeof visualizerConfigs.$inferSelect;
export type NewVisualizerConfig = typeof visualizerConfigs.$inferInsert;
