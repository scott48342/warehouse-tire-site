/**
 * Accessory Recommendation API
 * 
 * GET /api/accessories/recommend
 * 
 * Query params:
 *   wheelSku - Selected wheel SKU (for center cap matching)
 *   wheelBrand - Wheel brand (e.g., "Moto Metal", "Fuel")
 *   wheelCenterBore - Wheel center bore in mm
 *   vehicleCenterBore - Vehicle hub bore in mm (for hub ring matching)
 *   threadSize - Lug nut thread size (e.g., "M14x1.5")
 *   seatType - Lug nut seat type (e.g., "conical", "ball")
 *   boltPattern - Bolt pattern (e.g., "6x139.7")
 *   lugCount - Number of lugs per wheel (e.g., 5, 6, 8)
 * 
 * Returns recommended accessories grouped by category:
 *   - centerCaps: Matching center caps for the wheel
 *   - lugNuts: Compatible lug nut kits
 *   - hubRings: Hub centric rings if needed
 *   - lights: Popular lighting options
 */

import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db/pool";
import { calculateWheelSellPrice } from "@/lib/pricing";

export const runtime = "nodejs";

type AccessoryItem = {
  sku: string;
  title: string;
  brand: string | null;
  brandCode: string | null;
  category: string;
  subType: string | null;
  price: number;
  msrp: number | null;
  imageUrl: string | null;
  inStock: boolean;
  // Specs
  threadSize?: string | null;
  seatType?: string | null;
  outerDiameter?: number | null;
  innerDiameter?: number | null;
  boltPattern?: string | null;
  wheelBrand?: string | null;
  // Recommendation info
  matchScore?: number;
  matchReason?: string;
};

type Recommendations = {
  centerCaps: AccessoryItem[];
  lugNuts: AccessoryItem[];
  hubRings: AccessoryItem[];
  lights: AccessoryItem[];
  summary: {
    hubRingNeeded: boolean;
    hubRingReason: string | null;
    lugNutSpec: string | null;
    centerCapMatch: string | null;
  };
};

/**
 * Find matching center caps for a wheel
 */
async function findCenterCaps(
  pool: any,
  wheelSku: string | null,
  wheelBrand: string | null,
  boltPattern: string | null
): Promise<AccessoryItem[]> {
  // Try multiple match strategies
  const results: AccessoryItem[] = [];
  
  // Strategy 1: Match by wheel brand
  if (wheelBrand) {
    const brandMatch = await pool.query(`
      SELECT * FROM accessories 
      WHERE category = 'center_cap' 
        AND (wheel_brand = $1 OR UPPER(title) LIKE '%' || UPPER($1) || '%')
      ORDER BY in_stock DESC, sell_price ASC
      LIMIT 10
    `, [wheelBrand]);
    
    for (const row of brandMatch.rows) {
      results.push({
        sku: row.sku,
        title: row.title,
        brand: row.brand,
        brandCode: row.brand_code,
        category: row.category,
        subType: row.sub_type,
        price: row.sell_price || row.msrp || 0,
        msrp: row.msrp,
        imageUrl: row.image_url,
        inStock: row.in_stock,
        boltPattern: row.bolt_pattern,
        wheelBrand: row.wheel_brand,
        matchScore: 90,
        matchReason: `Matches ${wheelBrand} wheels`,
      });
    }
  }
  
  // Strategy 2: Match by bolt pattern
  if (boltPattern && results.length < 5) {
    const bpMatch = await pool.query(`
      SELECT * FROM accessories 
      WHERE category = 'center_cap' 
        AND bolt_pattern = $1
        AND sku NOT IN (SELECT unnest($2::text[]))
      ORDER BY in_stock DESC, sell_price ASC
      LIMIT 5
    `, [boltPattern, results.map(r => r.sku)]);
    
    for (const row of bpMatch.rows) {
      results.push({
        sku: row.sku,
        title: row.title,
        brand: row.brand,
        brandCode: row.brand_code,
        category: row.category,
        subType: row.sub_type,
        price: row.sell_price || row.msrp || 0,
        msrp: row.msrp,
        imageUrl: row.image_url,
        inStock: row.in_stock,
        boltPattern: row.bolt_pattern,
        wheelBrand: row.wheel_brand,
        matchScore: 70,
        matchReason: `Fits ${boltPattern} bolt pattern`,
      });
    }
  }
  
  return results.slice(0, 10);
}

/**
 * Find matching lug nuts
 */
async function findLugNuts(
  pool: any,
  threadSize: string | null,
  seatType: string | null,
  lugCount: number | null
): Promise<AccessoryItem[]> {
  if (!threadSize) return [];
  
  // Normalize thread size for matching
  const normalizedThread = threadSize.toUpperCase().replace(/[^0-9X./-]/g, '');
  
  const query = await pool.query(`
    SELECT * FROM accessories 
    WHERE category = 'lug_nut'
      AND (
        thread_size = $1 
        OR thread_size ILIKE '%' || $2 || '%'
        OR UPPER(title) LIKE '%' || $2 || '%'
      )
      ${seatType ? "AND (seat_type = $3 OR seat_type IS NULL)" : ""}
    ORDER BY 
      CASE WHEN thread_size = $1 THEN 0 ELSE 1 END,
      in_stock DESC,
      sell_price ASC
    LIMIT 10
  `, seatType ? [threadSize, normalizedThread, seatType] : [threadSize, normalizedThread]);
  
  return query.rows.map((row: any) => ({
    sku: row.sku,
    title: row.title,
    brand: row.brand,
    brandCode: row.brand_code,
    category: row.category,
    subType: row.sub_type,
    price: row.sell_price || row.msrp || 0,
    msrp: row.msrp,
    imageUrl: row.image_url,
    inStock: row.in_stock,
    threadSize: row.thread_size,
    seatType: row.seat_type,
    matchScore: row.thread_size === threadSize ? 100 : 80,
    matchReason: `${threadSize} ${seatType || 'conical'} seat`,
  }));
}

/**
 * Find hub centric rings
 */
async function findHubRings(
  pool: any,
  wheelCenterBore: number | null,
  vehicleCenterBore: number | null
): Promise<{ items: AccessoryItem[]; needed: boolean; reason: string | null }> {
  // No hub ring needed if bores match or no data
  if (!wheelCenterBore || !vehicleCenterBore) {
    return { items: [], needed: false, reason: "Hub bore data not available" };
  }
  
  const diff = wheelCenterBore - vehicleCenterBore;
  
  if (diff < 0.5) {
    return { items: [], needed: false, reason: "Wheel bore matches vehicle hub" };
  }
  
  if (diff < 0) {
    return { items: [], needed: false, reason: "Wheel bore too small for vehicle (incompatible)" };
  }
  
  // Find rings: OD = wheel bore, ID = vehicle hub
  const tolerance = 0.5;
  const query = await pool.query(`
    SELECT * FROM accessories 
    WHERE category = 'hub_ring'
      AND outer_diameter BETWEEN $1 AND $2
      AND inner_diameter BETWEEN $3 AND $4
    ORDER BY 
      ABS(outer_diameter - $5) + ABS(inner_diameter - $6),
      in_stock DESC,
      sell_price ASC
    LIMIT 5
  `, [
    wheelCenterBore - tolerance,
    wheelCenterBore + tolerance,
    vehicleCenterBore - tolerance,
    vehicleCenterBore + tolerance,
    wheelCenterBore,
    vehicleCenterBore,
  ]);
  
  return {
    items: query.rows.map((row: any) => ({
      sku: row.sku,
      title: row.title,
      brand: row.brand,
      brandCode: row.brand_code,
      category: row.category,
      subType: row.sub_type,
      price: row.sell_price || row.msrp || 0,
      msrp: row.msrp,
      imageUrl: row.image_url,
      inStock: row.in_stock,
      outerDiameter: row.outer_diameter,
      innerDiameter: row.inner_diameter,
      matchScore: 100,
      matchReason: `${wheelCenterBore}mm → ${vehicleCenterBore}mm`,
    })),
    needed: true,
    reason: `Hub rings needed: wheel bore ${wheelCenterBore}mm → vehicle hub ${vehicleCenterBore}mm`,
  };
}

/**
 * Get popular lighting options
 */
async function findLights(pool: any): Promise<AccessoryItem[]> {
  const query = await pool.query(`
    SELECT * FROM accessories 
    WHERE category = 'lighting'
    ORDER BY in_stock DESC, sell_price ASC
    LIMIT 10
  `);
  
  return query.rows.map((row: any) => ({
    sku: row.sku,
    title: row.title,
    brand: row.brand,
    brandCode: row.brand_code,
    category: row.category,
    subType: row.sub_type,
    price: row.sell_price || row.msrp || 0,
    msrp: row.msrp,
    imageUrl: row.image_url,
    inStock: row.in_stock,
    matchScore: 50,
    matchReason: "Popular lighting option",
  }));
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  
  // Parse query params
  const wheelSku = url.searchParams.get("wheelSku");
  const wheelBrand = url.searchParams.get("wheelBrand");
  const wheelCenterBore = url.searchParams.get("wheelCenterBore");
  const vehicleCenterBore = url.searchParams.get("vehicleCenterBore");
  const threadSize = url.searchParams.get("threadSize");
  const seatType = url.searchParams.get("seatType");
  const boltPattern = url.searchParams.get("boltPattern");
  const lugCount = url.searchParams.get("lugCount");
  const includeAll = url.searchParams.get("includeAll") === "true";
  
  const pool = getDbPool();
  if (!pool) {
    return NextResponse.json({ error: "Database not configured" }, { status: 500 });
  }
  
  try {
    // Check if accessories table exists and has data
    const tableCheck = await pool.query(`
      SELECT COUNT(*) as count FROM accessories
    `).catch(() => ({ rows: [{ count: 0 }] }));
    
    if (Number(tableCheck.rows[0].count) === 0) {
      return NextResponse.json({ 
        error: "Accessories not imported yet",
        hint: "Run: node scripts/import-accessories.mjs --source=api",
      }, { status: 503 });
    }
    
    // Find recommendations for each category
    const [centerCaps, lugNuts, hubRingsResult, lights] = await Promise.all([
      findCenterCaps(pool, wheelSku, wheelBrand, boltPattern),
      findLugNuts(pool, threadSize, seatType, lugCount ? parseInt(lugCount) : null),
      findHubRings(pool, wheelCenterBore ? parseFloat(wheelCenterBore) : null, vehicleCenterBore ? parseFloat(vehicleCenterBore) : null),
      includeAll ? findLights(pool) : Promise.resolve([]),
    ]);
    
    const recommendations: Recommendations = {
      centerCaps,
      lugNuts,
      hubRings: hubRingsResult.items,
      lights,
      summary: {
        hubRingNeeded: hubRingsResult.needed,
        hubRingReason: hubRingsResult.reason,
        lugNutSpec: threadSize ? `${threadSize} ${seatType || 'conical'}` : null,
        centerCapMatch: wheelBrand || null,
      },
    };
    
    return NextResponse.json(recommendations, {
      headers: { "Cache-Control": "public, max-age=300, s-maxage=600" },
    });
    
  } catch (err: any) {
    console.error("[accessories/recommend] Error:", err);
    return NextResponse.json({ 
      error: "Failed to get recommendations",
      detail: err?.message,
    }, { status: 500 });
  }
}
