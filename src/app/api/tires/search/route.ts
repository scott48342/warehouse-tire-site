/**
 * Unified Tire Search API
 * 
 * Accepts vehicle params (year, make, model, modification) + optional wheelDiameter
 * Returns tires that fit the vehicle.
 * 
 * Flow:
 * 1. If size param provided → direct size search
 * 2. If vehicle params provided:
 *    a. Get tire sizes for vehicle from fitment profile
 *    b. Filter to wheelDiameter if provided
 *    c. Search tires matching those sizes
 */

import { NextResponse } from "next/server";
import pg from "pg";
import { getFitmentProfile } from "@/lib/fitment-db/profileService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const { Pool } = pg;

function required(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

let pool: pg.Pool | null = null;
function getPool() {
  if (pool) return pool;
  const DATABASE_URL = required("DATABASE_URL");
  pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 5,
  });
  return pool;
}

function n(v: any): number | null {
  const x = Number(v);
  return Number.isFinite(x) ? x : null;
}

function i(v: any): number {
  const x = Number(v);
  return Number.isFinite(x) ? Math.trunc(x) : 0;
}

function toSimpleSize(s: string): string {
  // Accept formats like:
  // - 245/50R18 → 2455018
  // - 245/40ZR20 95Y → 2454020
  // - 2455018 → 2455018
  const v = String(s || "").trim().toUpperCase();
  const m = v.match(/(\d{3})\s*\/\s*(\d{2})\s*[A-Z]*\s*R?\s*(\d{2})/i);
  if (m) return `${m[1]}${m[2]}${m[3]}`;
  const m2 = v.match(/^(\d{7})$/);
  if (m2) return m2[1];
  return "";
}

function extractRimDiameter(size: string): number | null {
  // Extract rim diameter from tire size
  // 245/50R18 → 18
  // 2455018 → 18
  const simple = toSimpleSize(size);
  if (simple && simple.length === 7) {
    return parseInt(simple.slice(5), 10);
  }
  const m = size.match(/R(\d{2})/i);
  if (m) return parseInt(m[1], 10);
  return null;
}

interface TireResult {
  partNumber: string;
  mfgPartNumber: string;
  brand: string | null;
  description: string;
  cost: number | null;
  quantity: { primary: number; alternate: number; national: number };
  imageUrl: string | null;
  size: string;
  simpleSize: string;
  rimDiameter: number | null;
  badges: {
    terrain: string | null;
    construction: string | null;
    warrantyMiles: number | null;
    loadIndex: string | null;
    speedRating: string | null;
  };
}

async function searchTiresBySize(
  db: pg.Pool,
  size: string,
  minQty: number,
  limit: number
): Promise<TireResult[]> {
  const simple = toSimpleSize(size) || size;
  
  const { rows } = await db.query({
    text: `
      select
        t.sku,
        t.brand_desc,
        t.tire_description,
        t.tire_size,
        t.simple_size,
        t.terrain,
        t.construction_type,
        t.mileage_warranty,
        t.load_index,
        t.speed_rating,
        t.image_url,
        t.map_usd,
        t.msrp_usd,
        coalesce(i.qoh, 0) as qoh
      from wp_tires t
      left join wp_inventory i
        on i.sku = t.sku
       and i.product_type = 'tire'
       and i.location_id = 'TOTAL'
      where (t.simple_size = $1 or t.tire_size ilike $2)
        and ($3::int is null or coalesce(i.qoh, 0) >= $3::int)
      order by coalesce(i.qoh, 0) desc, t.brand_desc asc, t.sku asc
      limit $4
    `,
    values: [simple, `%${simple}%`, minQty || null, limit],
  });

  return rows.map((r) => {
    const mapUsd0 = n(r.map_usd);
    const msrpUsd0 = n(r.msrp_usd);
    const mapUsd = mapUsd0 != null && mapUsd0 > 0.01 ? mapUsd0 : null;
    const msrpUsd = msrpUsd0 != null && msrpUsd0 > 0.01 ? msrpUsd0 : null;
    const cost = mapUsd != null ? Math.max(0.01, mapUsd - 50) : msrpUsd;
    const tireSize = r.tire_size || r.simple_size || "";

    return {
      partNumber: String(r.sku),
      mfgPartNumber: String(r.sku),
      brand: r.brand_desc || null,
      description: r.tire_description || tireSize || r.sku,
      cost: cost != null && Number.isFinite(cost) ? cost : null,
      quantity: { primary: 0, alternate: 0, national: i(r.qoh) },
      imageUrl: r.image_url || null,
      size: tireSize,
      simpleSize: r.simple_size || toSimpleSize(tireSize),
      rimDiameter: extractRimDiameter(tireSize),
      badges: {
        terrain: r.terrain || null,
        construction: r.construction_type || null,
        warrantyMiles: r.mileage_warranty != null ? i(r.mileage_warranty) : null,
        loadIndex: r.load_index || null,
        speedRating: r.speed_rating || null,
      },
    };
  });
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    
    // Direct size search
    const sizeRaw = (url.searchParams.get("size") || url.searchParams.get("tireSize") || "").trim();
    
    // Vehicle params
    const year = url.searchParams.get("year");
    const make = url.searchParams.get("make");
    const model = url.searchParams.get("model");
    const modification = url.searchParams.get("modification") || url.searchParams.get("trim");
    const wheelDiameter = i(url.searchParams.get("wheelDiameter"));
    
    // Pagination
    const minQty = i(url.searchParams.get("minQty"));
    const pageSize = Math.min(Math.max(i(url.searchParams.get("pageSize") || url.searchParams.get("limit")) || 50, 1), 200);

    const db = getPool();
    
    // Case 1: Direct size search
    if (sizeRaw) {
      const results = await searchTiresBySize(db, sizeRaw, minQty, pageSize);
      return NextResponse.json({
        results,
        mode: "size",
        size: sizeRaw,
      });
    }
    
    // Case 2: Vehicle-based search
    if (!year || !make || !model) {
      return NextResponse.json({
        results: [],
        error: "Vehicle params (year, make, model) or size required",
      });
    }
    
    // Get fitment profile to find tire sizes
    let tireSizes: string[] = [];
    let fitmentSource = "unknown";
    
    if (modification) {
      try {
        const profile = await getFitmentProfile({
          year: parseInt(year, 10),
          make,
          model,
          modificationId: modification,
        });
        
        if (profile?.oemTireSizes && profile.oemTireSizes.length > 0) {
          tireSizes = profile.oemTireSizes.map((ts: any) => 
            typeof ts === "string" ? ts : ts.size || ts.front || ""
          ).filter(Boolean);
          fitmentSource = profile.source || "db";
        }
      } catch (err) {
        console.error("[tires/search] Fitment profile error:", err);
      }
    }
    
    // Fallback: query vehicles/tire-sizes API
    if (tireSizes.length === 0) {
      try {
        const tireSizesUrl = new URL(`${url.origin}/api/vehicles/tire-sizes`);
        tireSizesUrl.searchParams.set("year", year);
        tireSizesUrl.searchParams.set("make", make);
        tireSizesUrl.searchParams.set("model", model);
        if (modification) tireSizesUrl.searchParams.set("modification", modification);
        
        const tsRes = await fetch(tireSizesUrl.toString());
        if (tsRes.ok) {
          const tsData = await tsRes.json();
          tireSizes = (tsData.sizes || tsData.results || []).map((s: any) => 
            typeof s === "string" ? s : s.size || s.front || ""
          ).filter(Boolean);
          fitmentSource = "api-fallback";
        }
      } catch (err) {
        console.error("[tires/search] Tire sizes fallback error:", err);
      }
    }
    
    // Filter by wheel diameter if specified
    if (wheelDiameter && tireSizes.length > 0) {
      const filtered = tireSizes.filter((size) => {
        const rim = extractRimDiameter(size);
        return rim === wheelDiameter;
      });
      
      // If no exact matches, keep all (user might be plus-sizing)
      if (filtered.length > 0) {
        tireSizes = filtered;
      }
    }
    
    if (tireSizes.length === 0) {
      return NextResponse.json({
        results: [],
        mode: "vehicle",
        vehicle: { year, make, model, modification },
        wheelDiameter: wheelDiameter || null,
        error: "No tire sizes found for vehicle",
      });
    }
    
    // Search for tires matching any of the tire sizes
    const allResults: TireResult[] = [];
    const seenSkus = new Set<string>();
    
    for (const size of tireSizes.slice(0, 5)) { // Limit to 5 sizes to avoid N+1
      const results = await searchTiresBySize(db, size, minQty, Math.ceil(pageSize / tireSizes.length));
      for (const tire of results) {
        if (!seenSkus.has(tire.partNumber)) {
          seenSkus.add(tire.partNumber);
          allResults.push(tire);
        }
      }
    }
    
    // Sort by stock and limit
    allResults.sort((a, b) => {
      const qtyA = a.quantity.national;
      const qtyB = b.quantity.national;
      return qtyB - qtyA;
    });
    
    const results = allResults.slice(0, pageSize);
    
    // Filter results to match wheelDiameter if specified
    const filteredResults = wheelDiameter
      ? results.filter((t) => t.rimDiameter === wheelDiameter)
      : results;
    
    return NextResponse.json({
      results: filteredResults.length > 0 ? filteredResults : results,
      mode: "vehicle",
      vehicle: { year, make, model, modification },
      wheelDiameter: wheelDiameter || null,
      tireSizesSearched: tireSizes,
      fitmentSource,
    });
  } catch (e: any) {
    console.error("[tires/search] Error:", e);
    return NextResponse.json(
      { results: [], error: e?.message || String(e) },
      { status: 200 }
    );
  }
}
