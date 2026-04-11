/**
 * Sitemap Generator
 * 
 * Generates XML sitemap with ONLY indexable pages.
 * Queries the database to include only vehicles with actual fitment data.
 * 
 * @updated 2026-04-11 - Switched from static vehicle list to DB-backed
 */

import { MetadataRoute } from "next";

const BASE_URL = "https://shop.warehousetiredirect.com";

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

interface VehicleRow {
  year: number;
  make: string;
  model: string;
  trim_count: number;
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
  // Skip DB during Vercel build to avoid connection issues
  const isBuildTime = process.env.VERCEL_ENV === "production" && 
                      process.env.NEXT_PHASE === "phase-production-build";
  
  if (isBuildTime) {
    console.log("[sitemap] Build time - using fallback vehicles");
    return FALLBACK_VEHICLES.map(v => ({ ...v, trim_count: 1 }));
  }
  
  try {
    // Dynamic import to avoid build-time DB connection
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
    
    const vehicles = result.rows as VehicleRow[];
    console.log(`[sitemap] Found ${vehicles.length} indexable vehicles from DB`);
    
    return vehicles;
  } catch (err) {
    console.error("[sitemap] DB error, using fallback:", err);
    return FALLBACK_VEHICLES.map(v => ({ ...v, trim_count: 1 }));
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [];
  const now = new Date();
  
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
  // Stats
  // ============================================================================
  console.log(`[sitemap] Generated ${entries.length} URLs:`);
  console.log(`  - Static pages: ${STATIC_PAGES.length}`);
  console.log(`  - Unique vehicles: ${addedSlugs.size}`);
  console.log(`  - Vehicle URLs: ${addedSlugs.size * PRODUCT_TYPES.length}`);
  
  return entries;
}
