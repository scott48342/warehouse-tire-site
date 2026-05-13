/**
 * Catalog & Marketing Tables
 * 
 * Tables for:
 * - catalogMakes - Cached makes (slug, name only)
 * - catalogModels - Cached models with years array
 * - catalogSyncLog - Sync job tracking
 * - manufacturerRebates - Rebate promotions
 * - firstOrderDiscounts - First-time customer discounts
 * - competitorPageAnalysis - Competitor pricing analysis
 */

import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  decimal,
  timestamp,
  json,
  index,
} from "drizzle-orm/pg-core";

// ============================================================================
// Catalog Makes (matches actual DB: 5 columns)
// ============================================================================

export const catalogMakes = pgTable(
  "catalog_makes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    slug: varchar("slug", { length: 100 }).notNull(),
    name: varchar("name", { length: 100 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: false }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: false }).notNull().defaultNow(),
  },
  (table) => ({
    slugIdx: index("catalog_makes_slug_idx").on(table.slug),
  })
);

export type CatalogMake = typeof catalogMakes.$inferSelect;
export type NewCatalogMake = typeof catalogMakes.$inferInsert;

// ============================================================================
// Catalog Models (matches actual DB: 7 columns)
// ============================================================================

export const catalogModels = pgTable(
  "catalog_models",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    makeSlug: varchar("make_slug", { length: 100 }).notNull(),
    slug: varchar("slug", { length: 200 }).notNull(),
    name: varchar("name", { length: 200 }).notNull(),
    years: json("years").$type<number[]>().notNull(), // Array of years
    createdAt: timestamp("created_at", { withTimezone: false }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: false }).notNull().defaultNow(),
  },
  (table) => ({
    makeSlugIdx: index("catalog_models_make_slug_idx").on(table.makeSlug),
    slugIdx: index("catalog_models_slug_idx").on(table.slug),
  })
);

export type CatalogModel = typeof catalogModels.$inferSelect;
export type NewCatalogModel = typeof catalogModels.$inferInsert;

// ============================================================================
// Catalog Sync Log
// ============================================================================

export const catalogSyncLog = pgTable(
  "catalog_sync_log",
  {
    // SCHEMA MATCHES ACTUAL DB (2026-05-13 introspection)
    id: uuid("id").defaultRandom().primaryKey(),
    entityType: varchar("entity_type", { length: 50 }).notNull(),
    entityKey: varchar("entity_key", { length: 200 }),
    syncedAt: timestamp("synced_at", { withTimezone: false }).notNull().defaultNow(),
    recordCount: integer("record_count").default(0),
  },
  (table) => ({
    entityTypeIdx: index("catalog_sync_log_type_idx").on(table.entityType),
  })
);

export type CatalogSyncLog = typeof catalogSyncLog.$inferSelect;
export type NewCatalogSyncLog = typeof catalogSyncLog.$inferInsert;

// ============================================================================
// Manufacturer Rebates
// ============================================================================

export const manufacturerRebates = pgTable(
  "manufacturer_rebates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    brand: varchar("brand", { length: 100 }),
    description: text("description"),
    rebateAmount: decimal("rebate_amount", { precision: 10, scale: 2 }),
    rebateType: varchar("rebate_type", { length: 50 }), // fixed, percentage
    minQuantity: integer("min_quantity").default(4),
    productTypes: json("product_types"), // ['tire', 'wheel']
    skuPatterns: json("sku_patterns"), // SKU patterns that qualify
    startDate: timestamp("start_date", { withTimezone: true }),
    endDate: timestamp("end_date", { withTimezone: true }),
    termsUrl: varchar("terms_url", { length: 500 }),
    imageUrl: varchar("image_url", { length: 500 }),
    isActive: boolean("is_active").default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    brandIdx: index("manufacturer_rebates_brand_idx").on(table.brand),
    activeIdx: index("manufacturer_rebates_active_idx").on(table.isActive),
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
    // SCHEMA MATCHES ACTUAL DB (2026-05-13 introspection)
    id: uuid("id").defaultRandom().primaryKey(),
    code: varchar("code", { length: 50 }),
    email: varchar("email", { length: 255 }),
    discountPercent: decimal("discount_percent", { precision: 5, scale: 2 }),
    issuedAt: timestamp("issued_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    redeemed: boolean("redeemed").default(false),
    redeemedAt: timestamp("redeemed_at", { withTimezone: true }),
    redeemedOrderId: varchar("redeemed_order_id", { length: 100 }),
    redeemedAmount: decimal("redeemed_amount", { precision: 10, scale: 2 }),
    emailSentAt: timestamp("email_sent_at", { withTimezone: true }),
    source: varchar("source", { length: 100 }),
    sessionId: varchar("session_id", { length: 100 }),
    ipAddress: varchar("ip_address", { length: 45 }),
    userAgent: varchar("user_agent", { length: 500 }),
  },
  (table) => ({
    emailIdx: index("first_order_discounts_email_idx").on(table.email),
    codeIdx: index("first_order_discounts_code_idx").on(table.code),
  })
);

export type FirstOrderDiscount = typeof firstOrderDiscounts.$inferSelect;
export type NewFirstOrderDiscount = typeof firstOrderDiscounts.$inferInsert;

// ============================================================================
// Competitor Page Analysis (matches actual DB: 40 columns)
// This is for UX/SEO scoring, not price scraping
// ============================================================================

export const competitorPageAnalysis = pgTable(
  "competitor_page_analysis",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    pageType: varchar("page_type", { length: 50 }), // srp, pdp
    ourUrl: text("our_url"),
    competitorName: varchar("competitor_name", { length: 100 }),
    competitorUrl: text("competitor_url"),
    vehicleContext: json("vehicle_context"),
    productContext: json("product_context"),
    
    // SRP scoring (competitor)
    srpImageQualityScore: integer("srp_image_quality_score"),
    srpPricingClarityScore: integer("srp_pricing_clarity_score"),
    srpTrustSignalScore: integer("srp_trust_signal_score"),
    srpFilterUsabilityScore: integer("srp_filter_usability_score"),
    srpMerchandisingScore: integer("srp_merchandising_score"),
    
    // PDP scoring (competitor)
    pdpAboveFoldClarityScore: integer("pdp_above_fold_clarity_score"),
    pdpImageExperienceScore: integer("pdp_image_experience_score"),
    pdpProductInfoScore: integer("pdp_product_info_score"),
    pdpTrustLayerScore: integer("pdp_trust_layer_score"),
    pdpConversionDriverScore: integer("pdp_conversion_driver_score"),
    pdpCtaStrengthScore: integer("pdp_cta_strength_score"),
    
    // SRP scoring (our site)
    ourSrpImageQualityScore: integer("our_srp_image_quality_score"),
    ourSrpPricingClarityScore: integer("our_srp_pricing_clarity_score"),
    ourSrpTrustSignalScore: integer("our_srp_trust_signal_score"),
    ourSrpFilterUsabilityScore: integer("our_srp_filter_usability_score"),
    ourSrpMerchandisingScore: integer("our_srp_merchandising_score"),
    
    // PDP scoring (our site)
    ourPdpAboveFoldClarityScore: integer("our_pdp_above_fold_clarity_score"),
    ourPdpImageExperienceScore: integer("our_pdp_image_experience_score"),
    ourPdpProductInfoScore: integer("our_pdp_product_info_score"),
    ourPdpTrustLayerScore: integer("our_pdp_trust_layer_score"),
    ourPdpConversionDriverScore: integer("our_pdp_conversion_driver_score"),
    ourPdpCtaStrengthScore: integer("our_pdp_cta_strength_score"),
    
    // Analysis notes
    notes: text("notes"),
    strengths: text("strengths"),
    weaknesses: text("weaknesses"),
    opportunities: text("opportunities"),
    
    // SEO data
    competitorTitle: text("competitor_title"),
    competitorMetaDescription: text("competitor_meta_description"),
    ourTitle: text("our_title"),
    ourMetaDescription: text("our_meta_description"),
    
    // Status
    status: varchar("status", { length: 50 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    pageTypeIdx: index("competitor_page_analysis_page_type_idx").on(table.pageType),
    competitorIdx: index("competitor_page_analysis_competitor_idx").on(table.competitorName),
  })
);

export type CompetitorPageAnalysis = typeof competitorPageAnalysis.$inferSelect;
export type NewCompetitorPageAnalysis = typeof competitorPageAnalysis.$inferInsert;
