/**
 * Build Gallery Schema
 * 
 * Curated builds for inspiration → Jake integration → conversion
 * 
 * KEY DESIGN DECISIONS:
 * - Builds are curated (50-100 initially), not user-generated
 * - Each build has full specs: vehicle, wheel, tire, lift, style
 * - Primary CTA is "Build Something Similar" → launches Jake with context
 * - SEO-friendly slugs for indexable URLs
 */

import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
  json,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// ════════════════════════════════════════════════════════════════════════════════
// BUILD STYLES (enum-like values)
// ════════════════════════════════════════════════════════════════════════════════

export const BUILD_STYLES = [
  "aggressive-street",
  "lifted",
  "off-road",
  "blackout",
  "luxury",
  "towing",
  "show-build",
  "leveled",
  "daily-driver",
] as const;

export type BuildStyle = typeof BUILD_STYLES[number];

// ════════════════════════════════════════════════════════════════════════════════
// GALLERY BUILDS TABLE
// ════════════════════════════════════════════════════════════════════════════════

export const galleryBuilds = pgTable(
  "gallery_builds",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    
    // SEO-friendly slug: 2021-chevrolet-silverado-1500-fuel-rebel-ridge-grappler
    slug: varchar("slug", { length: 500 }).notNull().unique(),
    
    // Build title (optional, for display)
    title: varchar("title", { length: 200 }),
    description: text("description"),
    
    // ═══════════════════════════════════════════════════════════════════════════
    // VEHICLE INFO
    // ═══════════════════════════════════════════════════════════════════════════
    vehicleYear: integer("vehicle_year").notNull(),
    vehicleMake: varchar("vehicle_make", { length: 100 }).notNull(),
    vehicleModel: varchar("vehicle_model", { length: 100 }).notNull(),
    vehicleTrim: varchar("vehicle_trim", { length: 100 }),
    
    // ═══════════════════════════════════════════════════════════════════════════
    // BUILD SPECS
    // ═══════════════════════════════════════════════════════════════════════════
    buildStyle: varchar("build_style", { length: 50 }).notNull(), // aggressive-street, lifted, off-road, etc.
    liftLevel: varchar("lift_level", { length: 50 }), // "stock", "leveled", "2-inch", "6-inch", etc.
    
    // ═══════════════════════════════════════════════════════════════════════════
    // WHEEL INFO
    // ═══════════════════════════════════════════════════════════════════════════
    wheelBrand: varchar("wheel_brand", { length: 100 }).notNull(),
    wheelModel: varchar("wheel_model", { length: 100 }).notNull(),
    wheelSize: varchar("wheel_size", { length: 50 }).notNull(), // "20x10", "22x12", etc.
    wheelFinish: varchar("wheel_finish", { length: 100 }), // "Matte Black", "Gloss Black Milled", etc.
    wheelOffset: varchar("wheel_offset", { length: 20 }), // "-24", "+18", etc.
    wheelBoltPattern: varchar("wheel_bolt_pattern", { length: 50 }), // "6x135", "8x170", etc.
    wheelSku: varchar("wheel_sku", { length: 100 }), // For direct product linking
    
    // ═══════════════════════════════════════════════════════════════════════════
    // TIRE INFO
    // ═══════════════════════════════════════════════════════════════════════════
    tireBrand: varchar("tire_brand", { length: 100 }).notNull(),
    tireModel: varchar("tire_model", { length: 100 }).notNull(),
    tireSize: varchar("tire_size", { length: 50 }).notNull(), // "35x12.50R20", "33x12.50R18", etc.
    tireSku: varchar("tire_sku", { length: 100 }), // For direct product linking
    
    // ═══════════════════════════════════════════════════════════════════════════
    // IMAGES
    // ═══════════════════════════════════════════════════════════════════════════
    heroImageUrl: text("hero_image_url").notNull(),
    additionalImages: json("additional_images").$type<string[]>().default([]),
    
    // ═══════════════════════════════════════════════════════════════════════════
    // METADATA & FLAGS
    // ═══════════════════════════════════════════════════════════════════════════
    tags: json("tags").$type<string[]>().default([]), // "truck", "jeep", "suv", "muscle", etc.
    isFeatured: boolean("is_featured").default(false).notNull(),
    isPopular: boolean("is_popular").default(false).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    
    // Display order (lower = shown first)
    displayOrder: integer("display_order").default(1000),
    
    // Optional source attribution
    sourceType: varchar("source_type", { length: 50 }), // "customer", "showroom", "manufacturer", etc.
    sourceAttribution: varchar("source_attribution", { length: 200 }), // "@instagram_handle" or "John D."
    
    // Timestamps
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => ({
    // Fast lookups
    slugIdx: uniqueIndex("gb_slug_idx").on(table.slug),
    activeIdx: index("gb_active_idx").on(table.isActive),
    featuredIdx: index("gb_featured_idx").on(table.isFeatured, table.isActive),
    popularIdx: index("gb_popular_idx").on(table.isPopular, table.isActive),
    
    // Vehicle filtering
    vehicleMakeIdx: index("gb_vehicle_make_idx").on(table.vehicleMake),
    vehicleModelIdx: index("gb_vehicle_model_idx").on(table.vehicleMake, table.vehicleModel),
    
    // Style/tag filtering
    buildStyleIdx: index("gb_build_style_idx").on(table.buildStyle),
    
    // Sorting
    displayOrderIdx: index("gb_display_order_idx").on(table.displayOrder, table.createdAt),
  })
);

export type GalleryBuild = typeof galleryBuilds.$inferSelect;
export type NewGalleryBuild = typeof galleryBuilds.$inferInsert;

// ════════════════════════════════════════════════════════════════════════════════
// HELPER: Generate slug from build data
// ════════════════════════════════════════════════════════════════════════════════

export function generateBuildSlug(build: {
  vehicleYear: number;
  vehicleMake: string;
  vehicleModel: string;
  wheelBrand: string;
  wheelModel: string;
  tireBrand: string;
  tireModel: string;
}): string {
  const parts = [
    String(build.vehicleYear),
    build.vehicleMake,
    build.vehicleModel,
    build.wheelBrand,
    build.wheelModel,
    build.tireBrand,
    build.tireModel,
  ];
  
  return parts
    .map(p => p.toLowerCase().replace(/[^a-z0-9]+/g, "-"))
    .join("-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

// ════════════════════════════════════════════════════════════════════════════════
// HELPER: Jake context payload
// ════════════════════════════════════════════════════════════════════════════════

export interface JakeBuildContext {
  galleryBuild: {
    vehicle: string; // "2021 Chevrolet Silverado 1500"
    wheel: string;   // "Fuel Rebel"
    wheelSize: string; // "20x10"
    tire: string;    // "Nitto Ridge Grappler"
    tireSize: string; // "35x12.50R20"
    style: string;   // "Lifted"
    liftLevel?: string; // "6-inch"
  };
}

export function buildToJakeContext(build: GalleryBuild): JakeBuildContext {
  return {
    galleryBuild: {
      vehicle: [
        build.vehicleYear,
        build.vehicleMake,
        build.vehicleModel,
        build.vehicleTrim,
      ].filter(Boolean).join(" "),
      wheel: `${build.wheelBrand} ${build.wheelModel}`,
      wheelSize: build.wheelSize,
      tire: `${build.tireBrand} ${build.tireModel}`,
      tireSize: build.tireSize,
      style: build.buildStyle.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase()),
      liftLevel: build.liftLevel || undefined,
    },
  };
}
