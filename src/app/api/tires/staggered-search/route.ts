/**
 * Staggered Tire Search API
 * 
 * For vehicles with staggered wheel setups (different front/rear sizes),
 * this endpoint searches for matching tire pairs:
 * - Same brand + model across both sizes
 * - Returns paired results for unified selection
 * 
 * Params:
 * - frontSize: Front tire size (e.g., "245/35R19")
 * - rearSize: Rear tire size (e.g., "305/30R20")
 * - minQty: Minimum quantity per axle (default 2)
 * 
 * Returns:
 * - pairs: Array of { front, rear, brand, model, setPrice } matched tire pairs
 * - frontOnly: Tires only available in front size
 * - rearOnly: Tires only available in rear size
 */

import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getBaseUrl() {
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
}

interface TireResult {
  partNumber: string;
  mfgPartNumber?: string;
  brand: string | null;
  description: string;
  cost: number | null;
  price?: number | null;
  quantity: { primary?: number; alternate?: number; national?: number };
  imageUrl: string | null;
  size?: string;
  simpleSize?: string;
  rimDiameter?: number | null;
  source?: string;
  badges?: {
    terrain?: string | null;
    construction?: string | null;
    warrantyMiles?: number | null;
    loadIndex?: string | null;
    speedRating?: string | null;
  };
  enrichment?: {
    mileage?: number | null;
    treadCategory?: string | null;
    mileageBadge?: string | null;
    loadRange?: string | null;
    isRunFlat?: boolean;
  };
}

interface StaggeredTirePair {
  pairId: string;
  brand: string;
  model: string;
  front: {
    partNumber: string;
    size: string;
    price: number;
    imageUrl: string | null;
    loadIndex?: string | null;
    speedRating?: string | null;
    quantity?: number;
  };
  rear: {
    partNumber: string;
    size: string;
    price: number;
    imageUrl: string | null;
    loadIndex?: string | null;
    speedRating?: string | null;
    quantity?: number;
  };
  setPrice: number; // 2 front + 2 rear
  imageUrl: string | null; // Best image from either
  terrain?: string | null;
  warrantyMiles?: number | null;
  mileage?: number | null;
  treadCategory?: string | null;
}

/**
 * Extract model name from tire description
 * e.g., "PILOT SPORT 4S 245/35ZR19 93Y XL" -> "PILOT SPORT 4S"
 */
function extractModelName(brand: string | null, description: string): string {
  if (!description) return "Unknown";
  
  // Remove size pattern (245/35R19, 305/30ZR20, etc.)
  let model = description.replace(/\d{3}\/\d{2}[A-Z]*R?\d{2}/gi, "").trim();
  
  // Remove load/speed rating (93Y, 103W, etc.)
  model = model.replace(/\b\d{2,3}[A-Z]\b/g, "").trim();
  
  // Remove common suffixes
  model = model.replace(/\b(XL|BSW|BW|OWL|RBL|SL)\b/gi, "").trim();
  
  // Remove brand name if it appears at the start
  if (brand) {
    const brandUpper = brand.toUpperCase();
    if (model.toUpperCase().startsWith(brandUpper)) {
      model = model.slice(brand.length).trim();
    }
  }
  
  // Clean up multiple spaces
  model = model.replace(/\s+/g, " ").trim();
  
  return model || "Unknown";
}

/**
 * Create a normalized key for matching tires across sizes
 */
function getTireMatchKey(brand: string | null, description: string): string {
  const normalizedBrand = (brand || "").toUpperCase().trim();
  const model = extractModelName(brand, description);
  const normalizedModel = model.toUpperCase()
    .replace(/[^A-Z0-9]/g, "") // Remove non-alphanumeric
    .trim();
  return `${normalizedBrand}:${normalizedModel}`;
}

export async function GET(req: Request) {
  const t0 = Date.now();
  
  try {
    const url = new URL(req.url);
    const frontSize = url.searchParams.get("frontSize")?.trim();
    const rearSize = url.searchParams.get("rearSize")?.trim();
    const minQty = Math.max(parseInt(url.searchParams.get("minQty") || "2", 10), 1);
    
    if (!frontSize || !rearSize) {
      return NextResponse.json({
        error: "Missing required params: frontSize and rearSize",
      }, { status: 400 });
    }
    
    console.log(`[staggered-tires] Searching: front=${frontSize}, rear=${rearSize}, minQty=${minQty}`);
    
    // Fetch tires for both sizes in parallel
    const baseUrl = getBaseUrl();
    const [frontRes, rearRes] = await Promise.all([
      fetch(`${baseUrl}/api/tires/search?size=${encodeURIComponent(frontSize)}&minQty=${minQty}`, {
        cache: "no-store",
      }),
      fetch(`${baseUrl}/api/tires/search?size=${encodeURIComponent(rearSize)}&minQty=${minQty}`, {
        cache: "no-store",
      }),
    ]);
    
    if (!frontRes.ok || !rearRes.ok) {
      return NextResponse.json({
        error: "Failed to fetch tire data",
        details: {
          frontStatus: frontRes.status,
          rearStatus: rearRes.status,
        },
      }, { status: 500 });
    }
    
    const frontData = await frontRes.json();
    const rearData = await rearRes.json();
    
    const frontTires: TireResult[] = frontData.results || [];
    const rearTires: TireResult[] = rearData.results || [];
    
    console.log(`[staggered-tires] Found ${frontTires.length} front, ${rearTires.length} rear tires`);
    
    // Index tires by brand+model key
    const frontByKey = new Map<string, TireResult[]>();
    for (const t of frontTires) {
      const key = getTireMatchKey(t.brand, t.description);
      if (!frontByKey.has(key)) frontByKey.set(key, []);
      frontByKey.get(key)!.push(t);
    }
    
    const rearByKey = new Map<string, TireResult[]>();
    for (const t of rearTires) {
      const key = getTireMatchKey(t.brand, t.description);
      if (!rearByKey.has(key)) rearByKey.set(key, []);
      rearByKey.get(key)!.push(t);
    }
    
    // Find matching pairs
    const pairs: StaggeredTirePair[] = [];
    const matchedFrontKeys = new Set<string>();
    const matchedRearKeys = new Set<string>();
    
    for (const [key, frontOptions] of frontByKey) {
      const rearOptions = rearByKey.get(key);
      if (!rearOptions || rearOptions.length === 0) continue;
      
      // Found a match - take the best option from each
      // Sort by: price (ascending), then by stock quantity (descending)
      const sortByValue = (a: TireResult, b: TireResult) => {
        const priceA = a.price ?? a.cost ?? 999999;
        const priceB = b.price ?? b.cost ?? 999999;
        if (priceA !== priceB) return priceA - priceB;
        const qtyA = (a.quantity?.primary ?? 0) + (a.quantity?.alternate ?? 0);
        const qtyB = (b.quantity?.primary ?? 0) + (b.quantity?.alternate ?? 0);
        return qtyB - qtyA;
      };
      
      frontOptions.sort(sortByValue);
      rearOptions.sort(sortByValue);
      
      const front = frontOptions[0];
      const rear = rearOptions[0];
      
      const frontPrice = front.price ?? front.cost ?? 0;
      const rearPrice = rear.price ?? rear.cost ?? 0;
      const setPrice = (frontPrice * 2) + (rearPrice * 2);
      
      const model = extractModelName(front.brand, front.description);
      
      pairs.push({
        pairId: `${front.partNumber}:${rear.partNumber}`,
        brand: front.brand || "Unknown",
        model,
        front: {
          partNumber: front.partNumber,
          size: front.size || frontSize,
          price: frontPrice,
          imageUrl: front.imageUrl,
          loadIndex: front.badges?.loadIndex,
          speedRating: front.badges?.speedRating,
          quantity: (front.quantity?.primary ?? 0) + (front.quantity?.alternate ?? 0),
        },
        rear: {
          partNumber: rear.partNumber,
          size: rear.size || rearSize,
          price: rearPrice,
          imageUrl: rear.imageUrl,
          loadIndex: rear.badges?.loadIndex,
          speedRating: rear.badges?.speedRating,
          quantity: (rear.quantity?.primary ?? 0) + (rear.quantity?.alternate ?? 0),
        },
        setPrice,
        imageUrl: front.imageUrl || rear.imageUrl,
        terrain: front.badges?.terrain || rear.badges?.terrain,
        warrantyMiles: front.badges?.warrantyMiles ?? rear.badges?.warrantyMiles,
        mileage: front.enrichment?.mileage ?? rear.enrichment?.mileage,
        treadCategory: front.enrichment?.treadCategory ?? rear.enrichment?.treadCategory,
      });
      
      matchedFrontKeys.add(key);
      matchedRearKeys.add(key);
    }
    
    // Sort pairs by set price
    pairs.sort((a, b) => a.setPrice - b.setPrice);
    
    // Collect unmatched tires
    const frontOnly: TireResult[] = [];
    const rearOnly: TireResult[] = [];
    
    for (const [key, tires] of frontByKey) {
      if (!matchedFrontKeys.has(key)) {
        frontOnly.push(...tires);
      }
    }
    
    for (const [key, tires] of rearByKey) {
      if (!matchedRearKeys.has(key)) {
        rearOnly.push(...tires);
      }
    }
    
    console.log(`[staggered-tires] Paired: ${pairs.length}, frontOnly: ${frontOnly.length}, rearOnly: ${rearOnly.length}`);
    
    return NextResponse.json({
      pairs,
      pairCount: pairs.length,
      frontOnly: frontOnly.slice(0, 20), // Limit unmatched
      rearOnly: rearOnly.slice(0, 20),
      meta: {
        frontSize,
        rearSize,
        frontTotal: frontTires.length,
        rearTotal: rearTires.length,
        timing: {
          totalMs: Date.now() - t0,
        },
      },
    });
    
  } catch (err) {
    console.error("[staggered-tires] Error:", err);
    return NextResponse.json({
      error: "Internal server error",
      message: err instanceof Error ? err.message : String(err),
    }, { status: 500 });
  }
}
