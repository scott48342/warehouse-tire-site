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

    if (category) {
      // Category-based search
      const dbCategory = CATEGORY_MAP[category] || category;
      
      sql = `
        SELECT sku, title, brand, brand_code, sell_price, msrp, map_price, 
               in_stock, category, image_url
        FROM accessories
        WHERE category = $1
        ORDER BY 
          CASE WHEN sell_price > 0 THEN 0 ELSE 1 END,
          sell_price ASC NULLS LAST
        LIMIT $2 OFFSET $3
      `;
      params = [dbCategory, pageSize, offset];
      
      countSql = `SELECT COUNT(*) as total FROM accessories WHERE category = $1`;
      countParams = [dbCategory];
      
    } else {
      // Full-text search
      sql = `
        SELECT sku, title, brand, brand_code, sell_price, msrp, map_price,
               in_stock, category, image_url
        FROM accessories
        WHERE search_text @@ plainto_tsquery('english', $1)
           OR title ILIKE $2
           OR sku ILIKE $2
        ORDER BY 
          CASE WHEN sell_price > 0 THEN 0 ELSE 1 END,
          ts_rank(search_text, plainto_tsquery('english', $1)) DESC
        LIMIT $3 OFFSET $4
      `;
      params = [query!, `%${query}%`, pageSize, offset];
      
      countSql = `
        SELECT COUNT(*) as total FROM accessories 
        WHERE search_text @@ plainto_tsquery('english', $1)
           OR title ILIKE $2
           OR sku ILIKE $2
      `;
      countParams = [query!, `%${query}%`];
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

    return NextResponse.json({
      results: items,
      total,
      category,
      query,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
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
