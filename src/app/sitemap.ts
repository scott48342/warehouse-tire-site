/**
 * Sitemap Generator
 * 
 * Generates XML sitemap for search engines
 */

import { MetadataRoute } from "next";
import { getTopVehicles, getAllMakes, buildVehicleUrl } from "@/lib/seo";

const BASE_URL = "https://shop.warehousetiredirect.com";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [];
  
  // ============================================================================
  // Static Pages
  // ============================================================================
  
  const staticPages = [
    { path: "/", priority: 1.0, changeFrequency: "daily" as const },
    { path: "/wheels", priority: 0.9, changeFrequency: "daily" as const },
    { path: "/tires", priority: 0.9, changeFrequency: "daily" as const },
    { path: "/package", priority: 0.8, changeFrequency: "weekly" as const },
    { path: "/schedule", priority: 0.8, changeFrequency: "monthly" as const },
    { path: "/lifted", priority: 0.7, changeFrequency: "weekly" as const },
  ];
  
  for (const page of staticPages) {
    entries.push({
      url: `${BASE_URL}${page.path}`,
      lastModified: new Date(),
      changeFrequency: page.changeFrequency,
      priority: page.priority,
    });
  }
  
  // ============================================================================
  // SEO Vehicle Pages
  // ============================================================================
  
  try {
    // Get top vehicles for SEO pages
    const topVehicles = await getTopVehicles(200);
    
    // Generate URLs for each product type
    const productTypes: Array<"wheels" | "tires" | "packages"> = ["wheels", "tires", "packages"];
    
    for (const vehicle of topVehicles) {
      for (const productType of productTypes) {
        const path = buildVehicleUrl(productType, vehicle.year, vehicle.make, vehicle.model);
        
        entries.push({
          url: `${BASE_URL}${path}`,
          lastModified: new Date(),
          changeFrequency: "weekly",
          priority: vehicle.priority * 0.7, // Scale down from 1.0
        });
      }
    }
  } catch (err) {
    console.error("[sitemap] Error generating vehicle URLs:", err);
  }
  
  return entries;
}
