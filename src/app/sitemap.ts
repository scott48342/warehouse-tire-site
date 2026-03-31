/**
 * Sitemap Generator
 * 
 * Generates comprehensive XML sitemap for search engines.
 * Includes all SEO landing pages for wheels, tires, and packages.
 * 
 * Expected output: 1000-5000+ URLs covering:
 * - Static pages (home, wheels, tires, etc.)
 * - /wheels/for/[vehicleSlug] pages
 * - /tires/for/[vehicleSlug] pages  
 * - /packages/for/[vehicleSlug] pages
 */

import { MetadataRoute } from "next";
import { ALL_VEHICLES, PREBUILD_VEHICLES } from "@/lib/seo/vehicleData";
import { slugifyVehicle } from "@/lib/seo/slugifyVehicle";

const BASE_URL = "https://shop.warehousetiredirect.com";

// Product types with their priorities
const PRODUCT_TYPES = [
  { type: "wheels", priority: 0.8 },
  { type: "tires", priority: 0.8 },
  { type: "packages", priority: 0.9 }, // Packages are highest priority for conversion
] as const;

// Static pages
const STATIC_PAGES = [
  { path: "/", priority: 1.0, changeFrequency: "daily" as const },
  { path: "/wheels", priority: 0.9, changeFrequency: "daily" as const },
  { path: "/tires", priority: 0.9, changeFrequency: "daily" as const },
  { path: "/package", priority: 0.8, changeFrequency: "weekly" as const },
  { path: "/schedule", priority: 0.7, changeFrequency: "monthly" as const },
  { path: "/lifted", priority: 0.7, changeFrequency: "weekly" as const },
];

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
  // SEO Vehicle Landing Pages
  // ============================================================================
  
  // Use ALL_VEHICLES for comprehensive sitemap coverage
  // This includes 2000+ year/make/model combinations
  const vehiclesToInclude = ALL_VEHICLES;
  
  // Track unique slugs to avoid duplicates
  const addedSlugs = new Set<string>();
  
  for (const vehicle of vehiclesToInclude) {
    const slug = slugifyVehicle(vehicle);
    
    // Skip if we've already added this slug
    if (addedSlugs.has(slug)) continue;
    addedSlugs.add(slug);
    
    // Determine priority based on year (recent years get higher priority)
    const yearNum = parseInt(vehicle.year, 10);
    const yearPriority = yearNum >= 2022 ? 1.0 : yearNum >= 2019 ? 0.8 : 0.6;
    
    // Check if this is a prebuild vehicle (higher priority)
    const isPrebuild = PREBUILD_VEHICLES.some(
      pv => pv.year === vehicle.year && 
            pv.make.toLowerCase() === vehicle.make.toLowerCase() && 
            pv.model.toLowerCase() === vehicle.model.toLowerCase()
    );
    
    // Add URL for each product type
    for (const { type, priority } of PRODUCT_TYPES) {
      const url = `${BASE_URL}/${type}/for/${slug}`;
      
      entries.push({
        url,
        lastModified: now,
        changeFrequency: "weekly",
        priority: Math.min(1.0, priority * yearPriority * (isPrebuild ? 1.0 : 0.9)),
      });
    }
  }
  
  // Log stats for debugging
  console.log(`[sitemap] Generated ${entries.length} URLs:`);
  console.log(`  - Static pages: ${STATIC_PAGES.length}`);
  console.log(`  - Unique vehicles: ${addedSlugs.size}`);
  console.log(`  - Vehicle URLs: ${addedSlugs.size * PRODUCT_TYPES.length}`);
  
  return entries;
}

/**
 * Sitemap stats for debugging
 */
export function getSitemapStats() {
  const uniqueVehicles = new Set(ALL_VEHICLES.map(v => slugifyVehicle(v))).size;
  return {
    staticPages: STATIC_PAGES.length,
    uniqueVehicles,
    totalProductUrls: uniqueVehicles * PRODUCT_TYPES.length,
    totalUrls: STATIC_PAGES.length + (uniqueVehicles * PRODUCT_TYPES.length),
    prebuildVehicles: PREBUILD_VEHICLES.length,
  };
}
