/**
 * Tire Brands API
 * Returns list of available tire brands from all sources:
 * - WheelPros (wp_tires with inventory)
 * - TireWeb cache (tireweb_sku_cache - ATD, K&M, NTW, US AutoForce)
 */

import { NextResponse } from "next/server";
import { Pool } from "pg";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

let pool: Pool | null = null;
function getPool() {
  if (pool) return pool;
  const DATABASE_URL = process.env.POSTGRES_URL;
  if (!DATABASE_URL) throw new Error("Missing POSTGRES_URL");
  pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 3,
  });
  return pool;
}

/**
 * Normalize brand names for consistent display
 * TireWeb returns uppercase; WheelPros uses title case
 */
function normalizeBrandName(brand: string): string {
  // Already properly cased (mixed case = leave alone)
  if (/[a-z]/.test(brand) && /[A-Z]/.test(brand)) {
    return brand;
  }
  
  // Special cases (known brand capitalizations)
  const specialCases: Record<string, string> = {
    "BFGOODRICH": "BFGoodrich",
    "GOODYEAR": "Goodyear",
    "MICHELIN": "Michelin",
    "CONTINENTAL": "Continental",
    "BRIDGESTONE": "Bridgestone",
    "PIRELLI": "Pirelli",
    "DUNLOP": "Dunlop",
    "FIRESTONE": "Firestone",
    "HANKOOK": "Hankook",
    "KUMHO": "Kumho",
    "YOKOHAMA": "Yokohama",
    "TOYO": "Toyo",
    "NITTO": "Nitto",
    "FALKEN": "Falken",
    "COOPER": "Cooper",
    "GENERAL": "General",
    "NEXEN": "Nexen",
    "NOKIAN": "Nokian",
    "UNIROYAL": "Uniroyal",
    "MASTERCRAFT": "Mastercraft",
    "IRONMAN": "Ironman",
    "RBP": "RBP",
    "ARGUS ADVANTA": "Argus Advanta",
    "MICKEY THOMPSON": "Mickey Thompson",
    "DICK CEPEK": "Dick Cepek",
    "PRO COMP": "Pro Comp",
    "FUEL TIRES": "Fuel Tires",
    "GT RADIAL": "GT Radial",
    "LAUFENN": "Laufenn",
    "SUMITOMO": "Sumitomo",
    "SAILUN": "Sailun",
    "WESTLAKE": "Westlake",
    "MILESTAR": "Milestar",
    "LIONHART": "Lionhart",
    "LEXANI": "Lexani",
    "KENDA": "Kenda",
    "KELLY": "Kelly",
    "STARFIRE": "Starfire",
    "HERCULES": "Hercules",
    "FUZION": "Fuzion",
    "THUNDERER": "Thunderer",
    "CROSSWIND": "Crosswind",
    "GLADIATOR": "Gladiator",
    "VOGUE": "Vogue",
    "DOUBLE COIN": "Double Coin",
  };
  
  const upper = brand.toUpperCase();
  if (specialCases[upper]) {
    return specialCases[upper];
  }
  
  // Default: Title Case
  return brand
    .toLowerCase()
    .split(" ")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export async function GET() {
  try {
    const db = getPool();
    
    // Get brands from WheelPros (with inventory)
    const wpQuery = db.query(`
      SELECT t.brand_desc as brand, COUNT(DISTINCT t.sku) as count
      FROM wp_tires t
      JOIN wp_inventory i ON i.sku = t.sku 
        AND i.product_type = 'tire' 
        AND i.location_id = 'TOTAL'
      WHERE t.brand_desc IS NOT NULL 
        AND t.brand_desc != ''
        AND COALESCE(i.qoh, 0) > 0
      GROUP BY t.brand_desc
    `);
    
    // Get brands from TireWeb cache (recent entries = available)
    // Only count SKUs seen in the last 7 days as "available"
    const twQuery = db.query(`
      SELECT brand, COUNT(DISTINCT part_number) as count
      FROM tireweb_sku_cache
      WHERE brand IS NOT NULL 
        AND brand != ''
        AND last_seen_at > NOW() - INTERVAL '7 days'
      GROUP BY brand
    `);
    
    const [wpResult, twResult] = await Promise.all([wpQuery, twQuery]);
    
    // Merge brands from both sources
    // Use normalized brand name as key to combine counts
    const brandMap = new Map<string, { name: string; count: number; sources: string[] }>();
    
    // Add WheelPros brands
    for (const row of wpResult.rows) {
      const normalized = normalizeBrandName(row.brand);
      const key = normalized.toUpperCase();
      
      if (brandMap.has(key)) {
        const existing = brandMap.get(key)!;
        existing.count += parseInt(row.count, 10);
        if (!existing.sources.includes("wheelpros")) {
          existing.sources.push("wheelpros");
        }
      } else {
        brandMap.set(key, {
          name: normalized,
          count: parseInt(row.count, 10),
          sources: ["wheelpros"],
        });
      }
    }
    
    // Add TireWeb brands
    for (const row of twResult.rows) {
      const normalized = normalizeBrandName(row.brand);
      const key = normalized.toUpperCase();
      
      if (brandMap.has(key)) {
        const existing = brandMap.get(key)!;
        existing.count += parseInt(row.count, 10);
        if (!existing.sources.includes("tireweb")) {
          existing.sources.push("tireweb");
        }
      } else {
        brandMap.set(key, {
          name: normalized,
          count: parseInt(row.count, 10),
          sources: ["tireweb"],
        });
      }
    }
    
    // Convert to array and sort by count (descending), then name
    const brands = Array.from(brandMap.values())
      .sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count;
        return a.name.localeCompare(b.name);
      })
      .map(b => ({
        name: b.name,
        count: b.count,
        sources: b.sources,
      }));
    
    return NextResponse.json({
      brands,
      total: brands.length,
      sources: {
        wheelpros: wpResult.rows.length,
        tireweb: twResult.rows.length,
      },
    });
  } catch (error) {
    console.error("[api/tires/brands] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch brands" },
      { status: 500 }
    );
  }
}
