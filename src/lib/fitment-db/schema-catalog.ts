/**
 * Catalog Schema
 * 
 * Tables for product catalog management:
 * - catalogMakes - Cached makes from suppliers
 * - catalogModels - Cached models from suppliers
 * - catalogSyncLog - Sync job tracking
 * - manufacturerRebates - Rebate promotions
 * - firstOrderDiscounts - First-time customer discounts
 * 
 * @created 2026-05-13 (migrated from inline definitions)
 */

import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  integer,
  timestamp,
  json,
  decimal,
  index,
} from "drizzle-orm/pg-core";

// ============================================================================
// Catalog Makes (cached from suppliers)
// ============================================================================

export const catalogMakes = pgTable(
  "catalog_makes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    make: varchar("make", { length: 100 }).notNull(),
    displayName: varchar("display_name", { length: 100 }),
    slug: varchar("slug", { length: 100 }),
    supplier: varchar("supplier", { length: 50 }),
    isActive: boolean("is_active").default(true),
    sortOrder: integer("sort_order").default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    makeIdx: index("catalog_makes_make_idx").on(table.make),
    supplierIdx: index("catalog_makes_supplier_idx").on(table.supplier),
  })
);

export type CatalogMake = typeof catalogMakes.$inferSelect;
export type NewCatalogMake = typeof catalogMakes.$inferInsert;

// ============================================================================
// Catalog Models (cached from suppliers)
// ============================================================================

export const catalogModels = pgTable(
  "catalog_models",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    makeId: uuid("make_id").references(() => catalogMakes.id),
    make: varchar("make", { length: 100 }).notNull(),
    model: varchar("model", { length: 200 }).notNull(),
    displayName: varchar("display_name", { length: 200 }),
    slug: varchar("slug", { length: 200 }),
    yearStart: integer("year_start"),
    yearEnd: integer("year_end"),
    supplier: varchar("supplier", { length: 50 }),
    isActive: boolean("is_active").default(true),
    sortOrder: integer("sort_order").default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    makeModelIdx: index("catalog_models_make_model_idx").on(table.make, table.model),
    supplierIdx: index("catalog_models_supplier_idx").on(table.supplier),
  })
);

export type CatalogModel = typeof catalogModels.$inferSelect;
export type NewCatalogModel = typeof catalogModels.$inferInsert;

// ============================================================================
// Catalog Sync Log (tracks sync jobs)
// ============================================================================

export const catalogSyncLog = pgTable(
  "catalog_sync_log",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    source: varchar("source", { length: 100 }).notNull(),
    syncType: varchar("sync_type", { length: 50 }).notNull(), // makes, models, products, inventory
    status: varchar("status", { length: 50 }).notNull().default("running"),
    recordsProcessed: integer("records_processed").default(0),
    recordsCreated: integer("records_created").default(0),
    recordsUpdated: integer("records_updated").default(0),
    recordsDeleted: integer("records_deleted").default(0),
    errors: json("errors"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    durationMs: integer("duration_ms"),
  },
  (table) => ({
    sourceIdx: index("catalog_sync_log_source_idx").on(table.source),
    statusIdx: index("catalog_sync_log_status_idx").on(table.status),
    startedIdx: index("catalog_sync_log_started_idx").on(table.startedAt),
  })
);

export type CatalogSyncLogEntry = typeof catalogSyncLog.$inferSelect;
export type NewCatalogSyncLogEntry = typeof catalogSyncLog.$inferInsert;

// ============================================================================
// Manufacturer Rebates
// ============================================================================

export const manufacturerRebates = pgTable(
  "manufacturer_rebates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    
    // Brand/product targeting
    brand: varchar("brand", { length: 100 }).notNull(),
    productLine: varchar("product_line", { length: 200 }),
    sku: varchar("sku", { length: 100 }),
    
    // Rebate details
    rebateAmount: decimal("rebate_amount", { precision: 10, scale: 2 }).notNull(),
    rebateType: varchar("rebate_type", { length: 50 }).default("instant"), // instant, mail-in, prepaid-card
    minQuantity: integer("min_quantity").default(4),
    maxQuantity: integer("max_quantity"),
    
    // Validity
    startDate: timestamp("start_date", { withTimezone: true }).notNull(),
    endDate: timestamp("end_date", { withTimezone: true }).notNull(),
    isActive: boolean("is_active").default(true),
    
    // Display
    title: varchar("title", { length: 255 }),
    description: text("description"),
    terms: text("terms"),
    imageUrl: varchar("image_url", { length: 500 }),
    
    // Source
    source: varchar("source", { length: 100 }),
    externalId: varchar("external_id", { length: 100 }),
    
    // Timestamps
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    brandIdx: index("manufacturer_rebates_brand_idx").on(table.brand),
    activeIdx: index("manufacturer_rebates_active_idx").on(table.isActive),
    dateIdx: index("manufacturer_rebates_date_idx").on(table.startDate, table.endDate),
  })
);

export type ManufacturerRebate = typeof manufacturerRebates.$inferSelect;
export type NewManufacturerRebate = typeof manufacturerRebates.$inferInsert;

// ============================================================================
// First Order Discounts
// ============================================================================

export const firstOrderDiscounts = pgTable(
  "first_order_discounts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    
    // Customer identity
    email: varchar("email", { length: 255 }).notNull().unique(),
    
    // Discount details
    discountCode: varchar("discount_code", { length: 50 }).notNull().unique(),
    discountPercent: decimal("discount_percent", { precision: 5, scale: 2 }).notNull(),
    
    // Status
    status: varchar("status", { length: 50 }).default("pending"), // pending, sent, used, expired
    
    // Tracking
    sentAt: timestamp("sent_at", { withTimezone: true }),
    usedAt: timestamp("used_at", { withTimezone: true }),
    usedOrderId: varchar("used_order_id", { length: 100 }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    
    // Site context
    hostname: varchar("hostname", { length: 100 }),
    
    // Timestamps
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    emailIdx: index("first_order_discounts_email_idx").on(table.email),
    codeIdx: index("first_order_discounts_code_idx").on(table.discountCode),
    statusIdx: index("first_order_discounts_status_idx").on(table.status),
  })
);

export type FirstOrderDiscount = typeof firstOrderDiscounts.$inferSelect;
export type NewFirstOrderDiscount = typeof firstOrderDiscounts.$inferInsert;

// ============================================================================
// Competitor Page Analysis
// ============================================================================

export const competitorPageAnalysis = pgTable(
  "competitor_page_analysis",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    
    // Our page
    ourUrl: varchar("our_url", { length: 1000 }).notNull(),
    ourPageType: varchar("our_page_type", { length: 50 }), // srp, pdp, category
    pageType: varchar("page_type", { length: 50 }), // srp, pdp, category (alias)
    
    // Competitor page
    competitorUrl: varchar("competitor_url", { length: 1000 }),
    competitorName: varchar("competitor_name", { length: 100 }),
    
    // Search context
    searchQuery: varchar("search_query", { length: 255 }),
    vehicleYear: integer("vehicle_year"),
    vehicleMake: varchar("vehicle_make", { length: 100 }),
    vehicleModel: varchar("vehicle_model", { length: 200 }),
    
    // Scores (0-100)
    overallScore: integer("overall_score"),
    contentScore: integer("content_score"),
    seoScore: integer("seo_score"),
    uxScore: integer("ux_score"),
    priceScore: integer("price_score"),
    
    // Analysis results
    insights: json("insights"), // Array of insights
    recommendations: json("recommendations"), // Array of recommendations
    rawData: json("raw_data"), // Full analysis payload
    
    // Status
    status: varchar("status", { length: 50 }).default("pending"),
    analyzedAt: timestamp("analyzed_at", { withTimezone: true }),
    
    // Timestamps
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    ourUrlIdx: index("cpa_our_url_idx").on(table.ourUrl),
    competitorIdx: index("cpa_competitor_idx").on(table.competitorName),
    statusIdx: index("cpa_status_idx").on(table.status),
  })
);

export type CompetitorPageAnalysis = typeof competitorPageAnalysis.$inferSelect;
export type NewCompetitorPageAnalysis = typeof competitorPageAnalysis.$inferInsert;
