/**
 * Gallery Schema (Drizzle ORM)
 * 
 * Tables:
 * - gallery_images: Build photos with fitment data
 * - gallery_image_likes: User engagement tracking
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
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// ============================================================================
// gallery_images - Build photos with fitment metadata
// ============================================================================

export const galleryImages = pgTable(
  "gallery_images",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // Image URLs
    imageUrl: text("image_url").notNull(),
    thumbnailUrl: text("thumbnail_url"),
    blobUrl: text("blob_url"), // Our cached copy

    // Source tracking
    source: varchar("source", { length: 50 }).notNull(), // 'fitment_industries', 'customer', 'curator'
    sourceId: varchar("source_id", { length: 255 }), // External ID
    sourceUrl: text("source_url"), // Original source page

    // Vehicle (normalized for matching)
    vehicleYear: integer("vehicle_year").notNull(),
    vehicleMake: varchar("vehicle_make", { length: 100 }).notNull(),
    vehicleModel: varchar("vehicle_model", { length: 100 }).notNull(),
    vehicleTrim: varchar("vehicle_trim", { length: 255 }),

    // Wheel specs (front)
    wheelBrand: varchar("wheel_brand", { length: 100 }),
    wheelModel: varchar("wheel_model", { length: 200 }),
    wheelDiameter: integer("wheel_diameter"), // 18, 20, 22
    wheelWidth: decimal("wheel_width", { precision: 4, scale: 1 }), // 9.5
    wheelOffsetMm: integer("wheel_offset_mm"), // +35, -12

    // Rear wheel (staggered setups)
    rearWheelDiameter: integer("rear_wheel_diameter"),
    rearWheelWidth: decimal("rear_wheel_width", { precision: 4, scale: 1 }),
    rearWheelOffsetMm: integer("rear_wheel_offset_mm"),
    isStaggered: boolean("is_staggered").default(false),

    // Tire specs
    tireBrand: varchar("tire_brand", { length: 100 }),
    tireModel: varchar("tire_model", { length: 200 }),
    tireSize: varchar("tire_size", { length: 50 }), // "275/55R20"
    rearTireSize: varchar("rear_tire_size", { length: 50 }),

    // Suspension/Lift
    suspensionType: varchar("suspension_type", { length: 30 }), // 'stock', 'lowering_springs', 'coilovers', 'air', 'lift_kit'
    suspensionBrand: varchar("suspension_brand", { length: 100 }),
    liftLevel: varchar("lift_level", { length: 30 }), // 'stock', 'leveled', 'lifted_2', 'lifted_4', 'lifted_6', 'lowered', 'slammed'

    // Fitment style
    fitmentType: varchar("fitment_type", { length: 30 }), // 'flush', 'hellaflush', 'nearly_flush', 'poke', 'tucked'

    // Spacers
    spacerSizeMm: integer("spacer_size_mm"),
    rearSpacerSizeMm: integer("rear_spacer_size_mm"),

    // Build style
    buildStyle: varchar("build_style", { length: 30 }), // 'aggressive', 'daily', 'show', 'offroad', 'drift'

    // Metadata
    title: varchar("title", { length: 255 }),
    description: text("description"),
    tags: text("tags").array(),

    // Engagement
    viewCount: integer("view_count").default(0),
    featured: boolean("featured").default(false),

    // Status
    status: varchar("status", { length: 20 }).default("active"), // 'active', 'pending', 'hidden', 'flagged'
    moderatedAt: timestamp("moderated_at"),
    moderatedBy: varchar("moderated_by", { length: 100 }),

    // Timestamps
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    importedAt: timestamp("imported_at"),
  },
  (table) => ({
    // Vehicle lookup (primary use case)
    vehicleIdx: index("gallery_images_vehicle_idx").on(
      table.vehicleYear,
      table.vehicleMake,
      table.vehicleModel
    ),
    // Wheel diameter filtering
    wheelDiameterIdx: index("gallery_images_wheel_diameter_idx").on(
      table.wheelDiameter
    ),
    // Lift level filtering
    liftIdx: index("gallery_images_lift_idx").on(table.liftLevel),
    // Source deduplication
    sourceIdx: uniqueIndex("gallery_images_source_idx").on(
      table.source,
      table.sourceId
    ),
    // Status filtering
    statusIdx: index("gallery_images_status_idx").on(table.status, table.featured),
    // Wheel brand browsing
    wheelBrandIdx: index("gallery_images_wheel_brand_idx").on(table.wheelBrand),
  })
);

// ============================================================================
// gallery_image_likes - User engagement
// ============================================================================

export const galleryImageLikes = pgTable(
  "gallery_image_likes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    galleryImageId: uuid("gallery_image_id")
      .notNull()
      .references(() => galleryImages.id, { onDelete: "cascade" }),
    userSessionId: varchar("user_session_id", { length: 255 }).notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    uniqueLike: uniqueIndex("gallery_image_likes_unique").on(
      table.galleryImageId,
      table.userSessionId
    ),
    imageIdx: index("gallery_image_likes_image_idx").on(table.galleryImageId),
  })
);

// ============================================================================
// Type exports
// ============================================================================

export type GalleryImage = typeof galleryImages.$inferSelect;
export type NewGalleryImage = typeof galleryImages.$inferInsert;

export type GalleryImageLike = typeof galleryImageLikes.$inferSelect;
export type NewGalleryImageLike = typeof galleryImageLikes.$inferInsert;

// ============================================================================
// Helper types for API responses
// ============================================================================

export interface GallerySearchParams {
  // Vehicle matching
  year?: number;
  make?: string;
  model?: string;
  trim?: string;

  // Wheel specs
  wheelDiameter?: number;
  wheelBrand?: string;

  // Lift/suspension
  liftLevel?: "stock" | "leveled" | "lifted" | "lowered";
  suspensionType?: string;

  // Build style
  buildStyle?: "aggressive" | "daily" | "show" | "offroad";
  fitmentType?: "flush" | "hellaflush" | "poke" | "tucked";

  // Pagination
  limit?: number;
  offset?: number;
}

export interface GalleryImageWithMeta extends GalleryImage {
  matchScore?: number; // How closely it matches the search criteria
  liked?: boolean; // Whether current user liked it
}
