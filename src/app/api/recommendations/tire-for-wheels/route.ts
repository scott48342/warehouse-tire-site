import { NextRequest, NextResponse } from "next/server";
import { getVehicleProfile, isCategoryAllowedForVehicle, getVehicleAwareReason } from "@/lib/recommendations/tireRecommendations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Smart Tire Upsell API
 * 
 * Given wheel details + vehicle context, returns the single best tire recommendation.
 * Uses existing tire search and recommendation logic.
 * 
 * Request:
 *   POST /api/recommendations/tire-for-wheels
 *   {
 *     wheelDiameter: "20",
 *     wheelWidth?: "9",
 *     vehicle: { year, make, model, trim?, modification? },
 *     staggered?: boolean,
 *     rearWheelWidth?: "10",
 *   }
 * 
 * Response:
 *   {
 *     ok: true,
 *     recommendation: {
 *       sku, rearSku?, brand, model, size, rearSize?,
 *       imageUrl, unitPrice, reason, reasonType,
 *       setPrice, inStock, confidence
 *     } | null,
 *     fallbackOptions?: [...], // If no single best, up to 2 alternatives
 *     tireSize: "275/45R20",
 *     rearTireSize?: "305/35R20",
 *   }
 */

// Premium brands get priority
const PREMIUM_BRANDS = ['michelin', 'bridgestone', 'continental', 'goodyear', 'pirelli'];
const MID_TIER_BRANDS = ['cooper', 'toyo', 'bfgoodrich', 'yokohama', 'hankook', 'falken', 'general', 'kumho', 'nexen', 'nitto', 'firestone'];

interface TireCandidate {
  sku: string;
  brand: string;
  model: string;
  name?: string;
  size: string;
  imageUrl?: string | null;
  price?: number | null;
  cost?: number | null;
  msrp?: number | null;
  stock?: number;
  localQty?: number;
  category?: string | null;
  mileageWarranty?: number | null;
  is3PMSF?: boolean;
  source?: string;
}

interface RecommendedTire {
  sku: string;
  rearSku?: string;
  brand: string;
  model: string;
  displayName: string;
  size: string;
  rearSize?: string;
  imageUrl: string | null;
  unitPrice: number;
  setPrice: number;
  reason: string;
  reasonType: string;
  inStock: boolean;
  confidence: "high" | "medium" | "low";
  source?: string;
}

function getDisplayPrice(tire: TireCandidate): number | null {
  // Priority: sell price > cost + margin > MSRP × 0.85 + margin
  if (typeof tire.price === "number" && tire.price > 0) {
    return tire.price;
  }
  if (typeof tire.cost === "number" && tire.cost > 0) {
    return tire.cost + 50; // Standard tire margin
  }
  if (typeof tire.msrp === "number" && tire.msrp > 0) {
    return tire.msrp * 0.85 + 50;
  }
  return null;
}

function getBrandTier(brand: string): number {
  const b = brand.toLowerCase();
  if (PREMIUM_BRANDS.includes(b)) return 3;
  if (MID_TIER_BRANDS.includes(b)) return 2;
  return 1;
}

function getStockLevel(tire: TireCandidate): number {
  return tire.stock || tire.localQty || 0;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { wheelDiameter, wheelWidth, vehicle, staggered, rearWheelWidth } = body;

    if (!wheelDiameter) {
      return NextResponse.json({ ok: false, error: "wheelDiameter required" }, { status: 400 });
    }

    // Get vehicle profile for category filtering
    const vehicleProfile = getVehicleProfile(vehicle);
    const vehicleLabel = vehicle 
      ? `${vehicle.year} ${vehicle.make} ${vehicle.model}`.trim()
      : null;

    // Determine tire size based on wheel diameter
    // For now, use a size lookup API or calculate common sizes
    const origin = req.nextUrl.origin;
    
    // Try to get fitment-correct tire sizes from vehicle configurations
    let tireSizes: string[] = [];
    let rearTireSizes: string[] = [];
    
    if (vehicle?.year && vehicle?.make && vehicle?.model) {
      try {
        const configUrl = new URL("/api/vehicles/configurations", origin);
        configUrl.searchParams.set("year", vehicle.year);
        configUrl.searchParams.set("make", vehicle.make);
        configUrl.searchParams.set("model", vehicle.model);
        if (vehicle.trim) configUrl.searchParams.set("trim", vehicle.trim);
        
        const configRes = await fetch(configUrl.toString());
        if (configRes.ok) {
          const configData = await configRes.json();
          const configs = configData.configurations || [];
          
          // Find configs that match the wheel diameter
          for (const config of configs) {
            const frontWheel = config.frontWheel || config.wheel;
            const rearWheel = config.rearWheel;
            
            if (frontWheel?.diameter === wheelDiameter || 
                String(frontWheel?.diameter) === String(wheelDiameter)) {
              // Get tire size for this config
              const frontTire = config.frontTire || config.tire;
              if (frontTire?.size) {
                tireSizes.push(frontTire.size);
              }
              if (staggered && rearWheel && config.rearTire?.size) {
                rearTireSizes.push(config.rearTire.size);
              }
            }
          }
        }
      } catch (e) {
        console.warn("[tire-for-wheels] Config lookup failed:", e);
      }
    }

    // Fallback: Generate common tire sizes for wheel diameter
    if (tireSizes.length === 0) {
      const dia = parseInt(wheelDiameter, 10);
      tireSizes = generateCommonTireSizes(dia);
    }

    // Dedupe
    tireSizes = [...new Set(tireSizes)];
    if (rearTireSizes.length > 0) {
      rearTireSizes = [...new Set(rearTireSizes)];
    }

    // Search for tires matching these sizes
    const primarySize = tireSizes[0];
    const rearSize = staggered && rearTireSizes.length > 0 ? rearTireSizes[0] : undefined;

    if (!primarySize) {
      return NextResponse.json({
        ok: true,
        recommendation: null,
        tireSize: null,
        noSizeMatch: true,
      });
    }

    // Fetch tire candidates
    const searchUrl = new URL("/api/tires/search", origin);
    searchUrl.searchParams.set("size", primarySize);
    searchUrl.searchParams.set("limit", "50"); // Get enough candidates to filter
    searchUrl.searchParams.set("inStock", "true");

    const searchRes = await fetch(searchUrl.toString());
    if (!searchRes.ok) {
      throw new Error(`Tire search failed: ${searchRes.status}`);
    }

    const searchData = await searchRes.json();
    const candidates: TireCandidate[] = searchData.results || [];

    if (candidates.length === 0) {
      return NextResponse.json({
        ok: true,
        recommendation: null,
        tireSize: primarySize,
        rearTireSize: rearSize,
        noStock: true,
      });
    }

    // Filter and score candidates
    const scoredCandidates = candidates
      .filter(t => {
        // Must have price
        const price = getDisplayPrice(t);
        if (!price || price <= 0) return false;
        
        // Must have stock (prefer 4+)
        const stock = getStockLevel(t);
        if (stock < 1) return false;
        
        // Category must be appropriate for vehicle type
        const category = t.category || '';
        if (!isCategoryAllowedForVehicle(category, vehicleProfile)) return false;
        
        return true;
      })
      .map(t => {
        const price = getDisplayPrice(t)!;
        const stock = getStockLevel(t);
        const brandTier = getBrandTier(t.brand);
        const mileage = t.mileageWarranty || 0;
        
        // Score: higher is better
        // Prioritize: in-stock (4+), mid-price, reputable brand, good warranty
        let score = 0;
        
        // Stock bonus (4+ is ideal for a set)
        score += stock >= 4 ? 30 : stock >= 2 ? 15 : 5;
        
        // Brand tier bonus
        score += brandTier * 15;
        
        // Warranty bonus
        if (mileage >= 80000) score += 20;
        else if (mileage >= 60000) score += 15;
        else if (mileage >= 40000) score += 10;
        
        // Price positioning: prefer 25th-75th percentile
        // (calculated across candidates)
        
        // 3PMSF bonus for all-weather confidence
        if (t.is3PMSF) score += 10;
        
        // Has image bonus
        if (t.imageUrl) score += 5;
        
        return { tire: t, price, stock, score };
      })
      .sort((a, b) => b.score - a.score);

    if (scoredCandidates.length === 0) {
      return NextResponse.json({
        ok: true,
        recommendation: null,
        tireSize: primarySize,
        rearTireSize: rearSize,
        noCategoryMatch: true,
        vehicleType: vehicleProfile.type,
      });
    }

    // Pick the best candidate
    const best = scoredCandidates[0];
    const { tire, price, stock, score } = best;

    // Determine confidence
    const confidence: "high" | "medium" | "low" = 
      stock >= 4 && getBrandTier(tire.brand) >= 2 ? "high" :
      stock >= 2 || getBrandTier(tire.brand) >= 2 ? "medium" : "low";

    // Generate reason
    let reasonType: "comfort" | "durability" | "allAround" | "performance" = "allAround";
    const category = (tire.category || '').toLowerCase();
    if (tire.mileageWarranty && tire.mileageWarranty >= 60000) {
      reasonType = "durability";
    } else if (/touring|highway/i.test(category)) {
      reasonType = "comfort";
    } else if (/performance|summer|uhp/i.test(category)) {
      reasonType = "performance";
    }

    const reason = getVehicleAwareReason(vehicleProfile, reasonType, {
      sku: tire.sku,
      mileageWarranty: tire.mileageWarranty || undefined,
      category: tire.category || undefined,
    });

    // Build recommendation
    const recommendation: RecommendedTire = {
      sku: tire.sku,
      brand: tire.brand,
      model: tire.model,
      displayName: `${tire.brand} ${tire.model}`,
      size: tire.size,
      imageUrl: tire.imageUrl || null,
      unitPrice: price,
      setPrice: price * 4,
      reason,
      reasonType,
      inStock: stock >= 4,
      confidence,
      source: tire.source,
    };

    // If staggered, find matching rear tire
    if (staggered && rearSize) {
      const rearSearchUrl = new URL("/api/tires/search", origin);
      rearSearchUrl.searchParams.set("size", rearSize);
      rearSearchUrl.searchParams.set("brand", tire.brand);
      rearSearchUrl.searchParams.set("model", tire.model);
      rearSearchUrl.searchParams.set("limit", "5");

      try {
        const rearRes = await fetch(rearSearchUrl.toString());
        if (rearRes.ok) {
          const rearData = await rearRes.json();
          const rearTires = rearData.results || [];
          const matchingRear = rearTires.find((rt: TireCandidate) => 
            rt.brand.toLowerCase() === tire.brand.toLowerCase() &&
            rt.model.toLowerCase() === tire.model.toLowerCase()
          );
          
          if (matchingRear) {
            const rearPrice = getDisplayPrice(matchingRear);
            recommendation.rearSku = matchingRear.sku;
            recommendation.rearSize = matchingRear.size;
            // For staggered: 2 front + 2 rear
            if (rearPrice) {
              recommendation.setPrice = (price * 2) + (rearPrice * 2);
            }
          }
        }
      } catch (e) {
        console.warn("[tire-for-wheels] Rear tire lookup failed:", e);
      }
    }

    // Build fallback options if confidence is low
    let fallbackOptions: RecommendedTire[] | undefined;
    if (confidence === "low" && scoredCandidates.length > 1) {
      fallbackOptions = scoredCandidates.slice(1, 3).map(({ tire: t, price: p }) => ({
        sku: t.sku,
        brand: t.brand,
        model: t.model,
        displayName: `${t.brand} ${t.model}`,
        size: t.size,
        imageUrl: t.imageUrl || null,
        unitPrice: p,
        setPrice: p * 4,
        reason: "Alternative option",
        reasonType: "allAround",
        inStock: getStockLevel(t) >= 4,
        confidence: "low" as const,
        source: t.source,
      }));
    }

    return NextResponse.json({
      ok: true,
      recommendation,
      fallbackOptions,
      tireSize: primarySize,
      rearTireSize: rearSize,
      vehicleLabel,
      vehicleType: vehicleProfile.type,
    });

  } catch (e: any) {
    console.error("[tire-for-wheels] Error:", e);
    return NextResponse.json(
      { ok: false, error: e?.message || String(e) },
      { status: 500 }
    );
  }
}

/**
 * Generate common tire sizes for a given wheel diameter
 */
function generateCommonTireSizes(diameter: number): string[] {
  const sizes: string[] = [];
  
  // Common aspect ratios and widths by diameter
  const sizeMap: Record<number, string[]> = {
    16: ["205/55R16", "215/60R16", "225/60R16", "215/55R16"],
    17: ["225/45R17", "225/50R17", "235/55R17", "215/45R17", "225/55R17"],
    18: ["235/45R18", "245/45R18", "235/50R18", "225/45R18", "255/55R18"],
    19: ["245/40R19", "255/40R19", "245/45R19", "235/40R19", "255/45R19"],
    20: ["275/45R20", "255/45R20", "275/40R20", "265/50R20", "285/50R20"],
    21: ["275/40R21", "285/40R21", "265/40R21", "295/35R21"],
    22: ["285/45R22", "305/40R22", "275/45R22", "305/45R22", "285/40R22"],
    24: ["305/35R24", "295/35R24", "285/40R24"],
  };

  return sizeMap[diameter] || [`275/45R${diameter}`, `255/45R${diameter}`];
}
