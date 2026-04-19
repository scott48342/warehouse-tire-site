/**
 * Generic Accessory Search API
 * 
 * GET /api/accessories/search?category=hub-ring&pageSize=50
 * 
 * Categories:
 * - lug-nut / lug_nut: Lug nuts and wheel locks
 * - hub-ring / hub_ring: Hub centric rings
 * - center-cap / center_cap: Center caps
 * - lighting: LED lights, light bars
 * - tpms: TPMS sensors and kits
 * - valve-stem / valve_stem: Valve stems and caps
 * - spacer: Wheel spacers
 * 
 * Now reads from our local database (imported from TechFeed)
 */

import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db/pool";

export const runtime = "nodejs";

// Map URL-friendly category names to database category values
const CATEGORY_MAP: Record<string, string> = {
  "lug-nut": "lug_nut",
  "lug_nut": "lug_nut",
  "hub-ring": "hub_ring",
  "hub_ring": "hub_ring",
  "center-cap": "center_cap",
  "center_cap": "center_cap",
  "lighting": "lighting",
  "tpms": "tpms",
  "valve-stem": "valve_stem",
  "valve_stem": "valve_stem",
  "spacer": "spacer",
  "other": "other",
};

type AccessoryItem = {
  sku: string;
  title: string;
  brand?: string;
  brandCode?: string;
  price: number;
  msrp?: number;
  map?: number;
  inStock: boolean;
  category: string;
  imageUrl?: string;
};

export async function GET(req: Request) {
  const url = new URL(req.url);
  const category = url.searchParams.get("category");
  const query = url.searchParams.get("q");
  const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get("pageSize") || "50")));
  const page = Math.max(1, Number(url.searchParams.get("page") || "1"));
  const offset = (page - 1) * pageSize;

  if (!category && !query) {
    return NextResponse.json({ 
      error: "Missing category or q parameter",
      validCategories: Object.keys(CATEGORY_MAP),
    }, { status: 400 });
  }

  const pool = getDbPool();
  if (!pool) {
    return NextResponse.json({ error: "Database not available" }, { status: 500 });
  }

  try {
    let sql: string;
    let params: any[];
    let countSql: string;
    let countParams: any[];

    // Filter options
    const hideNoImage = url.searchParams.get("hideNoImage") !== "0"; // Default: hide items without images
    const minPrice = parseFloat(url.searchParams.get("minPrice") || "0") || 0;
    const maxPrice = parseFloat(url.searchParams.get("maxPrice") || "0") || 0;
    const brandFilter = url.searchParams.get("brand");
    const inStockOnly = url.searchParams.get("inStock") === "1";

    if (category) {
      // Category-based search
      const dbCategory = CATEGORY_MAP[category] || category;
      
      // Build WHERE clauses
      const conditions = ["category = $1"];
      const countConditions = ["category = $1"];
      params = [dbCategory];
      countParams = [dbCategory];
      let paramIdx = 2;
      
      if (hideNoImage) {
        conditions.push("image_url IS NOT NULL AND image_url != ''");
        countConditions.push("image_url IS NOT NULL AND image_url != ''");
      }
      
      if (minPrice > 0) {
        conditions.push(`sell_price >= $${paramIdx}`);
        countConditions.push(`sell_price >= $${paramIdx}`);
        params.push(minPrice);
        countParams.push(minPrice);
        paramIdx++;
      }
      
      if (maxPrice > 0) {
        conditions.push(`sell_price <= $${paramIdx}`);
        countConditions.push(`sell_price <= $${paramIdx}`);
        params.push(maxPrice);
        countParams.push(maxPrice);
        paramIdx++;
      }
      
      if (brandFilter) {
        conditions.push(`brand ILIKE $${paramIdx}`);
        countConditions.push(`brand ILIKE $${paramIdx}`);
        params.push(`%${brandFilter}%`);
        countParams.push(`%${brandFilter}%`);
        paramIdx++;
      }
      
      if (inStockOnly) {
        conditions.push("in_stock = true");
        countConditions.push("in_stock = true");
      }
      
      sql = `
        SELECT sku, title, brand, brand_code, sell_price, msrp, map_price, 
               in_stock, category, image_url
        FROM accessories
        WHERE ${conditions.join(" AND ")}
        ORDER BY 
          CASE WHEN sell_price > 0 THEN 0 ELSE 1 END,
          sell_price ASC NULLS LAST
        LIMIT $${paramIdx} OFFSET $${paramIdx + 1}
      `;
      params.push(pageSize, offset);
      
      countSql = `SELECT COUNT(*) as total FROM accessories WHERE ${countConditions.join(" AND ")}`;
      // countParams already set
      
    } else {
      // Full-text search
      const searchConditions = [
        "(search_text @@ plainto_tsquery('english', $1) OR title ILIKE $2 OR sku ILIKE $2)"
      ];
      if (hideNoImage) {
        searchConditions.push("image_url IS NOT NULL AND image_url != ''");
      }
      
      sql = `
        SELECT sku, title, brand, brand_code, sell_price, msrp, map_price,
               in_stock, category, image_url
        FROM accessories
        WHERE ${searchConditions.join(" AND ")}
        ORDER BY 
          CASE WHEN sell_price > 0 THEN 0 ELSE 1 END,
          ts_rank(search_text, plainto_tsquery('english', $1)) DESC
        LIMIT $3 OFFSET $4
      `;
      params = [query!, `%${query}%`, pageSize, offset];
      
      countSql = `
        SELECT COUNT(*) as total FROM accessories 
        WHERE ${searchConditions.join(" AND ")}
      `;
      countParams = [query!, `%${query}%`];
    }

    // Get brands for this category (for filter sidebar)
    let brandsResult: any = { rows: [] };
    if (category) {
      const dbCategory = CATEGORY_MAP[category] || category;
      const brandConditions = ["category = $1", "brand IS NOT NULL"];
      if (hideNoImage) {
        brandConditions.push("image_url IS NOT NULL AND image_url != ''");
      }
      brandsResult = await pool.query(`
        SELECT brand, COUNT(*) as count 
        FROM accessories 
        WHERE ${brandConditions.join(" AND ")}
        GROUP BY brand 
        ORDER BY count DESC
        LIMIT 50
      `, [dbCategory]);
    }

    const [result, countResult] = await Promise.all([
      pool.query(sql, params),
      pool.query(countSql, countParams),
    ]);

    const items: AccessoryItem[] = result.rows.map(row => ({
      sku: row.sku,
      title: row.title || row.sku,
      brand: row.brand || undefined,
      brandCode: row.brand_code || undefined,
      price: parseFloat(row.sell_price) || 0,
      msrp: row.msrp ? parseFloat(row.msrp) : undefined,
      map: row.map_price ? parseFloat(row.map_price) : undefined,
      inStock: row.in_stock ?? true, // Default to true if not set
      category: row.category || "other",
      imageUrl: row.image_url || undefined,
    }));

    const total = parseInt(countResult.rows[0]?.total || "0");
    
    // Build brands list from query
    const brands = brandsResult.rows.map((r: any) => ({
      name: r.brand,
      count: parseInt(r.count),
    }));

    return NextResponse.json({
      results: items,
      total,
      category,
      query,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
      brands, // For filter sidebar
    }, {
      headers: { "Cache-Control": "public, max-age=60, s-maxage=300" },
    });

  } catch (err: any) {
    console.error("[accessories/search] Error:", err?.message || err);
    return NextResponse.json({ 
      error: "Failed to search accessories",
      detail: err?.message,
    }, { status: 500 });
  }
}
