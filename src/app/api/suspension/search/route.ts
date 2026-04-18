/**
 * Suspension/Lift Kit Search API
 * 
 * GET /api/suspension/search?year=2022&make=Chevrolet&model=Silverado 1500
 * GET /api/suspension/search?year=2022&make=Chevrolet&model=Silverado 1500&liftLevel=4in
 * GET /api/suspension/search?year=2022&make=Chevrolet&model=Silverado 1500&groupByLevel=true
 * 
 * Returns lift kits that fit the specified vehicle with pricing and inventory.
 * Supports filtering by lift level (leveled, 4in, 6in, 8in) and grouping.
 */

import { NextRequest, NextResponse } from "next/server";
import pg from "pg";
import { LIFT_LEVELS } from "@/lib/homepage-intent/config";
import type { LiftLevel } from "@/lib/homepage-intent/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const { Pool } = pg;

/**
 * Map lift height (inches) to our standard lift levels
 */
function liftHeightToLevel(inches: number | null): LiftLevel | null {
  if (inches === null) return null;
  
  if (inches <= 2.5) return "leveled";
  if (inches <= 4.5) return "4in";
  if (inches <= 7) return "6in";
  if (inches > 7) return "8in";
  
  return null;
}

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
  const liftLevel = searchParams.get("liftLevel") as LiftLevel | null;
  const groupByLevel = searchParams.get("groupByLevel") === "true";
  const inStockOnly = searchParams.get("inStockOnly") === "true";
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
    // Build model matching condition with aliases for HD trucks
    // Super Duty = F-250, F-350, F-450 (Ford)
    // Silverado/Sierra HD = 2500 HD, 3500 HD (GM)
    let modelCondition = "sf.model ILIKE $2";
    const modelPatterns: string[] = [`%${model}%`];
    
    // Ford Super Duty aliases (F-250, F-350, F-450 are all "Super Duty")
    if (make.toLowerCase() === 'ford') {
      if (model.toLowerCase().includes('f-250') || model.toLowerCase().includes('f250')) {
        modelPatterns.push('%Super Duty%');
      } else if (model.toLowerCase().includes('f-350') || model.toLowerCase().includes('f350')) {
        modelPatterns.push('%Super Duty%');
      } else if (model.toLowerCase().includes('f-450') || model.toLowerCase().includes('f450')) {
        modelPatterns.push('%Super Duty%');
      } else if (model.toLowerCase().includes('super duty')) {
        modelPatterns.push('%F-250%', '%F-350%', '%F-450%');
      }
    }
    
    // Jeep Wrangler aliases (JK, JL, TJ, 2-Door, 4-Door, Diesel are all "Wrangler")
    if (make.toLowerCase() === 'jeep') {
      const modelLower = model.toLowerCase();
      if (modelLower.includes('wrangler')) {
        // When searching for any Wrangler variant, include all Wrangler models
        // But respect generation (JK vs JL vs TJ) if specified
        if (modelLower.includes('jl')) {
          // JL generation (2018+): include 2-door, 4-door, diesel variants
          modelPatterns.push('%Wrangler JL%', '%Wrangler JL 2-Door%', '%Wrangler JL 4-Door%', '%Wrangler JL Diesel%');
        } else if (modelLower.includes('jk')) {
          // JK generation (2007-2018): include 2-door, 4-door variants
          modelPatterns.push('%Wrangler JK%', '%Wrangler JK 2-Door%', '%Wrangler JK 4-Door%');
        } else if (modelLower.includes('tj')) {
          // TJ generation (1997-2006): include LJ (Unlimited) variant
          modelPatterns.push('%Wrangler TJ%', '%Wrangler LJ%');
        } else if (modelLower === 'wrangler' || modelLower.includes('wrangler ')) {
          // Generic "Wrangler" search - include ALL variants
          modelPatterns.push('%Wrangler JK%', '%Wrangler JL%', '%Wrangler TJ%', '%Wrangler LJ%');
        }
      } else if (modelLower.includes('gladiator')) {
        // Gladiator: include diesel variant
        modelPatterns.push('%Gladiator%', '%Gladiator Diesel%');
      } else if (modelLower.includes('cherokee') && !modelLower.includes('grand')) {
        // Cherokee: include XJ, KL variants
        modelPatterns.push('%Cherokee XJ%', '%Cherokee KL%');
      } else if (modelLower.includes('grand cherokee')) {
        // Grand Cherokee: include ZJ, WJ, WK variants
        modelPatterns.push('%Grand Cherokee ZJ%', '%Grand Cherokee WJ%', '%Grand Cherokee WK%');
      }
    }
    
    // GM Silverado ↔ Sierra cross-reference (same platform)
    // For cross-make references, we need to expand the make filter too
    const makeLower = make.toLowerCase();
    const modelLower = model.toLowerCase();
    let makeCondition = "sf.make ILIKE $1";
    const makes: string[] = [make];
    
    if (makeLower === 'chevrolet' && modelLower.includes('silverado')) {
      // Also search GMC Sierra (same truck, different badge)
      makes.push('GMC');
      if (modelLower.includes('1500')) {
        modelPatterns.push('%Sierra 1500%');
      } else if (modelLower.includes('2500')) {
        modelPatterns.push('%Sierra 2500%');
      } else if (modelLower.includes('3500')) {
        modelPatterns.push('%Sierra 3500%');
      }
    } else if (makeLower === 'gmc' && modelLower.includes('sierra')) {
      // Also search Chevrolet Silverado (same truck, different badge)
      makes.push('Chevrolet');
      if (modelLower.includes('1500')) {
        modelPatterns.push('%Silverado 1500%');
      } else if (modelLower.includes('2500')) {
        modelPatterns.push('%Silverado 2500%');
      } else if (modelLower.includes('3500')) {
        modelPatterns.push('%Silverado 3500%');
      }
    }
    
    // GM Colorado ↔ Canyon cross-reference (same platform)
    if (makeLower === 'chevrolet' && modelLower.includes('colorado')) {
      makes.push('GMC');
      modelPatterns.push('%Canyon%');
    } else if (makeLower === 'gmc' && modelLower.includes('canyon')) {
      makes.push('Chevrolet');
      modelPatterns.push('%Colorado%');
    }
    
    // Build OR condition for multiple model patterns
    if (modelPatterns.length > 1) {
      const orClauses = modelPatterns.map((_, i) => `sf.model ILIKE $${2 + i}`).join(' OR ');
      modelCondition = `(${orClauses})`;
    }
    
    // Build make condition (may include multiple makes for cross-references)
    if (makes.length > 1) {
      const makeOrClauses = makes.map((_, i) => `sf.make ILIKE $${1 + i}`).join(' OR ');
      makeCondition = `(${makeOrClauses})`;
    }
    
    // Build dynamic WHERE clause
    // Adjust parameter indices based on number of makes
    const modelStartIdx = 1 + makes.length;
    const yearIdx = modelStartIdx + modelPatterns.length;
    
    if (modelPatterns.length > 1) {
      const orClauses = modelPatterns.map((_, i) => `sf.model ILIKE $${modelStartIdx + i}`).join(' OR ');
      modelCondition = `(${orClauses})`;
    } else {
      modelCondition = `sf.model ILIKE $${modelStartIdx}`;
    }
    
    const conditions = [
      makeCondition,
      modelCondition, 
      `sf.year_start <= $${yearIdx}`,
      `sf.year_end >= $${yearIdx}`,
    ];
    const params: (string | number)[] = [...makes, ...modelPatterns, yearNum];
    let paramIdx = yearIdx + 1;
    
    // Filter by lift level if specified
    if (liftLevel && liftLevel in LIFT_LEVELS) {
      if (liftLevel === "leveled") {
        conditions.push(`(sf.lift_height IS NULL OR sf.lift_height <= 2.5)`);
      } else if (liftLevel === "4in") {
        conditions.push(`sf.lift_height > 2.5 AND sf.lift_height <= 4.5`);
      } else if (liftLevel === "6in") {
        conditions.push(`sf.lift_height > 4.5 AND sf.lift_height <= 7`);
      } else if (liftLevel === "8in") {
        conditions.push(`sf.lift_height > 7`);
      }
    }
    
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
    
    // Filter by in stock only
    if (inStockOnly) {
      // Note: Applied in the query join, not here
    }
    
    const whereClause = "WHERE " + conditions.join(" AND ");
    
    // Build inventory filter for inStockOnly
    const inventoryJoin = `LEFT JOIN wp_inventory inv ON inv.sku = sf.sku AND inv.product_type = 'accessory'`;
    const inventoryFilter = inStockOnly ? "AND COALESCE(inv.qoh, 0) > 0" : "";
    
    // Count total (need to join for inStockOnly filter)
    const countResult = await pool.query(
      `SELECT COUNT(DISTINCT sf.sku) as total 
       FROM suspension_fitments sf 
       ${inventoryJoin}
       ${whereClause} ${inventoryFilter}`,
      params
    );
    const total = parseInt(countResult.rows[0]?.total || "0");
    
    // Get results with inventory join
    const offset = (page - 1) * pageSize;
    const resultsQuery = `
      SELECT DISTINCT ON (sf.sku)
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
      ${inventoryJoin}
      ${whereClause} ${inventoryFilter}
      ORDER BY sf.sku, sf.lift_height ASC NULLS LAST, sf.msrp ASC NULLS LAST
    `;
    
    // Note: For groupByLevel we need all results, otherwise paginate
    const paginatedQuery = groupByLevel
      ? resultsQuery
      : `${resultsQuery} LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`;
    
    const resultsParams = groupByLevel ? params : [...params, pageSize, offset];
    const results = await pool.query(paginatedQuery, resultsParams);
    
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
    
    // Map results to clean objects
    const mappedResults = results.rows.map((r: any) => ({
      sku: r.sku,
      name: r.product_desc,
      brand: r.brand,
      productType: r.product_type,
      liftHeight: r.lift_height ? parseFloat(r.lift_height) : null,
      liftLevel: liftHeightToLevel(r.lift_height ? parseFloat(r.lift_height) : null),
      yearRange: `${r.year_start}-${r.year_end}`,
      msrp: r.msrp ? parseFloat(r.msrp) : null,
      mapPrice: r.map_price ? parseFloat(r.map_price) : null,
      imageUrl: r.image_url,
      inStock: parseInt(r.inventory) > 0,
      inventory: parseInt(r.inventory),
    }));
    
    // Group by level if requested
    let byLevel: any[] | undefined;
    let ungroupedKits: typeof mappedResults = [];
    
    if (groupByLevel) {
      const levelOrder: LiftLevel[] = ["leveled", "4in", "6in", "8in"];
      const levelMap = new Map<LiftLevel, typeof mappedResults>();
      
      for (const kit of mappedResults) {
        const level = kit.liftLevel;
        if (level) {
          if (!levelMap.has(level)) levelMap.set(level, []);
          levelMap.get(level)!.push(kit);
        } else {
          // Products without lift_height go to ungrouped
          ungroupedKits.push(kit);
        }
      }
      
      byLevel = levelOrder
        .filter(l => levelMap.has(l))
        .map(level => {
          const config = LIFT_LEVELS[level];
          return {
            liftLevel: level,
            label: config.label,
            inches: config.inches,
            offsetMin: config.offsetMin,
            offsetMax: config.offsetMax,
            targetTireSizes: config.targetTireSizes,
            kits: levelMap.get(level) || [],
            count: (levelMap.get(level) || []).length,
          };
        });
      
      // Add ungrouped section if there are products without lift_height
      if (ungroupedKits.length > 0) {
        byLevel.push({
          liftLevel: "other",
          label: "Other Suspension Parts",
          inches: null,
          offsetMin: null,
          offsetMax: null,
          targetTireSizes: [],
          kits: ungroupedKits,
          count: ungroupedKits.length,
        });
      }
    }
    
    return NextResponse.json({
      ok: true,
      vehicle: { year: yearNum, make, model },
      total,
      page: groupByLevel ? 1 : page,
      pageSize: groupByLevel ? total : pageSize,
      totalPages: groupByLevel ? 1 : Math.ceil(total / pageSize),
      filters: {
        brands: brandsResult.rows.map((b: any) => ({ 
          name: b.brand, 
          count: parseInt(b.count) 
        })),
        liftRange: {
          min: rangeResult.rows[0]?.min_lift ? parseFloat(rangeResult.rows[0].min_lift) : null,
          max: rangeResult.rows[0]?.max_lift ? parseFloat(rangeResult.rows[0].max_lift) : null,
        },
        liftLevels: Object.entries(LIFT_LEVELS).map(([id, config]) => ({
          id,
          label: config.label,
          inches: config.inches,
        })),
      },
      // Grouped results (when groupByLevel=true)
      ...(byLevel ? { byLevel } : {}),
      // Flat results - include even with groupByLevel if byLevel is empty (products without lift_height)
      results: (groupByLevel && byLevel && byLevel.length > 0) ? [] : mappedResults,
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
