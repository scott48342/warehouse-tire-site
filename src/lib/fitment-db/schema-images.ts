/**
 * Image Schema
 * 
 * Tables for cached product images:
 * - tireImages - Cached tire product images from TireLibrary
 * - kmImageMappings - K&M supplier image mappings
 * 
 * @created 2026-05-13 (migrated from inline definitions)
 * @updated 2026-05-13 (fixed to match actual DB)
 */

import {
  pgTable,
  varchar,
  text,
  integer,
  timestamp,
  index,
} from "drizzle-orm/pg-core";

// ============================================================================
// Tire Images Cache (matches actual DB: 11 columns)
// ============================================================================

export const tireImages = pgTable(
  "tire_images",
  {
    // pattern_id is the primary key (integer, not uuid)
    patternId: integer("pattern_id").primaryKey(),
    
    // Brand and pattern name
    brand: varchar("brand", { length: 100 }),
    pattern: varchar("pattern", { length: 200 }),
    
    // URLs
    sourceUrl: text("source_url").notNull(),
    blobUrl: text("blob_url"),
    
    // Status
    status: varchar("status", { length: 50 }).notNull().default("pending"),
    errorMessage: text("error_message"),
    
    // File metadata
    contentType: varchar("content_type", { length: 100 }),
    fileSize: integer("file_size"),
    
    // Timestamps
    createdAt: timestamp("created_at", { withTimezone: false }).notNull().defaultNow(),
    uploadedAt: timestamp("uploaded_at", { withTimezone: false }),
  },
  (table) => ({
    statusIdx: index("tire_images_status_idx").on(table.status),
    brandIdx: index("tire_images_brand_idx").on(table.brand),
  })
);

export type TireImage = typeof tireImages.$inferSelect;
export type NewTireImage = typeof tireImages.$inferInsert;

// ============================================================================
// K&M Image Mappings (matches actual DB: 5 columns)
// Note: part_number is the primary key, not a uuid
// ============================================================================

export const kmImageMappings = pgTable(
  "km_image_mappings",
  {
    // part_number is the primary key
    partNumber: varchar("part_number", { length: 100 }).primaryKey(),
    
    // K&M specific fields
    prodline: varchar("prodline", { length: 200 }),
    folderId: varchar("folder_id", { length: 100 }),
    
    // Image URL
    imageUrl: text("image_url"),
    
    // Timestamp
    fetchedAt: timestamp("fetched_at", { withTimezone: false }).notNull().defaultNow(),
  },
  (table) => ({
    prodlineIdx: index("km_image_mappings_prodline_idx").on(table.prodline),
  })
);

export type KmImageMapping = typeof kmImageMappings.$inferSelect;
export type NewKmImageMapping = typeof kmImageMappings.$inferInsert;
