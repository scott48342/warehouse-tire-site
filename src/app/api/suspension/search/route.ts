/**
 * Suspension/Lift Kit Search API
 * 
 * GET /api/suspension/search?year=2022&make=Chevrolet&model=Silverado 1500
 * 
 * Returns lift kits that fit the specified vehicle with pricing and inventory.
 */

import { NextRequest, NextResponse } from "next/server";
import pg from "pg";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const { Pool } = pg;

function getPool() {
  return new Pool({
    connectionString: process.env.POSTGRES_URL,
    ssl: { rejectUnauthorized: false },
    max: 3,
  });
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  
  const year = searchParams.get("year");
  const make = searchParams.get("make");
  const model = searchParams.get("model");
  const minLift = searchParams.get("minLift");
  const maxLift = searchParams.get("maxLift");
  const brand = searchParams.get("brand");
  const page = parseInt(searchParams.get("page") || "1");
  const pageSize = Math.min(parseInt(searchParams.get("pageSize") || "20"), 100);
  
  // Validate required params
  if (!year || !make || !model) {
    return NextResponse.json({
      ok: false,
      error: "Missing required parameters: year, make, model",
    }, { status: 400 });
  }
  
  const yearNum = parseInt(year);
  if (isNaN(yearNum) || yearNum < 1980 || yearNum > 2030) {
    return NextResponse.json({
      ok: false,
      error: "Invalid year",
    }, { status: 400 });
  }
  
  const pool = getPool();
  
  try {
    // Build dynamic WHERE clause
    const conditions = [
      "sf.make ILIKE $1",
      "sf.model ILIKE $2", 
      "sf.year_start <= $3",
      "sf.year_end >= $3",
    ];
    const params: (string | number)[] = [make, `%${model}%`, yearNum];
    let paramIdx = 4;
    
    if (minLift) {
      conditions.push(`sf.lift_height >= $${paramIdx}`);
      params.push(parseFloat(minLift));
      paramIdx++;
    }
    
    if (maxLift) {
      conditions.push(`sf.lift_height <= $${paramIdx}`);
      params.push(parseFloat(maxLift));
      paramIdx++;
    }
    
    if (brand) {
      conditions.push(`sf.brand ILIKE $${paramIdx}`);
      params.push(`%${brand}%`);
      paramIdx++;
    }
    
    const whereClause = "WHERE " + conditions.join(" AND ");
    
    // Count total
    const countResult = await pool.query(
      `SELECT COUNT(*) as total FROM suspension_fitments sf ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0]?.total || "0");
    
    // Get results with inventory join
    const offset = (page - 1) * pageSize;
    const resultsQuery = `
      SELECT 
        sf.sku,
        sf.product_desc,
        sf.brand,
        sf.product_type,
        sf.lift_height,
        sf.make,
        sf.model,
        sf.year_start,
        sf.year_end,
        sf.msrp,
        sf.map_price,
        sf.image_url,
        COALESCE(inv.qoh, 0) as inventory
      FROM suspension_fitments sf
      LEFT JOIN wp_inventory inv ON inv.sku = sf.sku AND inv.product_type = 'accessory'
      ${whereClause}
      ORDER BY 
        sf.lift_height ASC NULLS LAST,
        sf.msrp ASC NULLS LAST
      LIMIT $${paramIdx} OFFSET $${paramIdx + 1}
    `;
    
    const resultsParams = [...params, pageSize, offset];
    const results = await pool.query(resultsQuery, resultsParams);
    
    // Get available brands for filters
    const brandsResult = await pool.query(
      `SELECT DISTINCT brand, COUNT(*) as count
       FROM suspension_fitments sf
       ${whereClause}
       GROUP BY brand
       ORDER BY count DESC`,
      params
    );
    
    // Get lift height range
    const rangeResult = await pool.query(
      `SELECT MIN(lift_height) as min_lift, MAX(lift_height) as max_lift
       FROM suspension_fitments sf
       ${whereClause} AND lift_height IS NOT NULL`,
      params
    );
    
    await pool.end();
    
    return NextResponse.json({
      ok: true,
      vehicle: { year: yearNum, make, model },
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
      filters: {
        brands: brandsResult.rows.map((b: any) => ({ 
          name: b.brand, 
          count: parseInt(b.count) 
        })),
        liftRange: {
          min: rangeResult.rows[0]?.min_lift ? parseFloat(rangeResult.rows[0].min_lift) : null,
          max: rangeResult.rows[0]?.max_lift ? parseFloat(rangeResult.rows[0].max_lift) : null,
        },
      },
      results: results.rows.map((r: any) => ({
        sku: r.sku,
        name: r.product_desc,
        brand: r.brand,
        productType: r.product_type,
        liftHeight: r.lift_height ? parseFloat(r.lift_height) : null,
        yearRange: `${r.year_start}-${r.year_end}`,
        msrp: r.msrp ? parseFloat(r.msrp) : null,
        mapPrice: r.map_price ? parseFloat(r.map_price) : null,
        imageUrl: r.image_url,
        inStock: parseInt(r.inventory) > 0,
        inventory: parseInt(r.inventory),
      })),
    });
    
  } catch (error: any) {
    console.error("[suspension/search] Error:", error);
    await pool.end();
    return NextResponse.json({
      ok: false,
      error: error?.message || "Search failed",
    }, { status: 500 });
  }
}
