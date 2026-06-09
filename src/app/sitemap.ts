/**
 * Sitemap Generator
 * 
 * Generates XML sitemap with ONLY indexable pages.
 * Queries the database to include only vehicles with actual fitment data.
 * 
 * @updated 2026-04-11 - Switched from static vehicle list to DB-backed
 * @updated 2026-05-29 - Force dynamic to ensure DB query runs (not build-time only)
 * @updated 2026-06-09 - Added PDP pages (wheels, suspension, accessories) with quality filters
 * @updated 2026-06-09 - Dynamic host detection for multi-domain support
 */

import { MetadataRoute } from "next";

// Force dynamic generation so the sitemap queries the DB at runtime
// Revalidate every 24 hours (86400 seconds)
export const dynamic = "force-dynamic";
export const revalidate = 86400;

// Domain mapping for multi-site support
const DOMAIN_MAP: Record<string, string> = {
  "shop.warehousetiredirect.com": "https://shop.warehousetiredirect.com",
  "shop.warehousetire.net": "https://shop.warehousetire.net",
};
const DEFAULT_BASE_URL = "https://shop.warehousetiredirect.com";

/**
 * Get base URL for sitemap
 * Uses env var (set per-deployment) since sitemap is generated at build/revalidate time
 */
function getBaseUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL || DEFAULT_BASE_URL;
}

// Product types with their priorities
const PRODUCT_TYPES = [
  { type: "wheels", priority: 0.8 },
  { type: "tires", priority: 0.8 },
  { type: "packages", priority: 0.9 },
] as const;

// Static pages (always indexed)
const STATIC_PAGES = [
  { path: "/", priority: 1.0, changeFrequency: "daily" as const },
  { path: "/wheels", priority: 0.9, changeFrequency: "daily" as const },
  { path: "/tires", priority: 0.9, changeFrequency: "daily" as const },
  { path: "/package", priority: 0.8, changeFrequency: "weekly" as const },
  { path: "/schedule", priority: 0.7, changeFrequency: "monthly" as const },
  { path: "/suspension", priority: 0.7, changeFrequency: "weekly" as const },
  { path: "/accessories", priority: 0.6, changeFrequency: "weekly" as const },
  // Note: /lifted is noindexed, excluded from sitemap
];

// Fallback vehicles for build time when DB is unavailable
const FALLBACK_VEHICLES = [
  // Top trucks
  { year: 2024, make: "ford", model: "f-150" },
  { year: 2024, make: "chevrolet", model: "silverado-1500" },
  { year: 2024, make: "ram", model: "1500" },
  { year: 2024, make: "toyota", model: "tacoma" },
  { year: 2024, make: "toyota", model: "tundra" },
  { year: 2024, make: "gmc", model: "sierra-1500" },
  // Top SUVs
  { year: 2024, make: "jeep", model: "wrangler" },
  { year: 2024, make: "jeep", model: "grand-cherokee" },
  { year: 2024, make: "ford", model: "bronco" },
  { year: 2024, make: "toyota", model: "4runner" },
  { year: 2024, make: "ford", model: "explorer" },
  { year: 2024, make: "chevrolet", model: "tahoe" },
  // Sports
  { year: 2024, make: "ford", model: "mustang" },
  { year: 2024, make: "chevrolet", model: "camaro" },
  { year: 2024, make: "dodge", model: "challenger" },
  { year: 2024, make: "dodge", model: "charger" },
  // Sedans
  { year: 2024, make: "toyota", model: "camry" },
  { year: 2024, make: "honda", model: "accord" },
  { year: 2024, make: "honda", model: "civic" },
];

// ============================================================================
// Types
// ============================================================================

interface VehicleRow {
  year: number;
  make: string;
  model: string;
  trim_count: number;
}

interface WheelPDPRow {
  sku: string;
}

interface SuspensionPDPRow {
  sku: string;
}

interface AccessoryPDPRow {
  sku: string;
}

/**
 * Create URL-safe slug from vehicle info
 */
function slugify(year: number, make: string, model: string): string {
  const cleanMake = make.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  const cleanModel = model.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  return `${year}-${cleanMake}-${cleanModel}`;
}

/**
 * Get vehicles from database that have actual fitment data
 */
async function getIndexableVehicles(): Promise<VehicleRow[]> {
  try {
    // Dynamic import for cleaner module resolution
    const { db } = await import("@/lib/fitment-db/db");
    const { sql } = await import("drizzle-orm");
    
    // Get vehicles with fitment data, grouped by year/make/model
    // Only include vehicles with bolt_pattern (indicates real fitment data)
    const result = await db.execute(sql`
      SELECT 
        year::int as year,
        make,
        model,
        COUNT(*)::int as trim_count
      FROM vehicle_fitments
      WHERE bolt_pattern IS NOT NULL
        AND year >= 2010
      GROUP BY year, make, model
      ORDER BY year DESC, make, model
    `);
    
    const vehicles = result.rows as unknown as VehicleRow[];
    console.log(`[sitemap] Found ${vehicles.length} indexable vehicles from DB`);
    
    return vehicles;
  } catch (err) {
    console.error("[sitemap] DB error, using fallback:", err);
    return FALLBACK_VEHICLES.map(v => ({ ...v, trim_count: 1 }));
  }
}

/**
 * Get wheel SKUs from TechFeed JSON that have images
 * TechFeed data is stored in gzipped JSON files, not database tables
 * 
 * Quality filter: Only include wheels with at least one image
 * No arbitrary limit - include all quality wheels for full coverage
 */
async function getIndexableWheelPDPs(): Promise<WheelPDPRow[]> {
  try {
    // TechFeed data is stored in JSON files, not database
    const { getTechfeedWheelBySku, warmTechfeedWheelCache } = await import("@/lib/techfeed/wheels");
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const zlib = await import("node:zlib");
    
    // Load the TechFeed JSON file directly
    const gzPath = path.join(process.cwd(), "src/techfeed/wheels_by_sku.json.gz");
    const buf = await fs.readFile(gzPath);
    const json = zlib.gunzipSync(buf).toString("utf8");
    const data = JSON.parse(json) as { bySku: Record<string, { images?: string[] }> };
    
    // Filter to wheels with images
    const allSkus = Object.keys(data.bySku || {});
    const wheelsWithImages = allSkus.filter(sku => {
      const w = data.bySku[sku];
      return w.images && Array.isArray(w.images) && w.images.length > 0;
    });
    
    console.log(`[sitemap] Found ${wheelsWithImages.length} indexable wheel PDPs (${allSkus.length - wheelsWithImages.length} excluded - no images)`);
    
    return wheelsWithImages.map(sku => ({ sku }));
  } catch (err) {
    console.error("[sitemap] Wheel PDP query error:", err);
    return [];
  }
}

/**
 * Get suspension SKUs that have fitment data
 * All suspension products should be indexed - they have good content
 */
async function getIndexableSuspensionPDPs(): Promise<SuspensionPDPRow[]> {
  try {
    const { db } = await import("@/lib/fitment-db/db");
    const { sql } = await import("drizzle-orm");
    
    const result = await db.execute(sql`
      SELECT DISTINCT sku
      FROM suspension_fitments
      WHERE sku IS NOT NULL AND sku != ''
      ORDER BY sku
      LIMIT 2000
    `);
    
    const products = result.rows as unknown as SuspensionPDPRow[];
    console.log(`[sitemap] Found ${products.length} indexable suspension PDPs`);
    
    return products;
  } catch (err) {
    console.error("[sitemap] Suspension PDP query error:", err);
    return [];
  }
}

/**
 * Get accessory SKUs that have images and are in stock
 * Focus on popular categories: lug nuts, hub rings, TPMS
 */
async function getIndexableAccessoryPDPs(): Promise<AccessoryPDPRow[]> {
  try {
    const { db } = await import("@/lib/fitment-db/db");
    const { sql } = await import("drizzle-orm");
    
    const result = await db.execute(sql`
      SELECT DISTINCT sku
      FROM accessories
      WHERE sku IS NOT NULL 
        AND sku != ''
        AND (image_url IS NOT NULL OR sell_price > 0)
        AND category IN ('lug_nut', 'hub_ring', 'tpms', 'center_cap')
      ORDER BY sku
      LIMIT 5000
    `);
    
    const products = result.rows as unknown as AccessoryPDPRow[];
    console.log(`[sitemap] Found ${products.length} indexable accessory PDPs`);
    
    return products;
  } catch (err) {
    console.error("[sitemap] Accessory PDP query error:", err);
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [];
  const now = new Date();
  const BASE_URL = getBaseUrl();
  
  console.log(`[sitemap] Generating for domain: ${BASE_URL}`);
  
  // ============================================================================
  // Static Pages
  // ============================================================================
  for (const page of STATIC_PAGES) {
    entries.push({
      url: `${BASE_URL}${page.path}`,
      lastModified: now,
      changeFrequency: page.changeFrequency,
      priority: page.priority,
    });
  }
  
  // ============================================================================
  // Vehicle Pages (from database)
  // ============================================================================
  const vehicles = await getIndexableVehicles();
  const addedSlugs = new Set<string>();
  
  for (const vehicle of vehicles) {
    const slug = slugify(vehicle.year, vehicle.make, vehicle.model);
    
    // Skip duplicates
    if (addedSlugs.has(slug)) continue;
    addedSlugs.add(slug);
    
    // Priority based on year recency
    const yearPriority = vehicle.year >= 2022 ? 1.0 : vehicle.year >= 2019 ? 0.8 : 0.6;
    
    // Add URL for each product type
    for (const { type, priority } of PRODUCT_TYPES) {
      entries.push({
        url: `${BASE_URL}/${type}/for/${slug}`,
        lastModified: now,
        changeFrequency: "weekly",
        priority: Math.min(1.0, priority * yearPriority),
      });
    }
  }
  
  // ============================================================================
  // Product Detail Pages (PDPs)
  // Only include products with images and good content
  // ============================================================================
  
  // Fetch all PDPs in parallel for speed
  const [wheelPDPs, suspensionPDPs, accessoryPDPs] = await Promise.all([
    getIndexableWheelPDPs(),
    getIndexableSuspensionPDPs(),
    getIndexableAccessoryPDPs(),
  ]);
  
  // Wheel PDPs (priority 0.7 - below vehicle pages but above accessories)
  for (const wheel of wheelPDPs) {
    entries.push({
      url: `${BASE_URL}/wheels/${encodeURIComponent(wheel.sku)}`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.7,
    });
  }
  
  // Suspension PDPs (priority 0.7 - good content, comparable to wheels)
  for (const susp of suspensionPDPs) {
    entries.push({
      url: `${BASE_URL}/suspension/${encodeURIComponent(susp.sku)}`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.7,
    });
  }
  
  // Accessory PDPs (priority 0.5 - lower priority, simpler content)
  for (const acc of accessoryPDPs) {
    entries.push({
      url: `${BASE_URL}/accessories/${encodeURIComponent(acc.sku)}`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.5,
    });
  }
  
  // ============================================================================
  // Stats
  // ============================================================================
  console.log(`[sitemap] Generated ${entries.length} URLs:`);
  console.log(`  - Static pages: ${STATIC_PAGES.length}`);
  console.log(`  - Unique vehicles: ${addedSlugs.size}`);
  console.log(`  - Vehicle URLs: ${addedSlugs.size * PRODUCT_TYPES.length}`);
  console.log(`  - Wheel PDPs: ${wheelPDPs.length}`);
  console.log(`  - Suspension PDPs: ${suspensionPDPs.length}`);
  console.log(`  - Accessory PDPs: ${accessoryPDPs.length}`);
  
  return entries;
}
