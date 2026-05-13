/**
 * Image Schema
 * 
 * Tables for cached product images:
 * - tireImages - Cached tire product images from TireLibrary
 * 
 * @created 2026-05-13 (migrated from inline definitions)
 */

import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  timestamp,
  index,
} from "drizzle-orm/pg-core";

// ============================================================================
// Tire Images Cache
// ============================================================================

export const tireImages = pgTable(
  "tire_images",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    
    // TireLibrary pattern ID (from TireWeb/USAF data)
    patternId: integer("pattern_id").notNull().unique(),
    
    // Our cached URL (Vercel Blob)
    cachedUrl: varchar("cached_url", { length: 1000 }),
    
    // Original source URL
    sourceUrl: varchar("source_url", { length: 1000 }),
    
    // Image metadata
    width: integer("width"),
    height: integer("height"),
    fileSize: integer("file_size"),
    mimeType: varchar("mime_type", { length: 50 }),
    
    // Status
    status: varchar("status", { length: 50 }).notNull().default("pending"), // pending, cached, failed, missing
    errorMessage: text("error_message"),
    
    // Timestamps
    cachedAt: timestamp("cached_at", { withTimezone: true }),
    lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    patternIdIdx: index("tire_images_pattern_id_idx").on(table.patternId),
    statusIdx: index("tire_images_status_idx").on(table.status),
  })
);

export type TireImage = typeof tireImages.$inferSelect;
export type NewTireImage = typeof tireImages.$inferInsert;

// ============================================================================
// K&M Image Mappings (TireWeb/K&M supplier images)
// ============================================================================

export const kmImageMappings = pgTable(
  "km_image_mappings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    
    // Product identifier
    partNumber: varchar("part_number", { length: 100 }).notNull(),
    brand: varchar("brand", { length: 100 }),
    model: varchar("model", { length: 200 }),
    
    // Image URLs
    imageUrl: varchar("image_url", { length: 1000 }),
    thumbnailUrl: varchar("thumbnail_url", { length: 1000 }),
    
    // Source
    supplier: varchar("supplier", { length: 50 }).default("km"),
    
    // Timestamps
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    partNumberIdx: index("km_image_mappings_part_number_idx").on(table.partNumber),
    brandIdx: index("km_image_mappings_brand_idx").on(table.brand),
  })
);

export type KmImageMapping = typeof kmImageMappings.$inferSelect;
export type NewKmImageMapping = typeof kmImageMappings.$inferInsert;
